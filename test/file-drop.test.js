import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DRAFT_KEY } from '../src/documents.js';

test('dropping files uses the editor open flow, protecting drafts and ignoring stale reads', async () => {
  const doc = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(doc, { url:'https://tiny.example/', pretendToBeVisual:true });
  const {window} = dom;
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => new window.DOMRect();
  const globals = ['Window','window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved = new Map(globals.map(k=>[k, globalThis[k]]));
  for (const key of globals) globalThis[key] = key.endsWith('AnimationFrame') ? window[key].bind(window) : window[key];
  window.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}});
  let replace = false;
  window.confirm = () => replace;
  const original = {text:'Original draft',name:'original.md',dirty:true};
  window.localStorage.setItem(DRAFT_KEY,JSON.stringify(original));
  try {
    await import('../src/main.js');
    const editor = window.document.querySelector('.cm-content');
    const hint = window.document.querySelector('#drop-hint');
    const filename = () => window.document.querySelector('#filename').textContent;
    const status = () => window.document.querySelector('#status').textContent;
    const draft = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY));
    const emit = (type, files=[], types=['Files']) => {
      const event = new window.Event(type,{bubbles:true,cancelable:true});
      event.dataTransfer = {files,types,getData(){return '';}};
      editor.dispatchEvent(event);
      return event;
    };
    const bytes = text => new TextEncoder().encode(text);
    const file = (name,text) => ({name,size:bytes(text).length,arrayBuffer:async()=>bytes(text)});
    const flush = () => new Promise(resolve=>setImmediate(resolve));
    const drag = emit('dragover'); // The OS has not exposed the files yet.
    assert.equal(drag.defaultPrevented,true);
    assert.equal(drag.dataTransfer.dropEffect,'copy');
    assert.equal(hint.hidden,false);
    emit('dragleave');
    assert.equal(hint.hidden,true);
    assert.equal(emit('drop',[],['text/plain']).defaultPrevented,false);
    const valid = file('visit.md','# 한글');
    let reachedEditor = false;
    editor.addEventListener('drop',()=>{ reachedEditor=true; });
    assert.equal(emit('drop',[valid]).defaultPrevented,true);
    assert.equal(reachedEditor,false);
    await flush();
    assert.equal(filename(),'original.md *');
    assert.deepEqual(draft(),original);
    replace = true;
    emit('drop',[valid,valid]);
    assert.match(status(),/one Markdown/);
    emit('drop',[file('invalid.md','hello\u0000')]);
    await flush();
    assert.match(status(),/plain-text Markdown/);
    assert.deepEqual(draft(),original);

    let finishFirst;
    emit('drop',[{name:'stale.md',size:3,arrayBuffer:()=>new Promise(resolve=>{finishFirst=resolve;})}]);
    emit('drop',[valid]);
    await flush();
    finishFirst(bytes('old'));
    await flush();
    assert.equal(filename(),'visit.md');
    assert.deepEqual(draft(),{name:'visit.md',text:'# 한글',dirty:false});
    assert.match(window.document.querySelector('.cm-content').textContent,/한글/);
    assert.equal(hint.hidden,true);
  } finally {
    dom.window.close();
    for (const [key,value] of saved) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

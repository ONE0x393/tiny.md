import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DRAFT_KEY } from '../src/documents.js';

test('inline rename preserves contents, persists the draft name, and changes the save name', async () => {
  const doc = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(doc, { url:'https://tiny.example/', pretendToBeVisual:true });
  const {window} = dom;
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => new window.DOMRect();
  const globals = ['Window','window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved = new Map(globals.map(k=>[k, globalThis[k]]));
  for (const key of globals) globalThis[key] = key.endsWith('AnimationFrame') ? window[key].bind(window) : window[key];
  window.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}});
  window.localStorage.setItem(DRAFT_KEY,JSON.stringify({text:'Draft body',name:'original.md',dirty:false}));
  let downloaded;
  window.HTMLAnchorElement.prototype.click = function(){downloaded=this.download;};
  try {
    await import('../src/main.js');
    const filename = window.document.querySelector('#filename');
    const input = window.document.querySelector('#filename-input');
    const key = (key,options={}) => input.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
    const draft = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY));
    filename.click();
    assert.equal(input.hidden,false);
    assert.equal(window.document.activeElement,input);
    assert.equal(input.selectionEnd,'original'.length);
    input.value = 'discard';
    key('Escape');
    assert.equal(filename.textContent,'original.md');
    assert.equal(draft().name,'original.md');
    assert.equal(window.document.activeElement,filename);
    filename.click();
    input.value = '회의 기록';
    key('Enter',{isComposing:true});
    assert.equal(input.hidden,false);
    key('Enter');
    assert.equal(filename.textContent,'회의 기록.md *');
    assert.deepEqual(draft(),{name:'회의 기록.md',text:'Draft body',dirty:true});
    assert.equal(window.document.title,'회의 기록.md — tiny.md');
    filename.click();
    input.value = '발표 자료.markdown';
    key('s',{ctrlKey:true});
    assert.equal(downloaded,'발표 자료.markdown');
    assert.deepEqual(draft(),{name:'발표 자료.markdown',text:'Draft body',dirty:false});
    assert.equal(filename.textContent,'발표 자료.markdown');
  } finally {
    dom.window.close();
    for (const [key,value] of saved) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

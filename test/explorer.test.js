import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { fromFolderPicker, fromDroppedFolder } from '../src/explorer.js';
import { DRAFT_KEY } from '../src/documents.js';

test('folder picker and drops open nested files safely without reading their contents during indexing', async () => {
  const doc = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(doc, { url:'https://tiny.example/', pretendToBeVisual:true });
  const {window} = dom;
  window.Range.prototype.getClientRects = () => [];
  window.Range.prototype.getBoundingClientRect = () => new window.DOMRect();
  const globals = ['Window','window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved = new Map(globals.map(k=>[k, globalThis[k]]));
  for (const key of globals) globalThis[key] = key.endsWith('AnimationFrame') ? window[key].bind(window) : window[key];
  window.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}});
  let approve = false;
  let confirms = 0;
  window.confirm = () => { confirms++; return approve; };
  const original = {text:'Unsaved draft',name:'original.md',dirty:true};
  window.localStorage.setItem(DRAFT_KEY,JSON.stringify(original));
  try {
    await import('../src/main.js');
    const $ = selector => window.document.querySelector(selector);
    const draft = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY));
    const flush = () => new Promise(resolve => setImmediate(resolve));
    const input = $('#folder-input');
    const openPicker = files => {
      Object.defineProperty(input,'files',{value:files,configurable:true});
      input.dispatchEvent(new window.Event('change',{bubbles:true}));
    };
    const file = (path,body) => {
      const buffer = new TextEncoder().encode(body);
      return {name:path.split('/').at(-1),webkitRelativePath:path,size:buffer.length,arrayBuffer:async()=>buffer};
    };
    const dropFolder = entry => {
      const event = new window.Event('drop',{bubbles:true,cancelable:true});
      event.dataTransfer = {types:['Files'], files:[],items:[{kind:'file',webkitGetAsEntry:()=>entry}]};
      $('.cm-content').dispatchEvent(event);
      assert.equal(event.defaultPrevented,true);
    };
    const panel = $('#explorer-panel');
    const toggle = $('#explorer-toggle');
    assert.equal(panel.hidden,false);
    assert.equal(toggle.getAttribute('aria-expanded'),'true');
    const workspace = $('.workspace');
    const editor = $('#editor');
    toggle.click();
    assert.equal(panel.hidden,true);
    assert.equal(workspace.classList.contains('has-panel'),false);
    assert.strictEqual($('#editor'),editor);
    toggle.click();
    assert.equal(panel.hidden,false);
    $('#outline-toggle').click();
    assert.equal(panel.hidden,true);
    assert.equal($('#outline-panel').hidden,false);
    toggle.click();
    assert.equal(panel.hidden,false);
    assert.equal($('#outline-panel').hidden,true);
    let pickerClicked = false;
    input.click = () => { pickerClicked = true; };
    $('#open-folder').click();
    assert.equal(pickerClicked,true);
    openPicker([file('project/notes/today.md','오늘'),file('project/logo.png','binary')]);
    assert.equal($('#folder-name').textContent,'project');
    assert.equal($('#folder-files summary').textContent,'notes');
    assert.doesNotMatch($('#folder-files').textContent,/logo/);
    assert.equal(confirms,0); // Browsing alone never replaces the editor.
    $('#folder-files summary').click();
    assert.equal($('#folder-files details').open,true);
    $('#folder-files button').click();
    await flush();
    assert.deepEqual(draft(),original);
    assert.equal(confirms,1);
    approve = true;
    $('#folder-files button').click();
    await flush();
    assert.deepEqual(draft(),{text:'오늘',name:'today.md',dirty:false});

    let release;
    dropFolder({name:'Stale',isDirectory:true,createReader:()=>({readEntries:resolve=>{release=resolve;}})});
    openPicker([file('New/current.md','current')]);
    release([]);
    await flush();
    assert.equal($('#folder-name').textContent,'New');

    let reads = 0;
    let contents = 0;
    dropFolder({name:'Dropped',isDirectory:true,createReader:()=>({readEntries(resolve){
      reads++;
      if (reads === 1) resolve([{name:'a.jpg',isFile:true}]);
      else if (reads === 2) resolve([{name:'readme.markdown',isFile:true,file(resolve){
        contents++;
        resolve(file('readme.markdown','New text'));
      }}]);
      else resolve([]);
    }})});
    await flush();
    assert.equal(reads,3);
    assert.equal(contents,0);
    assert.equal($('#folder-name').textContent,'Dropped');
    assert.deepEqual([...$('#folder-files').querySelectorAll('button')].map(button=>button.textContent),['readme.markdown']);
    $('#folder-files button').click();
    await flush();
    assert.equal(contents,1);
    assert.deepEqual(draft(),{text:'New text',name:'readme.markdown',dirty:false});
  } finally {
    dom.window.close();
    for (const [key,value] of saved) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('folder entry limits also count filtered-out files', async () => {
  const entries = Array.from({length:5001},(_,i)=>({name:i+'.png',isFile:true}));
  assert.throws(()=>fromFolderPicker(entries),/smaller subfolder/);
  await assert.rejects(fromDroppedFolder({
    name:'Large',isDirectory:true,createReader:()=>({readEntries:resolve=>resolve(entries)})
  }),/smaller subfolder/);
});

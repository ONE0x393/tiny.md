import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { liveMode, liveStyling, setLiveMode } from '../src/live.js';
import { liveTables } from '../src/tables.js';

test('GFM tables render structurally, preserve blank and escaped cells, and reveal source for editing', () => {
  const dom = new JSDOM('<main id="editor"></main>',{pretendToBeVisual:true});
  const saved = new Map(['Window','window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  for (const key of saved.keys()) {
    globalThis[key] = key.endsWith('AnimationFrame') ? dom.window[key].bind(dom.window) : dom.window[key];
  }
  let view;
  try {
    const input = 'Intro\n\n| Left | Middle | Right |\n| :--- | :---: | ---: |\n| **bold** || a \\| b |\n| `code` | <img src=x onerror=alert(1)> | [link](javascript:alert(1)) |\n| one |\n\nEnd';
    view = new EditorView({parent:document.querySelector('#editor'),state:EditorState.create({
      doc:input, extensions:[markdown({extensions:GFM}),liveMode,liveStyling,liveTables(liveMode)]
    })});
    const table = () => view.contentDOM.querySelector('table');
    assert.deepEqual([...table().querySelectorAll('th')].map(x=>[x.textContent,x.style.textAlign]),[['Left','left'],['Middle','center'],['Right','right']]);
    assert.deepEqual([...table().tBodies[0].rows[0].cells].map(x=>x.textContent),['bold','','a | b']);
    assert.equal(table().querySelector('strong').textContent,'bold');
    assert.equal(table().querySelector('code').textContent,'code');
    assert.equal(table().querySelector('img,a'),null);
    assert.match(table().textContent,/<img src=x/);
    assert.equal(table().tBodies[0].rows[2].cells.length,3);
    table().tBodies[0].rows[0].cells[0].click();
    assert.equal(view.state.selection.main.head,input.indexOf('**bold**'));
    assert.equal(table(),null);
    assert.equal(view.state.doc.toString(),input);
    view.dispatch({selection:{anchor:0}});
    assert.ok(table());
    view.dispatch({effects:setLiveMode.of(false)});
    assert.equal(table(),null);
    assert.match(view.contentDOM.textContent,/\| :--- \| :---: \| ---: \|/);
    view.dispatch({effects:setLiveMode.of(true)});
    assert.ok(table());
  } finally {
    view?.destroy();
    dom.window.close();
    for (const [k,v] of saved) { if (v===undefined) delete globalThis[k]; else globalThis[k]=v; }
  }
});

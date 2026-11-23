import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { liveMode, liveStyling, setLiveMode, selectionTouchesLine } from '../src/live.js';

test('a cursor reveals its own line; an adjacent half-open selection does not', () => {
  const state = EditorState.create({doc:'first\nsecond',selection:{anchor:0,head:6}});
  assert.equal(selectionTouchesLine(state,state.doc.line(1)),true);
  assert.equal(selectionTouchesLine(state,state.doc.line(2)),false);
});

test('editor reveals live markers without rewriting Markdown or its selection', () => {
  const dom = new JSDOM('<main id="editor"></main>',{ pretendToBeVisual:true });
  const saved = new Map(['window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  for (const key of saved.keys()) {
    globalThis[key] = typeof dom.window[key] === 'function' && key.endsWith('AnimationFrame') ? dom.window[key].bind(dom.window) : dom.window[key];
  }
  let view;
  try {
    const input = '# 한글 test\n\nNormal **bold** and *italic*\n\n> quote\n\n[Example](https://example.invalid)\n\n---\n';
    view = new EditorView({
      parent:document.querySelector('#editor'),
      state:EditorState.create({doc:input,extensions:[markdown({extensions:GFM}),liveMode,liveStyling]})
    });
    const bold = () => view.contentDOM.querySelector('.md-strong');
    const line = selector => view.contentDOM.querySelector(selector);
    assert.equal(line('.md-h1').textContent,'# 한글 test');
    assert.equal(bold().textContent,'bold');
    assert.equal(line('.md-link').textContent,'Example');
    assert.equal(line('.md-quote').textContent,'quote');
    const anchor = input.indexOf('bold') + 1;
    view.dispatch({selection:{anchor}});
    assert.equal(line('.md-h1').textContent,'한글 test');
    assert.equal(bold(),null);
    assert.match(view.contentDOM.textContent,/\*\*bold\*\*/);
    view.dispatch({effects:setLiveMode.of(false)});
    assert.equal(line('.md-h1'),null);
    assert.match(view.contentDOM.textContent,/\[Example\]\(https:\/\/example.invalid\)/);
    assert.equal(view.state.selection.main.anchor,anchor);
    assert.equal(view.state.doc.toString(),input);
  } finally {
    view?.destroy();
    dom.window.close();
    for (const [k,v] of saved) { if (v===undefined) delete globalThis[k]; else globalThis[k]=v; }
  }
});

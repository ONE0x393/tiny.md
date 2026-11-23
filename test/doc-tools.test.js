import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { getOutline, wrapSelection } from '../src/doc-tools.js';

test('outline finds ATX and setext headings, excluding fenced-code headings',()=>{
  const state = EditorState.create({doc:'# First\n\nSecond\n---\n\n```md\n# Not a heading\n```\n\n### Third ##',extensions:[markdown()]});
  assert.deepEqual(getOutline(state).map(({level,title})=>[level,title]),[[1,'First'],[2,'Second'],[3,'Third']]);
});

test('wrap and unwrap a selection; typing can continue inside paired markers',()=>{
  const range = {anchor:0,head:5};
  const view = {state:EditorState.create({doc:'hello!',selection:range}),dispatch(spec){this.state=this.state.update(spec).state;}};
  assert.equal(wrapSelection(view,'**'),true);
  assert.equal(view.state.doc.toString(),'**hello**!');
  assert.deepEqual([view.state.selection.main.from,view.state.selection.main.to],[2,7]);
  wrapSelection(view,'**');
  assert.equal(view.state.doc.toString(),'hello!');
  view.dispatch({selection:{anchor:6}});
  wrapSelection(view,'`');
  assert.equal(view.state.doc.toString(),'hello!``');
  assert.equal(view.state.selection.main.head,7);
});

test('italic can nest inside existing bold without removing it',()=>{
  const view = {state:EditorState.create({doc:'**foo**',selection:{anchor:2,head:5}}),dispatch(spec){this.state=this.state.update(spec).state;}};
  wrapSelection(view,'*');
  assert.equal(view.state.doc.toString(),'***foo***');
});

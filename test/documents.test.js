import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY, MAX_BYTES, downloadName, getDraft, putDraft, readDocument } from '../src/documents.js';

test('converts plain-text names to safe Markdown downloads',()=>{
  assert.equal(downloadName('새 문서.txt'),'새 문서.md');
  assert.equal(downloadName('guide.markdown'),'guide.markdown');
  assert.equal(downloadName('unsafe/name'),'unsafe-name.md');
  assert.equal(downloadName('..'),'Untitled.md');
  const long = downloadName('한글'.repeat(160) + '.markdown');
  assert.match(long,/\.markdown$/);
  assert.ok(new TextEncoder().encode(long).length <= 240);
  assert.equal(downloadName(long),long);
});

test('restores an empty edited draft without substituting the example',()=>{
  const memory = new Map();
  const storage = {getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  assert.equal(getDraft(storage),null);
  const draft = {text:'',name:'work.md',dirty:true};
  assert.equal(putDraft(storage,draft),true);
  assert.deepEqual(getDraft(storage),draft);
  memory.set(DRAFT_KEY,'not JSON');
  assert.equal(getDraft(storage),null);
  assert.equal(putDraft({setItem(){throw Error('quota');}},draft),false);
});

test('loads UTF-8 Markdown as text; refuses binary, invalid UTF-8 and oversized files',async()=>{
  const bytes = values => new Uint8Array(values).buffer;
  assert.deepEqual(await readDocument(new File(['# 가나다\r\n'],'note.txt')),{text:'# 가나다\r\n',name:'note.md',dirty:false});
  await assert.rejects(readDocument(new File([bytes([0])],'binary.md')),/plain-text/);
  await assert.rejects(readDocument(new File([bytes([0xff])],'binary.md')),/UTF-8/);
  await assert.rejects(readDocument({size:MAX_BYTES+1}),/5 MB/);
});

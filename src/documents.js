export const DRAFT_KEY = 'tiny-md.draft.v1';
export const MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_FILENAME = 'Untitled.md';

export function downloadName(name = DEFAULT_FILENAME) {
  const clean = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 150);
  if (!clean || clean === '.' || clean === '..') return DEFAULT_FILENAME;
  return /\.(md|markdown|mdown|mkd)$/iu.test(clean) ? clean : clean.replace(/\.txt$/iu, '') + '.md';
}

export function getDraft(storage) {
  try {
    const value = JSON.parse(storage.getItem(DRAFT_KEY));
    if (typeof value?.text !== 'string' || typeof value.name !== 'string') return null;
    return {text: value.text, name: downloadName(value.name), dirty: value.dirty === true};
  } catch { return null; }
}

export function putDraft(storage, draft) {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export async function readDocument(file) {
  if (!file || file.size > MAX_BYTES) throw new Error('Choose a text file up to 5 MB.');
  let text;
  try {
    text = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer());
  } catch {
    throw new Error('This file could not be read as UTF-8 text.');
  }
  if (text.includes('\u0000')) throw new Error('Choose a plain-text Markdown file.');
  return {text,name:downloadName(file.name),dirty:false};
}

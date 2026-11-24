import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { GFM } from '@lezer/markdown';
import { liveMode, liveStyling, setLiveMode } from './live.js';
import { DEFAULT_FILENAME, downloadName, getDraft, putDraft, readDocument } from './documents.js';
import { getOutline, wrapSelection, jumpToHeading } from './doc-tools.js';
import { bindFileDrop } from './file-drop.js';
import { liveTables } from './tables.js';
import { fromDroppedFolder, fromFolderPicker, renderFolder } from './explorer.js';

const sample = '# The quiet part of writing\n\nA place for ideas, drafts, and things worth keeping. Write in **Markdown** and see it take shape as you go.\n\n## Try it out\n\n- Edit any line to reveal its Markdown markers.\n- Switch to Source to work with the raw file.\n\n> The best editor disappears when you start writing.\n\n';
const live = document.querySelector('#live-mode');
const source = document.querySelector('#source-mode');
const metrics = document.querySelector('#metrics');
const status = document.querySelector('#status');
const filename = document.querySelector('#filename');
const filenameInput = document.querySelector('#filename-input');
const outline = document.querySelector('#outline-panel');
const outlineLinks = document.querySelector('#outline-links');
const outlineToggle = document.querySelector('#outline-toggle');
const fileInput = document.querySelector('#file-input');
const explorer = document.querySelector('#explorer-panel');
const explorerToggle = document.querySelector('#explorer-toggle');
const folderInput = document.querySelector('#folder-input');
const folderName = document.querySelector('#folder-name');
const folderFiles = document.querySelector('#folder-files');
let folderGeneration = 0;
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const initial = getDraft(storage) ?? {text:sample,name:DEFAULT_FILENAME,dirty:false};
let documentName = initial.name;
let dirty = initial.dirty;
let generation = 0;
let revision = 0;
let saveTimer;
let openRevision = 0;

function setMessage(message) { if (status.textContent !== message) status.textContent = message; }
function persist() {
  window.clearTimeout(saveTimer);
  const ok = putDraft(storage,{text:view.state.doc.toString(),name:documentName,dirty});
  setMessage(ok ? 'Draft stored on this device' : 'Draft could not be stored locally. Save to keep a copy.');
}
function renderStatus(state) {
  const doc = state.doc.toString();
  const words = doc.trim() ? doc.trim().match(/\S+/gu).length : 0;
  metrics.textContent = words.toLocaleString() + (words === 1 ? ' word' : ' words') + '  /  ' + state.doc.lines + (state.doc.lines === 1 ? ' line' : ' lines');
  filename.textContent = documentName + (dirty ? ' *' : '');
  filename.title = 'Rename ' + documentName + (dirty ? ' (changes not exported)' : '');
  filename.setAttribute('aria-label', filename.title);
  document.title = documentName + ' — tiny.md';
}
function renderOutline(state) {
  if (outline.hidden) return;
  const entries = getOutline(state);
  const list = document.createDocumentFragment();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Headings appear here.';
    list.append(empty);
  }
  for (const {level,title,from} of entries) {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = title;
    item.style.setProperty('--depth', String(level - 1));
    item.addEventListener('click', () => jumpToHeading(view,from));
    list.append(item);
  }
  outlineLinks.replaceChildren(list);
}

const tableStyling = liveTables(liveMode);
function makeState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      history(), drawSelection(), dropCursor(), highlightSpecialChars(),
      markdown({extensions: GFM, addKeymap:false}), liveMode, liveStyling, tableStyling,
      keymap.of([
        {key:'Mod-b',run:view=>wrapSelection(view,'**')},
        {key:'Mod-i',run:view=>wrapSelection(view,'*')},
        ...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({'aria-label':'Markdown document', spellcheck:'true'}),
      EditorView.updateListener.of(update => {
        if (update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) renderOutline(update.state);
        if (!update.docChanged) return;
        revision++;
        dirty = true;
        renderStatus(update.state);
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persist,180);
      })
    ]
  });
}
const view = new EditorView({parent:document.querySelector('#editor'),state:makeState(initial.text)});
renderStatus(view.state);
setMessage(initial.dirty ? 'Draft restored from this device' : 'Markdown');
function showPanel(panel) {
  outline.hidden = panel !== outline;
  explorer.hidden = panel !== explorer;
  outlineToggle.setAttribute('aria-expanded',String(!outline.hidden));
  explorerToggle.setAttribute('aria-expanded',String(!explorer.hidden));
  document.querySelector('.workspace').classList.toggle('has-panel',!!panel);
  renderOutline(view.state);
}
outlineToggle.addEventListener('click', () => showPanel(outline.hidden ? outline : null));
explorerToggle.addEventListener('click', () => showPanel(explorer.hidden ? explorer : null));

for (const button of document.querySelectorAll('[data-mark]')) {
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('click',()=>{
    wrapSelection(view,button.dataset.mark);
    view.focus();
  });
}

function changeMode(useLive, focus = true) {
  view.dispatch({effects:setLiveMode.of(useLive)});
  live.setAttribute('aria-pressed', String(useLive));
  source.setAttribute('aria-pressed', String(!useLive));
  document.body.classList.toggle('source-mode', !useLive);
  if (focus) view.focus();
}
live.addEventListener('click', () => changeMode(true));
source.addEventListener('click', () => changeMode(false));

function finishRename(commit, restoreFocus = false) {
  if (filenameInput.hidden) return;
  const next = filenameInput.value.trim() ? downloadName(filenameInput.value) : documentName;
  filenameInput.hidden = true;
  filename.hidden = false;
  if (commit && next !== documentName) {
    documentName = next;
    revision++;
    dirty = true;
    renderStatus(view.state);
    persist();
    setMessage('Renamed to ' + documentName);
  }
  if (restoreFocus) filename.focus();
}
filename.addEventListener('click', () => {
  filenameInput.value = documentName;
  filenameInput.hidden = false;
  filename.hidden = true;
  filenameInput.focus();
  const ext = /\.(md|markdown|mdown|mkd)$/iu.exec(documentName);
  filenameInput.setSelectionRange(0, ext?.index ?? documentName.length);
});
filenameInput.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    finishRename(event.key === 'Enter', true);
  }
});
filenameInput.addEventListener('blur', () => finishRename(true));

function confirmReplace() {
  finishRename(true);
  return !dirty || window.confirm('Replace this draft? Save first if you want to keep a copy.');
}
function replaceDocument(doc) {
  generation++;
  documentName = doc.name;
  dirty = doc.dirty;
  window.clearTimeout(saveTimer);
  const useLive = live.getAttribute('aria-pressed') === 'true';
  view.setState(makeState(doc.text));
  changeMode(useLive);
  renderStatus(view.state);
  renderOutline(view.state);
  persist();
}
document.querySelector('#new-doc').addEventListener('click', () => {
  if (confirmReplace()) replaceDocument({text:'',name:DEFAULT_FILENAME,dirty:false});
});
function chooseFile() {
  if (confirmReplace()) {
    ++generation;
    openRevision = revision;
    fileInput.click();
  }
}
document.querySelector('#open-doc').addEventListener('click',chooseFile);
async function openLocalFile(source, expectedRevision) {
  const sourceGeneration = ++generation;
  try {
    const file = typeof source === 'function' ? await source() : source;
    if (sourceGeneration !== generation) return;
    const doc = await readDocument(file);
    if (sourceGeneration !== generation || (revision !== expectedRevision && !confirmReplace())) return;
    replaceDocument(doc);
  } catch (e) {
    if(sourceGeneration === generation) setMessage(e?.message || 'Could not open this file.');
  }
}
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void openLocalFile(file, openRevision);
});
function displayFolder(root) {
  folderName.textContent = root.name;
  renderFolder(folderFiles,root,load => {
    if (confirmReplace()) void openLocalFile(load,revision);
  });
  showPanel(explorer);
}
function rejectFolder(error) {
  setMessage(error?.message || 'Could not read this folder. Try Open folder.');
}
document.querySelector('#open-folder').addEventListener('click', () => folderInput.click());
folderInput.addEventListener('change', () => {
  const files = folderInput.files;
  if (files?.length) {
    ++folderGeneration;
    try { displayFolder(fromFolderPicker(files)); } catch (error) { rejectFolder(error); }
  }
  folderInput.value = '';
});
async function openDroppedFolder(entry) {
  const current = ++folderGeneration;
  try {
    const root = await fromDroppedFolder(entry,() => current === folderGeneration);
    if (current === folderGeneration) displayFolder(root);
  } catch (error) {
    if (current === folderGeneration) rejectFolder(error);
  }
}
const dropHint = document.querySelector('#drop-hint');
bindFileDrop(window, {
  openFile(file) {
    if (confirmReplace()) void openLocalFile(file, revision);
  },
  openFolder: openDroppedFolder,
  reject: setMessage,
  highlight(active) { dropHint.hidden = !active; }
});
function saveDocument() {
  finishRename(true);
  const name = downloadName(documentName);
  const url = URL.createObjectURL(new Blob([view.state.doc.toString()],{type:'text/markdown;charset=utf-8'}));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url),5000);
  }
  dirty = false;
  renderStatus(view.state);
  persist();
  setMessage('Download requested: ' + name);
}
document.querySelector('#save-doc').addEventListener('click',saveDocument);
window.addEventListener('pagehide',() => { if(dirty) persist(); });
window.addEventListener('keydown', event => {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() === 's') { event.preventDefault(); saveDocument(); }
  if (event.key.toLowerCase() === 'o') { event.preventDefault(); chooseFile(); }
});

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }
const themeKey = 'tiny-md.theme';
let themeSetting;
try { themeSetting = storage?.getItem(themeKey); } catch { /* storage may be disabled */ }
applyTheme(themeSetting === 'dark' || (themeSetting !== 'light' && systemDark.matches));
const theme = document.querySelector('#theme');
theme.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  applyTheme(dark);
  theme.setAttribute('aria-pressed',String(dark));
  try { storage?.setItem(themeKey,dark ? 'dark' : 'light'); } catch { /* no persisted preference */ }
});
theme.setAttribute('aria-pressed',String(document.documentElement.dataset.theme === 'dark'));

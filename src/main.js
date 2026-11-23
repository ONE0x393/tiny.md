import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { GFM } from '@lezer/markdown';
import { liveMode, liveStyling, setLiveMode } from './live.js';
import { DEFAULT_FILENAME, downloadName, getDraft, putDraft, readDocument } from './documents.js';
import { getOutline, wrapSelection, jumpToHeading } from './doc-tools.js';
import './style.css';

const sample = '# The quiet part of writing\n\nA place for ideas, drafts, and things worth keeping. Write in **Markdown** and see it take shape as you go.\n\n## Try it out\n\n- Edit any line to reveal its Markdown markers.\n- Switch to Source to work with the raw file.\n\n> The best editor disappears when you start writing.\n\n';
const live = document.querySelector('#live-mode');
const source = document.querySelector('#source-mode');
const metrics = document.querySelector('#metrics');
const status = document.querySelector('#status');
const filename = document.querySelector('#filename');
const outline = document.querySelector('#outline-panel');
const outlineLinks = document.querySelector('#outline-links');
const outlineToggle = document.querySelector('#outline-toggle');
const fileInput = document.querySelector('#file-input');
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
  filename.title = dirty ? 'Changes not exported' : 'Document name';
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

function makeState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      history(), drawSelection(), dropCursor(), highlightSpecialChars(),
      markdown({extensions: GFM, addKeymap:false}), liveMode, liveStyling,
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
outlineToggle.addEventListener('click', () => {
  outline.hidden = !outline.hidden;
  outlineToggle.setAttribute('aria-expanded',String(!outline.hidden));
  document.querySelector('.workspace').classList.toggle('with-outline',!outline.hidden);
  renderOutline(view.state);
});
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

function confirmReplace() {
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
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  const sourceGeneration = ++generation;
  const expectedRevision = openRevision;
  try {
    const doc = await readDocument(file);
    if (sourceGeneration !== generation || (revision !== expectedRevision && !confirmReplace())) return;
    replaceDocument(doc);
  } catch (e) {
    if(sourceGeneration === generation) setMessage(e.message);
  }
});
function saveDocument() {
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

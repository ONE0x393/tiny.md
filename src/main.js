import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { liveMode, liveStyling, setLiveMode } from './live.js';
import './style.css';

const initial = '# The quiet part of writing\n\nA place for ideas, drafts, and things worth keeping. Write in **Markdown** and see it take shape as you go.\n\n## Try it out\n\n- Edit any line to reveal its Markdown markers.\n- Switch to Source to work with the raw file.\n\n> The best editor disappears when you start writing.\n\n';
const live = document.querySelector('#live-mode');
const source = document.querySelector('#source-mode');
const metrics = document.querySelector('#metrics');
const status = document.querySelector('#status');

function renderStatus(state) {
  const doc = state.doc.toString();
  const words = doc.trim() ? doc.trim().match(/\S+/gu).length : 0;
  metrics.textContent = words.toLocaleString() + (words === 1 ? ' word' : ' words') + '  /  ' + state.doc.lines + (state.doc.lines === 1 ? ' line' : ' lines');
}
const view = new EditorView({
  parent: document.querySelector('#editor'),
  state: EditorState.create({
    doc: initial,
    extensions: [
      history(), drawSelection(), dropCursor(), highlightSpecialChars(),
      markdown({extensions: GFM, addKeymap:false}), liveMode, liveStyling,
      keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({'aria-label':'Markdown document', spellcheck:'true'}),
      EditorView.updateListener.of(update => { if(update.docChanged) renderStatus(update.state); })
    ]
  })
});
renderStatus(view.state);

function changeMode(useLive) {
  view.dispatch({effects:setLiveMode.of(useLive)});
  live.setAttribute('aria-pressed', String(useLive));
  source.setAttribute('aria-pressed', String(!useLive));
  document.body.classList.toggle('source-mode', !useLive);
  status.textContent = useLive ? 'Markdown' : 'Source mode';
  view.focus();
}
live.addEventListener('click', () => changeMode(true));
source.addEventListener('click', () => changeMode(false));

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }
applyTheme(systemDark.matches);
document.querySelector('#theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme !== 'dark'));

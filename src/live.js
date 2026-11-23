import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';

export const setLiveMode = StateEffect.define();
export const liveMode = StateField.define({
  create: () => true,
  update: (active, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setLiveMode)) active = effect.value;
    }
    return active;
  }
});

const heading = /^ATXHeading([1-6])$/;
const setext = /^SetextHeading([12])$/;
const inlineStyles = {
  Emphasis: 'emphasis', StrongEmphasis: 'strong', InlineCode: 'code',
  Strikethrough: 'strike', Link: 'link', Autolink: 'link'
};
const punctuation = new Set(['EmphasisMark', 'CodeMark', 'HeaderMark', 'QuoteMark', 'StrikethroughMark']);
const lineStyles = {
  Blockquote: 'quote', FencedCode: 'fence', CodeBlock: 'fence',
  ListItem: 'list-item', HorizontalRule: 'rule', Table: 'table',
  TableHeader: 'table-head', TableDelimiter: 'table-delimiter'
};

export function selectionTouchesLine(state, line) {
  return state.selection.ranges.some(({from, to}) => {
    if (from === to) return from >= line.from && from <= line.to;
    // Selection ranges are half-open. A selected newline still reveals its line.
    return from <= line.to && to > line.from;
  });
}

function makeDecorations(view) {
  const state = view.state;
  const builder = new RangeSetBuilder();
  if (!state.field(liveMode)) return builder.finish();

  const ranges = [];
  const lines = new Map();
  const visited = new Set();
  const conceal = Decoration.replace({});
  for (const {from, to} of view.visibleRanges) {
    syntaxTree(state).iterate({from, to, enter(node) {
      const key = node.name + ':' + node.from + ':' + node.to;
      if (visited.has(key)) return;
      visited.add(key);
      const head = heading.exec(node.name) ?? setext.exec(node.name);
      const lineStyle = head ? 'h' + head[1] : lineStyles[node.name];
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(Math.max(node.from, node.to - 1));
      if (lineStyle) {
        const fromLine = Math.max(first.number, state.doc.lineAt(from).number);
        const toLine = Math.min(last.number, state.doc.lineAt(to).number);
        for (let i = fromLine; i <= toLine; i++) {
          const line = state.doc.line(i);
          let classes = lines.get(line.from);
          if (!classes) lines.set(line.from, classes = new Set());
          classes.add(lineStyle);
          if (selectionTouchesLine(state, line)) classes.add('active');
        }
        if (node.name === 'HorizontalRule' && !selectionTouchesLine(state, first)) {
          ranges.push({from:node.from,to:node.to,decoration:conceal});
        }
      }
      const inline = inlineStyles[node.name];
      if (inline && !selectionTouchesLine(state, first) && node.to > node.from) {
        ranges.push({from:node.from,to:node.to,decoration:Decoration.mark({class:'md-' + inline})});
      }
      if (punctuation.has(node.name) && node.to <= first.to && !selectionTouchesLine(state, first) && node.to > node.from) {
        let end = node.to;
        if (node.name === 'HeaderMark' || node.name === 'QuoteMark') {
          if (state.sliceDoc(end, Math.min(end + 1, first.to)) === ' ') end++;
        }
        ranges.push({from:node.from,to:end,decoration:conceal});
      }
      if (node.name === 'Link' && first.number === last.number && !selectionTouchesLine(state, first)) {
        const marks = node.node.getChildren('LinkMark');
        const firstMark = marks[0], labelEnd = marks[1];
        if (firstMark && labelEnd && state.sliceDoc(firstMark.from,firstMark.to)==='[' && state.sliceDoc(labelEnd.from,labelEnd.to)===']') {
          ranges.push({from:firstMark.from,to:firstMark.to,decoration:conceal});
          ranges.push({from:labelEnd.from,to:node.to,decoration:conceal});
        }
      }
    }});
  }
  for (const [from, classes] of lines) ranges.push({
    from, to:from, decoration:Decoration.line({class:[...classes].map(i=>'md-'+i).join(' ')})
  });
  ranges.sort((a, b) => a.from - b.from || a.decoration.startSide - b.decoration.startSide || b.to - a.to);
  for (const {from,to,decoration} of ranges) builder.add(from,to,decoration);
  return builder.finish();
}

export const liveStyling = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = makeDecorations(view); }
  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged ||
        update.startState.field(liveMode) !== update.state.field(liveMode) ||
        syntaxTree(update.startState) !== syntaxTree(update.state)) {
      this.decorations = makeDecorations(update.view);
    }
  }
}, { decorations: p => p.decorations });

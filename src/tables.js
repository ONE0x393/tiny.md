import { syntaxTree } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';

const inlineTags = {Emphasis:'em', StrongEmphasis:'strong', Strikethrough:'s', InlineCode:'code'};
const inlineMarks = new Set(['EmphasisMark','StrikethroughMark','CodeMark']);

function renderInline(doc, parent, state, node) {
  const source = state.sliceDoc(node.from,node.to);
  if (inlineMarks.has(node.name)) return;
  if (node.name === 'Escape') {
    parent.append(source.slice(1));
    return;
  }
  if (node.name === 'Link' || node.name === 'Image') {
    const [open, close] = node.getChildren('LinkMark');
    if (open && close && state.sliceDoc(close.from,close.to) === ']') {
      const label = doc.createElement(node.name === 'Link' ? 'span' : 'em');
      label.className = 'md-table-label';
      renderChildren(doc,label,state,node,open.to,close.from);
      parent.append(label);
      return;
    }
  }
  const tag = inlineTags[node.name];
  if (tag) {
    const element = doc.createElement(tag);
    if (tag === 'code') {
      const [start,end] = node.getChildren('CodeMark');
      let code = start && end ? state.sliceDoc(start.to,end.from) : source;
      code = code.replace(/\\\|/g,'|');
      if (/^ .* $/.test(code) && code.trim()) code = code.slice(1,-1);
      element.textContent = code;
    } else renderChildren(doc,element,state,node);
    parent.append(element);
    return;
  }
  parent.append(source);
}

function renderChildren(doc, parent, state, node, from = node.from, to = node.to) {
  let pos = from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from < from || child.to > to) continue;
    parent.append(state.sliceDoc(pos,child.from));
    renderInline(doc,parent,state,child);
    pos = child.to;
  }
  parent.append(state.sliceDoc(pos,to));
}

function columns(state,row) {
  const separators = row.getChildren('TableDelimiter');
  const first = separators[0], last = separators.at(-1);
  const leading = first && !state.sliceDoc(row.from,first.from).trim();
  const trailing = last && !state.sliceDoc(last.to,row.to).trim();
  const internal = separators.slice(leading ? 1 : 0,separators.length-(trailing ? 1 : 0));
  const result = new Array(internal.length+1).fill(null);
  let index = 0;
  for (const cell of row.getChildren('TableCell')) {
    while (index < internal.length && internal[index].to <= cell.from) index++;
    result[index] = cell;
  }
  return result;
}

class TableWidget extends WidgetType {
  constructor(state,node) {
    super();
    this.state = state;
    this.node = node;
    this.source = state.sliceDoc(node.from,node.to);
  }
  eq(other) { return this.node.from === other.node.from && this.source === other.source; }
  toDOM(view) {
    const doc = view.dom.ownerDocument;
    const wrap = doc.createElement('div');
    wrap.className = 'md-rendered-table';
    const table = doc.createElement('table');
    const {node,state} = this;
    const alignment = state.sliceDoc(node.getChild('TableDelimiter').from,node.getChild('TableDelimiter').to)
      .trim().replace(/^\||\|$/g,'').split('|').map(part => {
        const spec = part.trim();
        return spec.endsWith(':') ? (spec.startsWith(':') ? 'center' : 'right') : 'left';
      });
    const edit = from => {
      view.dispatch({selection:{anchor:from},scrollIntoView:true});
      view.focus();
    };
    const header = node.getChild('TableHeader');
    const width = columns(state,header).length;
    function row(section, source, heading) {
      const cells = columns(state,source);
      const tr = section.insertRow();
      for (let i=0; i<width; i++) {
        const element = doc.createElement(heading ? 'th' : 'td');
        if (heading) element.scope = 'col';
        element.style.textAlign = alignment[i] || 'left';
        if (cells[i]) renderChildren(doc,element,state,cells[i]);
        element.addEventListener('click', () => edit(cells[i]?.from ?? source.from));
        tr.append(element);
      }
    }
    row(table.createTHead(),header,true);
    const body = table.createTBody();
    for (const bodyRow of node.getChildren('TableRow')) row(body,bodyRow,false);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'md-table-edit';
    button.textContent = 'Edit table';
    button.addEventListener('click', () => edit(header.from));
    wrap.append(table,button);
    return wrap;
  }
}

export function liveTables(liveMode) {
  function build(state) {
    if (!state.field(liveMode)) return Decoration.none;
    const ranges = [];
    syntaxTree(state).iterate({enter(ref) {
      if (ref.name !== 'Table') return;
      const node = ref.node;
      if (node.parent?.name !== 'Document' || !node.getChild('TableHeader') || !node.getChild('TableDelimiter')) return false;
      if (!state.selection.ranges.some(({from,to}) => from <= node.to && (from === to ? to >= node.from : to > node.from))) {
        ranges.push(Decoration.replace({widget:new TableWidget(state,node),block:true}).range(node.from,node.to));
      }
      return false;
    }});
    return Decoration.set(ranges,true);
  }
  return StateField.define({
    create:build,
    update(value,tr) {
      if (tr.docChanged || tr.selection || tr.startState.field(liveMode) !== tr.state.field(liveMode) ||
          syntaxTree(tr.startState) !== syntaxTree(tr.state)) return build(tr.state);
      return value;
    },
    provide: field => EditorView.decorations.from(field)
  });
}

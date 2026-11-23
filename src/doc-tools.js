import { syntaxTree } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const headingNode = /^(?:ATXHeading|SetextHeading)([1-6])$/;
export function getOutline(state) {
  const result = [];
  syntaxTree(state).iterate({enter(node) {
    const match = headingNode.exec(node.name);
    if (!match) return;
    const first = state.doc.lineAt(node.from);
    const text = state.sliceDoc(node.from,first.to);
    const title = (node.name.startsWith("ATX") ? text.replace(/^#{1,6}(?:[ \t]+|$)/,'').replace(/[ \t]+#+[ \t]*$/,'') : text).trim();
    if (title) result.push({level:Number(match[1]),title,from:first.from});
  }});
  return result;
}

export function wrapSelection(view, marker) {
  const state = view.state;
  const spec = state.changeByRange(({from,to}) => {
    const selected = state.sliceDoc(from,to);
    if (selected && from >= marker.length &&
        state.sliceDoc(from-marker.length,from) === marker &&
        state.sliceDoc(to,to+marker.length) === marker &&
        state.sliceDoc(Math.max(0,from-marker.length-1),from-marker.length) !== marker[0] &&
        state.sliceDoc(to+marker.length,to+marker.length+1) !== marker[0]) {
      return {changes:[{from:from-marker.length,to:from},{from:to,to:to+marker.length}],range:EditorSelection.range(from-marker.length,to-marker.length)};
    }
    return {
      changes:{from,to,insert:marker+selected+marker},
      range:EditorSelection.range(from+marker.length,to+marker.length)
    };
  });
  view.dispatch({...spec,userEvent:'input.format',scrollIntoView:true});
  return true;
}

export function jumpToHeading(view, from) {
  view.dispatch({selection:{anchor:from},effects:EditorView.scrollIntoView(from,{y:'start',yMargin:24})});
  view.focus();
}

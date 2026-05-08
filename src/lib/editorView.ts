import { EditorView } from "prosemirror-view";

let currentView: EditorView | null = null;

export const getEditorView = () => currentView;
export const setEditorView = (v: EditorView | null) => {
  currentView = v;
};

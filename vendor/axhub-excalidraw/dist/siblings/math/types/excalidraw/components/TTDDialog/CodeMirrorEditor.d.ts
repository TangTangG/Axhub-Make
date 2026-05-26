import type { Theme } from "@excalidraw/element/types";
export interface CodeMirrorEditorProps {
    value: string;
    onChange: (value: string) => void;
    onKeyboardSubmit?: () => void;
    placeholder?: string;
    theme: Theme;
    errorLine?: number | null;
}
declare const CodeMirrorEditor: ({ value, onChange, onKeyboardSubmit, placeholder, theme, errorLine, }: CodeMirrorEditorProps) => import("react/jsx-runtime").JSX.Element;
export default CodeMirrorEditor;

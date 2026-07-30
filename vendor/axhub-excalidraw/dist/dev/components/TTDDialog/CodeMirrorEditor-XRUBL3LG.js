import "../../chunk-Y3BTNZQY.js";
import "../../chunk-XDFCUUT6.js";

// components/TTDDialog/CodeMirrorEditor.tsx
import { useEffect, useRef } from "react";
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
  drawSelection
} from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo
} from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// components/TTDDialog/mermaid-lang-lite.ts
import { StreamLanguage } from "@codemirror/language";
var mermaidStreamParser = StreamLanguage.define({
  token(stream) {
    if (stream.match(/^%%.*$/)) {
      return "comment";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
      return "string";
    }
    if (stream.match(
      /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|journey|gitGraph|timeline|quadrantChart|sankey|xychart)\b/i
    )) {
      return "keyword";
    }
    if (stream.match(/^(TB|TD|BT|RL|LR)\b/)) {
      return "keyword";
    }
    if (stream.match(
      /^(subgraph|end|participant|actor|loop|alt|else|opt|par|critical|break|rect|note|over|activate|deactivate|title|section|class|style|linkStyle|classDef|click)\b/i
    )) {
      return "keyword";
    }
    if (stream.match(/^[-.=<>|ox]+>/)) {
      return "operator";
    }
    if (stream.match(/^<[-.=<>|ox]+/)) {
      return "operator";
    }
    if (stream.match(/^--+|\.\.+|==+/)) {
      return "operator";
    }
    if (stream.match(/^[[\](){}|<>]/)) {
      return "bracket";
    }
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      return "variableName";
    }
    if (stream.match(/^\d+(\.\d+)?/)) {
      return "number";
    }
    if (stream.match(/^[,:;]/)) {
      return "punctuation";
    }
    if (stream.eatSpace()) {
      return null;
    }
    stream.next();
    return null;
  }
});
function mermaidLite() {
  return mermaidStreamParser;
}

// components/TTDDialog/CodeMirrorEditor.tsx
import { jsx } from "react/jsx-runtime";
var darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#1e1e1e",
      color: "#d4d4d4"
    },
    ".cm-content": { caretColor: "#fff" },
    ".cm-cursor": { borderLeftColor: "#fff" },
    ".cm-gutters": {
      backgroundColor: "#1e1e1e",
      color: "#858585",
      border: "none"
    },
    ".cm-activeLineGutter": { backgroundColor: "#2a2a2a" },
    ".cm-activeLine": { backgroundColor: "#2a2a2a" },
    ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.15)" }
  },
  { dark: true }
);
var darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#569cd6" },
  { tag: tags.string, color: "#ce9178" },
  { tag: tags.comment, color: "#6a9955" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.operator, color: "#d4d4d4" },
  { tag: tags.punctuation, color: "#d4d4d4" },
  { tag: tags.variableName, color: "#9cdcfe" },
  { tag: tags.bracket, color: "#ffd700" }
]);
var lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#1e1e1e"
  },
  ".cm-content": { caretColor: "#000" },
  ".cm-cursor": { borderLeftColor: "#000" },
  ".cm-gutters": {
    backgroundColor: "#fff",
    color: "#999",
    border: "none"
  },
  ".cm-activeLineGutter": { backgroundColor: "#e8e8e8" },
  ".cm-activeLine": { backgroundColor: "#e8e8e8" },
  ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.1)" }
});
var lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#0000ff" },
  { tag: tags.string, color: "#a31515" },
  { tag: tags.comment, color: "#008000" },
  { tag: tags.number, color: "#098658" },
  { tag: tags.operator, color: "#1e1e1e" },
  { tag: tags.punctuation, color: "#1e1e1e" },
  { tag: tags.variableName, color: "#001080" },
  { tag: tags.bracket, color: "#af00db" }
]);
var errorLineDeco = Decoration.line({ class: "cm-errorLine" });
var getErrorLineExtension = (errorLine, doc) => {
  if (!errorLine || errorLine < 1 || errorLine > doc.lines) {
    return EditorView.decorations.of(Decoration.none);
  }
  const line = doc.line(errorLine);
  return EditorView.decorations.of(
    Decoration.set([errorLineDeco.range(line.from)])
  );
};
var getThemeExtensions = (theme) => {
  if (theme === "dark") {
    return [darkTheme, syntaxHighlighting(darkHighlight)];
  }
  return [lightTheme, syntaxHighlighting(lightHighlight)];
};
var CodeMirrorEditor = ({
  value,
  onChange,
  onKeyboardSubmit,
  placeholder,
  theme,
  errorLine
}) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onKeyboardSubmitRef = useRef(onKeyboardSubmit);
  const themeCompartmentRef = useRef(new Compartment());
  const errorLineCompartmentRef = useRef(new Compartment());
  onChangeRef.current = onChange;
  onKeyboardSubmitRef.current = onKeyboardSubmit;
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const themeCompartment = themeCompartmentRef.current;
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                onKeyboardSubmitRef.current?.();
                return true;
              }
            },
            // historyKeymap binds Mod-Shift-z only on Mac; add it for all platforms
            { key: "Mod-Shift-z", run: redo, preventDefault: true }
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lineNumbers(),
          EditorView.lineWrapping,
          themeCompartment.of(getThemeExtensions(theme)),
          errorLineCompartmentRef.current.of([]),
          mermaidLite(),
          drawSelection({ drawRangeCursor: true }),
          ...placeholder ? [cmPlaceholder(placeholder)] : []
        ]
      }),
      parent: containerRef.current
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        getThemeExtensions(theme)
      )
    });
  }, [theme]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: errorLineCompartmentRef.current.reconfigure(
        getErrorLineExtension(errorLine, view.state.doc)
      )
    });
  }, [errorLine]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value }
      });
    }
  }, [value]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: containerRef,
      className: "ttd-dialog-input ttd-dialog-input--codemirror"
    }
  );
};
var CodeMirrorEditor_default = CodeMirrorEditor;
export {
  CodeMirrorEditor_default as default
};
//# sourceMappingURL=CodeMirrorEditor-XRUBL3LG.js.map

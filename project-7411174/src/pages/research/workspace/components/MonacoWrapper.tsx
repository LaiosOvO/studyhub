import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

interface MonacoWrapperProps {
  content: string;
  language: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function MonacoWrapper({
  content,
  language,
  onChange,
  onSave,
}: MonacoWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Register Ctrl+S / Cmd+S keybinding
      editor.addAction({
        id: "save-file",
        label: "Save File",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        ],
        run: () => {
          onSave();
        },
      });
    },
    [onSave],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      onChange(value ?? "");
    },
    [onChange],
  );

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        wordWrap: "on",
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        lineNumbersMinChars: 3,
        renderLineHighlight: "gutter",
      }}
    />
  );
}

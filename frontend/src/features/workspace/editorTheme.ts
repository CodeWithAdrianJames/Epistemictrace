import type { BeforeMount } from '@monaco-editor/react'

export const EDITOR_THEME = 'epistemictrace-dark'

// ui-context.md → Coding Workspace: Monaco cannot read CSS variables, so these values repeat the
// tokens.css palette (--bg-subtle code surface, --bg-page line highlight, --border-highlight line
// numbers, --text-secondary active line number, --accent selection, --accent-text cursor).
export const defineEditorTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(EDITOR_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#191b33',
      'editor.lineHighlightBackground': '#252746',
      'editor.lineHighlightBorder': '#252746',
      'editorLineNumber.foreground': '#626596',
      'editorLineNumber.activeForeground': '#ced0e2',
      'editor.selectionBackground': '#7e4bde66',
      'editorCursor.foreground': '#b89ced',
      'editorWidget.background': '#252746',
      'editorWidget.border': '#3f4273',
    },
  })
}

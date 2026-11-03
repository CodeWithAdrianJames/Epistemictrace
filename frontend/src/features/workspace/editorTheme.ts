import type { BeforeMount } from '@monaco-editor/react'

export const EDITOR_THEME = 'epistemictrace-dark'

// The --font-mono stack from tokens.css; Monaco takes the font as an option, not from CSS.
export const EDITOR_FONT_FAMILY = "'JetBrains Mono', 'Fira Code', ui-monospace, 'Cascadia Code', Consolas, 'Liberation Mono', monospace"

// ui-context.md → Coding Workspace: Monaco cannot read CSS variables, so these values repeat the
// tokens.css palette (--bg-subtle code surface, --bg-surface-raised line highlight, --text-faint line
// numbers, --text-secondary active line number, --accent selection, --accent-soft-text cursor, bracket
// pairs --text-muted / --accent-cyan / --accent-link) and the
// syntax colors of the workspace reference (keywords --accent-link, escapes --accent-cyan, builtin types
// --tile-blue, numbers --state-fail, comments --text-faint, punctuation --text-muted, strings the
// reference's #ffd27a).
export const defineEditorTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(EDITOR_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'fcfcfc' },
      { token: 'keyword', foreground: 'c4a8ff' },
      { token: 'identifier', foreground: 'fcfcfc' },
      { token: 'type.identifier', foreground: '8ab4ff' },
      { token: 'string', foreground: 'ffd27a' },
      { token: 'string.escape', foreground: '67e8f9' },
      { token: 'number', foreground: 'f6a0ac' },
      { token: 'comment', foreground: '6d70a5', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'a9aac8' },
      { token: 'delimiter.bracket', foreground: 'a9aac8' },
      { token: 'operator', foreground: 'a9aac8' },
    ],
    colors: {
      'editor.background': '#1d1f3d',
      'editor.foreground': '#fcfcfc',
      'editor.lineHighlightBackground': '#2d305a80',
      'editor.lineHighlightBorder': '#00000000',
      'editorGutter.background': '#1a1c38',
      'editorLineNumber.foreground': '#6d70a5',
      'editorLineNumber.activeForeground': '#cfd0ea',
      'editor.selectionBackground': '#7e4bde66',
      'editorCursor.foreground': '#cebbf3',
      'editorIndentGuide.background1': '#2f3260',
      'editorBracketHighlight.foreground1': '#a9aac8',
      'editorBracketHighlight.foreground2': '#67e8f9',
      'editorBracketHighlight.foreground3': '#c4a8ff',
      'editorBracketMatch.background': '#7e4bde33',
      'editorBracketMatch.border': '#7e4bde',
      'editorWidget.background': '#252746',
      'editorWidget.border': '#3b3e70',
      'scrollbarSlider.background': '#4a4d8566',
      'scrollbarSlider.hoverBackground': '#4a4d85aa',
    },
  })
}

import Editor, { type EditorProps, type OnChange } from '@monaco-editor/react'
import { useCallback, useMemo } from 'react'
import { countChange } from './changeAccounting.ts'

// at is Date.now() when Monaco reported the change.
export interface EditorChange {
  charsAdded: number
  charsRemoved: number
  at: number
}

interface CodeEditorProps {
  value: string
  onChange: (value: string, change: EditorChange) => void
  ariaLabel?: string
}

// Reports every Monaco content-change event (keystroke, paste, undo) on its own; coalescing
// changes into telemetry events is the caller's job (spec 17).
function CodeEditor({ value, onChange, ariaLabel = 'Code editor' }: CodeEditorProps) {
  // detectIndentation is off so code indented another way cannot override the 4-space tabs.
  const options = useMemo<EditorProps['options']>(
    () => ({
      ariaLabel,
      minimap: { enabled: false },
      wordWrap: 'on',
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
    }),
    [ariaLabel],
  )

  // Stable while onChange is, so the wrapper does not re-subscribe to Monaco on every render.
  const handleChange = useCallback<OnChange>(
    (nextValue, event) => {
      onChange(nextValue ?? '', { ...countChange(event.changes), at: Date.now() })
    },
    [onChange],
  )

  return (
    <Editor
      height="100%"
      language="python"
      theme="vs"
      value={value}
      onChange={handleChange}
      loading="Loading editor…"
      options={options}
    />
  )
}

export default CodeEditor

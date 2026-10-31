// The two fields of a Monaco content change that the accounting needs; Monaco's own change objects fit this shape.
export interface ContentChange {
  text: string
  rangeLength: number
}

export interface ChangeCount {
  charsAdded: number
  charsRemoved: number
}

// One Monaco content-change event can hold several changes (multi-cursor edits), so they are summed.
// Lengths are UTF-16 code units, the unit Monaco uses for both text and rangeLength.
export function countChange(changes: readonly ContentChange[]): ChangeCount {
  let charsAdded = 0
  let charsRemoved = 0
  for (const change of changes) {
    charsAdded += change.text.length
    charsRemoved += change.rangeLength
  }
  return { charsAdded, charsRemoved }
}

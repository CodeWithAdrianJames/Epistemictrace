const FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Spec 27 R2: an ISO-8601 instant in the browser's local time, e.g. "Mon, 3 Nov 2026, 10:15".
// Built from the parts so the punctuation does not depend on the runtime's locale data.
export function formatDateTime(iso: string): string {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of FORMAT.formatToParts(new Date(iso))) {
    parts[part.type] = part.value
  }
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`
}

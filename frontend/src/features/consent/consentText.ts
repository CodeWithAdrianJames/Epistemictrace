export const CONSENT_TITLE = 'Research & Learning Telemetry Consent'

export const CONSENT_PARAGRAPHS: readonly string[] = [
  'EpistemicTrace collects process-level telemetry during coding sessions to understand problem-solving workflows and detect unproductive debugging loops.',
  'Collected data includes timestamped edit history, runs, test outcomes, and error signatures. No external tabs, system files, or non-editor keystrokes are tracked.',
  'Telemetry is pseudonymized, stored securely for the academic term, and voluntary (declining does not impact grades or activity access).',
]

export const CONSENT_BANNER_TEXT =
  'Tracking is off for this visit. Your code is evaluated locally, but session telemetry is disabled.'

export const CONSENT_BANNER_ACTION = 'Turn on tracking'

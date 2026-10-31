import type { ActivityStatus } from '../../api/instructorActivitiesApi.ts'

// Spec 09 R1/R3: the status label shown on the list and the edit page.
export const STATUS_LABELS: Record<ActivityStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

export function testCaseCountLabel(count: number): string {
  return count === 1 ? '1 test case' : `${count} test cases`
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// Calendar date in the viewer's locale and time zone, from an ISO-8601 instant.
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso))
}

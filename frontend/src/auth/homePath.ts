import type { Role } from '../api/authApi.ts'

// Spec 07 R5: the page each role lands on after logging in.
export function homePathFor(role: Role): string {
  return role === 'INSTRUCTOR' ? '/instructor/activities' : '/student/activities'
}

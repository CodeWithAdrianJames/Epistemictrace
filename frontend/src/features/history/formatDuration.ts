// Spec 27 R2: "25 min", "1 h 5 min", "In progress" for a session without an end.
export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'In progress'
  }
  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 1) {
    return 'Less than 1 min'
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} min`
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

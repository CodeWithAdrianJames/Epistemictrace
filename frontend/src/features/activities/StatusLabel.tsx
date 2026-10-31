import type { ActivityStatus } from '../../api/instructorActivitiesApi.ts'
import { STATUS_LABELS } from './activityLabels.ts'
import styles from './StatusLabel.module.css'

// Spec 09 R1/R3: the status badge on the list and the edit page; the text label is always shown.
function StatusLabel({ status }: { status: ActivityStatus }) {
  return <span className={`${styles.status} ${styles[status]}`}>{STATUS_LABELS[status]}</span>
}

export default StatusLabel

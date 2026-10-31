import { useParams } from 'react-router'
import { useAuth } from '../../auth/AuthProvider.tsx'
import CodeEditor from './CodeEditor.tsx'
import styles from './WorkspacePage.module.css'
import { useDraft } from './useDraft.ts'

// Temporary mount of the editor for manual checks (spec 11 R6). Spec 14 replaces this page with
// the real workspace: the loaded activity, its starter code, the problem and results panels.
function WorkspacePage() {
  const { activityId = '' } = useParams()
  const { user } = useAuth()
  // RequireRole only renders this page for a signed-in student, so 'local' is a fallback only.
  const [code, setCode] = useDraft(user ? user.id : 'local', activityId, '')

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Activity workspace</h1>
      <div className={styles.editor}>
        <CodeEditor value={code} onChange={setCode} />
      </div>
    </div>
  )
}

export default WorkspacePage

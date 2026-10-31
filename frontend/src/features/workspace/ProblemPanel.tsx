import { useId } from 'react'
import type { TestCase } from '../../api/activitiesApi.ts'
import styles from './ProblemPanel.module.css'

interface ProblemPanelProps {
  problemStatement: string
  testCases: readonly TestCase[]
}

// Spec 14 R3: the statement as the instructor typed it, and the visible tests as examples.
// Tests are numbered by their place among all tests, so "Test 3" matches the results panel (Q8).
function ProblemPanel({ problemStatement, testCases }: ProblemPanelProps) {
  const headingId = useId()
  const examples = [...testCases]
    .sort((a, b) => a.position - b.position)
    .map((testCase, index) => ({ testCase, number: index + 1 }))
    .filter(({ testCase }) => !testCase.hidden)

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Problem
      </h2>
      <p className={styles.statement}>{problemStatement}</p>
      {examples.length > 0 && (
        <>
          <h3 className={styles.subheading}>Examples</h3>
          <ol className={styles.examples}>
            {examples.map(({ testCase, number }) => (
              <li key={testCase.id} className={styles.example}>
                <h4 className={styles.exampleName}>Test {number}</h4>
                <dl className={styles.values}>
                  <dt>Input</dt>
                  <dd>
                    <pre className={styles.block}>{testCase.input}</pre>
                  </dd>
                  <dt>Expected output</dt>
                  <dd>
                    <pre className={styles.block}>{testCase.expectedOutput}</pre>
                  </dd>
                </dl>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

export default ProblemPanel

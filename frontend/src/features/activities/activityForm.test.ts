import { describe, expect, it } from 'vitest'
import type { ActivityDetail } from '../../api/instructorActivitiesApi.ts'
import {
  ACTIVITY_FIELDS,
  EMPTY_ACTIVITY,
  isChanged,
  toActivityRequest,
  validateActivity,
  valuesFrom,
  type ActivityFormValues,
} from './activityForm.ts'

const VALID: ActivityFormValues = {
  title: 'Sum two numbers',
  problemStatement: 'Read two integers and print their sum.',
  starterCode: '',
}

const DETAIL: ActivityDetail = {
  id: 5,
  title: 'Sum two numbers',
  problemStatement: 'Read two integers\nand print their sum.',
  starterCode: 'a = int(input())\n',
  status: 'DRAFT',
  testCases: [],
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
}

describe('validateActivity', () => {
  it('accepts valid values with empty starter code', () => {
    expect(validateActivity(VALID)).toEqual({})
  })

  it('asks for a title when it is empty or only whitespace', () => {
    expect(validateActivity({ ...VALID, title: '' })).toEqual({ title: 'Enter a title.' })
    expect(validateActivity({ ...VALID, title: '   \t ' })).toEqual({ title: 'Enter a title.' })
  })

  it('limits the trimmed title to 120 characters', () => {
    expect(validateActivity({ ...VALID, title: 'a'.repeat(120) })).toEqual({})
    expect(validateActivity({ ...VALID, title: `  ${'a'.repeat(120)}  ` })).toEqual({})
    expect(validateActivity({ ...VALID, title: 'a'.repeat(121) })).toEqual({
      title: 'Title must be 120 characters or fewer.',
    })
  })

  it('asks for a problem statement when it is empty or only whitespace', () => {
    expect(validateActivity({ ...VALID, problemStatement: '' })).toEqual({
      problemStatement: 'Enter a problem statement.',
    })
    expect(validateActivity({ ...VALID, problemStatement: ' \n\n ' })).toEqual({
      problemStatement: 'Enter a problem statement.',
    })
  })

  it('limits the problem statement to 20,000 characters', () => {
    expect(validateActivity({ ...VALID, problemStatement: 'a'.repeat(20_000) })).toEqual({})
    expect(validateActivity({ ...VALID, problemStatement: 'a'.repeat(20_001) })).toEqual({
      problemStatement: 'Problem statement must be 20,000 characters or fewer.',
    })
  })

  it('limits the starter code to 20,000 characters', () => {
    expect(validateActivity({ ...VALID, starterCode: 'a'.repeat(20_000) })).toEqual({})
    expect(validateActivity({ ...VALID, starterCode: 'a'.repeat(20_001) })).toEqual({
      starterCode: 'Starter code must be 20,000 characters or fewer.',
    })
  })

  it('reports every invalid field at once', () => {
    expect(validateActivity({ title: '', problemStatement: '', starterCode: 'a'.repeat(20_001) })).toEqual({
      title: 'Enter a title.',
      problemStatement: 'Enter a problem statement.',
      starterCode: 'Starter code must be 20,000 characters or fewer.',
    })
  })

  it('counts UTF-16 code units, the unit of the server @Size check', () => {
    expect(validateActivity({ ...VALID, title: '😀'.repeat(60) })).toEqual({})
    expect(validateActivity({ ...VALID, title: `${'😀'.repeat(60)}a` })).toEqual({
      title: 'Title must be 120 characters or fewer.',
    })
  })
})

describe('toActivityRequest', () => {
  it('trims the title and keeps the problem statement and starter code exactly as typed', () => {
    expect(
      toActivityRequest({ title: '  Sum  ', problemStatement: '  Line 1\nLine 2  \n', starterCode: '\n  x = 1\n' }),
    ).toEqual({ title: 'Sum', problemStatement: '  Line 1\nLine 2  \n', starterCode: '\n  x = 1\n' })
  })
})

describe('valuesFrom and isChanged', () => {
  it('takes the three editable fields from an activity', () => {
    expect(valuesFrom(DETAIL)).toEqual({
      title: 'Sum two numbers',
      problemStatement: 'Read two integers\nand print their sum.',
      starterCode: 'a = int(input())\n',
    })
  })

  it('reports a change in any field and no change for equal values', () => {
    const saved = valuesFrom(DETAIL)

    expect(isChanged({ ...saved }, saved)).toBe(false)
    expect(isChanged({ ...saved, title: 'Sum two numbers!' }, saved)).toBe(true)
    expect(isChanged({ ...saved, problemStatement: `${saved.problemStatement}\n` }, saved)).toBe(true)
    expect(isChanged({ ...saved, starterCode: '' }, saved)).toBe(true)
  })

  it('starts a new activity with every field empty', () => {
    expect(EMPTY_ACTIVITY).toEqual({ title: '', problemStatement: '', starterCode: '' })
    expect(ACTIVITY_FIELDS).toEqual(['title', 'problemStatement', 'starterCode'])
  })
})

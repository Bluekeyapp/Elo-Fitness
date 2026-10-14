import { test, expect } from 'vitest'
import { P } from '../src/data/program'
import { buildSteps, groups, resumeStep, timing, workStepFrom, firstStepOf, type Step } from '../src/lib/flow'

const session = (phase: number, id: string) => P[phase].sessions.find(s => s.id === id)!
const describe = (steps: Step[]) => steps.map(s => s.kind === 'rest' ? `rest ${s.seconds}` : `ex${s.ex} ${s.set}/${s.sets}`)

test('a regular exercise rests after every set, and the session ends without a rest', () => {
  const steps = buildSteps(session(0, 'a').ex)
  expect(describe(steps).slice(0, 8)).toEqual([
    'ex0 1/4', 'rest 60', 'ex0 2/4', 'rest 60', 'ex0 3/4', 'rest 60', 'ex0 4/4', 'rest 60',
  ])
  expect(describe(steps).slice(-2)).toEqual(['rest 30', 'ex5 3/3'])
  const workSteps = steps.filter(s => s.kind === 'work').length
  expect(workSteps).toBe(session(0, 'a').ex.reduce((n, e) => n + e.s, 0))
})

test('phase 2 Sunday circuit runs in rounds with 90s rest after each round', () => {
  const ex = session(1, 'd2').ex
  expect(groups(ex)).toEqual([[0, 1, 2, 3], [4], [5]])
  const steps = buildSteps(ex)
  expect(describe(steps).slice(0, 6)).toEqual(['ex0 1/4', 'ex1 1/4', 'ex2 1/4', 'ex3 1/4', 'rest 90', 'ex0 2/4'])
  const first = steps[0]
  expect(first.kind === 'work' && first.circuit).toEqual({ position: 1, size: 4 })
  // Tabata (last, 0s rest) ends the session with no trailing rest.
  expect(describe(steps).at(-1)).toBe('ex5 1/1')
})

test('phase 3 supersets pair two exercises; EMOM stays alone and the ab circuit is grouped', () => {
  expect(groups(session(2, 'c3').ex)).toEqual([[0], [1, 2], [3, 4], [5]])
  expect(groups(session(2, 'd3').ex)).toEqual([[0], [1, 2, 3, 4]])
  const steps = buildSteps(session(2, 'd3').ex)
  expect(describe(steps).slice(0, 6)).toEqual(['ex0 1/1', 'ex1 1/3', 'ex2 1/3', 'ex3 1/3', 'ex4 1/3', 'rest 60'])
})

test('timed exercises get an effort countdown', () => {
  const t = (r: string, n = 'X') => timing({ n, r, s: 1, w: '', rest: 0, tip: '' })
  expect(t('30s')).toEqual({ duration: 30, sides: 1 })
  expect(t('25s/côté')).toEqual({ duration: 25, sides: 2 })
  expect(t('4 min')).toEqual({ duration: 240, sides: 1 })
  expect(t('Maximum 45s')).toEqual({ duration: 45, sides: 1 })
  expect(t('Voir détail', 'EMOM 16 min')).toEqual({ duration: 960, sides: 1 })
  expect(t('15')).toEqual({ sides: 1 })
  expect(t('10/jambe')).toEqual({ sides: 1 })
  expect(t('15+10 pulsations')).toEqual({ sides: 1 })
})

test('every session of the program produces a valid flow', () => {
  for (const phase of P) for (const s of phase.sessions) {
    const steps = buildSteps(s.ex)
    expect(steps[0].kind).toBe('work')
    expect(steps.at(-1)!.kind).toBe('work')
    for (let i = 1; i < steps.length; i++) expect(steps[i].kind === 'rest' && steps[i - 1].kind === 'rest').toBe(false)
    // Each exercise appears exactly `s` times and its last appearance is its last set.
    s.ex.forEach((e, i) => {
      const mine = steps.filter(st => st.kind === 'work' && st.ex === i)
      expect(mine).toHaveLength(e.s)
      expect(mine.at(-1)).toMatchObject({ set: e.s })
    })
  }
})

test('resume, jump and manual navigation skip rests', () => {
  const steps = buildSteps(session(0, 'a').ex)
  expect(resumeStep(steps, [true, true, false, false, false, false])).toBe(firstStepOf(steps, 2))
  expect(resumeStep(steps, [true, true, true, true, true, true])).toBe(0)
  expect(workStepFrom(steps, 0, 1)).toBe(2)
  expect(workStepFrom(steps, 2, -1)).toBe(0)
  expect(workStepFrom(steps, 0, -1)).toBeNull()
  expect(workStepFrom(steps, steps.length - 1, 1)).toBeNull()
})

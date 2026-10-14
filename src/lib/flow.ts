import type { Exercise } from '../data/program';

/**
 * Turns a session into the ordered steps of a guided workout: one "work" step per set
 * (or per circuit round), separated by "rest" steps.
 *
 * Program rules encoded here:
 * - Rest happens after every set (the program's rest is between sets).
 * - Exercises with 0s rest are chained with the following exercise(s) that have the same
 *   number of sets: they form a circuit done in rounds (A → B → C → rest → A → B → C …),
 *   resting for the last exercise's rest after each round.
 * - No rest after the very last set of the session.
 */

export interface WorkStep {
  kind: 'work';
  ex: number;          // exercise index in the session
  set: number;         // 1-based set (or round) number
  sets: number;
  /** Circuit info when the exercise is part of a chained group. */
  circuit?: { position: number; size: number };
  /** Effort countdown in seconds for timed exercises, per side. */
  duration?: number;
  sides: 1 | 2;
}
export interface RestStep { kind: 'rest'; seconds: number }
export type Step = WorkStep | RestStep;

/** Effort duration for timed exercises ("30s", "25s/côté", "4 min", "Maximum 45s", "EMOM 16 min"). */
export function timing(ex: Exercise): { duration?: number; sides: 1 | 2 } {
  const reps = ex.r.trim().toLowerCase();
  const perSide = /\/\s*côté$/.test(reps);
  let m = reps.match(/^(?:maximum\s+)?(\d+)\s*s(?:\s*\/\s*côté)?$/);
  if (m) return { duration: Number(m[1]), sides: perSide ? 2 : 1 };
  m = reps.match(/^(\d+)\s*min$/);
  if (m) return { duration: Number(m[1]) * 60, sides: 1 };
  m = ex.n.toLowerCase().match(/(\d+)\s*min\b/); // e.g. "EMOM 16 min" with reps "Voir détail"
  if (m && !/\d/.test(reps)) return { duration: Number(m[1]) * 60, sides: 1 };
  return { sides: 1 };
}

/** Groups of exercise indexes done together (a single exercise is a group of one). */
export function groups(exercises: Exercise[]): number[][] {
  const out: number[][] = [];
  let current: number[] = [];
  exercises.forEach((ex, i) => {
    current.push(i);
    const next = exercises[i + 1];
    const chained = ex.rest === 0 && next !== undefined && next.s === ex.s;
    if (!chained) { out.push(current); current = []; }
  });
  return out;
}

export function buildSteps(exercises: Exercise[]): Step[] {
  const steps: Step[] = [];
  for (const group of groups(exercises)) {
    const sets = exercises[group[0]].s;
    const restAfter = exercises[group[group.length - 1]].rest;
    for (let set = 1; set <= sets; set++) {
      group.forEach((ex, position) => {
        steps.push({
          kind: 'work', ex, set, sets,
          ...(group.length > 1 ? { circuit: { position: position + 1, size: group.length } } : {}),
          ...timing(exercises[ex]),
        });
      });
      if (restAfter > 0) steps.push({ kind: 'rest', seconds: restAfter });
    }
  }
  while (steps.at(-1)?.kind === 'rest') steps.pop();
  return steps;
}

/** True when this work step is the exercise's final set, i.e. completing it completes the exercise. */
export const isLastSet = (step: WorkStep) => step.set === step.sets;

/** First step of an exercise (to start or jump there). */
export const firstStepOf = (steps: Step[], ex: number) =>
  Math.max(0, steps.findIndex(s => s.kind === 'work' && s.ex === ex));

/** Where to resume: the first set of the first exercise not yet checked. */
export function resumeStep(steps: Step[], checked: boolean[]): number {
  const i = steps.findIndex(s => s.kind === 'work' && !checked[s.ex]);
  return i < 0 ? 0 : i;
}

/** Nearest work step before/after `index` (rests are skipped when navigating by hand). */
export function workStepFrom(steps: Step[], index: number, direction: 1 | -1): number | null {
  for (let i = index + direction; i >= 0 && i < steps.length; i += direction) {
    if (steps[i].kind === 'work') return i;
  }
  return null;
}

/** Rough session length in minutes: warm-up, effort (45s per untimed set) and rests. */
export function estimateMinutes(steps: Step[]): number {
  const seconds = steps.reduce((t, s) => t + (s.kind === 'rest' ? s.seconds : (s.duration ?? 45) * s.sides), 5 * 60);
  return Math.round(seconds / 60 / 5) * 5 || 5;
}

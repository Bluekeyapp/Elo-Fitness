import { test, expect } from 'vitest';
import { createTimer } from '../src/lib/timer';

test('deadline reconciles a suspended tab and signals completion only once', () => {
  let now = 1000, notifications = 0, cleared = 0, callback = () => {};
  const timer = createTimer({ now: () => now, schedule: fn => { callback = fn; return 1; }, cancel: () => cleared++, onComplete: () => notifications++ });
  timer.start(60); now += 30501; expect(timer.reconcile().remaining).toBe(30);
  now += 90000; callback();
  expect(timer.snapshot().status).toBe('complete'); expect(timer.snapshot().remaining).toBe(0); expect(notifications).toBe(1);
  timer.reconcile(); expect(notifications).toBe(1); expect(cleared).toBeGreaterThan(0);
  timer.stop(); expect(timer.snapshot().status).toBe('idle');
});

test('cancel and restart invalidate the old deadline', () => {
  let now = 0, notifications = 0;
  const timer = createTimer({ now: () => now, schedule: () => 1, cancel: () => {}, onComplete: () => notifications++ });
  timer.start(10); timer.stop(); now = 20000; timer.reconcile(); expect(notifications).toBe(0);
  timer.start(60); now = 30000; expect(timer.reconcile().remaining).toBe(50);
  timer.start(5); now = 36000; timer.reconcile(); expect(notifications).toBe(1);
});

test('adjusting a running rest moves the deadline but never into the past', () => {
  let now = 0;
  const timer = createTimer({ now: () => now, schedule: () => 1, cancel: () => {} });
  timer.start(60); timer.adjust(15); expect(timer.snapshot().remaining).toBe(75);
  timer.adjust(-500); expect(timer.snapshot().remaining).toBe(1); expect(timer.snapshot().status).toBe('running');
  timer.stop(); timer.adjust(30); expect(timer.snapshot().status).toBe('idle');
});

test('pause freezes the remaining time, even across a long phone sleep', () => {
  let now = 0, notifications = 0
  const timer = createTimer({ now: () => now, schedule: () => 1, cancel: () => {}, onComplete: () => notifications++ })
  timer.start(60); now = 20_000; timer.pause()
  expect(timer.snapshot()).toMatchObject({ status: 'paused', remaining: 40 })
  now = 500_000; timer.reconcile()
  expect(timer.snapshot()).toMatchObject({ status: 'paused', remaining: 40 }); expect(notifications).toBe(0)
  timer.adjust(10); expect(timer.snapshot().remaining).toBe(50)
  timer.resume(); now += 49_000; expect(timer.reconcile().remaining).toBe(1)
  now += 1_000; timer.reconcile(); expect(notifications).toBe(1)
  timer.pause(); expect(timer.snapshot().status).toBe('complete')
})

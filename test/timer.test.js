import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimer } from '../js/timer.js';
test('deadline reconciles a suspended tab and signals completion only once', () => {
  let now=1000,notifications=0,callback,cleared=0;
  const timer=createTimer({now:()=>now,schedule:fn=>{callback=fn;return 1;},cancel:()=>cleared++,onComplete:()=>notifications++});
  timer.start(60);now+=30501;assert.equal(timer.reconcile().remaining,30);
  now+=90000;callback();assert.equal(timer.snapshot().status,'complete');assert.equal(timer.snapshot().remaining,0);assert.equal(notifications,1);
  timer.reconcile();assert.equal(notifications,1);assert.ok(cleared);
  timer.stop();assert.equal(timer.snapshot().status,'idle');
});
test('cancel and restart invalidate the old deadline', () => {
  let now=0,notifications=0;
  const timer=createTimer({now:()=>now,schedule:()=>1,cancel:()=>{},onComplete:()=>notifications++});
  timer.start(10);timer.stop();now=20000;timer.reconcile();assert.equal(notifications,0);
  timer.start(60);now=30000;assert.equal(timer.reconcile().remaining,50);
  timer.start(5);now=36000;timer.reconcile();assert.equal(notifications,1);
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Retracker, RetrackerDB, createTracker } from './retracker';

describe('Retracker', () => {
  let retracker: Retracker;

  beforeEach(async () => {
    retracker = new Retracker(new RetrackerDB(':memory:'));
    await retracker.init();
  });

  it('basic functionality and execution order', async () => {
    const testFn = (x: number) => x * 2;
    const trackedFn = retracker.track(testFn);

    const result1 = await trackedFn(5);
    expect(result1).toBe(10);
    expect(retracker.wasLastCallFromDB()).toBe(false);

    const result2 = await trackedFn(5);
    expect(result2).toBe(10);
    expect(retracker.wasLastCallFromDB()).toBe(false);

    const result3 = await trackedFn(7);
    expect(result3).toBe(14);
    expect(retracker.wasLastCallFromDB()).toBe(false);

    const result4 = await trackedFn(5);
    expect(result4).toBe(10);
    expect(retracker.wasLastCallFromDB()).toBe(false);

    const history = await retracker.getHistory();
    expect(history.length).toBe(4);
  });

  it('trackMethod', async () => {
    const obj = {
      value: 10,
      method(x: number) {
        return this.value + x;
      }
    };
    const trackedMethod = retracker.trackMethod(obj, obj.method);

    const result1 = await trackedMethod(5);
    expect(result1).toBe(15);

    const result2 = await trackedMethod(5);
    expect(result2).toBe(15);
    expect(retracker.wasLastCallFromDB()).toBe(false);
  });

  it('trackObject', async () => {
    const obj = {
      value: 10,
      method1(x: number) {
        return this.value + x;
      },
      method2(x: number) {
        return this.value * x;
      }
    };
    const trackedObj = retracker.trackObject(obj);

    const result1 = await trackedObj.method1(5);
    expect(result1).toBe(15);

    const result2 = await trackedObj.method2(5);
    expect(result2).toBe(50);

    const result3 = await trackedObj.method1(5);
    expect(result3).toBe(15);
  });
});

describe('createTracker', () => {
  it('creates a tracker with tr, trm, and tro functions', async () => {
    const { tr, trm, tro } = await createTracker({dbPath: ':memory:'});

    const testFn = (x: number) => x * 2;
    const trackedFn = tr(testFn);
    const result1 = await trackedFn(5);
    expect(result1).toBe(10);

    const result2 = await trackedFn(5);
    expect(result2).toBe(10);

    const obj = {
      value: 10,
      method(x: number) {
        return this.value + x;
      }
    };
    const trackedMethod = trm(obj, obj.method);
    const result3 = await trackedMethod(5);
    expect(result3).toBe(15);

    const trackedObj = tro(obj);
    const result4 = await trackedObj.method(5);
    expect(result4).toBe(15);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { Retracker, RetrackerDB, protect, createTracker } from './retracker';

describe('Retracker - protect functionality', () => {
  let retracker: Retracker;

  beforeEach(async () => {
    retracker = new Retracker(new RetrackerDB(':memory:'));
    await retracker.init();
  });

  it('protect functionality with simple function', async () => {
    const multiplyByTwo = (x: number) => x * 2;
    const trackedFn = retracker.track(multiplyByTwo);

    const result1 = await trackedFn(5);
    expect(result1).toBe(10);

    const result2 = await trackedFn(5);
    expect(result2).toBe(10);

    const result3 = await trackedFn(protect(5));
    expect(result3).toBe(10);

    const result4 = await trackedFn(protect(5));
    expect(result4).toBe(10);

    const result5 = await trackedFn(5);
    expect(result5).toBe(10);
  });

  it('protect with simple object function', async () => {
    const sumObject = (obj: { x: number, y: number }) => obj.x + obj.y;
    const trackedFn = retracker.track(sumObject);

    const result1 = await trackedFn({ x: 5, y: 3 });
    expect(result1).toBe(8);

    const result2 = await trackedFn({ x: 5, y: 3 });
    expect(result2).toBe(8);

    const result3 = await trackedFn(protect({ x: 5, y: 3 }));
    expect(result3).toBe(8);

    const result4 = await trackedFn(protect({ x: 5, y: 3 }));
    expect(result4).toBe(8);
  });
});

describe('Retracker - protect with createTracker', () => {
  it('protect functionality with createTracker', async () => {
    const { tr } = await createTracker({dbPath: ':memory:'});
    const addFive = (x: number) => x + 5;
    const trackedFn = tr(addFive);

    const result1 = await trackedFn(10);
    expect(result1).toBe(15);

    const result2 = await trackedFn(protect(10));
    expect(result2).toBe(15);

    const result3 = await trackedFn(protect(10));
    expect(result3).toBe(15);
  });
});

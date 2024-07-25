import { describe, it, expect } from 'vitest';
import { Retracker, RetrackerDB } from './retracker';

const sharedDB = new RetrackerDB(':memory:');

async function simulateRestart(): Promise<Retracker> {
  const retracker = new Retracker(sharedDB);
  await retracker.init();
  return retracker;
}

describe('Retracker - persistence', () => {
  it('should persist data across simulated restarts', async () => {
    // 1st Process
    const retracker1 = await simulateRestart();
    
    const testFn = (x: number, y: number) => x + y;
    const trackedFn1 = retracker1.track(testFn);
    
    // process1:#1
    const result1_1 = await trackedFn1(5, 10);
    expect(result1_1).toBe(15);
    expect(retracker1.wasLastCallFromDB()).toBe(false);
    
    // 2nd Process
    const retracker2 = await simulateRestart();
    const trackedFn2 = retracker2.track(testFn);
    
    // process2:#1
    const result2_1 = await trackedFn2(5, 10);
    expect(result2_1).toBe(15);
    expect(retracker2.wasLastCallFromDB()).toBe(true);
    
    // process2:#2
    const result2_2 = await trackedFn2(7, 7);
    expect(result2_2).toBe(14);
    expect(retracker2.wasLastCallFromDB()).toBe(false);
  });
});
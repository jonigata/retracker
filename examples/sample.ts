import { createTracker } from 'retracker';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const { tr, truncate } = await createTracker({ verbose: true });

  async function task1(x: number) {
    console.log(`Task 1 processing ${x}...`);
    await sleep(2000);
    return x * 2;
  }

  async function task2(x: number) {
    console.log(`Task 2 processing ${x}...`);
    await sleep(1500);
    return x + 10;
  }

  async function task3(x: number) {
    console.log(`Task 3 processing ${x}...`);
    await sleep(1000);
    return x.toString().repeat(3);
  }

  console.log(await tr(task1)(5));
  console.log(await tr(task2)(7));
  console.log(await tr(task3)(9));
  console.log(await tr(task1)(5));  // This will execute again as it's a new call in the sequence
  console.log(await tr(task2)(8));  // This will execute as it has different arguments
}

main();
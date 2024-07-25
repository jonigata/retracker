# Retracker

Retracker is a development tool for Node.js that helps you manage and resume long-running processes. It's designed to save time during development by remembering the state of your operations, allowing you to pick up where you left off if your process is interrupted.

## Key Concepts

- Retracker works similarly to Docker in that it tracks the history of function calls and their arguments.
- It doesn't cache return values of functions. Instead, it remembers the sequence of operations.
- If a function is called with different arguments than what's in the history, Retracker will "break" at that point and re-execute from there.

## Installation

Install Retracker using npm:

```bash
npm install retracker
```

## Usage

Here's an example demonstrating Retracker with multiple time-consuming tasks:

```javascript
import { createTracker } from 'retracker';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const { tr } = await createTracker({ dbPath: './retracker.sqlite', verbose: true });

  const task1 = tr(async (x) => {
    console.log(`Task 1 processing ${x}...`);
    await sleep(2000);
    return x * 2;
  });

  const task2 = tr(async (x) => {
    console.log(`Task 2 processing ${x}...`);
    await sleep(1500);
    return x + 10;
  });

  const task3 = tr(async (x) => {
    console.log(`Task 3 processing ${x}...`);
    await sleep(1000);
    return x.toString().repeat(3);
  });

  console.log(await task1(5));
  console.log(await task2(7));
  console.log(await task3(9));
  console.log(await task1(5));  // This should be instant on subsequent runs
  console.log(await task2(8));  // This will re-run as the input is different
}

main();
```

When you run this script for the first time, you might see output like this:

```
track task1: (5)
   --- start:
Task 1 processing 5...
   --- result: 10
10
track task2: (7)
   --- start:
Task 2 processing 7...
   --- result: 17
17
track task3: (9)
   --- start:
Task 3 processing 9...
   --- result: "999"
999
track task1: (5)
   --- reuse: 10
10
track task2: (8)
   --- start:
Task 2 processing 8...
   --- result: 18
18
```

If you run the script again without changing anything, you'll see:

```
track task1: (5)
   --- reuse: 10
10
track task2: (7)
   --- reuse: 17
17
track task3: (9)
   --- reuse: "999"
999
track task1: (5)
   --- reuse: 10
10
track task2: (8)
   --- reuse: 18
18
```

Notice how all tasks are now instant, as Retracker is using the saved history.

If you modify the script to change an input (e.g., change `task1(5)` to `task1(6)`), you'll see:

```
track task1: (6)
   --- start:
Task 1 processing 6...
   --- result: 12
12
track task2: (7)
   --- reuse: 17
17
track task3: (9)
   --- reuse: "999"
999
track task1: (6)
   --- reuse: 12
12
track task2: (8)
   --- reuse: 18
18
```

This demonstrates how Retracker re-runs tasks when inputs change, but continues to use saved results for unchanged inputs.

## Features

- Tracks function call history
- Resumes operations from where they left off
- Supports asynchronous functions
- Uses SQLite for persistent storage
- Allows protection of sensitive arguments from being recorded

## API

### `createTracker(options)`

Creates a new tracker instance.

- `options.dbPath`: Path to the SQLite database file (default: './retracker.sqlite')
- `options.verbose`: Enable verbose logging (default: false)

Returns an object with the following methods:

- `tr`: Track a function
- `trm`: Track a method
- `tro`: Track all methods of an object
- `truncate`: Clear the tracking history

### `protect(value)`

Prevents a value from being recorded in the history.

## Use Cases

- Development of data processing pipelines
- Iterative algorithm development
- Any scenario where you're working with long-running processes and want to avoid restarting from scratch every time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
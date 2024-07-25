# Retracker

Retracker is a development tool for Node.js that helps you manage and resume long-running processes. It's designed to save time during development by remembering the sequence of function calls, allowing you to pick up where you left off if your process is interrupted.

## Key Concepts

- Retracker works similarly to Docker in that it tracks the history of function calls and their arguments.
- It remembers the sequence of operations, not the return values of functions.
- If a function is called with different arguments than what's in the history, Retracker will "break" at that point and re-execute from there.
- Retracker only tracks the inputs and outputs of the functions it wraps. It cannot track or reproduce side effects or destructive operations that occur within these functions. Such operations are outside the scope of Retracker's functionality.
- The effectiveness of Retracker relies on the tracked functions being pure or having minimal side effects. Functions that modify global state or perform I/O operations may not behave as expected when replayed.

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

  async function task1(x) {
    console.log(`Task 1 processing ${x}...`);
    await sleep(2000);
    return x * 2;
  }

  async function task2(x) {
    console.log(`Task 2 processing ${x}...`);
    await sleep(1500);
    return x + 10;
  }

  async function task3(x) {
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
```

When you run this script for the first time, all tasks will execute. On subsequent runs, Retracker will skip the execution of tasks that match the recorded history, unless the inputs change.

### 1st time

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
   --- start: 
Task 1 processing 5...
   --- result: 10

10
track task2: (8)
   --- start: 
Task 2 processing 8...
   --- result: 18

18
```


### 2nd time

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

### after truncated(changed) script

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
truncate from here, task1(5): 
   --- start: 
Task 1 processing 5...
   --- result: 10

10
track task2: (8)
   --- start: 
Task 2 processing 8...
   --- result: 18

18
```

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
- `truncate`: Truncate the tracking history from the current point

### `protect(value)`

Prevents a value from being recorded in the history.

### `truncate()`

Truncates the tracking history from the current point onwards. Useful for creating new branches in your execution history.

## Use Cases

- Development of data processing pipelines
- Iterative algorithm development
- Any scenario where you're working with long-running processes and want to avoid restarting from scratch every time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
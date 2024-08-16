import colors from 'ansi-colors';
import { snugJSON } from "snug-json";
import { RetrackerDB } from './retracker-db';

export { RetrackerDB }

const defaultDbName = './retracker.sqlite';

function stringify(obj: any) {
  return snugJSON(obj, { 
    maxLength: 300, 
    maxStringLength: 15, 
    maxArrayLength: 3, 
    space: 2
  });
}

function stringifyShort(obj: any) {
  return snugJSON(obj, { 
    maxLength: 50, 
    maxStringLength: 8, 
    maxArrayLength: 3, 
  });
}

function indent(s: string, n: number): string {
  const a = s.split('\n');
  return a[0] + '\n' + a.slice(1).map(line => ' '.repeat(n) + line).join('\n');
}

export type Options = {
  verbose?: boolean;
  dbPath?: string;
}

// 基本的な関数型を定義
type AnyFunction = (...args: any[]) => any;

// Promise<Awaited<T>> を簡略化
type PromiseResult<T> = Promise<Awaited<T>>;

// Protected型を定義
class Protected<T> {
  constructor(public value: T) {}
}

// Protectable型を定義
type Protectable<T> = T | Protected<T>;

// ProtectableArray型を定義
type ProtectableArray<T extends any[]> = {
  [K in keyof T]: Protectable<T[K]>;
};

// トラッカー関数の型を定義
type TrackerFunction<T extends AnyFunction> = (
  ...args: ProtectableArray<Parameters<T>>
) => PromiseResult<ReturnType<T>>;

// tr 関数の型を定義
export type Tracker = <T extends AnyFunction>(fn: T) => TrackerFunction<T>;

// trm 関数の型を定義
export type TrackerMethod = <T, M extends (this: T, ...args: any[]) => any>(
  obj: T,
  method: M
) => TrackerFunction<M>;

// tro 関数の型を定義
export type TrackerObject = <T extends object>(obj: T) => {
  [K in keyof T]: T[K] extends AnyFunction ? TrackerFunction<T[K]> : T[K];
};

// createTracker 関数の戻り値の型を定義
type TrackerResult = {
  tr: Tracker;
  trm: TrackerMethod;
  tro: TrackerObject;
  truncate: () => Promise<void>;
};

// createTracker 関数の型を定義
type CreateTracker = (options: Options) => Promise<TrackerResult>;

// プロテクターを作成するヘルパー関数
export function protect<T>(value: T): Protected<T> {
  return new Protected(value);
}

export class Retracker {
  private db: RetrackerDB;
  private currentHistory: number[] = [];
  private callCounter: number = -1;
  private lastCallWasFromDB: boolean = false;
  private nextCallIsError: null | (() => Error) = null;

  constructor(db?: RetrackerDB, private options: Options = { verbose: false, dbPath: defaultDbName }) {
    this.db = db ?? new RetrackerDB(options.dbPath ?? defaultDbName);
  }

  async init(): Promise<void> {
    await this.db.init();
    await this.loadHistory();
    this.callCounter = 0;
  }

  private async loadHistory(): Promise<void> {
    const rows = await this.db.query<{ call_number: number }>("SELECT call_number FROM function_calls ORDER BY call_number");
    this.currentHistory = rows.map(row => row.call_number);
  }

  track<T extends AnyFunction>(fn: T): TrackerFunction<T> {
    return async (...args: ProtectableArray<Parameters<T>>): Promise<Awaited<ReturnType<T>>> => {
      if (this.callCounter < 0) {
        throw new Error("Retracker not initialized. Call init() first.");
      }

      const currentCallNumber = this.callCounter++;
      if (this.nextCallIsError) {
        const error = this.nextCallIsError();
        this.nextCallIsError = null;
        throw error;
      }
      
      this.verbose(`track ${fn.name}:`, `(${args.map(stringifyShort).join(', ')})`);
      if (currentCallNumber < this.currentHistory.length) {
        const historicalCall = await this.getHistoricalCall(currentCallNumber);
        if (historicalCall && 
            historicalCall.functionName === fn.name && 
            this.compareArgs(historicalCall.args, args)) {
          const ur = this.unprotectResult(historicalCall.result);
          this.verbose(`   --- reuse:`, indent(stringify(ur), 14));
          this.lastCallWasFromDB = true;
          return ur;
        } else {
          this.verbose(`truncate from here, ${fn.name}(${args}):`);
          await this.truncateHistory(currentCallNumber);
        }
      }
      
      this.lastCallWasFromDB = false;
      const unprotectedArgs = this.unprotectArgs(args);
      this.verbose(`   --- start:`);
      const result = await Promise.resolve(fn(...unprotectedArgs));
      this.verbose(`   --- result:`, indent(stringify(result), 15));
      await this.recordCall(currentCallNumber, fn.name, args, result);
      this.currentHistory.push(currentCallNumber);
      return result;
    };
  }

  trackMethod<T, M extends (this: T, ...args: any[]) => any>(
    obj: T,
    method: M
  ): (...args: ProtectableArray<Parameters<M>>) => Promise<Awaited<ReturnType<M>>> {
    const boundMethod = method.bind(obj);
    return this.track(boundMethod);
  }

  private unprotectArgs<T extends any[]>(args: ProtectableArray<T>): T {
    return args.map(arg => arg instanceof Protected ? arg.value : arg) as T;
  }

  private unprotectResult(result: any): any {
    return JSON.parse(result, (_key, value) => {
      if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__protected__')) {
        return new Protected(null);
      }
      return value;
    });
  }

  trackObject<T extends object>(obj: T): { [K in keyof T]: T[K] extends (...args: any[]) => any ? (...args: ProtectableArray<Parameters<T[K]>>) => Promise<Awaited<ReturnType<T[K]>>> : T[K] } {
    return new Proxy(obj, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args: any[]) => this.track(value.bind(target))(...args);
        }
        return value;
      }
    }) as any;
  }

  private compareArgs(storedArgs: any[], currentArgs: any[]): boolean {
    if (storedArgs.length !== currentArgs.length) return false;
    for (let i = 0; i < storedArgs.length; i++) {
      const currentArg = currentArgs[i] instanceof Protected ? currentArgs[i].value : currentArgs[i];
      if (JSON.stringify(storedArgs[i]) !== JSON.stringify(currentArg)) {
        return false;
      }
    }
    return true;
  }

  private async getHistoricalCall(callNumber: number): Promise<{ functionName: string, args: any[], result: any } | null> {
    if (!this.db) throw new Error("Database not initialized");
    const rows = await this.db.query<{ function_name: string, args: string, result: string }>(
      "SELECT function_name, args, result FROM function_calls WHERE call_number = ?",
      [callNumber]
    );
    if (rows.length > 0) {
      const row = rows[0];
      return {
        functionName: row.function_name,
        args: JSON.parse(row.args),
        result: row.result  // 注意：ここでJSONパースしない
      };
    }
    return null;
  }

  private async recordCall(callNumber: number, functionName: string, args: any[], result: any): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const serializedArgs = JSON.stringify(this.unprotectArgs(args));
    const serializedResult = JSON.stringify(result, (_key, value) => {
      if (value instanceof Protected) {
        return { __protected__: true };
      }
      return value;
    });
    await this.db.execute(
      "INSERT OR REPLACE INTO function_calls (call_number, function_name, args, result) VALUES (?, ?, ?, ?)",
      [callNumber, functionName, serializedArgs, serializedResult]
    );
  }

  async truncate(): Promise<void> { // from here
    await this.truncateHistory(this.callCounter);
  }

  private async truncateHistory(fromCallNumber: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    await this.db.execute("DELETE FROM function_calls WHERE call_number >= ?", [fromCallNumber]);
    this.currentHistory = this.currentHistory.filter(num => num < fromCallNumber);
  }

  async getHistory(): Promise<number[]> {
    return this.currentHistory;
  }
  
  async close(): Promise<void> {
    if (0 <= this.callCounter) {
      await this.db.close();
      this.callCounter = -1;
    }
  }

  wasLastCallFromDB(): boolean {
    return this.lastCallWasFromDB;
  }  

  verbose(s: string, args: string = ''): void {
    if (this.options.verbose) {
      console.log(colors.green(s), colors.gray(args));
    }
  }

  failNext(error: () => Error): void {
    this.nextCallIsError = error;
  }
}

export const createTracker: CreateTracker = async (options) => {
  if (options.dbPath === ":memory:") {
    console.warn("Warning: Using an in-memory database. Data will not be persisted.");
  }
  
  const db = new RetrackerDB(options.dbPath ?? defaultDbName);
  const retracker = new Retracker(db, options);
  await retracker.init();

  return {
    tr: retracker.track.bind(retracker),
    trm: retracker.trackMethod.bind(retracker),
    tro: retracker.trackObject.bind(retracker),
    truncate: retracker.truncate.bind(retracker),
    failNext: retracker.failNext.bind(retracker)
  };
};
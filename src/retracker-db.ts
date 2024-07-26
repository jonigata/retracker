import { UniversalSQLite } from 'universal-sqlite';

export class RetrackerDB {
  private db: UniversalSQLite;

  constructor(dbPath: string) {
    this.db = new UniversalSQLite(dbPath);
  }

  async init(): Promise<void> {
    try {
      await this.db.init();
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS function_calls (
          call_number INTEGER PRIMARY KEY,
          function_name TEXT,
          args TEXT,
          result TEXT
        );
      `);
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw new Error("Database initialization failed");
    }
  }

  async execute(query: string, params?: any[]): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db.execute(query, params);
  }

  async query<T = any>(query: string, params?: any[]): Promise<T[]> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db.query<T>(query, params);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}
/** Minimal surface so TypeScript passes when `expo-sqlite` is not yet installed locally. */
declare module "expo-sqlite" {
  export function openDatabaseAsync(databaseName: string): Promise<{
    execAsync: (sql: string) => Promise<void>;
    runAsync: (statement: string, params?: (string | number)[]) => Promise<void>;
    getFirstAsync: <T>(statement: string, params?: (string | number)[]) => Promise<T | null>;
    getAllAsync: <T>(statement: string, params?: (string | number)[]) => Promise<T[]>;
  }>;
}

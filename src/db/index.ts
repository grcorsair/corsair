/**
 * Database Module — Barrel Exports
 *
 * Re-exports connection management and migration runner.
 */
export { getDb, createDb, closeDb } from "./connection";
export { migrate, getMigrationFiles, readMigrationSQL } from "./migrate";
export type { MigrateResult, DatabaseLike, TransactionLike } from "./migrate";

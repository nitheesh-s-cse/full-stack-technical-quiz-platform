/**
 * Local test database helper (audit / CI utility — NOT used in production).
 *
 * Starts an embedded PostgreSQL instance on a local port with a throwaway
 * data directory and creates a dedicated test database. Use it for the
 * automated test and question-bank verification suites so that no external
 * or live database is ever touched.
 *
 * Usage:
 *   node scripts/local-db.mjs start     # start and print the connection URL
 *   node scripts/local-db.mjs stop      # stop the instance
 *   node scripts/local-db.mjs reset     # wipe test data (schema+seed reapplied by caller)
 */
import EmbeddedPostgres from "embedded-postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const HOST = "127.0.0.1";
const PORT = Number(process.env.OH_TEST_PG_PORT || 5433);
const USER = process.env.OH_TEST_PG_USER || "postgres";
const PASSWORD = process.env.OH_TEST_PG_PASSWORD || "postgres";
const DB_NAME = process.env.OH_TEST_PG_DB || "app_db_test";

const STATE_HOME = process.env.OH_TEST_PG_DATA || path.join(os.tmpdir(), "oh-output-hunt-pg");
const STOP_FLAG = path.join(STATE_HOME, "server.pid.txt");

function connectionUrl(db = DB_NAME) {
  return `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${db}`;
}

async function main() {
  const mode = process.argv[2] ?? "start";

  fs.mkdirSync(STATE_HOME, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: STATE_HOME,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (mode === "stop") {
    await pg.stop();
    console.log(`Stopped embedded PostgreSQL (${STATE_HOME}).`);
    return;
  }

  if (mode === "reset") {
    try {
      await pg.stop();
    } catch {
      /* not running */
    }
    try {
      fs.rmSync(path.join(STATE_HOME, "data"), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    console.log("Test PostgreSQL data directory cleared.");
    return;
  }

  // start (or resume)
  try {
    await pg.initialise();
  } catch (err) {
    // Data directory may already be initialised — that is fine.
    if (!String(err).includes("exists")) console.error("init:", err?.message ?? err);
  }
  try {
    await pg.start();
  } catch (err) {
    // If already running (e.g. another shell started it), still usable.
    console.error("start note:", err?.message ?? err);
  }
  try {
    await pg.createDatabase(DB_NAME);
  } catch (err) {
    if (!String(err).toLowerCase().includes("already exists")) {
      console.error("createDatabase note:", err?.message ?? err);
    }
  }

  // Write a marker so `stop` knows this instance exists.
  const pid = process.pid;
  fs.writeFileSync(STOP_FLAG, String(pid));

  console.log(`Local test DB ready: ${connectionUrl()}`);
  console.log(`  data dir: ${STATE_HOME}  (run "node scripts/local-db.mjs stop" to shut down)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
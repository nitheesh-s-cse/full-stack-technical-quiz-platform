import { Client } from "pg";
const DB = process.env.PROBE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:5433/app_db_test";
const mode = process.argv[2] || "insert";
const c = new Client({ connectionString: DB });
await c.connect();
try {
  if (mode === "insert") {
    await c.query("delete from teams where team_code like 'QAPROBE%'");
    await c.query("insert into teams (team_code, team_name, member1_name, member2_name, member3_name, member4_name, college_dept, team_status, current_round) values ('QAPROBE001','QA Probe','A','B','C','D','CSE','REGISTERED',1)");
    const r = await c.query("select team_code from teams where team_code like 'QAPROBE%'");
    console.log("PROBE_INSERTED", JSON.stringify(r.rows));
  } else {
    await c.query("delete from teams where team_code like 'QAPROBE%'");
    console.log("PROBE_REMOVED");
  }
} finally { await c.end(); }

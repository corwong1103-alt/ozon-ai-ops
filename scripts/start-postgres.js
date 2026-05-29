const path = require("path");
const fs = require("fs");
const EmbeddedPostgres = require("embedded-postgres").default;

const databaseDir = path.resolve(process.cwd(), ".local/postgres");
const port = Number(process.env.POSTGRES_PORT || 5433);
const user = process.env.POSTGRES_USER || "postgres";
const password = process.env.POSTGRES_PASSWORD || "postgres";
const database = process.env.POSTGRES_DB || "ozon_ai_ops";

const hasExistingCluster = fs.existsSync(path.join(databaseDir, "PG_VERSION"));

if (fs.existsSync(databaseDir) && !hasExistingCluster) {
  console.log(`Removing incomplete PostgreSQL data directory: ${databaseDir}`);
  fs.rmSync(databaseDir, { recursive: true, force: true });
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ["--locale=C", "-c", "shared_memory_type=mmap", "-c", "dynamic_shared_memory_type=mmap"],
  postgresFlags: ["-c", "shared_memory_type=mmap", "-c", "dynamic_shared_memory_type=mmap"],
  onLog: (message) => process.stdout.write(String(message)),
  onError: (message) => process.stderr.write(String(message))
});

async function main() {
  if (hasExistingCluster) {
    console.log(`Using existing PostgreSQL data directory: ${databaseDir}`);
  } else {
    await pg.initialise();
  }

  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`\nCreated database: ${database}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) {
      throw error;
    }
    console.log(`\nDatabase already exists: ${database}`);
  }

  console.log(`PostgreSQL is running on port ${port}`);
  console.log(`DATABASE_URL=postgresql://${user}:${password}@localhost:${port}/${database}?schema=public`);
}

async function stop() {
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

main().catch(async (error) => {
  console.error(error);
  try {
    await pg.stop();
  } catch {}
  process.exit(1);
});

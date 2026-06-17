const net = require("net");
const { spawn } = require("child_process");

const port = Number(process.env.POSTGRES_PORT || 5433);
const nextArgs = ["next", "dev", ...process.argv.slice(2)];

function waitForPort(targetPort, host = "127.0.0.1", timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.createConnection({ host, port: targetPort });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for PostgreSQL on ${host}:${targetPort}`));
          return;
        }
        setTimeout(tryConnect, 250);
      });
    }

    tryConnect();
  });
}

function run(command, args) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

async function main() {
  const db = run("node", ["scripts/start-postgres.js"]);

  await waitForPort(port);
  const next = run("npx", nextArgs);

  function shutdown(signal) {
    next.kill(signal);
    db.kill(signal);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  next.on("exit", (code) => {
    db.kill("SIGTERM");
    process.exit(code ?? 0);
  });

  db.on("exit", (code) => {
    if (code && code !== 0) {
      next.kill("SIGTERM");
      process.exit(code);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

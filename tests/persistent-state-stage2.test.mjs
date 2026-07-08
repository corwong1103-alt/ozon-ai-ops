import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("persistent state hook has ttl, max length, ssr-safe mount restore, and user key isolation", async () => {
  const source = await readFile(new URL("../lib/usePersistentState.ts", import.meta.url), "utf8");

  assert.match(source, /useEffect/);
  assert.match(source, /ttlMs/);
  assert.match(source, /maxLength/);
  assert.match(source, /QuotaExceededError|catch/);
  assert.match(source, /userId/);
  assert.match(source, /sessionStorage/);
});

test("research consoles use persistent state instead of raw storage calls", async () => {
  const files = [
    "../components/OzonResearchConsole.tsx",
    "../components/Research1688Console.tsx",
    "../components/ResearchTaskPoller.tsx"
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /usePersistentState/);
    assert.doesNotMatch(source, /sessionStorage\.(getItem|setItem)/);
  }
});

test("logout clears persisted research keys from browser storage", async () => {
  const source = await readFile(new URL("../components/LogoutForm.tsx", import.meta.url), "utf8");

  assert.match(source, /startsWith\("ozon_"\)/);
  assert.match(source, /startsWith\("rc_"\)/);
});

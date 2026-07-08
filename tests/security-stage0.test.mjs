import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import nextConfig from "../next.config.mjs";

test("middleware includes api routes in the protected prefix list", async () => {
  const middlewareSource = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");

  assert.match(middlewareSource, /protectedPrefixes[\s\S]*"\/api"/);
});

test("middleware keeps public auth and image proxy api routes reachable", async () => {
  const middlewareSource = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");

  assert.match(middlewareSource, /publicApiPrefixes[\s\S]*"\/api\/auth\/login"/);
  assert.match(middlewareSource, /publicApiPrefixes[\s\S]*"\/api\/auth\/register"/);
  assert.match(middlewareSource, /publicApiPrefixes[\s\S]*"\/api\/image-proxy"/);
});

test("middleware rejects state-changing api requests without same-origin headers", async () => {
  const middlewareSource = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");

  assert.match(middlewareSource, /validateCsrfRequest/);
  assert.match(middlewareSource, /status:\s*403/);
});

test("next config applies baseline browser security headers", async () => {
  const headers = await nextConfig.headers();
  const allRoutes = headers.find((entry) => entry.source === "/(.*)");
  const values = Object.fromEntries(allRoutes.headers.map((header) => [header.key, header.value]));

  assert.match(values["Content-Security-Policy"], /default-src 'self'/);
  assert.equal(values["X-Frame-Options"], "DENY");
  assert.equal(values["X-Content-Type-Options"], "nosniff");
  assert.equal(values["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(values["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
});

test("image proxy resolves hostnames and blocks private network targets", async () => {
  const proxySource = await readFile(new URL("../app/api/image-proxy/route.ts", import.meta.url), "utf8");

  assert.match(proxySource, /node:dns\/promises/);
  assert.match(proxySource, /isPrivateIpAddress/);
  assert.match(proxySource, /resolveImageTarget/);
  assert.match(proxySource, /status:\s*403/);
});

test("session cookies use strict sameSite policy", async () => {
  const authSource = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");

  assert.match(authSource, /sameSite:\s*"strict"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ozonMarketSource = readFileSync(new URL("../lib/services/ozon-market.ts", import.meta.url), "utf8");
const keywordExpanderSource = readFileSync(new URL("../lib/services/keyword-expander.ts", import.meta.url), "utf8");

test("market source has explicit not-configured error code instead of silent empty results", () => {
  assert.match(ozonMarketSource, /MARKET_SOURCE_NOT_CONFIGURED/);
  assert.match(ozonMarketSource, /class MarketSourceNotConfiguredError/);
  assert.doesNotMatch(ozonMarketSource, /status:\s*"UNCONFIGURED",\s*message:[\s\S]*items:\s*\[\]/);
});

test("Chinese pants queries have stable Russian market keywords", () => {
  for (const keyword of ["брюки", "штаны", "джинсы"]) {
    assert.ok(ozonMarketSource.includes(keyword) || keywordExpanderSource.includes(keyword));
  }
});

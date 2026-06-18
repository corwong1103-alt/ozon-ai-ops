import assert from "node:assert/strict";
import test from "node:test";

import { MARKET_SEARCH_CACHE_TTL_MS } from "../lib/search-intelligence.ts";

test("market search cache TTL follows the V3 search intelligence document", () => {
  assert.equal(MARKET_SEARCH_CACHE_TTL_MS, 30 * 60 * 1000);
});

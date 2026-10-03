import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SESSION_IDLE_MS,
  SESSION_IDLE_WARN_MS,
  shouldCloseIdle,
  shouldWarnIdle,
  summarizeUserAgent,
} from "./view.ts";

describe("secure session surface", () => {
  it("never renders a session token and idle-closes the workshop", () => {
    const ledger = readFileSync(fileURLToPath(new URL("../../components/session-ledger.tsx", import.meta.url)), "utf8");
    const guard = readFileSync(fileURLToPath(new URL("../../components/session-guard.tsx", import.meta.url)), "utf8");
    assert.doesNotMatch(ledger, /\{[a-zA-Z.]*token\}/);
    assert.match(ledger, /listForgeSessions/);
    assert.match(ledger, /revokeOtherForgeSessions/);
    assert.match(guard, /shouldCloseIdle/);
    assert.match(guard, /signOut/);
    assert.equal(SESSION_IDLE_MS, 15 * 60 * 1000);
    assert.equal(SESSION_IDLE_WARN_MS, 2 * 60 * 1000);
  });

  it("names the browser without dumping the user-agent", () => {
    assert.equal(summarizeUserAgent("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"), "Chrome");
    assert.equal(summarizeUserAgent(""), "Navegador desconocido");
    const now = 1_000_000;
    assert.equal(shouldWarnIdle(now - 14 * 60 * 1000, now), true);
    assert.equal(shouldCloseIdle(now - 16 * 60 * 1000, now), true);
    assert.equal(shouldCloseIdle(now - 60 * 1000, now), false);
  });
});

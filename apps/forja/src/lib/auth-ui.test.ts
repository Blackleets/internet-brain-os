import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { emailAndPasswordEnabled } from "./auth/email-password.ts";

describe("robust auth wiring", () => {
  it("enables Google, X and email/password and never mounts /auth/popup", () => {
    assert.equal(emailAndPasswordEnabled, true);
    const login = readFileSync(fileURLToPath(new URL("../routes/login.tsx", import.meta.url)), "utf8");
    const api = readFileSync(fileURLToPath(new URL("../routes/api/auth/$.ts", import.meta.url)), "utf8");
    const env = readFileSync(fileURLToPath(new URL("../../.grok/app-env.json", import.meta.url)), "utf8");
    assert.match(login, /GROK_PROVIDERS/);
    assert.match(login, /signIn\.email/);
    assert.match(login, /signUp\.email/);
    assert.match(api, /auth\.handler/);
    assert.doesNotMatch(env, /VITE_AUTH_ENABLED/);
    assert.equal(
      existsSync(fileURLToPath(new URL("../routes/auth/popup.tsx", import.meta.url))),
      false,
    );
  });
});

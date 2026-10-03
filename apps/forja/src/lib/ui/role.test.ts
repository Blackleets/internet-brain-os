import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOwnerPage, roleOf } from "./role.ts";

describe("owner vs user surfaces", () => {
  it("defaults to user and hides the kernel workshop", () => {
    assert.equal(roleOf({ hash: null, unlocked: false }), "user");
    assert.equal(isOwnerPage("/agentes"), true);
    assert.equal(isOwnerPage("/chat"), true);
    assert.equal(isOwnerPage("/activity"), true);
    assert.equal(isOwnerPage("/settings"), true);
    assert.equal(isOwnerPage("/login"), false);
    assert.equal(isOwnerPage("/"), false);
    assert.equal(isOwnerPage("/verificar"), false);
    assert.equal(isOwnerPage("/goals"), false);
  });
});

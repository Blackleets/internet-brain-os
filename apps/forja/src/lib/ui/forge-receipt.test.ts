import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citedObservations, forgeReceipt, providerLine, receiptHeadline } from "./forge-receipt.ts";
import type { Evidence } from "../kernel/types.ts";

describe("forge receipt", () => {
  it("keeps Forjando off a completed case and never invents sources", () => {
    const receipt = forgeReceipt({
      goal: {
        stage: "complete",
        status: "complete",
        leads: [{ title: "A", url: "https://a.example/x", snippet: "", sourceHost: "a.example" }],
        discovery: {
          queries: ["btc 2010"],
          providers: [
            { name: "wikipedia", status: "empty", hitCount: 0 },
            { name: "ddg-lite", status: "ok", hitCount: 4 },
          ],
          found: 4,
          usable: 3,
          domains: ["a.example", "b.example"],
          extracted: 2,
        },
      },
      evidenceCount: 2,
      findingCount: 1,
      contradictionCount: 0,
      sealed: true,
    });
    assert.equal(receipt.headline, "Forjado");
    assert.equal(receipt.found, 4);
    assert.equal(receipt.usable, 3);
    assert.equal(receipt.extracted, 2);
    assert.equal(receipt.sealed, true);
    assert.ok(receipt.providers.some((line) => line.includes("wikipedia: vacío")));
    assert.ok(receipt.providers.some((line) => line.includes("ddg-lite: 4")));
  });

  it("names an incomplete investigation from the Kernel, not as Completado", () => {
    const receipt = forgeReceipt({
      goal: {
        stage: "blocked",
        status: "blocked",
        blockedReason: "Ningún proveedor devolvió URLs utilizables.",
        leads: [],
        discovery: {
          queries: ["foo"],
          providers: [{ name: "wikipedia", status: "fail", hitCount: 0, error: "timeout" }],
          found: 0,
          usable: 0,
          domains: [],
          extracted: 0,
        },
      },
      evidenceCount: 0,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    assert.equal(receipt.headline, "Investigación incompleta");
    assert.match(receipt.reason ?? "", /URLs utilizables/);
    assert.match(providerLine({ name: "wikipedia", status: "fail", hitCount: 0, error: "timeout" }), /falló/);
    assert.equal(receiptHeadline("forging"), "Forjando…");
  });

  it("does not call a complete-without-seal case Forjado", () => {
    const receipt = forgeReceipt({
      goal: {
        stage: "complete",
        status: "complete",
        leads: [],
      },
      evidenceCount: 2,
      findingCount: 1,
      contradictionCount: 0,
      sealed: false,
    });
    assert.equal(receipt.headline, "Investigación incompleta");
    assert.equal(receipt.sealed, false);
  });

  it("treats cited excerpts as observed data and never the finding answer", () => {
    const evidence: Evidence[] = [
      {
        id: "e1",
        goalId: "g1",
        url: "https://a.example/p",
        title: "Page",
        sourceHost: "a.example",
        excerpt: "BTC opened 2010 near $0.08.",
        contentHash: "h",
        retrievedAt: "2026-01-01T00:00:00.000Z",
        httpStatus: 200,
        bytes: 120,
        validation: "retrieved",
      },
    ];
    const observed = citedObservations({ evidenceIds: ["e1", "missing"] }, evidence);
    assert.equal(observed.length, 1);
    assert.equal(observed[0]?.excerpt.includes("0.08"), true);
    assert.equal(observed.some((item) => item.excerpt.includes("subirá")), false);
  });
});

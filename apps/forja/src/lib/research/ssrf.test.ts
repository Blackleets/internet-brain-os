import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrivateAddress, nextPublicRedirect, rejectUnsafeUrl, describePublicFetchError } from "./ssrf.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("isPrivateAddress", () => {
  it("blocks loopback and RFC1918", () => {
    assert.equal(isPrivateAddress("127.0.0.1"), true);
    assert.equal(isPrivateAddress("10.0.0.8"), true);
    assert.equal(isPrivateAddress("192.168.1.1"), true);
    assert.equal(isPrivateAddress("169.254.169.254"), true);
    assert.equal(isPrivateAddress("172.16.0.2"), true);
  });

  it("blocks CGNAT and IPv6 loopback", () => {
    assert.equal(isPrivateAddress("100.64.0.1"), true);
    assert.equal(isPrivateAddress("100.127.255.254"), true);
    assert.equal(isPrivateAddress("::1"), true);
    assert.equal(isPrivateAddress("fe80::1"), true);
  });

  it("allows public v4", () => {
    assert.equal(isPrivateAddress("1.1.1.1"), false);
    assert.equal(isPrivateAddress("8.8.8.8"), false);
  });
});

describe("rejectUnsafeUrl", () => {
  it("rejects http", () => {
    assert.throws(() => rejectUnsafeUrl("http://example.com/x"), /HTTPS/);
  });

  it("rejects loopback", () => {
    assert.throws(() => rejectUnsafeUrl("https://127.0.0.1/x"), /privada/);
  });

  it("rejects credentials", () => {
    assert.throws(() => rejectUnsafeUrl("https://user:pass@example.com/"), /credenciales/);
  });

  it("rejects internal hosts", () => {
    assert.throws(() => rejectUnsafeUrl("https://foo.internal/"), /autorizado/);
  });
});

describe("nextPublicRedirect", () => {
  it("rejects a hop to loopback", async () => {
    await assert.rejects(
      () => nextPublicRedirect(new URL("https://example.com/a"), "https://127.0.0.1/secret"),
      /privada/,
    );
  });

  it("rejects a hop to http", async () => {
    await assert.rejects(
      () => nextPublicRedirect(new URL("https://example.com/a"), "http://example.com/b"),
      /HTTPS/,
    );
  });

  it("rejects a missing location", async () => {
    await assert.rejects(
      () => nextPublicRedirect(new URL("https://example.com/a"), null),
      /destino/,
    );
  });
});

describe("readers share the SSRF helper", () => {
  it("wikipedia search goes through assertPublicHttpsUrl and fetchPublicHttps", () => {
    const src = readFileSync(fileURLToPath(new URL("./functions.ts", import.meta.url)), "utf8");
    const start = src.indexOf("async function wikipediaHits");
    const end = src.indexOf("function extractJson");
    const slice = src.slice(start, end);
    assert.equal(slice.includes("assertPublicHttpsUrl"), true);
    assert.equal(slice.includes("fetchPublicHttps"), true);
    assert.equal(/fetch\(endpoint/.test(slice), false);
  });

  it("wikipedia extract goes through the public HTTPS helper", () => {
    const src = readFileSync(fileURLToPath(new URL("./functions.ts", import.meta.url)), "utf8");
    const start = src.indexOf("async function readWikipediaExtract");
    const slice = src.slice(start, start + 1600);
    assert.equal(slice.includes("assertPublicHttpsUrl"), true);
    assert.equal(slice.includes("fetchPublicHttps"), true);
    assert.equal(/fetch\(endpoint/.test(slice), false);
  });

  it("search adapters use search timeouts, not the page-read timeout", () => {
    const src = readFileSync(fileURLToPath(new URL("./functions.ts", import.meta.url)), "utf8");
    const adapters = src.slice(src.indexOf("async function wikipediaHits"), src.indexOf("function extractJson"));
    assert.equal(adapters.includes("assertPublicHttpsUrl"), true);
    assert.equal(adapters.includes("fetchPublicHttps"), true);
    assert.equal(adapters.includes("SEARCH_ORIGIN_TIMEOUT_MS"), true);
    assert.equal(adapters.includes("SEARCH_AUX_TIMEOUT_MS"), true);
    assert.equal(/timeoutMs:\s*FETCH_TIMEOUT_MS/.test(adapters), false);
    assert.equal(src.includes("needsBroaderWeb"), true);
  });
});

describe("describePublicFetchError", () => {
  it("does not surface the raw undici fetch failed string", () => {
    const err = Object.assign(new Error("fetch failed"), {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT", message: "Connect Timeout Error" },
    });
    const text = describePublicFetchError(err);
    assert.equal(/fetch failed/i.test(text), false);
    assert.match(text, /conexión|origen público/i);
  });

  it("keeps SSRF policy messages intact", () => {
    assert.match(describePublicFetchError(new Error("Red privada rechazada.")), /privada/);
    assert.match(describePublicFetchError(new Error("Solo se permite HTTPS público.")), /HTTPS/);
  });
});

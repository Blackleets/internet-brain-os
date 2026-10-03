import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEntities, excerptOf, extractReadableText, formatStructuredDocument, readBounded, stripHtml } from "./extract.ts";

const AMP = "\u0026";

describe("decodeEntities", () => {
  it("decodes named entities used in public html", () => {
    const raw = `${AMP}amp;${AMP}quot;x${AMP}lt;y${AMP}gt;`;
    assert.equal(decodeEntities(raw), `&"x<y>`);
  });

  it("decodes nbsp to a space", () => {
    assert.equal(decodeEntities(`A${AMP}nbsp;B`), "A B");
  });
});

describe("stripHtml", () => {
  it("strips tags then decodes remaining entities", () => {
    assert.equal(stripHtml(`<p>A ${AMP}amp; B</p>`), "A & B");
  });
});

describe("excerptOf", () => {
  it("does not rewrite short text", () => {
    assert.equal(excerptOf("corto"), "corto");
  });
});

describe("extractReadableText", () => {
  it("prefers article body over chrome", () => {
    const html = `<html><nav>Menu</nav><article><p>Wikipedia es una enciclopedia libre.</p></article><footer>pie</footer></html>`;
    const text = extractReadableText(html);
    assert.match(text, /enciclopedia libre/);
    assert.equal(/Menu/.test(text), false);
  });
});

describe("readBounded", () => {
  it("truncates instead of throwing when the body is larger than the cap", async () => {
    const body = "abcdefghij";
    const res = new Response(body, { headers: { "content-length": "999999" } });
    const read = await readBounded(res, 4);
    assert.equal(read.truncated, true);
    assert.equal(read.text, "abcd");
    assert.equal(read.bytes, 4);
  });
});

describe("formatStructuredDocument", () => {
  it("records provider metadata and does not invent a schema on invalid JSON", () => {
    const document = formatStructuredDocument({
      text: "not-json",
      contentType: "application/json",
      url: "https://example.com/api",
      retrievedAt: "2026-08-29T00:00:00.000Z",
    });
    assert.match(document, /\[structured\]/);
    assert.match(document, /https:\/\/example.com\/api/);
    assert.match(document, /not-json/);
    assert.match(document, /No infiere/);
    assert.equal(document.includes("\"price\":"), false);
  });
});

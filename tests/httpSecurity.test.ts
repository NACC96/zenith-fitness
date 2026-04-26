import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_MODELS,
  getCorsHeaders,
  isAllowedModel,
  isAllowedOrigin,
  parseAllowedOrigins,
  validateChatRequestBody,
} from "../convex/lib/httpSecurity";

describe("HTTP security helpers", () => {
  it("parses comma-separated configured origins", () => {
    assert.deepEqual(parseAllowedOrigins("https://a.test, https://b.test ,,"), [
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("allows configured, localhost, and missing origins only", () => {
    const configured = ["https://zenith.example"];

    assert.equal(isAllowedOrigin("https://zenith.example", configured), true);
    assert.equal(isAllowedOrigin("http://localhost:3000", configured), false);
    assert.equal(isAllowedOrigin("http://localhost:3000", configured, true), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:3000", configured, true), true);
    assert.equal(isAllowedOrigin(null, configured), false);
    assert.equal(isAllowedOrigin("https://evil.example", configured), false);
  });

  it("echoes the allowed request origin in CORS headers", () => {
    const headers = getCorsHeaders("https://zenith.example", ["https://zenith.example"]);
    assert.equal(headers["Access-Control-Allow-Origin"], "https://zenith.example");
    assert.equal(headers["Vary"], "Origin");
  });

  it("does not allow arbitrary models", () => {
    assert.equal(ALLOWED_MODELS.includes("anthropic/claude-sonnet-4.6"), true);
    assert.equal(isAllowedModel("anthropic/claude-sonnet-4.6"), true);
    assert.equal(isAllowedModel("openai/some-expensive-unapproved-model"), false);
    assert.equal(isAllowedModel(123), false);
  });

  it("accepts a normal chat payload and normalizes history", () => {
    const result = validateChatRequestBody({
      sessionId: "abc",
      content: "hello",
      model: "anthropic/claude-sonnet-4.6",
      messageHistory: [{ role: "user", content: "previous" }],
      images: [],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.content, "hello");
      assert.deepEqual(result.value.messageHistory, [{ role: "user", content: "previous" }]);
      assert.deepEqual(result.value.images, []);
    }
  });

  it("rejects oversized content, history, images, and unsupported roles", () => {
    assert.equal(validateChatRequestBody({ content: "x".repeat(8001), model: "anthropic/claude-sonnet-4.6" }).ok, false);
    assert.equal(validateChatRequestBody({ content: "ok", model: "anthropic/claude-sonnet-4.6", messageHistory: new Array(21).fill({ role: "user", content: "x" }) }).ok, false);
    assert.equal(validateChatRequestBody({ content: "ok", model: "anthropic/claude-sonnet-4.6", images: ["data:image/png;base64,a", "data:image/png;base64,b", "data:image/png;base64,c", "data:image/png;base64,d"] }).ok, false);
    assert.equal(validateChatRequestBody({ content: "ok", model: "anthropic/claude-sonnet-4.6", messageHistory: [{ role: "system", content: "bad" }] }).ok, false);
  });
});

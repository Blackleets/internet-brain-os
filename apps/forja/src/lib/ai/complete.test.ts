import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeAI, invocationHasSecret } from "./complete.ts";
import { PROVIDER_ENDPOINTS, providerHttpError } from "./adapters.ts";
import { defaultModelFor } from "./catalog.ts";
import { itIsolated } from "../kernel/test-isolate.ts";
import {
  AI_BOUNDARIES,
  aiAdmitMemory,
  aiDecideConfidence,
  aiMutatePolicies,
  aiSkipAuthority,
  chatAsEvidence,
  chatAsMemory,
  responseAsEvidence,
  responseAsMemory,
} from "./boundaries.ts";
import { redactSecrets } from "./redact.ts";
import { useAI } from "./store.ts";
import { recordAIInvocation } from "./observe.ts";
import { useKernel } from "../kernel/store.ts";
import { kernelFingerprint, replaySeal } from "../kernel/replay.ts";
import { composeDossier } from "../kernel/dossier.ts";
import { admitEvidence } from "../kernel/admission.ts";
import type { AICompleteRequest, ProviderId } from "./types.ts";
import type { Evidence, Finding } from "../kernel/types.ts";

const SECRET = "sk-secret-test-key-1234567890";

function request(over: Partial<AICompleteRequest> & Pick<AICompleteRequest, "selection">): AICompleteRequest {
  return {
    task: "chat",
    operation: "chat",
    messages: [{ role: "user", content: "hola" }],
    ...over,
  };
}

function jsonResponse(url: string, content: string, model = "mock-model"): Response {
  const openai = {
    model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
  const anthropic = {
    model,
    content: [{ text: content }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
  const body = url.includes("anthropic") ? anthropic : openai;
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("AI abstraction", { concurrency: false }, () => {
  it("1. two providers can run the same operation", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(new URL(url).hostname);
      return jsonResponse(url, "ok", "model-a");
    };
    const openai = await completeAI(
      request({
        operation: "interpret",
        selection: { provider: "openai", model: "gpt-4o", apiKey: SECRET },
      }),
      { fetchImpl },
    );
    const anthropic = await completeAI(
      request({
        operation: "interpret",
        selection: { provider: "anthropic", model: "claude-sonnet-4-20250514", apiKey: SECRET },
      }),
      { fetchImpl },
    );
    assert.equal(openai.ok, true);
    assert.equal(anthropic.ok, true);
    if (openai.ok && anthropic.ok) {
      assert.equal(openai.invocation.provider, "openai");
      assert.equal(anthropic.invocation.provider, "anthropic");
      assert.equal(openai.invocation.operation, anthropic.invocation.operation);
    }
    assert.equal(seen.includes(PROVIDER_ENDPOINTS.openai.host), true);
    assert.equal(seen.includes(PROVIDER_ENDPOINTS.anthropic.host), true);
  });

  itIsolated("2. changing model does not mutate the Kernel", () => {
    const before = kernelFingerprint(useKernel.getState());
    useAI.getState().select("openai", "gpt-4o");
    useAI.getState().setKey("openai", SECRET);
    assert.equal(kernelFingerprint(useKernel.getState()), before);
    assert.equal(useKernel.getState().evidence.length, 0);
    assert.equal(useKernel.getState().memory.length, 0);
  });

  it("3. an LLM reply cannot become admitted memory", () => {
    assert.equal(responseAsMemory("un hecho inventado").ok, false);
    assert.equal(aiAdmitMemory().ok, false);
    assert.equal(AI_BOUNDARIES.mayAdmitMemory, false);
  });

  it("4. an LLM reply cannot become evidence", () => {
    assert.equal(responseAsEvidence("https://example.com dice 20").ok, false);
    const gate = admitEvidence({
      id: "e_from_llm",
      goalId: "g1",
      url: "https://example.com/x",
      title: "del modelo",
      sourceHost: "example.com",
      excerpt: "",
      contentHash: "short",
      retrievedAt: "",
      httpStatus: 0,
      bytes: 0,
      validation: "rejected",
    } as Evidence);
    assert.equal(gate.ok, false);
    assert.equal(AI_BOUNDARIES.mayCreateEvidence, false);
  });

  itIsolated("5. chat does not become memory", () => {
    useKernel.getState().addChat("user", "recuerda que el taladro cuesta 20");
    useKernel.getState().addChat("assistant", "Lo tendré en cuenta.", {
      provider: "xai",
      model: "grok-4.5",
    });
    assert.equal(useKernel.getState().memory.length, 0);
    assert.equal(chatAsMemory("Lo tendré en cuenta.").ok, false);
    assert.equal(chatAsEvidence("Lo tendré en cuenta.").ok, false);
    assert.equal(AI_BOUNDARIES.mayTreatChatAsMemory, false);
  });

  itIsolated("6. provider and model are recorded in activity", () => {
    recordAIInvocation({
      result: {
        ok: true,
        text: "ok",
        invocation: {
          provider: "openai",
          model: "gpt-4o",
          operation: "interpret",
          at: "2026-08-29T00:00:00.000Z",
          latencyMs: 12,
          usage: { promptTokens: 10, completionTokens: 4, estimatedCostUsd: 0.0001 },
        },
      },
      correlationId: "g1",
      goalId: "g1",
    });
    const event = useKernel.getState().activity.find((item) => item.kind === "ai.completed");
    assert.ok(event);
    assert.equal(event.ai?.provider, "openai");
    assert.equal(event.ai?.model, "gpt-4o");
    assert.equal(event.summary.includes(SECRET), false);
  });

  itIsolated("7. a provider failure does not corrupt the Kernel", async () => {
    const goal = useKernel.getState().createGoal("Taladro 18-25");
    const before = kernelFingerprint(useKernel.getState());
    const fetchImpl: typeof fetch = async () =>
      new Response("unauthorized " + SECRET, { status: 401 });
    const result = await completeAI(
      request({ selection: { provider: "openai", model: "gpt-4o", apiKey: SECRET } }),
      { fetchImpl },
    );
    assert.equal(result.ok, false);
    recordAIInvocation({ result, correlationId: goal.id, goalId: goal.id });
    assert.equal(kernelFingerprint(useKernel.getState()), before);
    assert.equal(useKernel.getState().evidence.length, 0);
    assert.equal(useKernel.getState().memory.length, 0);
    assert.equal(JSON.stringify(result).includes(SECRET), false);
  });

  it("8. fallback records the model that actually answered", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.openai.com")) {
        return new Response("down", { status: 503 });
      }
      return jsonResponse(url, "ok-from-router", "anthropic/claude-sonnet-4");
    };
    const result = await completeAI(
      request({
        operation: "chat",
        selection: {
          provider: "openai",
          model: "gpt-4o",
          apiKey: SECRET,
          fallbacks: [{ provider: "openrouter", model: "anthropic/claude-sonnet-4", apiKey: SECRET }],
        },
      }),
      { fetchImpl },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.invocation.provider, "openrouter");
      assert.equal(result.invocation.model, "anthropic/claude-sonnet-4");
      assert.equal(result.invocation.fallbackFrom?.provider, "openai");
      assert.equal(result.invocation.fallbackFrom?.model, "gpt-4o");
    }
  });

  itIsolated("9. API keys never appear in activity, replay or export", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(`invalid key ${SECRET}`, { status: 401 });
    const result = await completeAI(
      request({ selection: { provider: "xai", model: "grok-4.5", apiKey: SECRET } }),
      { fetchImpl },
    );
    recordAIInvocation({ result, correlationId: "g1", goalId: "g1" });
    const exportText = useKernel.getState().exportKernel();
    const activityText = JSON.stringify(useKernel.getState().activity);
    assert.equal(exportText.includes(SECRET), false);
    assert.equal(activityText.includes(SECRET), false);
    assert.equal(JSON.stringify(result).includes(SECRET), false);
    assert.equal(invocationHasSecret(result, [SECRET]), false);
    assert.equal(redactSecrets(`Bearer ${SECRET}`, [SECRET]).includes(SECRET), false);
  });

  itIsolated("10. Replay preserves the provider and model used then", async () => {
    const kernel = useKernel.getState();
    const goal = kernel.createGoal("Taladro 18-25 euros");
    const evidence: Evidence = {
      id: `e_${goal.id}`,
      goalId: goal.id,
      url: "https://example.com/drill",
      title: "Taladro 20 EUR",
      sourceHost: "example.com",
      excerpt: "Taladro 20 EUR observado en ficha pública.",
      contentHash: "abc123def4567890abcd",
      retrievedAt: "2026-08-29T00:00:00.000Z",
      httpStatus: 200,
      bytes: 40,
      validation: "retrieved",
    };
    const finding: Finding = {
      id: `f_${goal.id}`,
      goalId: goal.id,
      title: "Precio observado",
      answer: "Hay un taladro a 20 EUR.",
      whyItMatters: "Encaja en el rango.",
      confidence: "medium",
      evidenceIds: [evidence.id],
      uncertainties: [],
      nextAction: "",
      interpretationAvailable: true,
      createdAt: evidence.retrievedAt,
    };
    assert.equal(kernel.tryAdmitEvidence(evidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(finding).ok, true);
    recordAIInvocation({
      result: {
        ok: true,
        text: "",
        invocation: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          operation: "interpret",
          at: "2026-08-29T00:00:01.000Z",
          latencyMs: 40,
        },
      },
      correlationId: goal.id,
      goalId: goal.id,
    });
    const liveGoal = useKernel.getState().goals.find((item) => item.id === goal.id);
    assert.ok(liveGoal);
    const dossier = await composeDossier({
      goal: liveGoal,
      findings: [finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(dossier);
    assert.equal(useKernel.getState().sealDossier(dossier).ok, true);
    const sealed = useKernel.getState().dossiers[0];
    useAI.getState().select("openai", "gpt-4o");
    const replayed = replaySeal(useKernel.getState(), sealed.id);
    const historic = replayed.activity.find((item) => item.kind === "ai.completed");
    assert.ok(historic);
    assert.equal(historic.ai?.provider, "anthropic");
    assert.equal(historic.ai?.model, "claude-sonnet-4-20250514");
    assert.equal(useAI.getState().provider, "openai");
  });

  it("11. OpenRouter uses the common adapter, not a parallel path", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      assert.equal(url, PROVIDER_ENDPOINTS.openrouter.url);
      return jsonResponse(url, "via-router", "x-ai/grok-4.5");
    };
    const result = await completeAI(
      request({
        selection: { provider: "openrouter", model: "x-ai/grok-4.5", apiKey: SECRET },
      }),
      { fetchImpl },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.invocation.provider, "openrouter");
      assert.equal(result.invocation.model, "x-ai/grok-4.5");
    }
    assert.equal(seen.length, 1);
  });

  it("12. providers can be added without changing Kernel authority", () => {
    assert.equal(AI_BOUNDARIES.maySkipAuthority, false);
    assert.equal(AI_BOUNDARIES.mayMutateKernel, false);
    assert.equal(AI_BOUNDARIES.mayDecideConfidence, false);
    assert.equal(aiSkipAuthority().ok, false);
    assert.equal(aiDecideConfidence().ok, false);
    assert.equal(aiMutatePolicies().ok, false);
    const providers: ProviderId[] = ["openrouter", "openai", "anthropic", "google", "xai"];
    assert.deepEqual(providers.slice().sort(), ["anthropic", "google", "openai", "openrouter", "xai"]);
  });

  it("13. spending-limit is named, not a bare HTTP 403", () => {
    const message = providerHttpError(
      403,
      JSON.stringify({
        code: "personal-team-blocked:spending-limit",
        error: "You have run out of credits or need a Grok subscription.",
      }),
      [SECRET],
    );
    assert.match(message, /sin crédito o suscripción/i);
    assert.equal(message.includes(SECRET), false);
  });

  it("14. probing another provider does not send the selected model", () => {
    assert.equal(
      defaultModelFor("openai", { provider: "xai", model: "grok-4.5" }),
      "gpt-4o",
    );
    assert.equal(
      defaultModelFor("xai", { provider: "xai", model: "grok-4.5" }),
      "grok-4.5",
    );
  });

  it("15. a 403 spending-limit is BLOCKED, not a failed interpretation to invent", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          code: "personal-team-blocked:spending-limit",
          error: "You have run out of credits or need a Grok subscription.",
        }),
        { status: 403 },
      );
    const result = await completeAI(
      request({ selection: { provider: "xai", model: "grok-4.5", apiKey: SECRET } }),
      { fetchImpl },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, "BLOCKED");
      assert.match(result.error, /crédito|suscripción/i);
    }
    assert.equal(JSON.stringify(result).includes(SECRET), false);
  });
});

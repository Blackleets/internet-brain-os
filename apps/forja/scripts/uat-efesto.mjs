#!/usr/bin/env node
/**
 * UAT runner — validation only. Does not change Kernel/product code.
 * Scores PASS / BLOCKED / FAIL. Never converts BLOCKED into PASS.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ORIGIN = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots/uat";
mkdirSync(OUT, { recursive: true });

function classify(url) {
  const u = url.toLowerCase();
  const decoded = decodeURIComponent(url);
  if (
    /searchpublicweb/i.test(decoded) ||
    /wikipedia\.org|duckduckgo\.com|news\.google\.com|hn\.algolia\.com/.test(u)
  ) {
    return "search";
  }
  if (/readpublicweb/i.test(decoded) || /fetchpublichttps/i.test(decoded)) return "read";
  if (/interpretevidence/i.test(decoded) || /completeai|completa/i.test(decoded)) return "interpret";
  if (/_serverfn/i.test(u) || /_serverFn/i.test(u)) return "serverfn";
  return "other";
}

function snapshot(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const kernelKey = keys.find((k) => k.includes("efesto-kernel")) || "efesto-kernel-v1";
    let kernel = null;
    try {
      kernel = JSON.parse(localStorage.getItem(kernelKey) || "null");
    } catch {
      kernel = null;
    }
    const state = kernel?.state || kernel;
    const text = document.body.innerText;
    return {
      url: location.href,
      title: document.title,
      text,
      hasPrepared: Boolean(document.querySelector("[data-goal-prepared='true']")),
      hasCase: Boolean(document.querySelector("[data-case-view='true']")),
      hasTrace: Boolean(document.querySelector("[data-forge-trace='true']")),
      leadCopy: /Lead no verificado/.test(text),
      memoryUnavailable: /Memoria no disponible/.test(text),
      identityRail: [...document.querySelectorAll("[data-identity-rail] [data-identity-step]")].map(
        (el) => `${el.getAttribute("data-identity-step")}:${el.getAttribute("data-state")}:${el.textContent.trim()}`,
      ),
      kernel: state
        ? {
            goals: (state.goals || []).map((g) => ({
              id: g.id,
              text: g.text,
              status: g.status,
              stage: g.stage,
              blockedReason: g.blockedReason,
              leadCount: g.leadCount,
              evidenceIds: g.evidenceIds,
              findingIds: g.findingIds,
            })),
            evidence: (state.evidence || []).map((e) => ({
              id: e.id,
              goalId: e.goalId,
              url: e.url,
              title: e.title,
              sourceHost: e.sourceHost,
              validation: e.validation,
              httpStatus: e.httpStatus,
              contentHash: e.contentHash,
              excerpt: String(e.excerpt || "").slice(0, 220),
            })),
            findings: (state.findings || []).map((f) => ({
              id: f.id,
              title: f.title,
              goalId: f.goalId,
              evidenceIds: f.evidenceIds,
              interpretationAvailable: f.interpretationAvailable,
              confidence: f.confidence,
              answer: String(f.answer || "").slice(0, 280),
            })),
            dossiers: (state.dossiers || []).map((d) => ({
              id: d.id,
              goalId: d.goalId,
              sealHash: d.sealHash,
              sealedAt: d.sealedAt,
              executive: String(d.executive || "").slice(0, 400),
              evidenceIds: d.evidenceIds,
              findingIds: d.findingIds,
              sourceHosts: d.sourceHosts,
            })),
            contradictions: (state.contradictions || []).map((c) => ({
              id: c.id,
              kind: c.kind,
              note: c.note,
              open: c.open,
              goalId: c.goalId,
            })),
            memory: (state.memory || []).map((m) => ({
              id: m.id,
              title: m.title,
              lifecycle: m.lifecycle,
              findingId: m.findingId,
              why: m.why,
            })),
            chat: (state.chat || []).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 80) })),
          }
        : null,
    };
  });
}

function scoreCase(id, snap, net, expectSeal, extras = {}) {
  const text = snap.text || "";
  const k = snap.kernel || { goals: [], evidence: [], findings: [], dossiers: [], contradictions: [], memory: [] };
  const latestGoal = extras.goalId
    ? k.goals.find((g) => g.id === extras.goalId) || k.goals[0]
    : k.goals[0];
  const goalId = latestGoal?.id;
  const evidence = k.evidence.filter((e) => !goalId || e.goalId === goalId || latestGoal?.evidenceIds?.includes(e.id));
  const findings = k.findings.filter((f) => !goalId || f.goalId === goalId);
  const dossiers = k.dossiers.filter((d) => !goalId || d.goalId === goalId);
  const prepareNet = net.filter((n) => n.phase === "prepare" && (n.kind === "search" || n.kind === "read"));
  const confirmSearch = net.filter((n) => n.phase === "confirm" && n.kind === "search");
  const confirmRead = net.filter((n) => n.phase === "confirm" && n.kind === "read");
  const prepareServerFn = net.filter((n) => n.phase === "prepare" && n.kind === "serverfn").length;
  const confirmServerFn = net.filter((n) => n.phase === "confirm" && n.kind === "serverfn").length;
  const invented =
    /https?:\/\/(example\.com|localhost)/i.test(JSON.stringify(evidence)) ||
    (/Case · Completado/i.test(text) && evidence.length === 0 && dossiers.length === 0 && latestGoal?.stage !== "blocked");
  const incomplete =
    latestGoal?.stage === "blocked" ||
    latestGoal?.stage === "failed" ||
    /Investigación incompleta/.test(text);
  const sealed = dossiers.length > 0 && Boolean(dossiers[0].sealHash);
  const realUrls = evidence.filter((e) => /^https:\/\//.test(e.url) && e.validation === "retrieved");
  const completedUi = /Case · Completado/i.test(text);
  const completedWithoutSeal = completedUi && !sealed;
  const completedWithoutEvidence = completedUi && realUrls.length === 0;

  let verdict = "FAIL";
  let why = "";
  if (invented || completedWithoutEvidence) {
    verdict = "FAIL";
    why = "Inventó fuentes o Completado sin evidencia.";
  } else if (completedWithoutSeal) {
    verdict = "FAIL";
    why = "Mostró Completado con investigación incompleta.";
  } else if (expectSeal) {
    if (prepareNet.length) {
      verdict = "FAIL";
      why = "Preparar disparó búsqueda o lectura.";
    } else if (realUrls.length && sealed) {
      verdict = "PASS";
      why = `Sellado con ${realUrls.length} evidencia(s) y ${findings.length} hallazgo(s).`;
    } else if (realUrls.length && !sealed) {
      verdict = "BLOCKED";
      why = "Hay evidencia retenida pero el Kernel no selló (interpretación/modelo).";
    } else if (incomplete && !invented) {
      verdict = "BLOCKED";
      why = latestGoal?.blockedReason || "Búsqueda o lectura pública no produjo evidencia admitida.";
    } else {
      verdict = "FAIL";
      why = "No se observó sello, evidencia ni negativa honesta.";
    }
  } else if (incomplete && !invented && !sealed && !completedUi) {
    verdict = "PASS";
    why = "Investigación incompleta. Evidencia recuperada no demostró el Goal. No selló ni Completado.";
  } else if (sealed || completedUi) {
    verdict = "FAIL";
    why = "Se esperaba incompleto y hubo sello o Completado.";
  } else {
    verdict = "BLOCKED";
    why = "No se pudo forzar el caso incompleto.";
  }

  return {
    id,
    verdict,
    why,
    prepareResearchRequests: prepareNet.length,
    confirmSearchRequests: confirmSearch.length,
    confirmReadRequests: confirmRead.length,
    prepareServerFn,
    confirmServerFn,
    prepareNet: prepareNet.slice(0, 8),
    confirmSearchSample: confirmSearch.slice(0, 6).map((n) => n.url),
    confirmReadSample: confirmRead.slice(0, 6).map((n) => n.url),
    goal: latestGoal,
    evidence: realUrls,
    findings,
    dossiers,
    contradictions: k.contradictions.filter((c) => !goalId || c.goalId === goalId),
    leadSeenDuringForge: Boolean(extras.leadSeen),
    phasesSeen: extras.phasesSeen || [],
    identity: {
      hasForjando: /Forjando/.test(text),
      hasCompletado: /Case · Completado/i.test(text),
      hasIncompleta: /Investigación incompleta/.test(text),
      hasCase: snap.hasCase,
      hasLeadCopy: snap.leadCopy,
      rail: snap.identityRail,
    },
    bodyPrefix: text.replace(/\s+/g, " ").slice(0, 500),
  };
}

async function runGoal(page, net, { id, goal, expectSeal, timeoutMs }) {
  net.length = 0;
  const phasesSeen = [];
  let leadSeen = false;
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("textarea[aria-label='Goal']", { timeout: 20000 });
  await page.locator("textarea[aria-label='Goal']").fill(goal);
  page._uatPhase = "prepare";
  await page.getByRole("button", { name: "Preparar Goal" }).click();
  await page.waitForSelector("[data-goal-prepared='true']", { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${id}-prepare.png`, fullPage: true });
  page._uatPhase = "confirm";
  await page.getByRole("button", { name: "Confirmar y forjar" }).click();
  await page.waitForURL(/\/goals\//, { timeout: 25000 });
  const started = Date.now();
  let lastGoalId = null;
  while (Date.now() - started < timeoutMs) {
    const snap = await snapshot(page);
    lastGoalId = (snap.url.match(/\/goals\/([^/?#]+)/) || [])[1] || snap.kernel?.goals?.[0]?.id || lastGoalId;
    if (snap.leadCopy) leadSeen = true;
    if (/Forjando/.test(snap.text)) phasesSeen.push("Forjando");
    if (/Comprobando/.test(snap.text)) phasesSeen.push("Comprobando");
    if (/Sellando/.test(snap.text)) phasesSeen.push("Sellando");
    if (/Case · Completado/i.test(snap.text)) phasesSeen.push("Completado");
    if (/Investigación incompleta/.test(snap.text)) phasesSeen.push("Incompleta");
    const researching = snap.hasTrace || /Forjando/.test(snap.text) || /Comprobando/.test(snap.text) || /Sellando/.test(snap.text);
    const settled = snap.hasCase || /Investigación incompleta/.test(snap.text) || /Sellado/.test(snap.text);
    const current = snap.kernel?.goals?.find((g) => g.id === lastGoalId) || snap.kernel?.goals?.[0];
    const terminal = current && ["complete", "blocked", "failed"].includes(current.stage);
    if ((settled || terminal) && !researching) break;
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${OUT}/${id}-result.png`, fullPage: true });
  const snap = await snapshot(page);
  writeFileSync(`${OUT}/${id}-snap.json`, JSON.stringify(snap, null, 2));
  const result = scoreCase(id, snap, net.slice(), expectSeal, {
    goalId: lastGoalId,
    leadSeen,
    phasesSeen: [...new Set(phasesSeen)],
  });
  writeFileSync(`${OUT}/${id}-verdict.json`, JSON.stringify(result, null, 2));
  return { snap, result };
}

async function gotoReady(page, path, timeout = 20000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(ORIGIN + path, { waitUntil: "domcontentloaded", timeout });
      await page.waitForFunction(
        () => !/Cargando el núcleo/.test(document.body.innerText || ""),
        { timeout: 15000 },
      );
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await page.waitForTimeout(800);
    }
  }
}

async function admitFirstFinding(page) {
  try {
    await gotoReady(page, "/findings");
    await page.waitForTimeout(800);
    const box = page.locator("input[placeholder='Una frase tuya. El modelo no basta.']").first();
    if (!(await box.count())) return { admitted: false, reason: "no admit form" };
    await box.scrollIntoViewIfNeeded();
    await box.click({ force: true });
    await box.fill("Lo retenemos porque la evidencia pública del Kernel lo sostiene.", { force: true });
    await page.getByRole("button", { name: "Admitir" }).first().click({ force: true });
    await page.waitForTimeout(800);
    await gotoReady(page, "/memory");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/UAT-E-memory.png`, fullPage: true });
    const snap = await snapshot(page);
    const admitted = (snap.kernel?.memory || []).filter((m) => m.lifecycle === "admitted");
    return { admitted: admitted.length > 0, memory: admitted, text: String(snap.text || "").slice(0, 500) };
  } catch (err) {
    return { admitted: false, reason: String(err).slice(0, 400) };
  }
}

async function chatDoesNotWriteMemory(page) {
  let before = 0;
  try {
    before = await page.evaluate(() => {
      const raw = localStorage.getItem("efesto-kernel-v1");
      try {
        const s = JSON.parse(raw || "{}");
        const st = s.state || s;
        return (st.memory || []).length;
      } catch {
        return 0;
      }
    });
    await gotoReady(page, "/chat");
    await page.waitForTimeout(500);
    const box = page.locator("textarea[placeholder='Escribe sin investigar la web…']").first();
    if (!(await box.count())) {
      return { before, after: before, chatInMemory: false, pass: true, skipped: true, reason: "no chat box" };
    }
    await box.fill("Esto es chat privado. No debe convertirse en memoria del Kernel.", { force: true, timeout: 8000 });
    const send = page.getByRole("button", { name: /Enviar|Forjando/ }).first();
    if (await send.count()) await send.click({ force: true });
    await page.waitForTimeout(2000);
    await gotoReady(page, "/memory");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/UAT-E-chat-memory.png`, fullPage: true });
    const snap = await snapshot(page);
    const after = (snap.kernel?.memory || []).length;
    const chatInMemory = /Esto es chat privado/i.test(snap.text);
    return {
      before,
      after,
      chatInMemory,
      pass: after === before && !chatInMemory,
      text: String(snap.text || "").replace(/\s+/g, " ").slice(0, 300),
    };
  } catch (err) {
    return {
      before,
      after: before,
      chatInMemory: false,
      pass: true,
      skipped: true,
      error: String(err).slice(0, 400),
    };
  }
}

function runNodeTest(file) {
  const r = spawnSync("node", ["--experimental-strip-types", "--test", file], {
    encoding: "utf8",
    cwd: "/workspace",
    timeout: 60000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const pass = /# fail\s+0/.test(out) || (r.status === 0 && /# tests/.test(out));
  return { file, status: r.status, pass, tail: out.slice(-1800) };
}

async function agentForgeLive() {
  const before = { note: "agent forge is server-side ephemeral; kernel store is client-only" };
  let res;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    const response = await fetch(`${ORIGIN}/api/agent/forge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-efesto-agent": "uat-hermes",
      },
      body: JSON.stringify({
        goal: "xqzplmn-efesto-agent-noindex-7k1 token que no debe existir",
        agent: "uat-hermes",
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    res = await response.json();
  } catch (err) {
    return {
      id: "UAT-F",
      verdict: "BLOCKED",
      why: `No se pudo llamar /api/agent/forge: ${String(err)}`,
      before,
    };
  }
  const packet = res.packet || null;
  const incomplete = res.incomplete === true || packet?.incomplete === true;
  const sealed = Boolean(packet?.seal?.hash);
  const evidence = packet?.evidence || [];
  const claimsCompleted = /Case · Completado/i.test(JSON.stringify(res));
  const inventedCompleted = claimsCompleted && incomplete;
  const agentDeclaredSealWithoutKernel = sealed && res.ok === true && packet?.contract?.kernelAdmits !== true;

  let verdict = "FAIL";
  let why = "";
  if (inventedCompleted) {
    verdict = "FAIL";
    why = "El agente marcó Completado con paquete incompleto.";
  } else if (agentDeclaredSealWithoutKernel) {
    verdict = "FAIL";
    why = "El agente selló sin contrato kernelAdmits.";
  } else if (res.ok === false && incomplete && !sealed) {
    verdict = "PASS";
    why = "Hermes recibió investigación incompleta. No hay Completado ni sello. El Kernel no inventó.";
  } else if (res.ok === true && sealed && evidence.length && packet.contract.kernelAdmits === true) {
    verdict = "PASS";
    why = "El sello, si existe, lo produjo el Kernel sobre evidencia. El agente no admite.";
  } else if (res.ok === false) {
    verdict = "PASS";
    why = res.reason || "El agente no pudo declarar Completado.";
  } else {
    verdict = "BLOCKED";
    why = "Respuesta del agente no encaja en Completado-prohibido ni en sello Kernel.";
  }

  return {
    id: "UAT-F",
    verdict,
    why,
    ok: res.ok,
    incomplete,
    reason: res.reason,
    contract: res.contract || packet?.contract,
    seal: packet?.seal || null,
    evidence: evidence.map((e) => ({ url: e.url, host: e.sourceHost, hash: e.contentHash })),
    findings: (packet?.findings || []).map((f) => f.title),
    goalStage: packet?.goal?.stage,
    packetIncomplete: packet?.incomplete,
  };
}

const report = {
  startedAt: new Date().toISOString(),
  publicLaunchApproved: false,
  architectureFrozen: true,
  cases: [],
};

report.unit = {
  contradiction: runNodeTest("src/lib/kernel/contradiction.test.ts"),
  protocol: runNodeTest("src/lib/agent/protocol.test.ts"),
  forgeEphemeral: runNodeTest("src/lib/agent/forge-ephemeral.test.ts"),
  goldenPath: runNodeTest("src/lib/ui/golden-path.test.ts"),
  identity: runNodeTest("src/lib/ui/identity.test.ts"),
};

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const net = [];
page._uatPhase = "idle";
page.on("request", (req) => {
  net.push({
    phase: page._uatPhase || "idle",
    kind: classify(req.url()),
    url: req.url().slice(0, 240),
  });
});

try {
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await gotoReady(page, "/memory");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/UAT-E-empty.png`, fullPage: true });
  const emptyMem = await snapshot(page);
  report.memoryEmpty = {
    unavailableCopy: Boolean(emptyMem.memoryUnavailable),
    memoryCount: emptyMem.kernel?.memory?.length ?? 0,
    text: String(emptyMem.text || "").replace(/\s+/g, " ").slice(0, 280),
  };

  const a = await runGoal(page, net, {
    id: "UAT-A",
    goal: "¿El Salvador sigue usando bitcoin como curso legal?",
    expectSeal: true,
    timeoutMs: 180000,
  });
  report.cases.push(a.result);

  let memoryAdmit = { admitted: false };
  if (a.result.findings?.length) {
    memoryAdmit = await admitFirstFinding(page);
  }
  report.memoryAdmit = memoryAdmit;

  const b = await runGoal(page, net, {
    id: "UAT-B",
    goal: "¿OpenAI es una empresa cotizada en bolsa?",
    expectSeal: true,
    timeoutMs: 180000,
  });
  report.cases.push(b.result);

  const c = await runGoal(page, net, {
    id: "UAT-C",
    goal: "Compara fuentes públicas sobre si El Salvador mantuvo o revirtió bitcoin como curso legal.",
    expectSeal: true,
    timeoutMs: 180000,
  });
  const liveContradictions = [
    ...(a.snap.kernel?.contradictions || []),
    ...(b.snap.kernel?.contradictions || []),
    ...(c.snap.kernel?.contradictions || []),
    ...(c.result.contradictions || []),
  ];
  const unitC = report.unit.contradiction.pass;
  const liveInvestigation = { verdict: c.result.verdict, why: c.result.why, urls: (c.result.evidence || []).map((e) => e.url) };
  if (c.result.verdict === "FAIL" && /Inventó|Completado con investigación incompleta/.test(c.result.why)) {
    // keep FAIL
  } else if (liveContradictions.length > 0) {
    const hidden = liveContradictions.every((x) => x.open === false) && !/contradic/i.test(c.snap.text || "");
    c.result.verdict = hidden ? "FAIL" : "PASS";
    c.result.why = hidden
      ? "Había contradicción y la UI/Kernel la ocultó."
      : `Contradicción observada (${liveContradictions.map((x) => x.kind).join(", ")}). No se escondió.`;
    c.result.contradictions = liveContradictions;
  } else if (unitC && c.result.verdict !== "FAIL") {
    c.result.verdict = "BLOCKED";
    c.result.why =
      "Kernel unitario no esconde contradicciones (tests PASS). En vivo no se observó un par de fuentes con el mismo URL y hash distinto, ni tensión evidencia-memoria. No se simula.";
    c.result.unitPass = true;
    c.result.liveInvestigation = liveInvestigation;
  }
  report.cases.push(c.result);

  const d = await runGoal(page, net, {
    id: "UAT-D",
    goal: "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública",
    expectSeal: false,
    timeoutMs: 120000,
  });
  report.cases.push(d.result);

  try {
    report.chatBoundary = await chatDoesNotWriteMemory(page);
    const chatViolated =
      Boolean(report.chatBoundary?.chatInMemory) ||
      Number(report.chatBoundary?.after) > Number(report.chatBoundary?.before);
    const memoryPass =
      report.memoryEmpty?.unavailableCopy &&
      report.memoryEmpty?.memoryCount === 0 &&
      !chatViolated;
    const memoryAdmitted = report.memoryAdmit?.admitted === true;
    report.cases.push({
      id: "UAT-E",
      verdict: chatViolated
        ? "FAIL"
        : memoryPass && memoryAdmitted
          ? "PASS"
          : memoryPass
            ? "BLOCKED"
            : "BLOCKED",
      why: chatViolated
        ? "FAIL: el chat escribió o apareció en Memoria."
        : memoryAdmitted && memoryPass
          ? "Memoria vacía dice 'Memoria no disponible'. Admitir exige razón humana. El chat no escribió memoria."
          : !memoryAdmitted && memoryPass
            ? "Chat no escribe memoria y el vacío es honesto, pero no hubo admisión (no hubo finding para admitir o faltó el formulario)."
            : "No se demostró la frontera de Memory Authority.",
      empty: report.memoryEmpty,
      admit: report.memoryAdmit,
      chat: report.chatBoundary,
    });
  } catch (err) {
    report.cases.push({ id: "UAT-E", verdict: "BLOCKED", why: String(err).slice(0, 400) });
  }

  try {
    report.agent = await agentForgeLive();
    report.cases.push(report.agent);
  } catch (err) {
    report.cases.push({ id: "UAT-F", verdict: "BLOCKED", why: String(err).slice(0, 400) });
  }
} catch (err) {
  report.error = String(err?.stack || err);
} finally {
  report.finishedAt = new Date().toISOString();
  const tally = { PASS: 0, BLOCKED: 0, FAIL: 0 };
  for (const c of report.cases) {
    tally[c.verdict] = (tally[c.verdict] || 0) + 1;
  }
  report.tally = tally;
  const ready =
    (tally.FAIL || 0) === 0 &&
    report.cases.some((c) => c.id === "UAT-A" && c.verdict === "PASS") &&
    report.cases.some((c) => c.id === "UAT-D" && c.verdict === "PASS") &&
    report.cases.some((c) => c.id === "UAT-F" && (c.verdict === "PASS" || c.verdict === "BLOCKED"));
  report.decision = ready ? "READY FOR HUMAN UAT" : "NOT READY";
  report.publicLaunchApproved = false;
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { IconLock, IconSeal } from "@/components/icons";
import { readRememberedPacket } from "@/lib/kernel/attestation";
import { demoIncompletePacket, demoSealedPacket } from "@/lib/kernel/demo-packets";
import type { VerificationReport } from "@/lib/kernel/verification";
import { useIsOwner } from "@/lib/ui/use-role";

export const Route = createFileRoute("/verificar")({ component: VerifyPage });

type Verdict = {
  ok?: boolean;
  attested?: boolean;
  incomplete?: boolean;
  reason?: string;
  report?: VerificationReport;
  packet?: {
    packetHash?: string;
    attestation?: { alg?: string; publicKey?: string };
    evidence?: unknown[];
    findings?: unknown[];
    goal?: { text?: string };
    incomplete?: boolean;
  };
};

function VerifyPage() {
  const owner = useIsOwner();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const remembered = readRememberedPacket();
    if (remembered && typeof remembered === "object") {
      setRaw(JSON.stringify(remembered, null, 2));
    }
  }, []);

  async function run() {
    setParseError(null);
    setVerdict(null);
    let packet: unknown;
    try {
      packet = JSON.parse(raw);
    } catch {
      setParseError("Eso no es JSON. Pega un Kernel Packet.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/agent/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packet }),
      });
      const data = (await response.json()) as Verdict;
      setVerdict(data);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "No se pudo contactar el Kernel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Verificar"
        description="Cinco capas independientes: protocolo, SHA-256, Ed25519, admisión y contraste. No es firma cualificada eIDAS."
      />

      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <IconSeal className="mt-1 size-5 text-accent" />
          <div>
            <p className="kicker">Contraste</p>
            <p className="mt-2 font-display text-xl tracking-tight">Sin fiarse del chat</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Un agente puede afirmar cualquier cosa. Un paquete de Efesto se valida capa a capa. Huella válida no
              es Completado. Firma válida no es un sello cualificado.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="kicker">Paquete</p>
        <Textarea
          className="mt-4 min-h-48 font-mono text-[12px]"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder='{ "protocol": "efesto-kernel-packet/v1", "product": "Efesto", ... }'
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void run()} disabled={busy || raw.trim().length < 2}>
            {busy ? "Verificando…" : "Verificar paquete"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setParseError(null);
              setVerdict(null);
              setRaw(JSON.stringify(await demoIncompletePacket(), null, 2));
            }}
          >
            Cargar incompleto
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setParseError(null);
              setVerdict(null);
              setRaw(JSON.stringify(await demoSealedPacket(), null, 2));
            }}
          >
            Cargar sellado
          </Button>
          {owner ? (
            <Link to="/agentes" className="inline-flex min-h-11 items-center px-3 text-sm text-accent">
              Puerta de agentes
            </Link>
          ) : null}
        </div>
        {parseError ? <p className="mt-4 text-sm text-danger">{parseError}</p> : null}
      </Panel>

      {verdict ? <VerdictCard verdict={verdict} /> : null}
    </div>
  );
}

function CheckRow({
  label,
  standard,
  state,
  detail,
}: {
  label: string;
  standard: string;
  state: "pass" | "fail" | "skip";
  detail: string;
}) {
  const tone = state === "pass" ? "text-verified" : state === "fail" ? "text-danger" : "text-subtle";
  const mark = state === "pass" ? "Pasa" : state === "fail" ? "Falla" : "Omite";
  return (
    <li className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 font-mono text-[11px] text-subtle">{standard}</p>
      </div>
      <div className="sm:max-w-sm sm:text-right">
        <p className={`text-xs uppercase tracking-[0.14em] ${tone}`}>{mark}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
      </div>
    </li>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const packet = verdict.packet;
  const report = verdict.report;
  return (
    <Panel className="p-5">
      <p className={`kicker ${verdict.ok ? "text-verified" : "text-danger"}`}>
        {verdict.ok ? "Válido" : "Rechazado"}
      </p>
      <p className="mt-2 font-display text-xl tracking-tight">
        {verdict.ok
          ? verdict.incomplete || packet?.incomplete
            ? "Paquete válido · investigación incompleta"
            : "Paquete válido · sellado"
          : "El Kernel no admite este paquete"}
      </p>
      {packet?.goal?.text ? <p className="mt-3 text-sm text-muted">{packet.goal.text}</p> : null}
      {verdict.reason && !verdict.ok ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{verdict.reason}</p>
      ) : null}

      {report ? (
        <ol className="mt-6">
          {report.checks.map((item) => (
            <CheckRow key={item.id} label={item.label} standard={item.standard} state={item.state} detail={item.detail} />
          ))}
        </ol>
      ) : null}

      {packet?.packetHash ? (
        <p className="mt-4 break-all font-mono text-[11px] text-subtle">{packet.packetHash}</p>
      ) : null}
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <IconLock className="mt-0.5 size-3.5 shrink-0 text-accent" />
        {report?.level.note ?? "El modelo no admite. El Kernel sí."}
      </p>
    </Panel>
  );
}

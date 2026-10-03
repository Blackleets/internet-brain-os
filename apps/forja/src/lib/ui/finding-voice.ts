const LABEL_RE =
  /(DATOS OBSERVADOS|M[ÉE]TRICAS|AN[ÁA]LISIS|ESCENARIOS|INCERTIDUMBRE|OBSERVADO|INTERPRETADO)\s*[:.·—–-]\s*/gi;

function fold(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

export function splitLabeledAnswer(answer: string): {
  interpretation: string;
  extraUncertainties: string[];
} {
  const source = answer.replace(/\r/g, "").trim();
  if (!source) return { interpretation: "", extraUncertainties: [] };
  const hits: Array<{ label: string; bodyStart: number; start: number }> = [];
  const matcher = new RegExp(LABEL_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(source))) {
    hits.push({
      label: fold(match[1] ?? ""),
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  if (!hits.length) return { interpretation: source, extraUncertainties: [] };

  const sections = hits.map((hit, index) => ({
    label: hit.label,
    body: source.slice(hit.bodyStart, hits[index + 1]?.start).trim(),
  }));

  const analysis = sections.find((item) => item.label === "ANALISIS" || item.label === "INTERPRETADO")?.body;
  const extraUncertainties = sections
    .filter((item) => item.label === "INCERTIDUMBRE" || item.label === "ESCENARIOS")
    .flatMap((item) => item.body.split(/\n|•|;/g).map((row) => row.replace(/^[-–]\s*/, "").trim()).filter(Boolean));

  const leftover = sections
    .filter((item) => !["DATOS OBSERVADOS", "OBSERVADO", "METRICAS", "INCERTIDUMBRE", "ESCENARIOS"].includes(item.label))
    .map((item) => item.body)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const interpretation = (analysis || leftover || source.replace(LABEL_RE, "").trim()).trim();
  return { interpretation, extraUncertainties };
}

export function interpretationVoice(answer: string): string {
  return splitLabeledAnswer(answer).interpretation;
}

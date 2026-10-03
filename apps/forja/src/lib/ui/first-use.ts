export const FIRST_USE_STEPS = [
  {
    n: "01",
    title: "Escribe lo que necesitas saber de verdad",
    body: "No un prompt creativo. Una pregunta cuya respuesta te importaría demostrar: una empresa, una norma, un mercado, una afirmación que has oído.",
  },
  {
    n: "02",
    title: "Prepara el Goal y confirma",
    body: "Preparar no busca. Confirmar abre el caso: verás las consultas, los sitios, las páginas que pudo leer y las que no. Eso no es decoración: es el trabajo. Si se queda en negro, no está forjando.",
  },
  {
    n: "03",
    title: "Lee el recibo, no el titular",
    body: "Recuperado no es hallazgo. El Kernel sella o dice investigación incompleta. Si no hay soporte, funcionó: no inventó fuentes.",
  },
] as const;

export const HOW_YOU_KNOW = [
  "Ves consultas y páginas reales, no un spinner eterno.",
  "Cada hallazgo cita una URL leída y una huella SHA-256.",
  "jwt.io u otra página ajena no cierra el caso.",
  "Si no hay soporte, dice investigación incompleta. Nunca Completado inventado.",
] as const;

export const WHY_NOT_PERPLEXITY = {
  perplexity: "Te da una respuesta redonda, con enlaces. Suena acabada aunque las fuentes no cubran la pregunta.",
  efesto:
    "Te da un sello. Distingue lo observado de lo interpretado. Si la web no alcanza, lo dice. Un agente no puede marcar Completado por su cuenta.",
  choose:
    "Elige Perplexity si quieres una respuesta ahora. Elige Efesto si te importa poder demostrar de dónde salió — o admitir que no salió de ninguna parte.",
} as const;

export const AGENT_STEPS = {
  grok: [
    "Copia la URL OpenAPI de Efesto.",
    "En Grok, abre Acciones personalizadas e importa esa URL.",
    "Pregúntale algo que deba ser verdad. Grok tiene que llamar a Efesto, no contestarte de memoria.",
    "Funciona si ves un paquete con huella, o Investigación incompleta. Si Grok te suelta una respuesta redonda sin paquete, no está usando Efesto.",
  ],
  hermes: [
    "Copia la URL MCP de Efesto.",
    "En Hermes, añade un servidor MCP HTTP con esa URL.",
    "Hazle la pregunta. Hermes debe usar la herramienta de forja, no improvisar fuentes.",
    "Funciona igual: paquete con huella, o incompleto. Hermes no puede declarar Completado si el Kernel no selló.",
  ],
  openclaw: [
    "Copia el skill de Efesto.",
    "Pégalo en OpenClaw como skill del Kernel.",
    "Pídele que forje un objetivo. El sello lo pone Efesto, no el modelo.",
    "Funciona si el skill devuelve un Kernel Packet verificable. Sin paquete, OpenClaw está hablando por su cuenta.",
  ],
} as const;

export const ATTESTATION_ALG = "Ed25519" as const;
export const LAST_PACKET_KEY = "efesto:last-packet";

export type PacketAttestation = {
  alg: typeof ATTESTATION_ALG;
  publicKey: string;
  signature: string;
};

type Cached = { publicKey: CryptoKey; privateKey: CryptoKey; publicKeyB64: string };

let cached: Cached | null = null;

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin);
}

function b64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function storeBrowserKeys(publicKeyB64: string, pkcs8B64: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("efesto:attestation", JSON.stringify({ publicKeyB64, pkcs8B64 }));
  } catch {
    /* private forge; storage can be blocked */
  }
}

function readBrowserKeys(): { publicKeyB64: string; pkcs8B64: string } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("efesto:attestation");
    if (!raw) return null;
    const row = JSON.parse(raw) as { publicKeyB64?: string; pkcs8B64?: string };
    if (!row.publicKeyB64 || !row.pkcs8B64) return null;
    return { publicKeyB64: row.publicKeyB64, pkcs8B64: row.pkcs8B64 };
  } catch {
    return null;
  }
}

async function pairFromParts(publicKeyB64: string, pkcs8B64: string): Promise<Cached> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    asBuffer(b64ToBytes(publicKeyB64)),
    { name: "Ed25519" },
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    asBuffer(b64ToBytes(pkcs8B64)),
    { name: "Ed25519" },
    true,
    ["sign"],
  );
  return { publicKey, privateKey, publicKeyB64 };
}

async function loadPair(): Promise<Cached> {
  if (cached) return cached;
  const stored = readBrowserKeys();
  if (stored) {
    cached = await pairFromParts(stored.publicKeyB64, stored.pkcs8B64);
    return cached;
  }
  const generated = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", generated.privateKey));
  const publicKeyB64 = bytesToB64(publicRaw);
  storeBrowserKeys(publicKeyB64, bytesToB64(pkcs8));
  cached = { publicKey: generated.publicKey, privateKey: generated.privateKey, publicKeyB64 };
  return cached;
}

export async function instancePublicKey(): Promise<string> {
  return (await loadPair()).publicKeyB64;
}

export async function instanceAttestationInfo() {
  return {
    alg: ATTESTATION_ALG,
    publicKey: await instancePublicKey(),
    note: "Un Kernel Packet se verifica sin fiarse del chat: SHA-256 del cuerpo canónico + Ed25519 sobre la huella. La clave pública viaja en el paquete.",
  };
}

export async function attestPacketHash(packetHash: string): Promise<PacketAttestation> {
  const pair = await loadPair();
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(packetHash)),
  );
  return {
    alg: ATTESTATION_ALG,
    publicKey: pair.publicKeyB64,
    signature: bytesToB64(signature),
  };
}

export async function verifyPacketAttestation(
  packetHash: string,
  attestation: PacketAttestation | undefined | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!attestation) return { ok: false, reason: "El paquete no tiene firma." };
  if (attestation.alg !== ATTESTATION_ALG) {
    return { ok: false, reason: "Algoritmo de firma desconocido." };
  }
  let raw: Uint8Array;
  let signature: Uint8Array;
  try {
    raw = b64ToBytes(attestation.publicKey);
    signature = b64ToBytes(attestation.signature);
  } catch {
    return { ok: false, reason: "La firma no es válida." };
  }
  if (raw.length !== 32) return { ok: false, reason: "La clave pública no es Ed25519." };
  try {
    const key = await crypto.subtle.importKey("raw", asBuffer(raw), { name: "Ed25519" }, true, ["verify"]);
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      asBuffer(signature),
      new TextEncoder().encode(packetHash),
    );
    if (!ok) return { ok: false, reason: "La firma del paquete no coincide. El Kernel no lo admite." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "La firma del paquete no se pudo verificar." };
  }
}

export function rememberPacket(packet: unknown) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(LAST_PACKET_KEY, JSON.stringify(packet));
  } catch {
    /* ignore */
  }
}

export function readRememberedPacket(): unknown | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAST_PACKET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function resetAttestationForTests() {
  cached = null;
}

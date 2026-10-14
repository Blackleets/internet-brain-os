// Installed mode only: answer the Efesto extension's content script with a one-use pairing code so the
// extension connects without the user typing anything. The code is minted by the Kernel through this
// dashboard's server-side bridge (the token never reaches the page) and is only posted back to this
// same origin. At most a few codes per page load.
import { localFetch } from './local-kernel';

export const PAIR_PAGE_REQUEST = 'efesto-extension:pair-request';
export const PAIR_PAGE_CODE = 'efesto-dashboard:pair-code';
const MAX_CODES_PER_PAGE = 3;

type Deps = { fetcher?: typeof fetch; win?: Window; kernelUrl: string };

export function installExtensionPairHandoff({ fetcher = localFetch(), win = window, kernelUrl }: Deps): () => void {
  let issued = 0;
  let inFlight = false;
  const onMessage = async (event: MessageEvent) => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    const data = event.data as { type?: unknown; nonce?: unknown } | null;
    if (!data || data.type !== PAIR_PAGE_REQUEST || typeof data.nonce !== 'string' || data.nonce.length > 128) return;
    if (inFlight || issued >= MAX_CODES_PER_PAGE) return;
    inFlight = true;
    try {
      const response = await fetcher(`${kernelUrl}/api/pairing/extension-code`, { method: 'POST' });
      if (!response.ok) return;
      const body = await response.json().catch(() => undefined) as { ok?: unknown; code?: unknown } | undefined;
      if (body?.ok !== true || typeof body.code !== 'string') return;
      issued += 1;
      win.postMessage({ type: PAIR_PAGE_CODE, nonce: data.nonce, code: body.code, kernelUrl }, win.location.origin);
    } catch { /* fail closed: the extension keeps its manual code under Advanced */ } finally { inFlight = false; }
  };
  const listener = (event: MessageEvent) => { void onMessage(event); };
  win.addEventListener('message', listener);
  return () => win.removeEventListener('message', listener);
}

/**
 * A short page that only asks the browser to prove itself (JavaScript/cookies check, CAPTCHA,
 * "checking your browser"…) is not the source's content. Saving it as Evidence would let a later
 * attempt or reader treat a bot wall as a read page (run 6: InfoJobs returned "No podemos
 * identificar tu navegador"). The verifier records such a read as failed instead.
 * Conservative on purpose: a challenge phrase AND a short page; long pages are never rejected.
 */
const MAX_CHALLENGE_PAGE_CHARS = 4000;
const CHALLENGE_PATTERNS = [
  /no podemos identificar tu navegador/i,
  /checking (?:if the site connection is secure|your browser)/i,
  /attention required!? \| cloudflare/i,
  /\bjust a moment\.\.\./i,
  /verify (?:that )?you are (?:a )?human/i,
  /are you a robot\??/i,
  /access to this page has been denied/i,
  /(?:please )?(?:make sure|ensure) (?:that )?(?:your browser supports |)(?:cookies and javascript|javascript and cookies) (?:are |is )?enabled/i,
  /enable (?:javascript and cookies|cookies and javascript) to continue/i,
  /\bcaptcha\b/i,
];

export function isBrowserChallengePage(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > MAX_CHALLENGE_PAGE_CHARS) return false;
  return CHALLENGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const BROWSER_CHALLENGE_READ_REASON = 'web.read got a bot-protection check page instead of the page content';

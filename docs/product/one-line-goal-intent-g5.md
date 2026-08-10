# G5.4 — Kernel-owned one-line Goal intent

Efesto's active Home remains intentionally simple: the user describes the outcome in one natural-language Goal. G5.4 does not add category, price or location forms.

## Boundary

The Kernel owns bounded discovery-intent enrichment during Goal validation. A client may still supply explicit supported categories; when it does, those categories win and inference does not replace them.

When categories are absent, the Kernel may infer only the existing safe discovery categories:

`job`, `grant`, `client`, `offer`, `tool`, `food`, `aid`, `learning`, `event`, `housing`, `travel`, `collaboration`, `money`.

No inferred value is an execution capability. Categories such as purchase, payment, login, message or file mutation do not exist in this intent vocabulary.

## Numeric intent

Natural Goals often carry the most important constraint as a number. The previous Home keyword helper intentionally favored words longer than two characters, which meant bounds such as `18`, `25`, `20` and `30` were not necessarily present in persisted Goal keywords.

G5.4 preserves bounded numeric values from the canonical title at Kernel validation time, including currency values and numbers with two or more digits, while retaining the 12-keyword contract.

Examples:

- `Find a good-quality drill in Spain for €18–€25 from reputable sellers.` → discovery intent includes `tool` + `offer`, keywords include `18` + `25`.
- `Find recent remote freelance work matching my skills at $20–$30/hour or more.` → discovery intent includes `job` + `client`, keywords include `20` + `30`; the hourly currency amount alone does not imply shopping `offer`.

## Safety and authority

This enrichment happens before Goal persistence and does not create a Mission, authorize research, execute Hermes, fetch a URL or admit memory. The existing trusted Goal research confirmation remains the authority boundary for automatic R0 work.

Unsupported explicit categories still fail closed. Generic text with no explicit discovery signal still fails validation rather than being silently broadened.

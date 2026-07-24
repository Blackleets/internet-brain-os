# Plan de Mejora — Efesto Opportunity Radar

## Estado actual (2026-07-24, rama `feat/automatic-browsing-radar`)

### ✅ Funcionando (verificado)
- Kernel local en puerto **4000** (one-click `npm run kernel:serve` → proxy :4000 → server interno).
- Extensión Chrome MV3 en `apps/extension/src`, **105/105 tests pasando**, `tsc -b` limpio.
- Obsidian Vault conectado en `OneDrive/Documentos/Obsidian Vault` (Cases/Evidence/Reports/Goals/Opportunities).
- **Auto Radar (Fase 1 completa):**
  - 1.1 Goal matching: `scoreRelevance()` puntúa la página contra Goals activos del Kernel localmente; solo envía si score ≥ 25. Sin Goals → irrelevante (sin ruido).
  - 1.2 Fuzzy dedupe: `fuzzyDuplicate()` (Jaccard sobre tokens, umbral 0.5) detecta reposts/contenido casi idéntico. Persistido en `fuzzyHistory`.
  - 1.3 E2E real verificado: `POST /api/browser/page-context` → Kernel crea case+evidence, escribe `.md` en Obsidian, aparece en `/api/cases`. (Probado manualmente con página pública de ejemplo.)
- Endpoint de Goals (`GET /api/goals`) y captura (`POST /api/browser/page-context`) validados contra Kernel vivo.
- `auto-radar.js`: se corrigió un syntax error previo (`if [...]` sin paréntesis) que rompía el service worker, y el puerto 3737→4000.

### ⚠️ Pendiente
- **Push + PR**: rama tiene 10 commits sin pushear (8 previos + Goal matching + Fuzzy dedup).
- **6 tests del kernel** fallan por `ENOENT` en temp de Windows (preexistente, mancha CI).
- **Build de distribución**: no hay script `build:extension` que empaquete la extensión en `.zip` cargable.
- **POST /api/goals** del Kernel rechaza Goals con `keywords` como string (`INVALID_GOAL`); el validador espera formato específico. No bloquea el Auto Radar (usa GET).
- `archive/broken-motor-b/`: código huérfano (Motor B P2P / Living Forge) descartado, guardado por si se retoma.

---

## Fase 2: Distribución (desbloquea que OTROS lo usen)
- [ ] `npm run build:extension` que empaquete `apps/extension/src` en `.zip` cargable (copiar dist + manifest + icons).
- [ ] Probar `Load unpacked` en Chrome.
- [ ] Documentar pasos en README.

## Fase 3: Push + PR + CI limpio
- [ ] `git push` de la rama `feat/automatic-browsing-radar`.
- [ ] Abrir PR contra `main`, esperar CI.
- [ ] Corregir los 6 tests del kernel (`ENOENT` Windows temp) para que CI pase.

## Fase 4: Tracción y publicación
- [ ] Landing page: conectar Formspree, botón de descarga → `.zip`/Web Store.
- [ ] Chrome Web Store: cuenta dev, screenshots, privacy policy, submit.
- [ ] Compartir en comunidades target; medir conversión.

## Fase 5: Monetización (post-tracción)
- [ ] Tier gratis (local) / Tier pago (kernel hosting + modelos externos) / B2B.

---

## Métricas de éxito
| Métrica | Meta 30 días | Meta 90 días |
|---------|-------------|-------------|
| Instalaciones | 100 | 1,000 |
| Páginas analizadas | 500 | 5,000 |
| Casos en Obsidian | 200 | 2,000 |
| Rating Chrome Store | 4.0+ | 4.5+ |

## Principios técnicos
1. **Local-first**: todo funciona sin servidor externo.
2. **Privacidad por diseño**: datos nunca salen del dispositivo sin consentimiento.
3. **Incremental**: cada cambio es no-rompedor y verificado con tests/build.
4. **Anti-slop**: UI distintiva.
5. **Movimiento con propósito**: animaciones solo muestran estado real.

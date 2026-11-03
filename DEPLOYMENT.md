# Thinkatic — Deployment Checklist

Use this checklist before every production deployment. Check off each item.

---

## 1. Pre-Deployment — Environment

- [ ] All environment variables set in hosting platform (Vercel / Railway / etc.)
  - [ ] `VITE_SUPABASE_URL` — Supabase Project URL
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase Publishable / Anon Key
  - [ ] `SUPABASE_SECRET_KEY` — Supabase Secret / Service Role Key
  - [ ] `PAYPAL_CLIENT_ID` — PayPal API key
  - [ ] `PAYPAL_CLIENT_SECRET` — PayPal secret
  - [ ] `VITE_GA_MEASUREMENT_ID` — Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`)
  - [ ] `BASE_PATH` — Set to `/` for root deployments (or subpath if needed)
  - [ ] `NODE_ENV=production`
- [ ] `.env` file is in `.gitignore` — never committed to version control
- [ ] API server environment variables mirrored correctly

---

## 2. Pre-Deployment — Build Verification

```bash
# From repo root
pnpm install
pnpm --filter @workspace/thinkatic run build
```

- [ ] Build completes with no errors
- [ ] TypeScript check passes: `pnpm --filter @workspace/thinkatic run typecheck`
- [ ] Bundle size is acceptable — check Rollup output, no chunk > 500 KB
- [ ] `dist/public/` contains `index.html`, `assets/`, and all static files
- [ ] `sitemap.xml` is present in `dist/public/`
- [ ] `robots.txt` is present in `dist/public/`
- [ ] OG image (`opengraph.jpg`) is present and ≥ 1200×630px
- [ ] No favicon is configured; browser tabs intentionally show no custom site icon

---

## 3. Pre-Deployment — Database

- [ ] Supabase schema migration has been applied to the Supabase project
  ```bash
  # Execute supabase/migrations/20260904000000_create_schema.sql via Supabase Dashboard SQL Editor
  ```
- [ ] All schema changes reviewed — no destructive migrations without backup
- [ ] Admin credentials seeded / verified

---

## 4. SEO & Metadata

- [ ] `index.html` has correct `<title>`, `<description>`, `og:image`, canonical URL
- [ ] `robots.txt` disallows `/admin`, `/admin-login`, `/api/`
- [ ] `sitemap.xml` lists all public pages with correct domain
- [ ] Canonical URLs use `https://thinkatic.com` (not HTTP, not www)
- [ ] OG image resolves to an absolute URL (`https://thinkatic.com/opengraph.jpg`)
- [ ] Per-page `useSEO()` hook is called on every public page
- [ ] JSON-LD structured data validates at: https://validator.schema.org/

---

## 5. Performance

- [ ] Lighthouse score ≥ 90 on Performance (test in incognito, throttled 4G)
- [ ] Lighthouse score ≥ 90 on Best Practices
- [ ] Lighthouse score ≥ 90 on SEO
- [ ] Lighthouse score ≥ 85 on Accessibility
- [ ] Web Vitals targets:
  - [ ] LCP < 2.5 s
  - [ ] CLS < 0.1
  - [ ] FID/INP < 200 ms
  - [ ] TTFB < 600 ms
- [ ] All images have `loading="lazy"` and explicit `width`/`height`
- [ ] Hero/above-the-fold images use `loading="eager"` and are pre-sized
- [ ] No unused CSS/JS imported at top level (code splitting working)
- [ ] Fonts loaded via `preload` + `preconnect` in `<head>`
- [ ] Static assets served with `Cache-Control: public, max-age=31536000, immutable` (handled by hosting CDN)
- [ ] gzip / Brotli compression enabled on hosting

---

## 6. Security

- [ ] Security headers configured (via hosting platform or reverse proxy):
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: (configure per site requirements)
  ```
- [ ] HTTPS enforced — HTTP redirects to HTTPS
- [ ] API keys / secrets not exposed in frontend bundle (verify with `grep -r "SECRET" dist/`)
- [ ] Admin routes (`/admin`, `/admin-login`) behind authentication
- [ ] Rate limiting on `/api/contacts` and other form endpoints
- [ ] CORS configured correctly on API server

---

## 7. Accessibility

- [ ] Skip-to-content link works (`Tab` on page load → "Skip to main content")
- [ ] All interactive elements reachable via keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`)
- [ ] Focus ring visible on all focusable elements
- [ ] No `tabindex` values > 0 (use 0 or -1 only)
- [ ] All images have meaningful `alt` text; decorative images have `alt=""`
- [ ] All form inputs have associated `<label>` elements
- [ ] ARIA roles used correctly (validated in Axe DevTools)
- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text

---

## 8. Analytics & Consent

- [ ] `VITE_GA_MEASUREMENT_ID` is set to a valid GA4 ID
- [ ] Cookie banner appears on first visit for new users
- [ ] Analytics fires **only** after user accepts cookies
- [ ] Consent is persisted in localStorage correctly
- [ ] GA4 debug view shows correct events in development

---

## 9. Functional Smoke Tests

- [ ] Home page loads in < 3s on slow 3G
- [ ] Navigation links work: all routes render correct pages
- [ ] Contact form submits successfully and shows success state
- [ ] Request Proposal form — all 3 steps work
- [ ] Apply Online form — all 3 steps + file upload work
- [ ] Careers page — department filter and search work
- [ ] 404 page shows for unknown routes
- [ ] Admin login page loads (not publicly linked)
- [ ] Cookie banner accepts/declines correctly
- [ ] Newsletter form in footer submits

---

## 10. Post-Deployment

- [ ] Verify live site at `https://thinkatic.com` loads correctly
- [ ] Test all form submissions in production
- [ ] Submit sitemap to Google Search Console: https://search.google.com/search-console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Run Lighthouse audit on the live URL (not localhost)
- [ ] Check Google Search Console for crawl errors
- [ ] Verify no console errors in production
- [ ] Set up uptime monitoring (e.g. UptimeRobot, Better Uptime)
- [ ] Tag release in git: `git tag v1.0.0 && git push --tags`

---

## Quick Deploy Commands

```bash
# Full production build
pnpm install
pnpm --filter @workspace/thinkatic run build

# Preview build locally before deploying
pnpm --filter @workspace/thinkatic run serve

# Apply Supabase migrations via Dashboard SQL Editor or Supabase CLI
# Migration file: supabase/migrations/20260904000000_create_schema.sql

# Start API server (production)
cross-env NODE_ENV=production pnpm --filter @workspace/api-server run build && \
  pnpm --filter @workspace/api-server run start
```

# RabbiHossainLTD V2 — Security Remediation & Full Redesign Plan

**Prepared:** 16 August 2026  
**Status:** Planning approved in principle; implementation waits for required source/content documents.

## Confirmed decisions

- **Primary brand:** RabbiHossainLTD
- **Visual direction:** Black-and-white, service-led editorial
- **Primary language:** Bangla-first with complete English switch
- **Catalog:** Keep current services, subject to truthful copy, provider authorization and clear risk/disclaimer content
- **Backend:** Backend GitHub repository will be supplied
- **Existing Firebase data:** Reset is acceptable, but no live data will be deleted without backup and a final explicit confirmation

---

## 1. Product goal

V2 should look like a real, established digital-services business—not a generated template. It will be content-led, restrained and practical. The design will avoid common AI-template signals:

- no neon cyan/green
- no glow, glassmorphism or gradient overload
- no endless identical card grids
- no auto-opening promotional modal
- no 20-slide auto carousel
- no fake numbers, generic claims or decorative filler copy
- no excessive pill labels, floating widgets or animation for its own sake

The website will use real service information, real screenshots, real business details and evidence-backed reviews.

---

## 2. Design system

### Colour

- Ink black: `#0A0A0A`
- Paper white: `#F5F5F2`
- Pure white: `#FFFFFF`
- Neutral grays only for hierarchy: `#1B1B1B`, `#5F5F5F`, `#B8B8B8`, `#E4E4E1`
- Status colours may be used only where functionally required in account/admin interfaces; public marketing pages remain black/white

### Typography

Bangla-first editorial typography:

- Bengali headings: licensed/open-source Bengali serif selected after content test
- Bengali UI/body: readable Bengali sans
- Latin headings/body: matching editorial serif + neutral grotesk
- Fonts will be self-hosted WOFF2 where licensing permits
- Minimum body size: 16px public pages, 14px dense admin tables

### Layout

- 12-column desktop grid; 4-column mobile grid
- real whitespace and deliberate asymmetry
- 1px borders, mostly square/4px corners
- content widths based on reading purpose, not one generic container
- controls use clear labels and predictable placement

### Buttons

- Primary: solid black on white section / solid white on black section
- Secondary: outlined inverse
- Text action: underlined link with arrow
- Minimum 44px target; persistent keyboard focus
- One primary action per section

### Motion

- 120–220ms utility transitions only
- no auto-playing slider
- no motion when `prefers-reduced-motion` is set
- modal/drawer focus management and Escape support

### Imagery

- real/licensed images only
- no AI-generated hero imagery
- all source images converted to responsive AVIF/WebP/JPEG variants
- consistent art direction: monochrome or carefully converted black-and-white crops

---

## 3. Information architecture

### Public pages

1. **Home**
   - restrained announcement strip, only when necessary
   - service-led editorial hero: one featured service/campaign, no auto carousel
   - category index
   - selected high-demand services
   - how ordering/payment/delivery works
   - real trust proof and verified reviews
   - selected portfolio/case study
   - compact FAQ
   - complete business footer

2. **Services catalog**
   - search and category navigation
   - readable list/editorial rows rather than dozens of tiny cards
   - BDT-first pricing, USD secondary where needed
   - delivery time, requirements and refund status visible
   - filters encoded in URL and accessible by keyboard

3. **Individual service pages**
   - unique URL and metadata for each service
   - real overview, price/options, eligibility, delivery, required data, refund terms and provider disclaimer
   - clear order CTA
   - related services

4. **Work / Portfolio**
   - only real case studies
   - problem, role, solution, outcome and evidence
   - individual case-study pages

5. **About**
   - real founder/business story
   - professional portrait
   - experience, credentials and working principles
   - no invented timeline/statistics

6. **FAQ, Contact, Privacy, Terms, Refund, Delivery**
   - rewritten to match actual implementation and vendors
   - updated dates and business identity

7. **System pages**
   - professional 404
   - maintenance/status state

### Account pages

- Login/register/reset password
- Account overview
- Wallet/add credit
- Orders and individual order details
- Profile/settings/language
- downloadable invoice/receipt

### Admin

- separate authenticated layout; not in public navigation
- dashboard, orders, payments, service catalog, coupons, fulfilment inventory, support and audit ledger
- no client-side email-only authorization

---

## 4. Technical architecture

### Frontend

Recommended rebuild: **Astro + TypeScript** producing static, SEO-friendly pages, with small client components only where auth/order UI needs them.

- reusable Header, Footer, LanguageSwitcher, ServiceList, OrderForm, Modal and Account components
- service content from validated structured data, not repeated hard-coded HTML
- route-level JavaScript loading
- complete Bangla/English dictionaries
- no inline application scripts
- no `no-inspect.js`

### Backend

The supplied Railway backend will become the authority for:

- authenticated service ordering
- authoritative prices and coupon validation
- payment verification
- atomic wallet ledger
- idempotent admin approval/rejection
- provider fulfilment
- one-time key inventory delivery
- admin claims and audit logs
- rate limits and abuse controls

### Firebase

- custom claims for roles
- least-privilege Firestore rules
- immutable ledger entries
- user-owned read rules for orders/profile
- server-only writes for balance, payment status and key inventory
- Emulator Suite tests for allowed/denied reads and writes

### Hosting and headers

Use a host/proxy that supports CSP and custom security headers (Cloudflare Pages/Cloudflare proxy, Netlify or Vercel), or keep GitHub Pages behind a suitable security layer.

Required headers:

- Content-Security-Policy with exact origin allowlist
- Strict-Transport-Security
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame protection through CSP `frame-ancestors`

---

## 5. Security remediation sequence

### Phase S0 — Containment

1. Remove all public `/keys/` files.
2. Rotate/revoke every published fulfilment key.
3. Purge key material from Git history.
4. Disable affected automatic key delivery until backend inventory is live.
5. Replace unauthorized admin GIF screen.
6. Back up current Firebase data before any reset.

### Phase S1 — Money and inventory integrity

1. Implement backend-only price table.
2. Implement transactional top-up approval.
3. Add status precondition and idempotency key.
4. Implement atomic transaction-ID reservation.
5. Implement server-side key reservation/delivery.
6. Add immutable balance ledger and admin audit trail.
7. Verify admin role through custom claim.

### Phase S2 — Platform hardening

1. Rewrite and test Firestore rules.
2. Add rate limits, validation and request-size limits.
3. Add security headers/CSP.
4. Remove source-blocking/security-theatre scripts.
5. Add secret scanning and dependency checks.
6. Review analytics/consent and third-party data disclosure.

No live data deletion or production switch occurs before backup, test deployment and explicit go-live approval.

---

## 6. Implementation phases

### Phase 1 — Inputs and content model

- receive backend source and business/content documents
- inventory every existing service, field, plan and integration
- mark each claim as verified, needs evidence or must be removed
- define service and policy schemas
- approve wireframes before visual build

**Output:** content matrix, route map, data schemas, low-fidelity wireframes.

### Phase 2 — Security foundation

- perform S0/S1 fixes in backend and Firebase rules
- create safe staging environment
- write backend and rules tests

**Exit criteria:** no public keys; balance/order/admin writes cannot be performed directly by normal clients; retries cannot double-credit.

### Phase 3 — Design system and shell

- implement typography, colour tokens, grid, buttons, forms, header/footer and accessibility primitives
- build black-and-white responsive page shell
- run visual review at key breakpoints

### Phase 4 — Public pages

- Home, Services, service detail pages, About, Work, FAQ, Contact and policies
- real content and imagery only
- metadata, canonical URLs, schema, sitemap, robots and 404

### Phase 5 — Account and checkout

- auth, profile, wallet, order flow, receipts and order history
- accessible forms and clear error/success states
- BDT-first pricing and backend-authoritative totals

### Phase 6 — Admin

- protected admin shell
- atomic approval/rejection actions
- catalog, coupons, support and audit views
- no sensitive content in frontend bundle

### Phase 7 — QA and go-live

- Playwright functional tests
- accessibility keyboard/screen-reader pass
- Lighthouse and image budgets
- mobile/desktop/browser checks
- security/rules tests
- staging user acceptance
- production backup, deploy, smoke test and rollback plan

---

## 7. Quality gates

The redesign is not complete unless all are met:

- no public fulfilment secrets or key files
- no unmatched/minified CSS divergence
- no horizontal overflow at 320px+
- LCP under 2.5s on key public pages
- TBT under 200ms target
- initial Services transfer under 2MB target
- accessibility score 95+ plus manual keyboard pass
- one H1 and one main landmark per public page
- all buttons/inputs labelled and keyboard usable
- no auto modal/carousel
- no fabricated reviews, metrics or delivery claims
- all money/status changes server-authoritative and idempotent
- complete robots, sitemap, canonical and social metadata

---

## 8. Go-live strategy

1. Build and test on staging domain.
2. Freeze catalog/content for final QA.
3. Export Firebase backup.
4. Obtain explicit approval for reset/migration.
5. Deploy backend first, then frontend.
6. Verify auth, top-up, order, admin and provider callbacks.
7. Switch DNS/domain.
8. Monitor errors, provider failures and duplicate-event alerts.
9. Keep previous release available for rollback without re-exposing keys.

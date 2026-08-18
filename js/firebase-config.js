/* ============================================================
   Firebase configuration — SINGLE SOURCE OF TRUTH
   ------------------------------------------------------------
   This object was previously duplicated in six places (js/auth.js,
   js/firebase-core.js and four inline <script type="module"> blocks).
   Any change had to be made six times, which is how configuration
   drifts. Everything now reads from here.

   ── AUTH_DOMAIN and the Google consent screen ──────────────────
   The Google sign-in screen shows whatever host is in `authDomain`,
   because that host serves the OAuth callback at /__/auth/handler.
   Today it reads:

       "Sign in to continue to rabbihossainltd-63709.firebaseapp.com"

   To show our own domain instead, `authDomain` must point at a host
   that Firebase Hosting serves, because /__/auth/handler is generated
   by Firebase Hosting — it is not a file we can upload. The apex
   domain is on GitHub Pages, so it cannot serve that path; a
   dedicated Hosting subdomain is used instead.

   ⚠️  DO NOT switch AUTH_DOMAIN to the custom host until ALL of the
   console steps in docs/OAUTH_CUSTOM_DOMAIN.md are complete and
   https://auth.rabbihossainltd.online/__/auth/handler returns 200.
   Flipping it early breaks Google sign-in with auth/unauthorized-domain
   or redirect_uri_mismatch for every user.

   Switching over is a one-line change: set USE_CUSTOM_AUTH_DOMAIN to
   true. Rolling back is the same line.
   ============================================================ */

/** Firebase-managed default. Always works; shows the project id. */
export const DEFAULT_AUTH_DOMAIN = 'rabbihossainltd-63709.firebaseapp.com';

/** Branded handler. Requires the Firebase Hosting + OAuth setup first. */
export const CUSTOM_AUTH_DOMAIN = 'auth.rabbihossainltd.online';

/**
 * Flip to `true` only after the checklist in docs/OAUTH_CUSTOM_DOMAIN.md
 * is finished and verified. Everything else stays untouched.
 */
export const USE_CUSTOM_AUTH_DOMAIN = true;

export const AUTH_DOMAIN = USE_CUSTOM_AUTH_DOMAIN
  ? CUSTOM_AUTH_DOMAIN
  : DEFAULT_AUTH_DOMAIN;

export const firebaseConfig = {
  apiKey: 'AIzaSyA7VMETaS1R4hq1WUBXgsVnvgEyzFhKGfs',
  authDomain: AUTH_DOMAIN,
  projectId: 'rabbihossainltd-63709',
  storageBucket: 'rabbihossainltd-63709.firebasestorage.app',
  messagingSenderId: '658498014345',
  appId: '1:658498014345:web:89db9e029a6930d3e2ca58',
  measurementId: 'G-RT4WQL8R0H'
};

/* Non-module consumers (js/auth.js is a classic script) read this. */
if (typeof window !== 'undefined') {
  window.RH_FIREBASE_CONFIG = firebaseConfig;
}

export default firebaseConfig;

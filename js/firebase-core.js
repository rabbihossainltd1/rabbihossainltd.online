import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { firebaseConfig } from "/js/firebase-config.js";


export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

/*
  Firestore local cache.
  ----------------------
  On the web, offline persistence is OFF by default, so every page load had to
  make a network round-trip before the balance could be painted — that is the
  visible "balance loads late" lag. With persistentLocalCache, onSnapshot fires
  immediately from IndexedDB and then again with the server value.

  persistentMultipleTabManager is required because /checkout/ is opened in a
  new tab; single-tab persistence would fail in whichever tab loads second.

  initializeFirestore must run before any getFirestore(app) call and can only
  run once per app, so we fall back to the already-initialised instance.
*/
function makeDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (err) {
    // Already initialised elsewhere, or IndexedDB unavailable
    // (private mode / storage blocked) — plain in-memory Firestore still works.
    return getFirestore(app);
  }
}

export const db = makeDb();

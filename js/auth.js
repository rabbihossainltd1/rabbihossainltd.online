/* ============================================================
   Rabbi Portfolio — Auth System v2.1
   - Google + Email authentication
   - Profile dashboard dropdown
   - Live wallet balance
   - Admin Panel button only for admin UID
   - Custom profile picture stored in Firestore
   - Profile settings: name, photo, password
   - Professional SVG menu icons
   ============================================================ */

(function () {
  'use strict';

  let currentUser = null;
  let currentUserData = null;
  let currentIsAdmin = false;
  let authApi = null;
  let dbApi = null;
  let unsubscribeUserDoc = null;
  let _afterLoginAction = null;
  const ADMIN_EMAILS = ['rabbihossainltd@gmail.com'];

  const firebaseConfig = {
    apiKey: "AIzaSyA7VMETaS1R4hq1WUBXgsVnvgEyzFhKGfs",
    authDomain: "rabbihossainltd-63709.firebaseapp.com",
    projectId: "rabbihossainltd-63709",
    storageBucket: "rabbihossainltd-63709.firebasestorage.app",
    messagingSenderId: "658498014345",
    appId: "1:658498014345:web:89db9e029a6930d3e2ca58",
    measurementId: "G-RT4WQL8R0H"
  };

  function injectAuthUI() {
    const loginModal = document.createElement('div');
    loginModal.id = 'authModal';
    loginModal.innerHTML = `
      <div class="auth-modal-box" id="authModalBox">
        <button class="auth-modal-close" id="authModalClose" type="button">&times;</button>
        <div class="auth-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
        </div>
        <h3 class="auth-title">Sign in to Continue</h3>
        <p class="auth-sub">Create a free account or sign in with Google to continue securely.</p>
        <button class="auth-google-btn" id="authGoogleBtn" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <div class="auth-divider"><span>or</span></div>
        <div id="authEmailForm">
          <div class="auth-form-group"><input class="auth-input" type="email" id="authEmail" placeholder="Email address" /></div>
          <div class="auth-form-group"><input class="auth-input" type="password" id="authPassword" placeholder="Password (min 6 chars)" /></div>
          <div id="authError" class="auth-error" style="display:none;"></div>
          <button class="auth-submit-btn" id="authSignInBtn" type="button">Sign In</button>
          <button class="auth-toggle-btn" id="authToggleBtn" type="button">Don't have an account? <strong>Create one</strong></button>
        </div>
        <p class="auth-note"><span class="auth-note-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7.75 10.25V8.5a4.25 4.25 0 0 1 8.5 0v1.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.75 10.25h10.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7"/></svg></span> Your data is protected.</p>
      </div>
    `;
    loginModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(loginModal);

    const navbar = document.querySelector('.nav-inner');
    if (navbar && !document.getElementById('navAuthBtn')) {
      const authBtn = document.createElement('div');
      authBtn.id = 'navAuthBtn';
      authBtn.innerHTML = `
        <div id="navUserAvatar" aria-label="Open profile dashboard">
          <img id="navUserImg" src="" alt="Profile" />
          <span id="navUserInitial">U</span>
        </div>
        <button id="navLoginBtn" type="button">Login</button>
      `;
      const navCta = navbar.querySelector('.nav-cta');
      if (navCta) navbar.insertBefore(authBtn, navCta);
      else navbar.appendChild(authBtn);
    }

    injectAuthCSS();
    return loginModal;
  }

  function injectAuthCSS() {
    if (document.getElementById('rabbiAuthStyles')) return;
    const style = document.createElement('style');
    style.id = 'rabbiAuthStyles';
    style.textContent = `
      #authModal.open { display:flex !important; animation:fadeIn 0.2s ease; }
      .auth-modal-box { background:var(--surface-2,#0d1117); border:1px solid rgba(0,200,255,0.15); border-radius:16px; width:100%; max-width:420px; padding:36px 32px; position:relative; animation:slideUp 0.25s cubic-bezier(0.4,0,0.2,1); box-shadow:0 32px 80px rgba(0,0,0,0.8); }
      .auth-modal-close { position:absolute;top:14px;right:14px;width:30px;height:30px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#7a8ca8;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s; }
      .auth-modal-close:hover { color:#00c8ff; border-color:rgba(0,200,255,0.3); }
      .auth-icon { width:56px;height:56px;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:var(--accent,#00c8ff); }
      .auth-title { font-family:var(--font-display,'DM Sans',sans-serif);font-size:1.2rem;font-weight:700;color:#e8edf5;text-align:center;margin-bottom:8px; }
      .auth-sub { font-size:0.84rem;color:#7a8ca8;text-align:center;line-height:1.6;margin-bottom:22px; }
      .auth-google-btn { width:100%;padding:12px;background:#fff;color:#1a1a1a;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s;margin-bottom:16px; }
      .auth-google-btn:hover { box-shadow:0 4px 20px rgba(255,255,255,0.15);transform:translateY(-1px); }
      .auth-divider { display:flex;align-items:center;gap:12px;margin:16px 0;color:#3a4a5a;font-size:0.78rem; }
      .auth-divider::before,.auth-divider::after { content:'';flex:1;height:1px;background:rgba(255,255,255,0.08); }
      .auth-form-group { margin-bottom:12px; }
      .auth-input { width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:9px;color:#e8edf5;font-size:0.9rem;outline:none;transition:border-color 0.2s;font-family:inherit; }
      .auth-input:focus { border-color:rgba(0,200,255,0.4); }
      .auth-input::placeholder { color:#3a4a5a; }
      .auth-error { background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.25);color:#ff8080;border-radius:8px;padding:10px 14px;font-size:0.82rem;margin-bottom:12px; }
      .auth-submit-btn { width:100%;padding:12px;background:var(--accent,#00c8ff);color:#020a10;border:none;border-radius:50px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-display,'DM Sans',sans-serif);transition:all 0.2s;margin-bottom:10px; }
      .auth-submit-btn:hover { opacity:0.88;transform:translateY(-1px); }
      .auth-submit-btn:disabled { opacity:0.5;cursor:not-allowed;transform:none; }
      .auth-toggle-btn { width:100%;padding:8px;background:none;border:none;color:#7a8ca8;font-size:0.82rem;cursor:pointer;text-align:center; }
      .auth-toggle-btn strong { color:var(--accent,#00c8ff); }
      .auth-note { text-align:center;font-size:0.74rem;color:#3a4a5a;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:6px; }
      .auth-note-icon svg { width:14px;height:14px;display:block; }
      #navAuthBtn { display:flex;align-items:center;gap:8px;cursor:pointer;margin-left:4px;position:relative;flex-shrink:0; }
      #navLoginBtn { padding:7px 16px;background:transparent;border:1px solid rgba(0,200,255,0.3);border-radius:50px;color:var(--accent,#00c8ff);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:var(--font-display,'DM Sans',sans-serif);transition:all 0.2s; }
      #navLoginBtn:hover { background:rgba(0,200,255,0.08);border-color:rgba(0,200,255,0.5); }
      #navUserAvatar { display:none;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#00c8ff,#00ff88);border:2px solid rgba(0,200,255,0.35);overflow:hidden;align-items:center;justify-content:center;color:#020a10;font-size:0.8rem;font-weight:800;box-shadow:0 0 18px rgba(0,200,255,0.18); }
      #navUserAvatar img { width:100%;height:100%;object-fit:cover;display:none; }
      #navUserInitial { display:block; }
      .nav-user-menu { position:absolute;top:48px;right:0;background:rgba(8,14,22,0.96);border:1px solid rgba(0,200,255,0.18);border-radius:18px;padding:14px;min-width:280px;max-width:calc(100vw - 24px);box-shadow:0 24px 70px rgba(0,0,0,0.65);z-index:2500;display:none;backdrop-filter:blur(18px); }
      .nav-user-menu.open { display:block;animation:slideUp 0.2s ease; }
      .profile-head { display:flex;gap:12px;align-items:center;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:10px; }
      .profile-photo-wrap { position:relative;width:54px;height:54px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#00c8ff,#00ff88);display:flex;align-items:center;justify-content:center;color:#020a10;font-weight:900;flex-shrink:0; }
      .profile-photo-wrap img { width:100%;height:100%;object-fit:cover;display:none; }
      .profile-name { color:#e8edf5;font-weight:800;font-size:.92rem;line-height:1.25;word-break:break-word; }
      .profile-email { color:#7a8ca8;font-size:.76rem;margin-top:3px;word-break:break-word; }
      .profile-balance { background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.20);border-radius:14px;padding:12px;margin:10px 0;color:#c9ffe2;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:.86rem; }
      .profile-balance strong { color:#00ff88;font-size:1rem; }
      .profile-upload { display:grid;grid-template-columns:1fr;gap:8px;margin:10px 0; }
      .nav-user-menu-btn { width:100%;padding:10px 12px;background:none;border:none;color:#e8edf5;font-size:0.86rem;cursor:pointer;text-align:left;border-radius:10px;transition:background 0.2s;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-decoration:none;font-family:inherit; }
      .profile-btn-icon { width:18px;height:18px;flex:0 0 18px;color:var(--accent,#00c8ff); }
      .nav-user-menu-btn:hover { background:rgba(255,255,255,0.06); }
      .nav-user-menu-btn.primary { background:linear-gradient(135deg,rgba(0,200,255,.14),rgba(0,255,136,.10));border:1px solid rgba(0,200,255,.14); }
      .nav-user-menu-btn.danger { color:#ff9d9d; }
      .nav-user-menu-btn[hidden] { display:none !important; }
      .profile-mini-note { color:#7a8ca8;font-size:.72rem;line-height:1.45;margin:2px 0 8px; }
      .profile-settings-modal { display:none;position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,.82);backdrop-filter:blur(10px);align-items:center;justify-content:center;padding:18px; }
      .profile-settings-modal.open { display:flex;animation:fadeIn .18s ease; }
      .profile-settings-box { width:100%;max-width:460px;max-height:92vh;overflow:auto;background:rgba(8,14,22,.98);border:1px solid rgba(0,200,255,.18);border-radius:22px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.72); }
      .settings-head { display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:14px; }
      .settings-head h3 { color:#e8edf5;font-size:1.05rem;margin:0;font-family:var(--font-display,'DM Sans',sans-serif); }
      .settings-head p { color:#7a8ca8;font-size:.78rem;line-height:1.5;margin:4px 0 0; }
      .settings-close { width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#9bb0c8;cursor:pointer;font-size:1.2rem;line-height:1; }
      .settings-section { background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;margin:12px 0; }
      .settings-section-title { display:flex;align-items:center;gap:8px;color:#e8edf5;font-size:.9rem;font-weight:800;margin-bottom:12px; }
      .settings-label { display:block;color:#a9b7ca;font-size:.76rem;font-weight:700;margin:10px 0 6px; }
      .settings-input { width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.25);color:#e8edf5;outline:none;font-family:inherit;font-size:.88rem; }
      .settings-input:focus { border-color:rgba(0,200,255,.45); }
      .settings-actions { display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px; }
      .settings-btn { width:100%;padding:11px 12px;border-radius:12px;border:1px solid rgba(0,200,255,.18);background:linear-gradient(135deg,rgba(0,200,255,.14),rgba(0,255,136,.10));color:#e8edf5;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit; }
      .settings-btn.secondary { background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.10);color:#b9c7d8; }
      .settings-btn:disabled { opacity:.58;cursor:not-allowed; }
      .settings-message { display:none;margin-top:10px;padding:10px 12px;border-radius:12px;font-size:.8rem;line-height:1.45; }
      .settings-message.success { display:block;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.20);color:#b7ffd9; }
      .settings-message.error { display:block;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.24);color:#ffb2b2; }
      .settings-history-list { display:grid;gap:10px;margin-top:10px; }
      .settings-history-item { background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px; }
      .settings-history-top { display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:5px; }
      .settings-history-title { color:#e8edf5;font-weight:800;font-size:.84rem;line-height:1.35;word-break:break-word; }
      .settings-history-amount { color:#00ff88;font-weight:900;font-size:.82rem;white-space:nowrap; }
      .settings-history-meta { color:#7a8ca8;font-size:.74rem;line-height:1.45;margin-top:3px;word-break:break-word; }
      .settings-history-status { display:inline-block;margin-top:7px;padding:4px 8px;border-radius:999px;background:rgba(0,200,255,.10);border:1px solid rgba(0,200,255,.16);color:#9edfff;font-size:.68rem;font-weight:800;text-transform:uppercase; }
      .settings-history-empty { color:#7a8ca8;font-size:.8rem;line-height:1.55;padding:10px 0; }
      .rabbi-bottom-nav { position:fixed; left:14px; right:14px; bottom:12px; z-index:2400; display:grid; grid-template-columns:repeat(4,1fr); gap:8px; max-width:620px; margin:0 auto; padding:8px; border-radius:24px; background:rgba(5,10,16,.92); border:1px solid rgba(0,200,255,.18); box-shadow:0 18px 55px rgba(0,0,0,.55),0 0 24px rgba(0,200,255,.08); backdrop-filter:blur(18px); }
      .rabbi-bottom-nav a { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:54px; border-radius:18px; color:#8fa2bb; text-decoration:none; font-size:.68rem; font-weight:800; letter-spacing:.01em; transition:.2s ease; }
      .rabbi-bottom-nav a svg { width:20px; height:20px; stroke-width:1.8; }
      .rabbi-bottom-nav a.active, .rabbi-bottom-nav a:hover { color:#020a10; background:linear-gradient(135deg,#00c8ff,#00ff88); box-shadow:0 8px 24px rgba(0,200,255,.20); }
      .customer-service-nav a { border:1px solid rgba(0,200,255,.16); border-radius:999px; padding:10px 14px!important; background:rgba(0,200,255,.06); }
      body.has-bottom-nav { padding-bottom:124px !important; }
      body.has-bottom-nav main, body.has-bottom-nav .wallet-page, body.has-bottom-nav .dashboard-page { padding-bottom:180px !important; }
      @media(min-width:900px){ .rabbi-bottom-nav { bottom:18px; left:50%; right:auto; transform:translateX(-50%); width:560px; } }

      /* v23.2 profile balance/card icon proper alignment */
      .nav-user-menu .profile-balance.compact-menu-balance{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 38px!important;
        align-items:center!important;
        justify-content:normal!important;
        gap:12px!important;
        padding:12px!important;
        margin:10px 0!important;
        min-height:62px!important;
      }
      .nav-user-menu .profile-balance-info{
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:center!important;
        gap:4px!important;
      }
      .nav-user-menu .profile-balance-info span{
        display:block!important;
        color:#94a9c2!important;
        font-size:.72rem!important;
        line-height:1!important;
        font-weight:900!important;
        text-transform:uppercase!important;
        letter-spacing:.08em!important;
        margin:0!important;
      }
      .nav-user-menu .profile-balance-info strong,
      .nav-user-menu #profileMenuBalance{
        display:block!important;
        color:#00ff88!important;
        font-size:1rem!important;
        line-height:1.15!important;
        font-family:var(--font-display,inherit)!important;
        font-weight:950!important;
        margin:0!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        max-width:190px!important;
      }
      .nav-user-menu .menu-balance-plus{
        width:38px!important;
        height:38px!important;
        min-width:38px!important;
        min-height:38px!important;
        max-width:38px!important;
        max-height:38px!important;
        padding:0!important;
        margin:0!important;
        border-radius:13px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        justify-self:end!important;
        align-self:center!important;
        line-height:1!important;
        text-decoration:none!important;
        background:linear-gradient(135deg,#00c8ff,#00ff88)!important;
        color:#020a10!important;
        box-shadow:0 12px 26px rgba(0,200,255,.18)!important;
        overflow:hidden!important;
      }
      .nav-user-menu .menu-balance-plus svg,
      .nav-user-menu .menu-balance-plus .profile-btn-icon{
        width:19px!important;
        height:19px!important;
        min-width:19px!important;
        min-height:19px!important;
        display:block!important;
        margin:0!important;
        padding:0!important;
        position:static!important;
        transform:none!important;
        flex:0 0 auto!important;
        color:currentColor!important;
      }

      @media(max-width:700px){ .nav-user-menu{ right:-8px; min-width:260px; } .profile-settings-box{padding:18px;border-radius:18px;} }
    `;
    document.head.appendChild(style);
  }

  async function loadFirebaseModules() {
    const appModule = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');
    const firestoreModule = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');

    const app = appModule.getApps().length ? appModule.getApps()[0] : appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);

    authApi = { ...authModule, auth };
    dbApi = { ...firestoreModule, db };
    return { authApi, dbApi };
  }

  function dollar(value) {
    const amount = Number(value || 0);
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} / ৳${Math.round(amount * 125).toLocaleString('en-BD')}`;
  }

  function getInitial(user) {
    return (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  }

  function updateAvatar(photoURL, user) {
    const avatar = document.getElementById('navUserAvatar');
    const img = document.getElementById('navUserImg');
    const initial = document.getElementById('navUserInitial');
    const profileImg = document.getElementById('profileMenuPhoto');
    const profileInitial = document.getElementById('profileMenuInitial');

    if (!avatar) return;

    if (photoURL) {
      if (img) { img.src = photoURL; img.style.display = 'block'; }
      if (initial) initial.style.display = 'none';
      if (profileImg) { profileImg.src = photoURL; profileImg.style.display = 'block'; }
      if (profileInitial) profileInitial.style.display = 'none';
    } else {
      if (img) { img.removeAttribute('src'); img.style.display = 'none'; }
      if (initial) { initial.textContent = getInitial(user); initial.style.display = 'block'; }
      if (profileImg) { profileImg.removeAttribute('src'); profileImg.style.display = 'none'; }
      if (profileInitial) { profileInitial.textContent = getInitial(user); profileInitial.style.display = 'block'; }
    }
  }

  async function ensureUserDoc(user) {
    if (!dbApi || !user) return;
    const { db, doc, getDoc, setDoc, updateDoc, serverTimestamp } = dbApi;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // New user — create doc
      await setDoc(userRef, {
        name: user.displayName || 'User',
        email: user.email || '',
        photoURL: user.photoURL || '',
        credit: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Existing user — only update email, NEVER overwrite name (user may have changed it)
      const data = snap.data();
      const updates = { updatedAt: serverTimestamp() };
      if (user.email && !data.email) updates.email = user.email;
      // Only set name if not already set in Firestore
      if (!data.name || data.name === 'User') {
        updates.name = user.displayName || data.name || 'User';
      }
      await updateDoc(userRef, updates);
    }
  }

  function updateProfileMenu(user, data) {
    const nameEl = document.getElementById('profileMenuName');
    const emailEl = document.getElementById('profileMenuEmail');
    const balanceEl = document.getElementById('profileMenuBalance');
    const adminBtn = document.getElementById('navAdminBtn');

    if (nameEl) nameEl.textContent = data?.name || user?.displayName || 'User';
    if (emailEl) emailEl.textContent = data?.email || user?.email || '';
    if (balanceEl) balanceEl.textContent = dollar(data?.credit || 0);
    if (adminBtn) adminBtn.hidden = !currentIsAdmin;

    updateAvatar(data?.photoURL || user?.photoURL || '', user);
  }

  async function checkAdmin(user) {
    currentIsAdmin = false;
    if (!user) return false;

    const emailIsAdmin = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());

    try {
      if (dbApi && user.uid) {
        const { db, doc, getDoc } = dbApi;
        const snap = await getDoc(doc(db, 'admins', user.uid));
        currentIsAdmin = snap.exists() || emailIsAdmin;
      } else {
        currentIsAdmin = emailIsAdmin;
      }
    } catch (err) {
      currentIsAdmin = emailIsAdmin;
    }

    const adminBtn = document.getElementById('navAdminBtn');
    if (adminBtn) adminBtn.hidden = !currentIsAdmin;
    return currentIsAdmin;
  }

  function listenUserDoc(user) {
    if (!dbApi || !user) return;
    if (unsubscribeUserDoc) unsubscribeUserDoc();

    const { db, doc, onSnapshot } = dbApi;
    const ref = doc(db, 'users', user.uid);
    unsubscribeUserDoc = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      currentUserData = snap.data();
      updateProfileMenu(user, currentUserData);
      window.dispatchEvent(new CustomEvent('rabbi:userData', { detail: currentUserData }));
    });
  }


  function professionalImageIcon() {
    return `
      <svg class="profile-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.75 7.75A3 3 0 0 1 7.75 4.75h8.5a3 3 0 0 1 3 3v8.5a3 3 0 0 1-3 3h-8.5a3 3 0 0 1-3-3v-8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.25 15.75l2.25-2.25 1.7 1.7 3.05-3.05 2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 9.25h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      </svg>`;
  }


  function iconDashboard() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.75 5.75h6.5v6.5h-6.5v-6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M12.75 5.75h6.5v3.75h-6.5V5.75Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M12.75 11.75h6.5v6.5h-6.5v-6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M4.75 14.5h6.5v3.75h-6.5V14.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      </svg>`;
  }

  function iconSupport() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.25 12.6v-1.2a6.75 6.75 0 0 1 13.5 0v1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M5.25 12.25h2.25a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H6.25a1 1 0 0 1-1-1v-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M18.75 12.25H16.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1.25a1 1 0 0 0 1-1v-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M16.25 18.75c-1 .65-2.05 1-4.25 1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }

  function iconCredit() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.75 7.75h14.5a1.75 1.75 0 0 1 1.75 1.75v7a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 16.5v-7a1.75 1.75 0 0 1 1.75-1.75Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 10.25h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M7.25 15.25h3.25" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }

  function iconShield() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3.75 5.75 6.25v5.35c0 4.1 2.6 7.75 6.25 8.9 3.65-1.15 6.25-4.8 6.25-8.9V6.25L12 3.75Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="m9.25 12.1 1.85 1.85 3.95-4.05" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function iconSignOut() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.5 5.25H7.75A2.75 2.75 0 0 0 5 8v8a2.75 2.75 0 0 0 2.75 2.75h2.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M14.25 8.25 18 12l-3.75 3.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 12H9.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }

  function iconSettings() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" stroke-width="1.7"/>
        <path d="M18.72 13.76c.08-.57.08-.95 0-1.52l1.62-1.28-1.55-2.68-1.92.78a7.3 7.3 0 0 0-1.32-.76l-.3-2.05h-3.1l-.3 2.05c-.46.18-.9.44-1.32.76l-1.92-.78-1.55 2.68 1.62 1.28c-.08.57-.08.95 0 1.52l-1.62 1.28 1.55 2.68 1.92-.78c.4.32.85.58 1.32.76l.3 2.05h3.1l.3-2.05c.47-.18.91-.44 1.32-.76l1.92.78 1.55-2.68-1.62-1.28Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
      </svg>`;
  }

  function iconSave() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.75 4.75h10.5L19.25 8v10.25a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1V5.75a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M8.25 4.75v5h7.5v-5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M8.25 19.25v-5.5h7.5v5.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      </svg>`;
  }

  function iconPassword() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.75 10.25V8.5a4.25 4.25 0 0 1 8.5 0v1.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M6.75 10.25h10.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M12 14v1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }

  function iconHistory() {
    return `
      <svg class="profile-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.75 4.75h10.5A2.25 2.25 0 0 1 19.5 7v10a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 17V7a2.25 2.25 0 0 1 2.25-2.25Z" stroke="currentColor" stroke-width="1.7"/>
        <path d="M8.25 8.5h7.5M8.25 12h7.5M8.25 15.5h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getTimestampMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatDate(value) {
    const ms = getTimestampMillis(value);
    if (!ms) return 'Not available';
    return new Date(ms).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function loadSettingsTransactionHistory() { return; }

  function setProfileUploadButtonState(button, label, loading) {
    if (!button) return;
    button.disabled = !!loading;
    button.innerHTML = `${professionalImageIcon()} <span>${label}</span>`;
  }

  function createProfileMenu(auth) {
    let menu = document.getElementById('navUserMenu');
    if (menu) return menu;

    const authBtn = document.getElementById('navAuthBtn');
    if (!authBtn) return null;

    menu = document.createElement('div');
    menu.id = 'navUserMenu';
    menu.className = 'nav-user-menu';
    menu.innerHTML = `
      <div class="profile-head">
        <div class="profile-photo-wrap">
          <img id="profileMenuPhoto" src="" alt="Profile photo" />
          <span id="profileMenuInitial">U</span>
        </div>
        <div style="min-width:0;">
          <div class="profile-name" id="profileMenuName">User</div>
          <div class="profile-email" id="profileMenuEmail">Loading...</div>
        </div>
      </div>
      <div class="profile-balance compact-menu-balance">
        <div class="profile-balance-info">
          <span>Balance</span>
          <strong id="profileMenuBalance">$0 / ৳0</strong>
        </div>
        <a href="add-credit.html" class="menu-balance-plus" aria-label="Add Credit">${iconCredit()}</a>
      </div>
      <a class="nav-user-menu-btn primary" href="dashboard.html">${iconDashboard()} <span>Dashboard</span></a>
      <button class="nav-user-menu-btn" id="profileSettingsBtn" type="button">${iconSettings()} <span>Profile Settings</span></button>
      <a class="nav-user-menu-btn" href="https://wa.me/8801731410341" target="_blank" rel="noopener">${iconSupport()} <span>Customer Service</span></a>
      <a class="nav-user-menu-btn" id="navAdminBtn" href="admin.html" hidden>${iconShield()} <span>Admin Panel</span></a>
      <button class="nav-user-menu-btn danger" id="navSignOutBtn" type="button">${iconSignOut()} <span>Sign Out</span></button>
    `;

    authBtn.appendChild(menu);

    const settingsBtn = menu.querySelector('#profileSettingsBtn');
    const signOutBtn = menu.querySelector('#navSignOutBtn');

    if (settingsBtn) settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.remove('open');
      openProfileSettings();
    });
    if (signOutBtn) signOutBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      localStorage.removeItem('rabbiLandingPopupSeen');
      sessionStorage.setItem('rabbiShowLandingPopup', '1');
      await authApi.signOut(auth);
      window.location.href = 'index.html';
    });

    updateProfileMenu(currentUser, currentUserData || {});
    return menu;
  }

  function resizeImageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image file.'));
        img.onload = () => {
          const max = 512;
          const scale = Math.min(max / img.width, max / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleProfilePhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file || !currentUser || !dbApi) return;

    const uploadBtn = document.getElementById('profileUploadBtn');
    try {
      setProfileUploadButtonState(uploadBtn, 'Uploading...', true);
      const dataUrl = await resizeImageToDataUrl(file);
      const { db, doc, updateDoc, serverTimestamp } = dbApi;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoURL: dataUrl,
        updatedAt: serverTimestamp()
      });
      updateAvatar(dataUrl, currentUser);
      setProfileUploadButtonState(uploadBtn, 'Profile Picture Updated', false);
      setTimeout(() => setProfileUploadButtonState(uploadBtn, 'Set Profile Picture', false), 1200);
    } catch (err) {
      alert(err.message || 'Profile picture update failed.');
      setProfileUploadButtonState(uploadBtn, 'Set Profile Picture', false);
    }
  }


  function setSettingsMessage(type, message) {
    const el = document.getElementById('profileSettingsMessage');
    if (!el) return;
    el.className = `settings-message ${type || ''}`;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  function fillSettingsForm() {
    const nameInput = document.getElementById('settingsName');
    const emailInput = document.getElementById('settingsEmail');
    if (nameInput) nameInput.value = currentUserData?.name || currentUser?.displayName || '';
    if (emailInput) emailInput.value = currentUser?.email || currentUserData?.email || '';
    const preview = document.getElementById('settingsAvatarPreview');
    const photo = currentUserData?.photoURL || currentUser?.photoURL || '';
    if (preview) {
      if (photo) preview.innerHTML = `<img src="${escapeHtml(photo)}" alt="Profile photo">`;
      else preview.textContent = String(currentUserData?.name || currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();
    }
    const pass1 = document.getElementById('settingsNewPassword');
    const pass2 = document.getElementById('settingsConfirmPassword');
    if (pass1) pass1.value = '';
    if (pass2) pass2.value = '';
    setSettingsMessage('', '');
  }

  function createProfileSettingsModal() {
    let modal = document.getElementById('profileSettingsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'profileSettingsModal';
    modal.className = 'profile-settings-modal';
    modal.innerHTML = `
      <div class="profile-settings-box">
        <button class="profile-settings-close" id="profileSettingsClose" type="button">&times;</button>
        <div class="profile-settings-title">Profile Settings</div>
        <p class="profile-settings-sub">Update your name, profile picture, customer support access, and password from one place.</p>

        <div class="settings-avatar-row">
          <div class="settings-avatar-preview" id="settingsAvatarPreview">U</div>
          <label class="settings-photo-btn">
            ${professionalImageIcon()} <span>Change Picture</span>
            <input type="file" id="settingsPhotoInput" accept="image/*" hidden />
          </label>
        </div>

        <div class="settings-grid">
          <div class="settings-field">
            <label for="settingsName">Name</label>
            <input type="text" id="settingsName" placeholder="Your name" />
          </div>
          <div class="settings-field">
            <label for="settingsEmail">Email</label>
            <input type="email" id="settingsEmail" disabled />
          </div>
          <div class="settings-field">
            <label for="settingsNewPassword">New Password</label>
            <input type="password" id="settingsNewPassword" placeholder="Leave blank if unchanged" autocomplete="new-password" />
          </div>
          <div class="settings-field">
            <label for="settingsConfirmPassword">Confirm Password</label>
            <input type="password" id="settingsConfirmPassword" placeholder="Confirm new password" autocomplete="new-password" />
          </div>
        </div>

        <div class="settings-compact-actions">
          <a href="https://wa.me/8801731410341" target="_blank" rel="noopener">${iconSupport()} <span>Customer Service</span></a>
        </div>

        <div id="profileSettingsMessage" class="settings-message" style="display:none;"></div>
        <button class="settings-save-btn" id="settingsSaveProfileBtn" type="button">${iconSave()} <span>Save Changes</span></button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#profileSettingsClose');
    const saveProfileBtn = modal.querySelector('#settingsSaveProfileBtn');
    const changePasswordBtn = modal.querySelector('#settingsChangePasswordBtn');
    const resetPasswordBtn = modal.querySelector('#settingsResetPasswordBtn');

    if (closeBtn) closeBtn.addEventListener('click', closeProfileSettings);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeProfileSettings(); });
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileSettings);
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', changeUserPassword);
    if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', sendUserPasswordReset);

    // Language save
    const saveLangBtn = modal.querySelector('#saveLangBtn');
    const currentLang = localStorage.getItem('siteLang') || 'en';
    const langEn = modal.querySelector('#langEn');
    const langBn = modal.querySelector('#langBn');
    if (langEn && langBn) {
      if (currentLang === 'bn') langBn.checked = true; else langEn.checked = true;
    }
    if (saveLangBtn) {
      saveLangBtn.addEventListener('click', function() {
        const selected = modal.querySelector('input[name="siteLanguage"]:checked');
        if (!selected) return;
        localStorage.setItem('siteLang', selected.value);
        setSettingsMessage('success', selected.value === 'bn' ? 'ভাষা সংরক্ষিত হয়েছে। পেজ রিলোড হচ্ছে...' : 'Language saved. Reloading...');
        setTimeout(() => window.location.reload(), 900);
      });
    }

    return modal;
  }

  function openProfileSettings(focusTarget) {
    if (!currentUser) {
      if (window.rabbiAuth) window.rabbiAuth.openLogin();
      return;
    }
    const modal = createProfileSettingsModal();
    fillSettingsForm();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      if (focusTarget === 'name') document.getElementById('settingsName')?.focus();
      if (focusTarget === 'password') document.getElementById('settingsNewPassword')?.focus();
      if (focusTarget === 'photo') document.getElementById('settingsPhotoInput')?.click();
    }, 120);
  }

  function closeProfileSettings() {
    const modal = document.getElementById('profileSettingsModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function saveProfileSettings() {
    if (!currentUser || !authApi) { setSettingsMessage('error', 'Not logged in. Please refresh.'); return; }
    const btn = document.getElementById('settingsSaveProfileBtn');
    const nameInput = document.getElementById('settingsName');
    const fileInput = document.getElementById('settingsPhotoInput');
    const passInput = document.getElementById('settingsNewPassword');
    const confirmInput = document.getElementById('settingsConfirmPassword');
    const fullName = String(nameInput?.value || '').trim();
    const newPassword = String(passInput?.value || '').trim();
    const confirmPassword = String(confirmInput?.value || '').trim();
    const file = fileInput?.files && fileInput.files[0];

    if (!fullName) {
      setSettingsMessage('error', 'Please enter your name.');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        setSettingsMessage('error', 'Password minimum 6 characters হতে হবে।');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSettingsMessage('error', 'Password confirmation does not match.');
        return;
      }
    }

    const old = btn ? btn.innerHTML : '';
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = `${iconSave()} <span>Saving...</span>`; }
      let photoURL = currentUserData?.photoURL || currentUser.photoURL || '';
      if (file) photoURL = await resizeImageToDataUrl(file);

      await authApi.updateProfile(currentUser, {
        displayName: fullName,
        photoURL: photoURL || null
      });

      if (newPassword) {
        if (typeof authApi.updatePassword !== 'function') {
          const mod = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');
          await mod.updatePassword(currentUser, newPassword);
        } else {
          await authApi.updatePassword(currentUser, newPassword);
        }
      }

      // Update Firestore user doc — use dbApi if available, else dynamic import
      if (dbApi) {
        const { db, doc, updateDoc, serverTimestamp } = dbApi;
        await updateDoc(doc(db, 'users', currentUser.uid), {
          name: fullName,
          photoURL: photoURL || '',
          updatedAt: serverTimestamp()
        });
      } else {
        // Fallback: dynamic import
        const { getFirestore, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { getApp } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js');
        const db = getFirestore(getApp());
        await updateDoc(doc(db, 'users', currentUser.uid), {
          name: fullName,
          photoURL: photoURL || '',
          updatedAt: serverTimestamp()
        });
      }

      currentUserData = { ...(currentUserData || {}), name: fullName, photoURL: photoURL || '' };
      updateProfileMenu(currentUser, currentUserData);
      if (fileInput) fileInput.value = '';
      setSettingsMessage('success', 'Profile updated successfully. Reloading...');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setSettingsMessage('error', err.message || 'Profile update failed.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
  }

  async function changeUserPassword() {
    if (!currentUser || !authApi) return;
    const currentPassword = String(document.getElementById('settingsCurrentPassword')?.value || '');
    const newPassword = String(document.getElementById('settingsNewPassword')?.value || '');
    const btn = document.getElementById('settingsChangePasswordBtn');
    const old = btn ? btn.innerHTML : '';

    if (!currentUser.email) {
      setSettingsMessage('error', 'Password change requires an email-based account.');
      return;
    }
    if (!currentPassword) {
      setSettingsMessage('error', 'Enter your current password first.');
      return;
    }
    if (newPassword.length < 6) {
      setSettingsMessage('error', 'New password must be at least 6 characters.');
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.innerHTML = `${iconPassword()} <span>Updating...</span>`; }
      const credential = authApi.EmailAuthProvider.credential(currentUser.email, currentPassword);
      await authApi.reauthenticateWithCredential(currentUser, credential);
      await authApi.updatePassword(currentUser, newPassword);
      const currentInput = document.getElementById('settingsCurrentPassword');
      const newInput = document.getElementById('settingsNewPassword');
      if (currentInput) currentInput.value = '';
      if (newInput) newInput.value = '';
      setSettingsMessage('success', 'Password changed successfully.');
    } catch (err) {
      const msg = {
        'auth/wrong-password': 'Current password is incorrect.',
        'auth/invalid-credential': 'Current password is incorrect.',
        'auth/weak-password': 'New password is too weak.',
        'auth/requires-recent-login': 'Please sign out, sign in again, and try changing the password.',
        'auth/operation-not-allowed': 'Password login is not enabled for this account.'
      }[err.code] || err.message || 'Password change failed.';
      setSettingsMessage('error', msg);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
  }

  async function sendUserPasswordReset() {
    if (!currentUser?.email || !authApi) {
      setSettingsMessage('error', 'No email found for this account.');
      return;
    }
    const btn = document.getElementById('settingsResetPasswordBtn');
    const old = btn ? btn.innerHTML : '';
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = `${iconPassword()} <span>Sending...</span>`; }
      await authApi.sendPasswordResetEmail(authApi.auth, currentUser.email);
      setSettingsMessage('success', 'Password reset link sent to your email.');
    } catch (err) {
      setSettingsMessage('error', err.message || 'Unable to send reset link.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
  }

  function bottomIcon(name) {
    const icons = {
      home: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.75 11.5 12 4.25l8.25 7.25" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.25 10.25v9h11.5v-9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 19.25v-5h4v5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      credit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 7.5h15a1.75 1.75 0 0 1 1.75 1.75v7.5A1.75 1.75 0 0 1 19.5 18.5h-15a1.75 1.75 0 0 1-1.75-1.75v-7.5A1.75 1.75 0 0 1 4.5 7.5Z" stroke="currentColor"/><path d="M2.75 10.25h18.5M6.75 15.5h3.5" stroke="currentColor" stroke-linecap="round"/></svg>',
      orders: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.25 4.75h11.5v14.5H6.25V4.75Z" stroke="currentColor" stroke-linejoin="round"/><path d="M8.75 8.25h6.5M8.75 12h6.5M8.75 15.75h3.5" stroke="currentColor" stroke-linecap="round"/></svg>',
      profile: '<svg viewBox="0 0 24 24" fill="none"><path d="M15.5 8.25a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" stroke="currentColor"/><path d="M5 19.25a7 7 0 0 1 14 0" stroke="currentColor" stroke-linecap="round"/></svg>'
    };
    return icons[name] || icons.home;
  }

  function injectBottomNavigation() {
    if (document.getElementById('rabbiBottomNav')) return;
    document.body.classList.add('has-bottom-nav');
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const qs = new URLSearchParams(location.search);
    const nav = document.createElement('nav');
    nav.id = 'rabbiBottomNav';
    nav.className = 'rabbi-bottom-nav';
    nav.setAttribute('aria-label', 'App bottom navigation');
    const items = [
      { href: 'index.html', key: 'home', label: 'Home', active: page === 'index.html' || page === '' },
      { href: 'add-credit.html', key: 'credit', label: 'Add Credit', active: page === 'add-credit.html' },
      { href: 'dashboard.html?tab=orders', key: 'orders', label: 'My Orders', active: page === 'dashboard.html' && qs.get('tab') === 'orders' },
      { href: 'dashboard.html', key: 'profile', label: 'Profile', active: page === 'dashboard.html' && qs.get('tab') !== 'orders' }
    ];
    nav.innerHTML = items.map(item => `<a href="${item.href}" class="${item.active ? 'active' : ''}">${bottomIcon(item.key)}<span>${item.label}</span></a>`).join('');
    document.body.appendChild(nav);
  }

  function injectCustomerServiceButton() {
    const list = document.getElementById('navLinks');
    if (!list || document.getElementById('customerServiceNavItem')) return;
    const li = document.createElement('li');
    li.id = 'customerServiceNavItem';
    li.className = 'customer-service-nav';
    li.innerHTML = `<a href="https://wa.me/8801731410341" target="_blank" rel="noopener"><span class="nav-icon">${iconSupport()}</span>Customer Service</a>`;
    list.appendChild(li);
  }

  async function bootstrap() {
    const loginModal = injectAuthUI();
    injectCustomerServiceButton();
    injectBottomNavigation();
    const { authApi: a } = await loadFirebaseModules();
    const { auth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } = a;

    let isSignUp = false;

    function openLoginModal(action) {
      if (currentUser) {
        closeLoginModal();
        return;
      }
      _afterLoginAction = action || null;
      clearAuthError();
      loginModal.classList.add('open');
      loginModal.style.display = '';
      document.body.style.overflow = 'hidden';
    }

    function closeLoginModal() {
      loginModal.classList.remove('open');
      loginModal.setAttribute('aria-hidden', 'true');
      loginModal.style.display = 'none';
      document.body.style.overflow = '';
    }

    function refreshAfterLoginOnce() {
      if (sessionStorage.getItem('rabbiLoginRefreshDone') === '1') return;
      sessionStorage.setItem('rabbiLoginRefreshDone', '1');
      setTimeout(() => window.location.reload(), 250);
    }

    function showAuthError(msg) {
      const el = document.getElementById('authError');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    function clearAuthError() {
      const el = document.getElementById('authError');
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    }

    window.rabbiAuth = {
      isLoggedIn: () => !!currentUser,
      getUser: () => currentUser,
      getUserData: () => currentUserData,
      getCredit: () => Number(currentUserData?.credit || 0),
      isAdmin: () => currentIsAdmin,
      openLogin: (action) => openLoginModal(action),
      openProfileSettings: (focus) => openProfileSettings(focus),
      signOut: () => { localStorage.removeItem('rabbiLandingPopupSeen'); sessionStorage.setItem('rabbiShowLandingPopup','1'); return authApi.signOut(auth); }
    };

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      const loginBtn = document.getElementById('navLoginBtn');
      const avatar = document.getElementById('navUserAvatar');
      const menu = document.getElementById('navUserMenu');

      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (avatar) avatar.style.display = 'flex';
        await ensureUserDoc(user);
        await checkAdmin(user);
        listenUserDoc(user);
        const wasLoginOpen = loginModal.classList.contains('open') || loginModal.style.display !== 'none';
        closeLoginModal();
        setTimeout(closeLoginModal, 50);
        window.dispatchEvent(new CustomEvent('rabbi:loggedin', { detail: user }));
        if (sessionStorage.getItem('rabbiLoginJustCompleted') === '1' || wasLoginOpen) {
          sessionStorage.removeItem('rabbiLoginJustCompleted');
          localStorage.removeItem('rabbiLandingPopupSeen');
          sessionStorage.setItem('rabbiShowLandingPopup', '1');
          refreshAfterLoginOnce();
        }
      } else {
        currentUserData = null;
        currentIsAdmin = false;
        sessionStorage.removeItem('rabbiLoginRefreshDone');
        if (unsubscribeUserDoc) { unsubscribeUserDoc(); unsubscribeUserDoc = null; }
        if (loginBtn) loginBtn.style.display = 'block';
        if (avatar) avatar.style.display = 'none';
        if (menu) menu.classList.remove('open');
      }
    });

    const googleBtn = document.getElementById('authGoogleBtn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        const old = googleBtn.innerHTML;
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = 'Signing in…';
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
          sessionStorage.setItem('rabbiLoginJustCompleted', '1');
          localStorage.removeItem('rabbiLandingPopupSeen');
          sessionStorage.setItem('rabbiShowLandingPopup', '1');
          closeLoginModal();
          refreshAfterLoginOnce();
        } catch (err) {
          showAuthError('Google sign-in failed. Please try again.');
        } finally {
          googleBtn.disabled = false;
          googleBtn.innerHTML = old;
        }
      });
    }

    const toggleBtn = document.getElementById('authToggleBtn');
    const signInBtn = document.getElementById('authSignInBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isSignUp = !isSignUp;
        if (signInBtn) signInBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
        toggleBtn.innerHTML = isSignUp ? 'Already have an account? <strong>Sign In</strong>' : 'Don\'t have an account? <strong>Create one</strong>';
        clearAuthError();
      });
    }

    if (signInBtn) {
      signInBtn.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        if (!email || !password) { showAuthError('Please enter email and password.'); return; }

        signInBtn.disabled = true;
        signInBtn.textContent = 'Please wait…';
        clearAuthError();

        try {
          if (isSignUp) await createUserWithEmailAndPassword(auth, email, password);
          else await signInWithEmailAndPassword(auth, email, password);
          sessionStorage.setItem('rabbiLoginJustCompleted', '1');
          localStorage.removeItem('rabbiLandingPopupSeen');
          sessionStorage.setItem('rabbiShowLandingPopup', '1');
          closeLoginModal();
          refreshAfterLoginOnce();
        } catch (err) {
          const msgs = {
            'auth/email-already-in-use': 'This email is already registered. Try signing in.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
            'auth/invalid-credential': 'Invalid email or password.'
          };
          showAuthError(msgs[err.code] || 'Authentication failed. Please try again.');
        } finally {
          signInBtn.disabled = false;
          signInBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
        }
      });
    }

    const navLoginBtn = document.getElementById('navLoginBtn');
    if (navLoginBtn) navLoginBtn.addEventListener('click', () => openLoginModal());

    const navUserAvatar = document.getElementById('navUserAvatar');
    if (navUserAvatar) {
      navUserAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentUser) { openLoginModal(); return; }
        const menu = createProfileMenu(auth);
        if (!menu) return;
        updateProfileMenu(currentUser, currentUserData || {});
        menu.classList.toggle('open');
        document.addEventListener('click', () => menu.classList.remove('open'), { once: true });
      });
    }

    const closeBtn = document.getElementById('authModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);
    loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();

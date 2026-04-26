/* ============================================================
   Rabbi Portfolio — Auth System v1.0
   Firebase Google Sign-In
   Users can browse freely; login required to submit forms
   ============================================================ */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  let currentUser = null;
  let authInitialized = false;
  let _afterLoginAction = null;

  /* ── Inject Auth UI ─────────────────────────────────────── */
  function injectAuthUI() {
    /* Login Modal */
    const loginModal = document.createElement('div');
    loginModal.id = 'authModal';
    loginModal.innerHTML = `
      <div class="auth-modal-box" id="authModalBox">
        <button class="auth-modal-close" id="authModalClose">&times;</button>
        <div class="auth-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
        </div>
        <h3 class="auth-title">Sign in to Continue</h3>
        <p class="auth-sub">Create a free account or sign in with Google to submit a service request. No spam — ever.</p>
        <button class="auth-google-btn" id="authGoogleBtn">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <div class="auth-divider"><span>or</span></div>
        <div id="authEmailForm">
          <div class="auth-form-group">
            <input class="auth-input" type="email" id="authEmail" placeholder="Email address" />
          </div>
          <div class="auth-form-group">
            <input class="auth-input" type="password" id="authPassword" placeholder="Password (min 6 chars)" />
          </div>
          <div id="authError" class="auth-error" style="display:none;"></div>
          <button class="auth-submit-btn" id="authSignInBtn">Sign In</button>
          <button class="auth-toggle-btn" id="authToggleBtn">Don't have an account? <strong>Create one</strong></button>
        </div>
        <p class="auth-note">🔒 Your data is safe and never shared.</p>
      </div>
    `;
    loginModal.style.cssText = `
      display:none;position:fixed;inset:0;z-index:3000;
      background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);
      align-items:center;justify-content:center;padding:20px;
    `;
    document.body.appendChild(loginModal);

    /* User Avatar in Navbar */
    const navbar = document.querySelector('.nav-inner');
    if (navbar) {
      const authBtn = document.createElement('div');
      authBtn.id = 'navAuthBtn';
      authBtn.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;margin-left:4px;';
      authBtn.innerHTML = `<div id="navUserAvatar" style="display:none;width:32px;height:32px;border-radius:50%;background:var(--accent);border:2px solid rgba(0,200,255,0.3);overflow:hidden;"><img id="navUserImg" src="" alt="" style="width:100%;height:100%;object-fit:cover;" /></div><button id="navLoginBtn" style="padding:7px 16px;background:transparent;border:1px solid rgba(0,200,255,0.3);border-radius:50px;color:var(--accent);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:var(--font-display);transition:all 0.2s;">Login</button>`;
      // Insert before nav-cta
      const navCta = navbar.querySelector('.nav-cta');
      if (navCta) navbar.insertBefore(authBtn, navCta);
      else navbar.appendChild(authBtn);
    }

    injectAuthCSS();
    return loginModal;
  }

  function injectAuthCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #authModal.open { display:flex !important; animation:fadeIn 0.2s ease; }
      .auth-modal-box {
        background:var(--surface-2,#0d1117); border:1px solid rgba(0,200,255,0.15);
        border-radius:16px; width:100%; max-width:420px; padding:36px 32px;
        position:relative; animation:slideUp 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow:0 32px 80px rgba(0,0,0,0.8);
      }
      .auth-modal-close {
        position:absolute;top:14px;right:14px;width:30px;height:30px;
        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
        border-radius:8px;color:#7a8ca8;cursor:pointer;font-size:1rem;
        display:flex;align-items:center;justify-content:center;transition:all 0.2s;
      }
      .auth-modal-close:hover { color:#00c8ff; border-color:rgba(0,200,255,0.3); }
      .auth-icon {
        width:56px;height:56px;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.2);
        border-radius:14px;display:flex;align-items:center;justify-content:center;
        margin:0 auto 18px;color:var(--accent,#00c8ff);
      }
      .auth-title { font-family:var(--font-display,'DM Sans',sans-serif);font-size:1.2rem;font-weight:700;color:#e8edf5;text-align:center;margin-bottom:8px; }
      .auth-sub { font-size:0.84rem;color:#7a8ca8;text-align:center;line-height:1.6;margin-bottom:22px; }
      .auth-google-btn {
        width:100%;padding:12px;background:#fff;color:#1a1a1a;border:none;border-radius:10px;
        font-size:0.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;
        justify-content:center;gap:10px;transition:all 0.2s;margin-bottom:16px;
      }
      .auth-google-btn:hover { box-shadow:0 4px 20px rgba(255,255,255,0.15);transform:translateY(-1px); }
      .auth-divider { display:flex;align-items:center;gap:12px;margin:16px 0;color:#3a4a5a;font-size:0.78rem; }
      .auth-divider::before,.auth-divider::after { content:'';flex:1;height:1px;background:rgba(255,255,255,0.08); }
      .auth-form-group { margin-bottom:12px; }
      .auth-input {
        width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
        border-radius:9px;color:#e8edf5;font-size:0.9rem;outline:none;transition:border-color 0.2s;
        font-family:inherit;
      }
      .auth-input:focus { border-color:rgba(0,200,255,0.4); }
      .auth-input::placeholder { color:#3a4a5a; }
      .auth-error { background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.25);color:#ff8080;
        border-radius:8px;padding:10px 14px;font-size:0.82rem;margin-bottom:12px; }
      .auth-submit-btn {
        width:100%;padding:12px;background:var(--accent,#00c8ff);color:#020a10;border:none;
        border-radius:50px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:var(--font-display,'DM Sans',sans-serif);
        transition:all 0.2s;margin-bottom:10px;
      }
      .auth-submit-btn:hover { opacity:0.88;transform:translateY(-1px); }
      .auth-submit-btn:disabled { opacity:0.5;cursor:not-allowed;transform:none; }
      .auth-toggle-btn { width:100%;padding:8px;background:none;border:none;color:#7a8ca8;font-size:0.82rem;cursor:pointer;text-align:center; }
      .auth-toggle-btn strong { color:var(--accent,#00c8ff); }
      .auth-note { text-align:center;font-size:0.74rem;color:#3a4a5a;margin-top:14px; }
      #navLoginBtn:hover { background:rgba(0,200,255,0.08);border-color:rgba(0,200,255,0.5); }
      .nav-user-menu {
        position:absolute;top:52px;right:0;background:var(--surface-2,#0d1117);
        border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:8px;
        min-width:180px;box-shadow:0 20px 50px rgba(0,0,0,0.5);z-index:1000;
        display:none;
      }
      .nav-user-menu.open { display:block;animation:slideUp 0.2s ease; }
      .nav-user-menu-name { padding:8px 12px;font-size:0.8rem;color:#7a8ca8;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px; }
      .nav-user-menu-btn { width:100%;padding:9px 12px;background:none;border:none;color:#e8edf5;
        font-size:0.85rem;cursor:pointer;text-align:left;border-radius:8px;transition:background 0.2s;display:flex;align-items:center;gap:8px; }
      .nav-user-menu-btn:hover { background:rgba(255,255,255,0.05); }
      .nav-user-menu-btn.danger { color:#ff8080; }
    `;
    document.head.appendChild(style);
  }

  /* ── Load Firebase Auth lazily ──────────────────────────── */
  async function loadFirebaseAuth() {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup,
            createUserWithEmailAndPassword, signInWithEmailAndPassword,
            signOut, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');

    const firebaseConfig = {
      apiKey: "AIzaSyA7VMETaS1R4hq1WUBXgsVnvgEyzFhKGfs",
      authDomain: "rabbihossainltd-63709.firebaseapp.com",
      projectId: "rabbihossainltd-63709",
      storageBucket: "rabbihossainltd-63709.firebasestorage.app",
      messagingSenderId: "658498014345",
      appId: "1:658498014345:web:89db9e029a6930d3e2ca58",
      measurementId: "G-RT4WQL8R0H"
    };

    const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);

    return { auth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
             signInWithEmailAndPassword, signOut, onAuthStateChanged };
  }

  /* ── Bootstrap ──────────────────────────────────────────── */
  let firebaseAuth = null;

  async function bootstrap() {
    const loginModal = injectAuthUI();
    const fa = await loadFirebaseAuth();
    firebaseAuth = fa;

    const { auth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
            signInWithEmailAndPassword, signOut, onAuthStateChanged } = fa;

    let isSignUp = false;

    /* Auth state listener */
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      authInitialized = true;
      updateNavUI(user);
      if (user) {
        loginModal.classList.remove('open');
        document.body.style.overflow = '';
        window.dispatchEvent(new CustomEvent('rabbi:loggedin', { detail: user }));
      }
    });

    /* Nav UI update */
    function updateNavUI(user) {
      const loginBtn   = document.getElementById('navLoginBtn');
      const userAvatar = document.getElementById('navUserAvatar');
      const userImg    = document.getElementById('navUserImg');

      if (user) {
        if (loginBtn)   loginBtn.style.display   = 'none';
        if (userAvatar) {
          userAvatar.style.display = 'block';
          if (user.photoURL && userImg) userImg.src = user.photoURL;
          else if (userImg) {
            userImg.style.display = 'none';
            userAvatar.style.background = 'var(--accent)';
            userAvatar.style.display = 'flex';
            userAvatar.style.alignItems = 'center';
            userAvatar.style.justifyContent = 'center';
            userAvatar.style.color = '#020a10';
            userAvatar.style.fontSize = '0.8rem';
            userAvatar.style.fontWeight = '700';
            userAvatar.textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
          }
        }
      } else {
        if (loginBtn)   loginBtn.style.display   = 'block';
        if (userAvatar) userAvatar.style.display = 'none';
      }
    }

    /* Google Sign-in */
    const googleBtn = document.getElementById('authGoogleBtn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = 'Signing in…';
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
          loginModal.classList.remove('open');
          document.body.style.overflow = '';
        } catch (err) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google';
          showAuthError('Google sign-in failed. Please try again.');
        }
      });
    }

    /* Email Sign-in / Sign-up toggle */
    const toggleBtn   = document.getElementById('authToggleBtn');
    const signInBtn   = document.getElementById('authSignInBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isSignUp = !isSignUp;
        signInBtn.textContent  = isSignUp ? 'Create Account' : 'Sign In';
        toggleBtn.innerHTML    = isSignUp
          ? 'Already have an account? <strong>Sign In</strong>'
          : 'Don\'t have an account? <strong>Create one</strong>';
        clearAuthError();
      });
    }

    if (signInBtn) {
      signInBtn.addEventListener('click', async () => {
        const email    = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        if (!email || !password) { showAuthError('Please enter email and password.'); return; }

        signInBtn.disabled = true;
        signInBtn.textContent = 'Please wait…';
        clearAuthError();

        try {
          if (isSignUp) {
            await createUserWithEmailAndPassword(auth, email, password);
          } else {
            await signInWithEmailAndPassword(auth, email, password);
          }
          loginModal.classList.remove('open');
          document.body.style.overflow = '';
        } catch (err) {
          signInBtn.disabled = false;
          signInBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
          const msgs = {
            'auth/email-already-in-use': 'This email is already registered. Try signing in.',
            'auth/user-not-found'       : 'No account found with this email.',
            'auth/wrong-password'       : 'Incorrect password. Please try again.',
            'auth/invalid-email'        : 'Please enter a valid email address.',
            'auth/weak-password'        : 'Password must be at least 6 characters.',
            'auth/too-many-requests'    : 'Too many attempts. Please wait and try again.',
          };
          showAuthError(msgs[err.code] || 'Authentication failed. Please try again.');
        }
      });
    }

    /* Nav login button */
    const navLoginBtn  = document.getElementById('navLoginBtn');
    if (navLoginBtn) {
      navLoginBtn.addEventListener('click', () => openLoginModal());
    }

    /* Nav user avatar — show menu */
    const navUserAvatar = document.getElementById('navUserAvatar');
    if (navUserAvatar) {
      navUserAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        let menu = document.getElementById('navUserMenu');
        if (!menu) {
          menu = document.createElement('div');
          menu.id = 'navUserMenu';
          menu.className = 'nav-user-menu';
          menu.style.position = 'relative';
          const authBtn = document.getElementById('navAuthBtn');
          if (authBtn) {
            authBtn.style.position = 'relative';
            authBtn.appendChild(menu);
          }
          const nameDiv = document.createElement('div');
          nameDiv.className = 'nav-user-menu-name';
          nameDiv.textContent = currentUser ? (currentUser.displayName || currentUser.email || 'User') : '';
          menu.appendChild(nameDiv);
          const addCreditBtn = document.createElement('button');
          addCreditBtn.className = 'nav-user-menu-btn';
          addCreditBtn.innerHTML = '💳 Add Credit';
          addCreditBtn.addEventListener('click', () => { window.location.href = 'add-credit.html'; });
          menu.appendChild(addCreditBtn);

          const adminBtn = document.createElement('button');
          adminBtn.className = 'nav-user-menu-btn';
          adminBtn.innerHTML = '🛡️ Admin Panel';
          adminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });
          menu.appendChild(adminBtn);

          const signOutBtn = document.createElement('button');
          signOutBtn.className = 'nav-user-menu-btn danger';
          signOutBtn.innerHTML = '🚪 Sign Out';
          signOutBtn.addEventListener('click', () => signOut(auth));
          menu.appendChild(signOutBtn);
        }
        menu.classList.toggle('open');
        document.addEventListener('click', () => menu.classList.remove('open'), { once: true });
      });
    }

    /* Close modal */
    const closeBtn = document.getElementById('authModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);
    loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });

    function openLoginModal(action) {
      _afterLoginAction = action || null;
      clearAuthError();
      loginModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLoginModal() {
      loginModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    function showAuthError(msg) {
      const el = document.getElementById('authError');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    }
    function clearAuthError() {
      const el = document.getElementById('authError');
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    }

    /* Public API */
    window.rabbiAuth = {
      isLoggedIn : () => !!currentUser,
      getUser    : () => currentUser,
      openLogin  : (action) => openLoginModal(action),
      signOut    : () => signOut(auth),
    };
  }

  /* Start */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();

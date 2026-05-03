/* ── Review System ── */
(async function () {
  const { db, auth } = await import('./firebase-core.js');
  const {
    collection, addDoc, getDocs, query, orderBy, where,
    serverTimestamp, doc, getDoc
  } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
  const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');

  let _currentUser = null;
  onAuthStateChanged(auth, u => { _currentUser = u; });

  /* ── inject CSS ── */
  if (!document.getElementById('reviewSystemCSS')) {
    const s = document.createElement('style');
    s.id = 'reviewSystemCSS';
    s.textContent = `
      /* ── Review Modal Overlay ── */
      #reviewModalOverlay {
        display: none; position: fixed; inset: 0; z-index: 9998;
        background: rgba(0,0,0,.78); backdrop-filter: blur(12px);
        align-items: center; justify-content: center; padding: 20px;
      }
      #reviewModalOverlay.open { display: flex; animation: rvFadeIn .22s ease; }
      @keyframes rvFadeIn { from{opacity:0} to{opacity:1} }

      .rv-box {
        width: min(480px,100%); border-radius: 24px;
        background: linear-gradient(180deg,rgba(0,200,255,.07) 0%,rgba(2,8,18,1) 100%);
        border: 1px solid rgba(0,200,255,.18);
        box-shadow: 0 40px 100px rgba(0,0,0,.6);
        padding: 32px 28px 28px; position: relative;
        animation: rvSlideUp .28s cubic-bezier(.2,1,.2,1) both;
      }
      @keyframes rvSlideUp { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }

      .rv-close {
        position: absolute; top: 14px; right: 14px;
        width: 30px; height: 30px; border-radius: 8px;
        background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
        color: #7a8ca8; cursor: pointer; font-size: 1.1rem;
        display: flex; align-items: center; justify-content: center; transition: all .2s;
      }
      .rv-close:hover { color: #00c8ff; border-color: rgba(0,200,255,.3); }

      .rv-title {
        font-family: var(--font-display,'DM Sans',sans-serif);
        font-size: 1.15rem; font-weight: 800; color: #e8edf5;
        margin: 0 0 4px; text-align: center;
      }
      .rv-sub {
        font-size: .83rem; color: #6a8aaa; text-align: center;
        margin: 0 0 24px; line-height: 1.5;
      }

      /* ── Star Rating ── */
      .rv-stars {
        display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;
      }
      .rv-star-btn {
        background: none; border: none; cursor: pointer; padding: 2px;
        color: rgba(255,255,255,.15); transition: color .15s, transform .15s;
      }
      .rv-star-btn:hover, .rv-star-btn.active { color: #ffa500; }
      .rv-star-btn:hover { transform: scale(1.18); }
      .rv-star-btn svg { display: block; }

      .rv-star-label {
        text-align: center; font-size: .82rem; font-weight: 700;
        color: #ffa500; min-height: 18px; margin-bottom: 16px;
        letter-spacing: .03em;
      }

      /* ── Input ── */
      .rv-label {
        font-size: .78rem; font-weight: 700; color: #7a8ca8;
        display: block; margin-bottom: 6px; letter-spacing: .04em; text-transform: uppercase;
      }
      .rv-textarea {
        width: 100%; padding: 12px 14px; border-radius: 12px;
        background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.1);
        color: #e8edf5; font-size: .9rem; font-family: inherit;
        outline: none; resize: none; line-height: 1.6; transition: border-color .2s, box-shadow .2s;
        box-sizing: border-box; min-height: 100px;
      }
      .rv-textarea:focus { border-color: rgba(0,200,255,.45); box-shadow: 0 0 0 3px rgba(0,200,255,.08); }
      .rv-textarea::placeholder { color: #3a4a5a; }

      .rv-char { text-align: right; font-size: .72rem; color: #3a5070; margin-top: 4px; margin-bottom: 18px; }

      .rv-submit {
        width: 100%; padding: 13px; border: none; border-radius: 14px;
        background: linear-gradient(135deg,#00c8ff,#00ff88);
        color: #02050a; font-weight: 900; font-size: .95rem;
        cursor: pointer; transition: opacity .2s, transform .2s;
        font-family: var(--font-display,'DM Sans',sans-serif);
      }
      .rv-submit:hover { opacity: .88; transform: translateY(-1px); }
      .rv-submit:disabled { opacity: .45; cursor: not-allowed; transform: none; }

      .rv-msg { font-size: .82rem; text-align: center; min-height: 20px; margin-top: 10px; }
      .rv-msg.ok { color: #00ff88; }
      .rv-msg.err { color: #ff7070; }

      /* ── Public Reviews Page / Modal ── */
      #reviewsViewOverlay {
        display: none; position: fixed; inset: 0; z-index: 9997;
        background: rgba(0,0,0,.80); backdrop-filter: blur(12px);
        align-items: flex-start; justify-content: center;
        padding: 20px; overflow-y: auto;
      }
      #reviewsViewOverlay.open { display: flex; animation: rvFadeIn .22s ease; }

      .rvv-box {
        width: min(600px,100%); border-radius: 24px; margin: auto;
        background: rgba(6,12,22,1); border: 1px solid rgba(0,200,255,.15);
        box-shadow: 0 40px 100px rgba(0,0,0,.7);
        padding: 28px 24px; position: relative;
        animation: rvSlideUp .28s cubic-bezier(.2,1,.2,1) both;
      }

      .rvv-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 20px; padding-bottom: 16px;
        border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .rvv-title { font-size: 1.05rem; font-weight: 800; color: #e8edf5; }
      .rvv-avg {
        display: flex; align-items: center; gap: 8px;
        background: rgba(255,165,0,.1); border: 1px solid rgba(255,165,0,.22);
        border-radius: 999px; padding: 5px 14px;
      }
      .rvv-avg-num { font-size: 1.1rem; font-weight: 900; color: #ffa500; }
      .rvv-avg-star svg { color: #ffa500; }
      .rvv-avg-count { font-size: .75rem; color: #6a8aaa; }

      .rv-card {
        padding: 16px; border-radius: 16px;
        background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
        margin-bottom: 12px; transition: border-color .2s;
      }
      .rv-card:hover { border-color: rgba(0,200,255,.18); }

      .rv-card-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 8px; flex-wrap: wrap; gap: 6px;
      }
      .rv-card-name { font-weight: 800; font-size: .88rem; color: #c8ddf0; }
      .rv-card-service { font-size: .72rem; color: #4a7090; font-weight: 600; }
      .rv-card-date { font-size: .72rem; color: #3a5070; }

      .rv-card-stars { display: flex; gap: 3px; margin-bottom: 8px; }
      .rv-card-stars svg { color: #ffa500; }
      .rv-card-stars svg.empty { color: rgba(255,255,255,.12); }

      .rv-card-text { font-size: .86rem; color: #8faec9; line-height: 1.65; }

      .rvv-empty { text-align: center; padding: 40px 0; color: #4a6070; font-size: .88rem; }

      .rvv-load { display: flex; justify-content:center; padding: 30px 0; }
      .rvv-spinner {
        width: 28px; height: 28px; border-radius: 50%;
        border: 3px solid rgba(0,200,255,.15);
        border-top-color: #00c8ff;
        animation: spin .7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Footer Reviews Button ── */
      .footer-reviews-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 8px 16px; border-radius: 999px;
        background: rgba(255,165,0,.1); border: 1px solid rgba(255,165,0,.25);
        color: #ffc14d; font-size: .8rem; font-weight: 700;
        cursor: pointer; transition: all .2s; text-decoration: none;
        margin-top: 10px;
      }
      .footer-reviews-btn:hover {
        background: rgba(255,165,0,.18); border-color: rgba(255,165,0,.45);
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Star SVG helper ── */
  function starSVG(filled, size = 28) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
  }

  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  /* ══════════════════════════════════════════
     REVIEW SUBMIT MODAL
  ══════════════════════════════════════════ */
  function createReviewModal() {
    if (document.getElementById('reviewModalOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'reviewModalOverlay';
    ov.innerHTML = `
      <div class="rv-box" id="reviewModalBox">
        <button class="rv-close" id="rvClose" type="button">&times;</button>
        <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.25);display:flex;align-items:center;justify-content:center;color:#ffa500;margin:0 auto 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h3 class="rv-title">Rate Your Experience</h3>
        <p class="rv-sub" id="rvSubText">How was your experience with our service?</p>

        <div class="rv-stars" id="rvStars">
          ${[1,2,3,4,5].map(i => `
            <button class="rv-star-btn" type="button" data-val="${i}" aria-label="${i} star">
              ${starSVG(false, 36)}
            </button>
          `).join('')}
        </div>
        <div class="rv-star-label" id="rvStarLabel"></div>

        <label class="rv-label">Your Experience</label>
        <textarea class="rv-textarea" id="rvText" placeholder="Tell others about your experience (optional)..." maxlength="400"></textarea>
        <div class="rv-char"><span id="rvCharCount">0</span>/400</div>

        <button class="rv-submit" id="rvSubmit" type="button" disabled>Submit Review</button>
        <div class="rv-msg" id="rvMsg"></div>
      </div>
    `;
    document.body.appendChild(ov);

    /* close */
    document.getElementById('rvClose').addEventListener('click', closeReviewModal);
    ov.addEventListener('click', e => { if (e.target === ov) closeReviewModal(); });

    /* stars */
    let selectedStar = 0;
    const starBtns = ov.querySelectorAll('.rv-star-btn');
    const label = document.getElementById('rvStarLabel');
    const submitBtn = document.getElementById('rvSubmit');

    function highlightStars(upTo) {
      starBtns.forEach((btn, i) => {
        const filled = i < upTo;
        btn.classList.toggle('active', filled);
        btn.innerHTML = starSVG(filled, 36);
      });
      label.textContent = starLabels[upTo] || '';
    }

    starBtns.forEach(btn => {
      btn.addEventListener('mouseenter', () => highlightStars(+btn.dataset.val));
      btn.addEventListener('mouseleave', () => highlightStars(selectedStar));
      btn.addEventListener('click', () => {
        selectedStar = +btn.dataset.val;
        highlightStars(selectedStar);
        submitBtn.disabled = false;
      });
    });

    /* char count */
    const textarea = document.getElementById('rvText');
    textarea.addEventListener('input', () => {
      document.getElementById('rvCharCount').textContent = textarea.value.length;
    });

    /* submit */
    submitBtn.addEventListener('click', async () => {
      if (!selectedStar) return;
      const text = textarea.value.trim();
      const msgEl = document.getElementById('rvMsg');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      msgEl.className = 'rv-msg'; msgEl.textContent = '';

      try {
        if (!_currentUser) throw new Error('Please sign in to leave a review.');

        const payload = {
          userId: _currentUser.uid,
          userName: _currentUser.displayName || _currentUser.email?.split('@')[0] || 'User',
          userEmail: _currentUser.email || '',
          rating: selectedStar,
          text: text,
          serviceName: ov._serviceName || '',
          createdAt: serverTimestamp(),
          approved: true
        };

        await addDoc(collection(db, 'reviews'), payload);
        msgEl.className = 'rv-msg ok';
        msgEl.textContent = 'Thank you for your review!';
        submitBtn.textContent = 'Submitted ✓';
        setTimeout(closeReviewModal, 1800);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
        msgEl.className = 'rv-msg err';
        msgEl.textContent = err.message || 'Failed to submit. Try again.';
      }
    });
  }

  function closeReviewModal() {
    const ov = document.getElementById('reviewModalOverlay');
    if (ov) { ov.classList.remove('open'); }
  }

  /* public API: open review modal */
  window.openReviewModal = function (serviceName = '') {
    createReviewModal();
    const ov = document.getElementById('reviewModalOverlay');
    ov._serviceName = serviceName;
    document.getElementById('rvSubText').textContent =
      serviceName ? `How was your experience with ${serviceName}?` : 'How was your experience with our service?';
    // reset
    const starBtns = ov.querySelectorAll('.rv-star-btn');
    starBtns.forEach((b, i) => { b.classList.remove('active'); b.innerHTML = starSVG(false, 36); });
    document.getElementById('rvStarLabel').textContent = '';
    document.getElementById('rvText').value = '';
    document.getElementById('rvCharCount').textContent = '0';
    document.getElementById('rvSubmit').disabled = true;
    document.getElementById('rvMsg').textContent = '';
    ov.classList.add('open');
  };

  /* ══════════════════════════════════════════
     REVIEWS VIEW MODAL (public)
  ══════════════════════════════════════════ */
  function renderStars(rating, size = 16) {
    return [1,2,3,4,5].map(i =>
      `<svg class="${i <= rating ? '' : 'empty'}" width="${size}" height="${size}" viewBox="0 0 24 24"
        fill="${i <= rating ? 'currentColor' : 'none'}"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>`
    ).join('');
  }

  async function openReviewsView() {
    let ov = document.getElementById('reviewsViewOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'reviewsViewOverlay';
      ov.innerHTML = `
        <div class="rvv-box">
          <button class="rv-close" id="rvvClose" type="button">&times;</button>
          <div class="rvv-head">
            <span class="rvv-title">Customer Reviews</span>
            <div class="rvv-avg" id="rvvAvg" style="display:none;">
              <span class="rvv-avg-num" id="rvvAvgNum"></span>
              <span class="rvv-avg-star">${starSVG(true, 18)}</span>
              <span class="rvv-avg-count" id="rvvAvgCount"></span>
            </div>
          </div>
          <div id="rvvList"><div class="rvv-load"><div class="rvv-spinner"></div></div></div>
        </div>
      `;
      document.body.appendChild(ov);
      document.getElementById('rvvClose').addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    }

    ov.classList.add('open');
    const listEl = document.getElementById('rvvList');
    listEl.innerHTML = '<div class="rvv-load"><div class="rvv-spinner"></div></div>';

    try {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);

      if (snap.empty) {
        listEl.innerHTML = '<div class="rvv-empty">No reviews yet. Be the first to review!</div>';
        return;
      }

      const docs = [];
      snap.forEach(d => docs.push(d.data()));

      // avg rating
      const avg = (docs.reduce((s, d) => s + (d.rating || 0), 0) / docs.length).toFixed(1);
      const avgEl = document.getElementById('rvvAvg');
      document.getElementById('rvvAvgNum').textContent = avg;
      document.getElementById('rvvAvgCount').textContent = `${docs.length} review${docs.length !== 1 ? 's' : ''}`;
      avgEl.style.display = 'flex';

      listEl.innerHTML = docs.map(d => {
        const date = d.createdAt?.toDate
          ? d.createdAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
          : '';
        return `
          <div class="rv-card">
            <div class="rv-card-head">
              <div>
                <div class="rv-card-name">${escH(d.userName || 'User')}</div>
                ${d.serviceName ? `<div class="rv-card-service">${escH(d.serviceName)}</div>` : ''}
              </div>
              <div class="rv-card-date">${date}</div>
            </div>
            <div class="rv-card-stars">${renderStars(d.rating)}</div>
            ${d.text ? `<div class="rv-card-text">${escH(d.text)}</div>` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="rvv-empty" style="color:#ff7070;">Failed to load reviews.</div>`;
    }
  }

  window.openReviewsView = openReviewsView;

  function escH(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Attach footer Reviews button ── */
  function attachFooterBtn() {
    document.querySelectorAll('.footer-col h4').forEach(h4 => {
      if (h4.textContent.trim() === 'Navigation') {
        if (h4.parentElement.querySelector('.footer-reviews-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'footer-reviews-btn';
        btn.type = 'button';
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Customer Reviews
        `;
        btn.addEventListener('click', openReviewsView);
        h4.parentElement.appendChild(btn);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachFooterBtn);
  } else {
    attachFooterBtn();
  }

})();

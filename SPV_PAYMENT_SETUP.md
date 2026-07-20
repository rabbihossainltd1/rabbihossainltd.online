# ⚡ SPV Auto Payment — Setup Guide

Tomar manual payment system ke **automatic** bananor jonno [SPV Services](https://spv-services.web.app) integrate kora hoyeche. Ekhon user bKash/Nagad/Rocket e payment korle **SPV auto-verify** kore credit add kore dibe — **manual admin approval lagbe na**.

> Purono **manual** Mobile Banking + Crypto flow **fallback** hishebe ager motoi ache. Auto Payment ekta extra option.

**Status:** Frontend + Backend — dui repo tei code **wired & done** ✅. Tomar baki kaj shudhu: SPV app setup → `SPV_API_KEY` Render e set → deploy.

---

## 1. Eta kivabe kaj kore

```
User amount dey → "Auto Payment" e click
        │
        ▼
Frontend → rabbi-backend  (POST /api/payment/spv/create-intent)
        │      ├─ Firestore e `topups` doc banay (status: pending)
        │      └─ SPV API ke payment intent banate bole
        ▼
Backend → SPV hosted checkout URL return kore
        │
        ▼
User notun tab e SPV checkout e payment kore + TrxID dey
        │
        ▼
SPV Android app (tomar phone e) incoming SMS match kore
        │
        ▼
Frontend backend ke poll kore (GET /api/payment/spv/status)
        │      └─ Backend SPV ke poll kore; `verified` hole
        │         user er credit add kore + topup = approved
        ▼
User er wallet e credit auto-add ✅  (< 5 second e)
```

**Gurutwapurno:** SPV API key **shudhu backend server e** thake. Browser e kokhono na.

---

## 2. Ja ja lagbe (prerequisites)

| # | Item | Kothay paba |
|---|------|-------------|
| 1 | **SPV Android app** install + **KYC approved** | [Download APK](https://spv-payment-api.pages.dev/downloads/spv-services-latest.apk) — 7-day free trial |
| 2 | App e **payout wallets** set kora (tomar bKash/Nagad/Rocket personal number) | SPV app settings |
| 3 | **Merchant API key** (`SPV-XXXXXXXX-XXXXXXXX`) | SPV merchant dashboard → KYC approve er por |

> ⚠️ **Domain lock:** API key prothom bar use korle seta tomar domain (`https://rabbihossainltd.online`) e **lock** hoye jabe. Backend e `SPV_ORIGIN` already ei domain e set kora ache.

---

## 3. Backend — already wired ✅ (rabbi-backend repo)

Ami tomar `rabbi-backend` repo te directly add kore diyechi:

| File | Ki kora hoyeche |
|------|-----------------|
| `routes/spv.js` *(notun)* | `POST /api/payment/spv/create-intent` + `GET /api/payment/spv/status`. Credit add howar logic tomar existing `/api/orders/confirm-topup` er **hobohu** (same helpers, idempotent — double-credit hobe na). |
| `index.js` | `app.use("/api/payment/spv", spvRouter)` mount + route docs |
| `.env.example` | SPV env vars add kora |

Backend er existing convention (response helpers, `requireAuth`, Firebase service) use korai extra kichu install korte hobe na — `express` + `firebase-admin` age thekei ache.

### Tomar koronio (Step D + Step F):

**Step D — Render e env var set koro** (Render → Service → Environment)

Shudhu **ekta notun** env var lagbe:
```
SPV_API_KEY = SPV-XXXXXXXX-XXXXXXXX     # tomar SPV merchant key (KYC er por)
```
> Optional: `SPV_ORIGIN` (default e `https://rabbihossainltd.online` ache), `SPV_BASE` (default ache).
> Tomar Firebase vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) age thekei Render e set kora — segulo **change korte hobe na**.

**Step F — Deploy**
- Backend repo push korle Render auto-deploy hobe (othoba manual deploy).
- `SPV_API_KEY` charao deploy korle **baki backend thik cholbe** — SPV endpoint gulo shudhu `SPV_NOT_CONFIGURED` dekhabe. Tai deploy safe.
- Test: `GET https://rabbi-backend-vlr7.onrender.com/api/health` → 200.

---

## 4. Frontend — already wired ✅ (ei repo, rabbihossainltd.online)

| File | Ki kora hoyeche |
|------|-----------------|
| `add-credit.html` | Step-2 e notun "⚡ Auto Payment (INSTANT)" button + CSS |
| `js/wallet.js` | `startSpvAutoPayment()`, backend call, status polling, page e firle auto-resume |

Ei repo **push** koro (GitHub Pages auto-deploy):
```bash
git add add-credit.html js/wallet.js SPV_PAYMENT_SETUP.md
git commit -m "feat: SPV auto payment (frontend)"
git push origin main
```

---

## 5. Test korar niyom

1. SPV app e tomar payout number gulo **enabled** ache nishchit koro.
2. Site e login → **Add Credit** → amount ($1+) → **Auto Payment** e click.
3. Notun tab e SPV checkout khulbe — **Send Money** kore TrxID dao.
4. "Verifying…" overlay ashbe; <5s e **green tick** ashar kotha.
5. Firestore check:
   - `topups/{id}` → `status: approved`, `approvedBy: "spv-auto"`
   - `users/{uid}.credit` (o `creditUSD`/`creditBDT`) → amount jog hoyeche
6. Dashboard e credit update dekhte pabe.

---

## 6. Troubleshooting

| Problem | Karon / Solution |
|---------|------------------|
| "Auto Payment ekhono choluni (SPV_API_KEY set noy)" | Render e `SPV_API_KEY` set koro, redeploy koro |
| Checkout khule na / `SPV_INTENT_FAILED` | API key thik? KYC approved? SPV response er `detail` e error ache |
| Payment korleo credit add hocche na | Backend logs dekho (`[spv/status]`); `topups` doc e `spvPaymentId` ache kina dekho |
| `FORBIDDEN` (403) | Je user login koreche ar topup er `userId` match korche kina |
| Domain lock error | `SPV_ORIGIN` exact `https://rabbihossainltd.online` ache nishchit koro |

---

## 7. Security notes

- 🔑 `SPV_API_KEY` **kokhono** frontend/HTML/public repo te dio na — shudhu Render env var.
- 📲 SPV app **shudhu tomar phone e** thakbe; eta incoming payment SMS match kore.
- ✅ Credit logic idempotent (`status === "pending"` guard) — double-credit hobe na.
- 🔁 Manual flow ager motoi kaj kore — SPV down thakle user manual e payment korte parbe.
- 🗝️ **GitHub token:** integration er jonno je Personal Access Token use kora hoyeche, kaj sesh hole seta GitHub Settings → Developer settings → Tokens theke **revoke/rotate** kore dio.

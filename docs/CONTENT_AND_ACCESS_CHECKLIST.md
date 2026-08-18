# RabbiHossainLTD V2 — Documents, Content & Access Checklist

এই checklist-এর documents পেলে redesign placeholder/fake content ছাড়া original ও professionalভাবে করা যাবে।

## A. Implementation শুরু করার জন্য বাধ্যতামূলক

### 1. Backend source

- Railway backend GitHub repository URL, অথবা private হলে source ZIP
- backend `README.md`
- `.env.example` — variable names only, কোনো real value নয়
- current API route list
- Firestore rules and indexes
- provider integration code: payment, Item4Gamer/FazerCards/other fulfilment
- webhook/callback flow description

**কখনো পাঠাবেন না:** Firebase service-account JSON, API secret, private key, database password, Railway token, GitHub PAT বা customer data dump। এগুলো chat/repository-তে নয়; deployment secret store-এ থাকবে।

### 2. Service catalog

`SERVICE_CATALOG_TEMPLATE.csv` পূরণ করুন। প্রতিটি service-এর জন্য দরকার:

- final name in Bangla and English
- category
- factual description
- exact BDT/USD price or “custom quote”
- variants/plans
- delivery time
- information required from customer
- refund eligibility
- provider/fulfilment source
- authorization/resale status
- known account/platform risk
- active/inactive status
- real service image/banner

### 3. Official business identity

- official display name: RabbiHossainLTD confirmed
- legal operator name
- business type
- address/region to display
- official email, phone and WhatsApp
- official Facebook/Instagram/other URLs
- trade licence/TIN/registration details, if applicable and intended for display
- support hours
- invoice issuer details

### 4. Brand assets

- existing logo in SVG/PDF/transparent PNG, if any
- if no logo: written confirmation that a new wordmark may be designed
- favicon source
- original service/product images
- trademark/logo-use permission where applicable

### 5. Hero assets and copy

Service-led hero selected. Supply:

- one primary featured service/campaign
- original high-resolution banner/photo, minimum 2000px wide
- Bangla headline, ideally 5–10 words
- one factual supporting sentence
- primary CTA target
- offer validity/date, if promotional

No AI-generated image will be used unless explicitly requested and labelled internally.

## B. Professional credibility content

### 6. Founder/About

- professional portrait, original file
- 100–250 word Bangla bio
- 100–250 word English bio
- actual experience start year
- role/skills
- certifications/credentials with proof and display permission
- business principles or service promise

### 7. Portfolio/case studies

For each case study:

- project/client name
- client permission to publish
- problem/brief
- your exact role
- work delivered
- timeframe
- measurable result, only if verified
- live URL
- 4–8 original screenshots
- testimonial, if available

Two strong real case studies are better than ten generic cards.

### 8. Reviews/trust proof

For each public review:

- reviewer display name
- purchased service
- exact quote
- date
- photo/logo permission, if used
- order/review verification reference kept privately

If “500+ customers” or “4.9 rating” remains, provide evidence and calculation method. Otherwise it will be removed.

## C. Legal and policy documents

### 9. Policies

Provide approved versions, or provide facts needed for drafting:

- Privacy Policy
- Terms & Conditions
- Refund Policy
- Delivery Policy
- Cookie/analytics notice, if required
- applicable law/dispute process
- data retention periods
- account/data deletion method
- third-party processors/vendors

Final legal text should be reviewed by a qualified professional.

### 10. Sensitive-service disclosures

Because all current services will remain, provide for each applicable service:

- official provider/issuer name
- reseller/fulfilment authorization status
- customer eligibility and KYC requirements
- platform/account-ban risk
- warranty/replacement rules
- prohibited use
- shared-account or account-upgrade method
- card fees, issuer, country limits and liability
- Meta verification eligibility and non-guarantee statement

Unsupported or misleading claims will not be published. Checkout may remain disabled for an item until required disclosure/provider proof is available.

## D. Technical/deployment access

### 11. Source and infrastructure

- frontend repository already cloned
- backend repo/ZIP
- DNS provider name
- current GitHub Pages deployment method
- preferred future host: Cloudflare Pages, Netlify, Vercel or current host
- Firebase project structure/rules source
- analytics property details, if analytics will remain
- Formspree ownership or replacement decision

Do not send passwords/tokens. We will prepare environment-variable names and deployment instructions; secrets are entered directly in the provider dashboard.

### 12. Data/reset approval

Reset was selected, but before any action provide:

- whether existing Auth users must also be removed
- whether orders/invoices need archival export
- statutory/accounting retention requirements
- desired go-live date
- final written confirmation after backup is verified

## E. Helpful design references

Not mandatory, but useful:

- 2–3 websites you genuinely like
- 2–3 websites you dislike
- preferred density: minimal/editorial vs catalog-heavy
- preferred image style: monochrome photography vs product screenshots

## Suggested upload structure

```text
project-inputs/
  backend-source.zip            # only if repo cannot be shared
  brand/
    logo.svg
    favicon-source.svg
    brand-details.md
  hero/
    hero-original.jpg
    hero-copy.md
  services/
    service-catalog.csv
    images/
  about/
    founder-photo-original.jpg
    bio-bn.md
    bio-en.md
  portfolio/
    project-01/
    project-02/
  reviews/
    verified-reviews.csv
  legal/
    privacy.md
    terms.md
    refund.md
    delivery.md
```

## Minimum package needed for work to begin

1. Backend repository URL/ZIP
2. Completed service catalog
3. Business identity/contact document
4. Hero image and hero copy
5. Logo or permission to design a wordmark
6. Confirmation of which production data must be backed up before reset

# RabbiHossainLTD Entity & AI Discovery Guide

## Canonical identity

**Preferred description:**

> RabbiHossainLTD is an independent software and digital services brand founded in 2024 and operated by MD Rabbi Hossain in Kaliganj, Jhenaidah, Khulna, Bangladesh.

**Legal status:** Personal brand and online business; not a registered limited company. “LTD” is part of the brand name.

**Primary focus:** Web, app and custom software development, API integration, automation, UI/UX, branding and website security.

**Secondary focus:** Selected game top-ups, premium apps, card-related services and digital products.

## Stable entity IDs

- Business: `https://rabbihossainltd.online/#business`
- Founder: `https://rabbihossainltd.online/#md-rabbi-hossain`
- Website: `https://rabbihossainltd.online/#website`
- Official profile page: `https://rabbihossainltd.online/about/#profile`

Do not change these IDs unless the primary domain changes.

## Public machine-readable sources

- `/entity.json` — canonical JSON-LD entity record
- `/llms.txt` — concise answer-engine summary
- `/humans.txt` — owner and brand summary
- `/sitemap.xml` — public indexable pages
- `/robots.txt` — allows public search and answer-engine crawlers

## External profile consistency

Every official public profile should use the same name, location, website and one-line description. Recommended profile bio:

> Founder & Owner of RabbiHossainLTD — an independent software and digital services brand for web, app, automation, security and digital solutions. Kaliganj, Jhenaidah, Khulna, Bangladesh. Official website: https://rabbihossainltd.online/

Each profile should link back to the official website. The website's Person and Organization schema links back with `sameAs`.

## Google actions after deployment

1. Add a **Domain property** for `rabbihossainltd.online` in Google Search Console.
2. Verify with the DNS TXT record at the DNS provider.
3. Submit `https://rabbihossainltd.online/sitemap.xml`.
4. Use URL Inspection → Request Indexing for:
   - `/`
   - `/about/`
   - `/faq/`
   - `/services/`
5. Inspect the old `/about.html` result and request recrawling/removal after Google sees its `noindex` and canonical redirect page.
6. Review Enhancement/structured-data reports after recrawl.

## Bing, Copilot and IndexNow

1. Add the site to Bing Webmaster Tools (it can import Google Search Console verification).
2. Submit the sitemap.
3. Keep the IndexNow key file at the site root.
4. Submit changed public URLs through IndexNow after meaningful updates.

## Important limitation

Schema, `llms.txt`, crawlers and consistent profiles improve recognition but cannot guarantee a Google Knowledge Panel or immediate inclusion in the internal training data of ChatGPT/Gemini. Search-connected AI systems can update after recrawling; base models update only on their providers' schedules. Independent references, client reviews, press coverage, public project pages and legal registration (if obtained later) strengthen entity confidence.

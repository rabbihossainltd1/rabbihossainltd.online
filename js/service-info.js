/* ============================================================
   Rabbi.dev — Service Info Modal  v1.0
   "কাজ কি?" button → shows full Bangla+English service details
   ============================================================ */

(function () {
  'use strict';

  /* ── Service details database ─────────────────────────── */
  const SERVICE_INFO = {

    'meta': {
      name: 'Facebook Meta Verified',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1877f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>',
      color: '#1877f2',
      tagline: 'Facebook Profile বা Page-কে সরকারি Verified Badge দিন',
      what_en: 'Meta Verified is an official verification badge (blue tick) from Facebook/Instagram for profiles and pages. It confirms your identity and boosts trust with your audience.',
      what_bn: 'Meta Verified হলো Facebook বা Instagram-এর অফিসিয়াল নীল টিক ব্যাজ। এটি আপনার প্রোফাইল বা পেজের পরিচয় নিশ্চিত করে এবং audience-এর কাছে আস্থা বাড়ায়।',
      features: [
        { en: 'Official blue verified badge on profile/page', bn: 'প্রোফাইল/পেজে অফিসিয়াল নীল ব্যাজ' },
        { en: 'Higher search visibility & priority ranking', bn: 'Search-এ বেশি দেখায়, ranking উপরে থাকে' },
        { en: 'Protection from impersonation & fake accounts', bn: 'Fake account ও impersonation থেকে সুরক্ষা' },
        { en: 'Access to exclusive Meta features', bn: 'Meta-র exclusive features ব্যবহার করা যায়' },
        { en: 'More credibility for business and personal brand', bn: 'Business ও personal brand-এর বিশ্বাসযোগ্যতা বাড়ে' },
        { en: 'Direct support from Meta for verified accounts', bn: 'Meta থেকে সরাসরি support পাওয়া যায়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Verification apply করার জন্য আপনার National ID / Passport লাগতে পারে। আমরা পুরো process guide করি।',
      note_en: 'National ID or Passport may be required. We guide you through the full process.',
    },

    'card': {
      name: 'Visa / Mastercard',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a56db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
      color: '#1a56db',
      tagline: 'Physical বা Virtual Dollar Card পান — Online Payment সহজ করুন',
      what_en: 'Get a physical or virtual Visa/Mastercard that works for online shopping, international payments, subscriptions, and more — from anywhere.',
      what_bn: 'Physical বা Virtual Visa/Mastercard কার্ড পান যা দিয়ে online shopping, international payment, subscription সব কিছু করতে পারবেন।',
      features: [
        { en: 'Pay on Amazon, Netflix, ChatGPT, and all global platforms', bn: 'Amazon, Netflix, ChatGPT সহ সব global platform-এ payment করুন' },
        { en: 'International online shopping made easy', bn: 'International online shopping সহজ হয়' },
        { en: 'Subscribe to any app or service worldwide', bn: 'যেকোনো app বা service subscribe করুন' },
        { en: 'Receive and send money internationally', bn: 'International money send/receive করুন' },
        { en: 'Virtual card — instant delivery, no physical wait', bn: 'Virtual card — instant delivery, physical card-এর জন্য অপেক্ষা নেই' },
        { en: 'Secure chip & PIN / contactless payments', bn: 'Secure chip & PIN / contactless payment' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> NID বা Passport ছাড়াই কার্ড পাওয়া সম্ভব। যোগাযোগ করুন আরও জানতে।',
      note_en: 'Card available without NID/Passport in some cases. Contact us to learn more.',
    },

    'ff': {
      name: 'Free Fire Diamond Top-up',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      color: '#ffa500',
      tagline: 'সবচেয়ে কম দামে FF Diamond — সরাসরি আপনার UID-এ',
      what_en: 'Recharge Free Fire diamonds directly to your UID at the lowest prices. Choose from single diamond packs or weekly/monthly membership plans.',
      what_bn: 'সবচেয়ে কম দামে Free Fire Diamond সরাসরি আপনার UID-এ রিচার্জ করুন। Single diamond pack বা weekly/monthly membership plan — সব পাবেন।',
      features: [
        { en: '25 to 2530 Diamond packs available', bn: '25 থেকে 2530 Diamond pack পাওয়া যায়' },
        { en: 'Weekly Lite, Weekly, Monthly membership plans', bn: 'Weekly Lite, Weekly, Monthly membership plan আছে' },
        { en: 'Direct top-up to your Free Fire UID — no login needed', bn: 'সরাসরি UID-এ top-up — আপনার login লাগে না' },
        { en: 'Lowest market price guaranteed', bn: 'Market-এর সবচেয়ে কম দাম গ্যারান্টি' },
        { en: 'Fast delivery — usually within minutes', bn: 'দ্রুত delivery — সাধারণত মিনিটের মধ্যে' },
        { en: 'bKash, Nagad, Rocket, Binance payment accepted', bn: 'bKash, Nagad, Rocket, Binance payment accept করা হয়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M15 10l-4 4m0 0l-4-4m4 4V3M5 21h14"/></svg> Diamond পেতে শুধু আপনার Free Fire UID দিন। Password বা account দেওয়া লাগবে না।',
      note_en: 'Only your Free Fire UID is needed. No password or account access required.',
    },

    'ffIos': {
      name: 'Free Fire iPhone Panel (iOS)',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00bfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      color: '#00bfff',
      tagline: 'iPhone এ Free Fire Panel — হ্যাক ছাড়া সব অ্যাডভান্টেজ',
      what_en: 'The Free Fire iOS Panel gives you special in-game advantages directly on your iPhone without needing to root or jailbreak. Safe, fast, and effective.',
      what_bn: 'Free Fire iOS Panel দিয়ে iPhone-এ root বা jailbreak ছাড়াই in-game special সুবিধা পান। Safe, দ্রুত এবং কার্যকর।',
      features: [
        { en: 'Auto-aim & enhanced accuracy features', bn: 'Auto-aim ও enhanced accuracy সুবিধা' },
        { en: 'Works on iPhone without jailbreak', bn: 'Jailbreak ছাড়াই iPhone-এ কাজ করে' },
        { en: 'Available in 1 Day, 7 Days, 31 Days durations', bn: '1 Day, 7 Days, 31 Days মেয়াদে পাওয়া যায়' },
        { en: 'Full Setup package for first-time users', bn: 'নতুনদের জন্য Full Setup package আছে' },
        { en: 'Fast activation after payment', bn: 'Payment-এর পরেই দ্রুত activate হয়' },
        { en: 'Support provided throughout the setup', bn: 'Setup-এর সময় সম্পূর্ণ support দেওয়া হয়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> এটি শুধুমাত্র iPhone (iOS) এর জন্য। Android ব্যবহারকারীরা Android Panel ব্যবহার করুন।',
      note_en: 'This panel is for iPhone (iOS) only. Android users should use the Android Panel.',
    },

    'ffDrip': {
      name: 'FF Android Panel — Drip Client (Root)',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b39ddb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 11V7a4 4 0 0 1 8 0M8 11V7a4 4 0 0 0-8 0"/><circle cx="9" cy="15" r="1" fill="#b39ddb"/><circle cx="15" cy="15" r="1" fill="#b39ddb"/></svg>',
      color: '#b39ddb',
      tagline: 'Android Rooted Phone-এ Free Fire Panel — Drip Client',
      what_en: 'The Free Fire Android Drip Panel works on rooted Android phones, giving you in-game enhancements through the Drip Client. Powerful and customizable.',
      what_bn: 'Rooted Android phone-এ Free Fire Drip Client panel দিয়ে in-game সুবিধা পান। শক্তিশালী এবং customize করার সুবিধা আছে।',
      features: [
        { en: 'Works on rooted Android devices via Drip Client', bn: 'Rooted Android-এ Drip Client দিয়ে কাজ করে' },
        { en: 'Enhanced in-game visibility and control', bn: 'In-game visibility ও control উন্নত হয়' },
        { en: '1 Day to 30 Day plans available', bn: '1 Day থেকে 30 Day পর্যন্ত plan আছে' },
        { en: 'Setup guidance provided step-by-step', bn: 'Step-by-step setup guide দেওয়া হয়' },
        { en: 'Secure delivery via email', bn: 'Email-এর মাধ্যমে secure delivery' },
        { en: 'Affordable pricing for all budgets', bn: 'সব বাজেটের জন্য সাশ্রয়ী মূল্য' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa500" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> এই service-টি ব্যবহার করতে আপনার Android phone অবশ্যই root করা থাকতে হবে।',
      note_en: 'Your Android device must be rooted to use this service.',
    },

    'ffFf4x': {
      name: 'FF Android Panel — FF4X',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      color: '#4fc3f7',
      tagline: 'Android Phone-এ Free Fire Panel — FF4X Client (Root ছাড়া)',
      what_en: 'The FF4X Android Panel gives you in-game advantages on Android without requiring root access. Uses the FF4X client for a smooth, safe experience.',
      what_bn: 'FF4X Android Panel দিয়ে root ছাড়াই Android phone-এ Free Fire-এ in-game সুবিধা পান। FF4X client ব্যবহার করে — safe এবং smooth।',
      features: [
        { en: 'Works on non-rooted Android devices via FF4X client', bn: 'Root ছাড়া Android-এ FF4X client দিয়ে কাজ করে' },
        { en: 'Enhanced in-game visibility and aim assistance', bn: 'In-game visibility ও aim সুবিধা উন্নত হয়' },
        { en: '1 Day to 30 Day plans available', bn: '1 Day থেকে 30 Day পর্যন্ত plan আছে' },
        { en: 'Step-by-step setup guidance provided', bn: 'Step-by-step setup guide দেওয়া হয়' },
        { en: 'Secure delivery via email', bn: 'Email-এর মাধ্যমে secure delivery' },
        { en: 'Affordable pricing for all budgets', bn: 'সব বাজেটের জন্য সাশ্রয়ী মূল্য' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> এই panel-টি Android phone-এর জন্য এবং root ছাড়াই কাজ করে। Rooted phone-এর জন্য Drip Client panel ব্যবহার করুন।',
      note_en: 'This panel works on Android without root. For rooted devices, use the Drip Client panel.',
    },

    'ffPc': {
      name: 'Free Fire PC Panel',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      color: '#00c864',
      tagline: 'PC-তে Free Fire Panel — সহজ ও দ্রুত',
      what_en: 'The Free Fire PC Panel lets you use in-game enhancements on your Windows computer. Ideal for players who prefer playing Free Fire on PC via emulator.',
      what_bn: 'Free Fire PC Panel দিয়ে Windows computer-এ in-game সুবিধা ব্যবহার করুন। Emulator-এ FF খেলা player-দের জন্য আদর্শ।',
      features: [
        { en: 'Works on Windows PC with Free Fire emulator', bn: 'Windows PC-তে FF emulator-এর সাথে কাজ করে' },
        { en: 'Enhanced aim, visibility and gameplay features', bn: 'উন্নত aim, visibility ও gameplay সুবিধা' },
        { en: '1 Day to 1 Year plans available', bn: '1 Day থেকে 1 Year পর্যন্ত plan আছে' },
        { en: 'Easy installation with support', bn: 'সহজ installation, support সহ' },
        { en: 'Cost-effective pricing', bn: 'সাশ্রয়ী মূল্য' },
        { en: 'Fast delivery after order confirmation', bn: 'Order confirm হওয়ার পরেই দ্রুত delivery' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> PC panel শুধু emulator-এ চলে। Phone দিয়ে FF খেললে iOS বা Android Panel ব্যবহার করুন।',
      note_en: 'PC panel works with emulators only. Use iOS or Android Panel if you play on phone.',
    },

    'chatgpt': {
      name: 'ChatGPT Subscription',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
      color: '#10a37f',
      tagline: 'ChatGPT-এর সর্বোচ্চ ক্ষমতা Unlock করুন — সবচেয়ে কম দামে',
      what_en: 'ChatGPT by OpenAI is the world\'s most advanced AI assistant. Upgrade to Plus or Pro for faster responses, GPT-4o, image generation, and much more.',
      what_bn: 'ChatGPT হলো OpenAI-এর তৈরি বিশ্বের সবচেয়ে উন্নত AI assistant। Plus বা Pro-তে upgrade করলে GPT-4o, image generation, faster response সহ অনেক কিছু পাবেন।',
      features: [
        { en: 'Access to GPT-4o — most powerful AI model', bn: 'GPT-4o — সবচেয়ে শক্তিশালী AI model ব্যবহার করুন' },
        { en: 'Generate images with DALL·E 3', bn: 'DALL·E 3 দিয়ে image তৈরি করুন' },
        { en: 'Web browsing & real-time information access', bn: 'Web browse করুন, real-time তথ্য পান' },
        { en: 'Advanced data analysis & code execution', bn: 'Data analysis ও code run করার সুবিধা' },
        { en: 'Create custom GPTs (Pro plan)', bn: 'নিজের custom GPT তৈরি করুন (Pro plan)' },
        { en: 'Priority access — no slowdowns during peak hours', bn: 'Peak hour-এও slow হবে না, priority access' },
        { en: 'Unlimited message limit (Pro)', bn: 'Message-এর কোনো limit নেই (Pro)' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Account আপনার নিজের, আমরা শুধু subscription activate করে দিই। 100% নিরাপদ।',
      note_en: 'Your own account. We only activate the subscription. 100% safe.',
    },

    'gemini': {
      name: 'Gemini AI Pro / Ultra',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      color: '#8e75ff',
      tagline: 'Google-এর সবচেয়ে শক্তিশালী AI — Gemini Ultra',
      what_en: 'Google Gemini is Google\'s most capable AI model. Gemini Advanced (Ultra 1.0) handles complex reasoning, coding, math, and creative tasks far beyond basic AI.',
      what_bn: 'Google Gemini হলো Google-এর সবচেয়ে শক্তিশালী AI। Gemini Advanced (Ultra 1.0) দিয়ে complex reasoning, coding, math ও creative কাজ সহজে করুন।',
      features: [
        { en: 'Gemini Ultra 1.0 — Google\'s most capable model', bn: 'Gemini Ultra 1.0 — Google-এর সবচেয়ে শক্তিশালী model' },
        { en: 'Multimodal: understands text, images, audio & video', bn: 'Text, image, audio ও video সব বোঝে (Multimodal)' },
        { en: 'Advanced coding, math and reasoning skills', bn: 'উন্নত coding, math ও reasoning ক্ষমতা' },
        { en: '1TB Google One storage included', bn: '1TB Google One storage পাবেন' },
        { en: 'Integrated with Gmail, Docs, Drive (Workspace)', bn: 'Gmail, Docs, Drive-এর সাথে integrated' },
        { en: 'Access exclusive Gemini features before others', bn: 'Exclusive Gemini features আগে ব্যবহার করুন' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> আপনার নিজের Google account-এ activate হবে। Safe ও secure।',
      note_en: 'Activated on your own Google account. Safe and secure.',
    },

    'canva': {
      name: 'Canva Pro / Teams',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
      color: '#7d2ae8',
      tagline: 'Design এখন অনেক সহজ — Canva Pro-র সব Premium Features পান',
      what_en: 'Canva Pro is the premium design platform used by millions of creators. Unlock brand kits, 100M+ stock assets, background remover, magic resize, and more.',
      what_bn: 'Canva Pro হলো লক্ষ লক্ষ creator-এর পছন্দের design platform। Brand kit, 100M+ stock asset, background remover, magic resize সহ সব premium feature পান।',
      features: [
        { en: '100M+ premium photos, videos, audio & graphics', bn: '100M+ premium photo, video, audio ও graphics' },
        { en: 'Background Remover — one click magic', bn: 'Background Remover — এক ক্লিকেই magic' },
        { en: 'Magic Resize — any design, any size instantly', bn: 'Magic Resize — যেকোনো size-এ instantly resize' },
        { en: 'Brand Kit — logo, colors, fonts saved', bn: 'Brand Kit — logo, color, font সব save করুন' },
        { en: '1TB cloud storage for your designs', bn: '1TB cloud storage design-এর জন্য' },
        { en: 'Schedule social media posts from Canva', bn: 'Canva থেকেই social media post schedule করুন' },
        { en: 'Team collaboration (Canva Teams plan)', bn: 'Team-এর সাথে মিলে কাজ করুন (Teams plan)' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Design জানা না লাগলেও চলবে! Canva এতটাই সহজ।',
      note_en: 'No design experience needed! Canva is that easy.',
    },

    'capcut': {
      name: 'CapCut Pro',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="background:#fff;border-radius:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
      color: '#fe2c55',
      tagline: 'Professional Video Edit করুন Mobile বা PC-তে — CapCut Pro দিয়ে',
      what_en: 'CapCut Pro is the premium version of the world\'s most popular video editor. Remove watermarks, access AI features, use premium effects and templates.',
      what_bn: 'CapCut Pro হলো বিশ্বের সবচেয়ে জনপ্রিয় video editor-এর premium version। Watermark সরান, AI features ব্যবহার করুন, premium effect ও template পান।',
      features: [
        { en: 'No watermark on exported videos', bn: 'Export করা video-তে কোনো watermark নেই' },
        { en: 'AI Background Remover & Smart Cutout', bn: 'AI Background Remover ও Smart Cutout' },
        { en: 'Auto Captions with AI — saves hours of work', bn: 'AI Auto Captions — ঘণ্টার কাজ মিনিটে' },
        { en: 'Thousands of premium effects and templates', bn: 'হাজারো premium effect ও template' },
        { en: 'Keyframe animation & professional transitions', bn: 'Keyframe animation ও professional transition' },
        { en: 'Export in 4K Ultra HD quality', bn: '4K Ultra HD quality-তে export করুন' },
        { en: 'Works on mobile and PC', bn: 'Mobile ও PC দুটোতেই কাজ করে' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5757" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> TikTok, YouTube Shorts, Reels তৈরির জন্য সেরা tool।',
      note_en: 'Best tool for creating TikTok, YouTube Shorts, and Reels content.',
    },

    'youtube': {
      name: 'YouTube Premium',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff0000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#ff0000"/></svg>',
      color: '#ff0000',
      tagline: 'Ad ছাড়া YouTube — Background Play ও Offline Download',
      what_en: 'YouTube Premium removes all ads, lets you play videos in the background, download for offline viewing, and includes YouTube Music Premium for free.',
      what_bn: 'YouTube Premium দিয়ে সব ad বন্ধ হয়, background-এ video চলে, offline download করা যায় এবং YouTube Music Premium বিনামূল্যে পাওয়া যায়।',
      features: [
        { en: 'Ad-free experience on all YouTube videos', bn: 'সব video-তে কোনো ad নেই' },
        { en: 'Background Play — video চলতে থাকে screen বন্ধ থাকলেও', bn: 'Screen বন্ধ থাকলেও video চলতে থাকে' },
        { en: 'Download videos for offline viewing', bn: 'Offline দেখার জন্য video download করুন' },
        { en: 'YouTube Music Premium included for free', bn: 'YouTube Music Premium বিনামূল্যে পাবেন' },
        { en: 'Exclusive YouTube Originals content', bn: 'Exclusive YouTube Originals content দেখুন' },
        { en: 'Family plan — up to 6 members', bn: 'Family plan — সর্বোচ্চ 6 জন ব্যবহার করতে পারবেন' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff0000" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> YouTube Music-ও included, আলাদা subscribe করতে হবে না!',
      note_en: 'YouTube Music is included — no separate subscription needed!',
    },

    'truecaller': {
      name: 'Truecaller Premium / Gold',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00b259" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      color: '#0099ff',
      tagline: 'Caller ID-এর সেরা — Spam Block করুন, Contact জানুন',
      what_en: 'Truecaller Premium gives you advanced caller ID, spam blocking, who viewed your profile, contact requests, and an ad-free experience.',
      what_bn: 'Truecaller Premium দিয়ে advanced caller ID, spam block, কে আপনার profile দেখেছে, contact request এবং ad-free অভিজ্ঞতা পান।',
      features: [
        { en: 'Know who\'s calling — even unknown numbers', bn: 'অচেনা নম্বর থেকেও জানুন কে call করছে' },
        { en: 'Advanced Spam Blocker — block unwanted calls', bn: 'Advanced Spam Blocker — অপ্রয়োজনীয় call block করুন' },
        { en: 'See who viewed your Truecaller profile', bn: 'কে আপনার Truecaller profile দেখেছে জানুন' },
        { en: 'Ghost Call feature — fake busy status', bn: 'Ghost Call — fake busy দেখান' },
        { en: 'Contact Requests — reach people directly', bn: 'Contact Request — সরাসরি মানুষের কাছে পৌঁছান' },
        { en: 'Ad-free experience throughout the app', bn: 'পুরো app-এ কোনো ad নেই' },
        { en: 'Gold badge on your profile (Gold plan)', bn: 'Profile-এ Gold badge (Gold plan)' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b259" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Bangladesh-এ Truecaller সবচেয়ে জনপ্রিয় caller ID app।',
      note_en: 'Most popular caller ID app in Bangladesh.',
    },

    'imo': {
      name: 'imo Premium',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0099ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      color: '#0084ff',
      tagline: 'imo-তে Special দেখান — Premium Badge ও Features পান',
      what_en: 'imo Premium gives you a special premium badge, the ability to see who viewed your story, send large files, and more — at a very affordable price.',
      what_bn: 'imo Premium দিয়ে special premium badge, story কে দেখেছে, বড় file পাঠানো এবং আরও অনেক সুবিধা পান — খুবই সাশ্রয়ী দামে।',
      features: [
        { en: 'Special Premium badge on your profile', bn: 'Profile-এ Special Premium badge' },
        { en: 'See who viewed your imo story', bn: 'কে আপনার imo story দেখেছে জানুন' },
        { en: 'Send large files up to 2GB', bn: '2GB পর্যন্ত বড় file পাঠান' },
        { en: 'Higher quality video calls', bn: 'উন্নত মানের video call' },
        { en: 'Exclusive sticker packs & themes', bn: 'Exclusive sticker pack ও theme' },
        { en: 'Ad-free messaging experience', bn: 'Ad ছাড়া messaging' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Weekly plan মাত্র ৳36 থেকে শুরু — সবচেয়ে সস্তা premium!',
      note_en: 'Weekly plan starts from just ৳36 — most affordable premium!',
    },

    'netflix': {
      name: 'Netflix',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
      color: '#e50914',
      tagline: 'Movies ও Series-এর সেরা Platform — Netflix Premium',
      what_en: 'Netflix is the world\'s leading streaming service with thousands of movies, TV shows, documentaries, and Netflix Originals. Available on all devices.',
      what_bn: 'Netflix হলো বিশ্বের সেরা streaming platform। হাজারো movie, TV show, documentary এবং Netflix Originals — সব device-এ দেখুন।',
      features: [
        { en: 'Thousands of movies, shows & documentaries', bn: 'হাজারো movie, show ও documentary' },
        { en: 'Netflix Originals — exclusive content only on Netflix', bn: 'Netflix Originals — শুধু Netflix-এ exclusive content' },
        { en: 'Ultra HD 4K streaming (Premium plan)', bn: 'Ultra HD 4K streaming (Premium plan)' },
        { en: 'Download and watch offline', bn: 'Download করে offline দেখুন' },
        { en: 'Multiple screens at the same time', bn: 'একই সাথে multiple screen-এ দেখুন' },
        { en: 'Works on TV, phone, tablet, PC', bn: 'TV, phone, tablet, PC সব device-এ চলে' },
        { en: 'New content added every week', bn: 'প্রতি সপ্তাহে নতুন content যোগ হয়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5757" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Mobile plan থেকে Premium পর্যন্ত সব plan পাওয়া যায়।',
      note_en: 'All plans available — from Mobile to Premium.',
    },

    'grok': {
      name: 'Grok AI Pro',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      color: '#1da1f2',
      tagline: 'X (Twitter)-এর AI — Real-time Information সহ Grok',
      what_en: 'Grok AI by xAI (Elon Musk) is a powerful AI with real-time X/Twitter data access, web search, image generation, and document analysis.',
      what_bn: 'Grok AI হলো xAI (Elon Musk) এর তৈরি শক্তিশালী AI যা real-time X/Twitter data, web search, image generation ও document analysis করতে পারে।',
      features: [
        { en: 'Real-time access to X/Twitter posts & trends', bn: 'Real-time X/Twitter post ও trend দেখার সুবিধা' },
        { en: 'Web search with up-to-date information', bn: 'Web search করে সর্বশেষ তথ্য পান' },
        { en: 'Generate images with Aurora model', bn: 'Aurora model দিয়ে image তৈরি করুন' },
        { en: 'Analyze documents, PDFs and data files', bn: 'Document, PDF ও data file analyze করুন' },
        { en: 'Unfiltered, direct and witty responses', bn: 'সরাসরি ও witty উত্তর — কোনো filter নেই' },
        { en: 'Voice conversation mode', bn: 'Voice conversation mode' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1da1f2" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg> X (Twitter) এর সাথে connected, তাই সব latest news ও trend জানে।',
      note_en: 'Connected to X (Twitter) — knows all latest news and trends.',
    },

    'vpn': {
      name: 'Premium VPN',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      color: '#00ff88',
      tagline: 'Internet নিরাপদ করুন — Block সাইট খুলুন, Privacy রক্ষা করুন',
      what_en: 'A premium VPN encrypts your internet connection, hides your IP, lets you access blocked websites, and protects your privacy on any network.',
      what_bn: 'Premium VPN আপনার internet connection encrypt করে, IP hide করে, block website খুলতে দেয় এবং যেকোনো network-এ privacy রক্ষা করে।',
      features: [
        { en: 'Access blocked websites and apps from anywhere', bn: 'যেকোনো জায়গা থেকে block website ও app খুলুন' },
        { en: 'Hides your real IP address — stay anonymous', bn: 'Real IP hide করে — anonymous থাকুন' },
        { en: 'Military-grade encryption for your data', bn: 'Military-grade encryption দিয়ে data সুরক্ষিত' },
        { en: 'Secure on public WiFi (cafes, airports)', bn: 'Public WiFi-তেও নিরাপদ (cafe, airport)' },
        { en: 'Fast servers in 50+ countries', bn: '50+ দেশে fast server আছে' },
        { en: 'No-log policy — your activity is never stored', bn: 'No-log policy — আপনার activity store হয় না' },
        { en: 'Protect 1 to 10 devices with one plan', bn: 'এক plan দিয়ে 1 থেকে 10 device সুরক্ষিত' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> YouTube, Facebook, WhatsApp সব কিছু যেকোনো দেশ থেকে ব্যবহার করুন।',
      note_en: 'Use YouTube, Facebook, WhatsApp from any country, without restrictions.',
    },

    'antivirus': {
      name: 'Antivirus Premium',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
      color: '#00c8ff',
      tagline: 'Virus, Malware ও Hacker থেকে Device রক্ষা করুন',
      what_en: 'Premium Antivirus protects your device from viruses, malware, ransomware, phishing, and hackers — in real time, without slowing your device.',
      what_bn: 'Premium Antivirus আপনার device-কে virus, malware, ransomware, phishing ও hacker থেকে real-time-এ রক্ষা করে — device slow না করেই।',
      features: [
        { en: 'Real-time virus and malware protection', bn: 'Real-time virus ও malware protection' },
        { en: 'Ransomware shield — protect your files', bn: 'Ransomware shield — আপনার file সুরক্ষিত' },
        { en: 'Phishing & unsafe website blocker', bn: 'Phishing ও unsafe website block করে' },
        { en: 'Password manager included', bn: 'Password manager সহ আসে' },
        { en: 'VPN included in some plans', bn: 'কিছু plan-এ VPN সহ আসে' },
        { en: 'Works on Windows, Android & iOS', bn: 'Windows, Android ও iOS সব platform-এ কাজ করে' },
        { en: 'Covers 1 to 10 devices', bn: '1 থেকে 10 device cover করে' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> একটি antivirus ছাড়া আপনার device সবসময় ঝুঁকিতে থাকে।',
      note_en: 'Without antivirus, your device is always at risk.',
    },

    'adsremove': {
      name: 'Remove Ads — Lifetime',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff5757" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
      color: '#ffa500',
      tagline: 'সব App ও Browser থেকে Ad চিরতরে সরিয়ে দিন',
      what_en: 'Remove Ads gives you a lifetime ad-free experience across apps and browsers. No more pop-ups, banners, or video ads interrupting your activity.',
      what_bn: 'Remove Ads দিয়ে সব app ও browser থেকে চিরতরে ad বন্ধ করুন। কোনো popup, banner বা video ad আর আসবে না।',
      features: [
        { en: 'Lifetime ad blocking — one-time payment', bn: 'Lifetime ad block — একবার payment করুন' },
        { en: 'Blocks ads on all apps and browsers', bn: 'সব app ও browser-এ ad block করে' },
        { en: 'No more popup or video ads', bn: 'কোনো popup বা video ad আর নেই' },
        { en: 'Faster browsing — less data usage', bn: 'দ্রুত browsing — কম data ব্যবহার' },
        { en: 'Better battery life without ad loading', bn: 'Ad load না হওয়ায় battery বেশি থাকে' },
        { en: 'Works across Android, iOS & PC', bn: 'Android, iOS ও PC সব platform-এ কাজ করে' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> মাত্র ৳749-এ lifetime ad-free অভিজ্ঞতা!',
      note_en: 'Lifetime ad-free experience for just ৳749!',
    },

    'premiere': {
      name: 'Adobe Premiere Pro',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9999ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="2" y1="17" x2="7" y2="17"/></svg>',
      color: '#9999ff',
      tagline: 'Professional Video Editing Software — Industry Standard',
      what_en: 'Adobe Premiere Pro is the industry-standard professional video editing software used by filmmakers, YouTubers, and broadcasters worldwide.',
      what_bn: 'Adobe Premiere Pro হলো বিশ্বের সেরা professional video editing software যা filmmakers, YouTubers ও broadcasters ব্যবহার করেন।',
      features: [
        { en: 'Professional timeline-based video editing', bn: 'Professional timeline-based video editing' },
        { en: 'AI-powered auto color correction & grading', bn: 'AI দিয়ে automatic color correction ও grading' },
        { en: 'Multi-camera editing support', bn: 'Multi-camera editing সুবিধা' },
        { en: 'Export in any format — 4K, 8K, HDR', bn: 'যেকোনো format-এ export — 4K, 8K, HDR' },
        { en: 'Seamless integration with After Effects & Photoshop', bn: 'After Effects ও Photoshop-এর সাথে seamless integration' },
        { en: 'Thousands of effects, transitions & presets', bn: 'হাজারো effect, transition ও preset' },
        { en: 'Cloud sync with Creative Cloud (100GB)', bn: 'Creative Cloud-এ cloud sync (100GB)' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5757" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> YouTube, Film, TV Production সব ক্ষেত্রে industry standard।',
      note_en: 'Industry standard for YouTube, Film, and TV Production.',
    },

    'photoshop': {
      name: 'Adobe Photoshop',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#31a8ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      color: '#31a8ff',
      tagline: 'Photo Editing-এর King — Photoshop-এর সব Power আনলক করুন',
      what_en: 'Adobe Photoshop is the world\'s most powerful photo editing and graphic design software. Used by photographers, designers, and digital artists globally.',
      what_bn: 'Adobe Photoshop হলো বিশ্বের সবচেয়ে শক্তিশালী photo editing ও graphic design software। Photographer, designer ও digital artist সবাই ব্যবহার করেন।',
      features: [
        { en: 'AI-powered Generative Fill — add anything with text', bn: 'AI Generative Fill — text লিখেই যেকোনো কিছু add করুন' },
        { en: 'Remove background with one click (AI)', bn: 'এক ক্লিকে background remove (AI)' },
        { en: 'Advanced photo retouching & restoration', bn: 'Advanced photo retouching ও restoration' },
        { en: 'Create graphics, logos, social media assets', bn: 'Graphics, logo, social media asset তৈরি করুন' },
        { en: 'Neural filters for instant transformations', bn: 'Neural filters দিয়ে instant transformation' },
        { en: 'Layer-based editing with unlimited layers', bn: 'Unlimited layer দিয়ে layer-based editing' },
        { en: 'Works on Windows & Mac', bn: 'Windows ও Mac দুটোতেই কাজ করে' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#31a8ff" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Design জানলে Photoshop ছাড়া professional হওয়া কঠিন।',
      note_en: 'Hard to be a professional designer without knowing Photoshop.',
    },

    'illustrator': {
      name: 'Adobe Illustrator',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff9a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 19 22 19"/></svg>',
      color: '#ff9a00',
      tagline: 'Vector Graphics Design-এর সেরা Tool — Logo থেকে Illustration পর্যন্ত',
      what_en: 'Adobe Illustrator is the industry-standard vector graphics software for creating logos, icons, illustrations, typography, and scalable artwork.',
      what_bn: 'Adobe Illustrator হলো logo, icon, illustration, typography ও scalable artwork তৈরির industry-standard vector graphics software।',
      features: [
        { en: 'Create logos, icons and vector art that scales infinitely', bn: 'Logo, icon ও vector art তৈরি করুন যা যেকোনো size-এ perfect থাকে' },
        { en: 'AI-powered Generative Vector (text to vector)', bn: 'AI Generative Vector — text থেকে vector তৈরি' },
        { en: 'Typography tools for professional fonts & text', bn: 'Professional font ও text-এর জন্য typography tools' },
        { en: 'Pen tool for precise path drawing', bn: 'Precise path drawing-এর জন্য Pen tool' },
        { en: 'Artboard system for multiple design versions', bn: 'Multiple design version-এর জন্য Artboard system' },
        { en: 'Export SVG, PDF, PNG in any resolution', bn: 'SVG, PDF, PNG যেকোনো resolution-এ export' },
        { en: 'Works seamlessly with Photoshop & InDesign', bn: 'Photoshop ও InDesign-এর সাথে seamlessly কাজ করে' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Logo design ও branding-এ Illustrator সবার প্রথম পছন্দ।',
      note_en: 'First choice for logo design and branding work.',
    },

    'windows': {
      name: 'Windows License',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/><rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/></svg>',
      color: '#0078d4',
      tagline: 'Original Windows License — Lifetime Activation কম দামে',
      what_en: 'Get a genuine Windows 10 or Windows 11 license key for lifetime activation. No subscription — pay once and use forever.',
      what_bn: 'Genuine Windows 10 বা Windows 11 license key পান lifetime activation-এর জন্য। একবার payment করুন, চিরকাল ব্যবহার করুন।',
      features: [
        { en: 'Genuine license key — 100% original & legal', bn: 'Genuine license key — 100% original ও legal' },
        { en: 'Lifetime activation — no expiry', bn: 'Lifetime activation — কোনো expiry নেই' },
        { en: 'Removes "Activate Windows" watermark', bn: '"Activate Windows" watermark সরে যাবে' },
        { en: 'Access to all Windows features', bn: 'Windows-এর সব feature ব্যবহার করুন' },
        { en: 'Free Windows updates forever', bn: 'সারাজীবন বিনামূল্যে Windows update পাবেন' },
        { en: 'Windows 10 & 11 Home and Pro available', bn: 'Windows 10 ও 11 Home ও Pro পাওয়া যায়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg> Original license — pirate Windows-এর ঝামেলা থেকে মুক্তি পান।',
      note_en: 'Original license — no more issues with pirated Windows.',
    },

    'excel': {
      name: 'Microsoft Excel / Office 365',
      emoji: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#217346" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
      color: '#217346',
      tagline: 'Microsoft Office-এর সব Apps — Excel, Word, PowerPoint',
      what_en: 'Get Microsoft Excel, Word, PowerPoint and the full Office 365 suite. Perfect for students, professionals, and businesses at a fraction of the retail price.',
      what_bn: 'Microsoft Excel, Word, PowerPoint সহ সম্পূর্ণ Office 365 suite পান। Students, professional ও business সবার জন্য — retail price-এর ভগ্নাংশে।',
      features: [
        { en: 'Microsoft Excel — powerful spreadsheet & data analysis', bn: 'Microsoft Excel — শক্তিশালী spreadsheet ও data analysis' },
        { en: 'Microsoft Word — professional documents', bn: 'Microsoft Word — professional document তৈরি করুন' },
        { en: 'PowerPoint — stunning presentations', bn: 'PowerPoint — stunning presentation তৈরি করুন' },
        { en: '1TB OneDrive cloud storage (365 plan)', bn: '1TB OneDrive cloud storage (365 plan)' },
        { en: 'Works on PC, Mac, tablet and phone', bn: 'PC, Mac, tablet ও phone সব device-এ কাজ করে' },
        { en: 'Real-time collaboration with team members', bn: 'Team-এর সাথে real-time collaboration' },
        { en: 'Lifetime license option available', bn: 'Lifetime license option পাওয়া যায়' },
      ],
      note_bn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#217346" stroke-width="2.2" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Students-দের জন্য সবচেয়ে সাশ্রয়ী Microsoft Office!',
      note_en: 'Most affordable Microsoft Office option for students!',
    },
  };

  /* ── Create info modal DOM ────────────────────────────── */
  function createModal() {
    if (document.getElementById('svcInfoModal')) return;

    const modal = document.createElement('div');
    modal.id = 'svcInfoModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'svcInfoModalTitle');
    modal.style.cssText = `
      display:none;position:fixed;inset:0;z-index:4000;
      background:rgba(2,10,16,0.88);backdrop-filter:blur(12px);
      align-items:flex-start;justify-content:center;
      padding:20px 16px 40px;overflow-y:auto;
    `;

    modal.innerHTML = `
      <div id="svcInfoModalBox" style="
        background:linear-gradient(145deg,rgba(10,20,35,0.98),rgba(5,15,30,0.99));
        border:1px solid rgba(0,200,255,0.22);border-radius:24px;
        max-width:620px;width:100%;margin:auto;
        box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 60px rgba(0,200,255,0.06);
        position:relative;overflow:hidden;
      ">
        <!-- gradient top bar -->
        <div id="svcInfoModalBar" style="height:4px;background:linear-gradient(90deg,#00c8ff,#00ff88);"></div>

        <!-- close btn -->
        <button id="svcInfoModalClose" type="button" aria-label="Close" style="
          position:absolute;top:16px;right:16px;z-index:10;
          width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);
          background:rgba(255,255,255,0.07);color:#a0b4c8;cursor:pointer;
          display:flex;align-items:center;justify-content:center;font-size:18px;
          transition:all 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.14)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        <!-- Content -->
        <div style="padding:28px 28px 32px;" id="svcInfoContent">
          <!-- header -->
          <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
            <div id="svcInfoEmoji" style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.06);flex-shrink:0;"></div>
            <div>
              <div id="svcInfoBadge" style="display:inline-block;font-size:.68rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:8px;"></div>
              <h2 id="svcInfoModalTitle" style="font-size:clamp(1.2rem,4vw,1.55rem);color:#e8f0f8;font-weight:900;margin:0 0 4px;line-height:1.3;font-family:var(--font-display,sans-serif);"></h2>
              <p id="svcInfoTagline" style="color:#7a9ab8;font-size:.88rem;line-height:1.5;margin:0;"></p>
            </div>
          </div>

          <!-- divider -->
          <div style="height:1px;background:rgba(0,200,255,0.12);margin:0 0 20px;"></div>

          <!-- What is it -->
          <div style="margin-bottom:20px;">
            <div style="font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#00c8ff;margin-bottom:10px;">
              এটা কী? / What is it?
            </div>
            <p id="svcInfoWhatBn" style="color:#c2d8ee;font-size:.91rem;line-height:1.75;margin:0 0 8px;"></p>
            <p id="svcInfoWhatEn" style="color:#7a9ab8;font-size:.84rem;line-height:1.7;margin:0;font-style:italic;"></p>
          </div>

          <!-- Features -->
          <div style="margin-bottom:20px;">
            <div style="font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#00ff88;margin-bottom:12px;">
              ✦ Premium Features
            </div>
            <ul id="svcInfoFeatures" style="margin:0;padding:0;list-style:none;display:grid;gap:8px;"></ul>
          </div>

          <!-- Note -->
          <div id="svcInfoNoteWrap" style="margin-bottom:24px;">
            <div id="svcInfoNote" style="
              padding:12px 14px;border-radius:14px;
              background:rgba(0,200,255,0.07);border:1px solid rgba(0,200,255,0.16);
              color:#9ec8e8;font-size:.84rem;line-height:1.65;font-weight:600;
            "></div>
          </div>

          <!-- CTA -->
          <button id="svcInfoCTA" type="button" style="
            width:100%;padding:14px 20px;border-radius:14px;border:0;
            background:linear-gradient(135deg,#00c8ff,#00ff88);
            color:#020a10;font-weight:900;font-size:.95rem;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:8px;
            transition:opacity 0.2s;
          " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span id="svcInfoCTALabel">Order করুন / Get Now</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    /* Close handlers */
    document.getElementById('svcInfoModalClose').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(key, ctaCallback) {
    const data = SERVICE_INFO[key];
    if (!data) return;

    createModal();
    const modal = document.getElementById('svcInfoModal');

    /* Fill content */
    document.getElementById('svcInfoEmoji').innerHTML = data.emoji || '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    document.getElementById('svcInfoModalTitle').textContent = data.name;
    document.getElementById('svcInfoTagline').textContent = data.tagline || '';
    document.getElementById('svcInfoWhatBn').textContent = data.what_bn || '';
    document.getElementById('svcInfoWhatEn').textContent = data.what_en || '';

    /* Badge */
    const badge = document.getElementById('svcInfoBadge');
    badge.textContent = 'Service Info';
    badge.style.background = (data.color || '#00c8ff') + '22';
    badge.style.border = '1px solid ' + (data.color || '#00c8ff') + '44';
    badge.style.color = data.color || '#00c8ff';

    /* Top bar color */
    document.getElementById('svcInfoModalBar').style.background =
      `linear-gradient(90deg, ${data.color || '#00c8ff'}, #00ff88)`;

    /* Features */
    const ul = document.getElementById('svcInfoFeatures');
    ul.innerHTML = (data.features || []).map(f => `
      <li style="
        display:grid;grid-template-columns:auto 1fr;gap:10px;
        background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);
        border-radius:12px;padding:10px 13px;
      ">
        <div style="color:${data.color || '#00c8ff'};margin-top:1px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="color:#d8eaf8;font-size:.88rem;font-weight:700;line-height:1.4;">${f.bn}</div>
          <div style="color:#5a7a9a;font-size:.78rem;margin-top:2px;line-height:1.35;">${f.en}</div>
        </div>
      </li>
    `).join('');

    /* Note */
    const noteEl = document.getElementById('svcInfoNote');
    const noteWrap = document.getElementById('svcInfoNoteWrap');
    if (data.note_bn) {
      noteEl.innerHTML = `<span style="display:block;margin-bottom:4px;">${data.note_bn}</span>
        <span style="color:#5a7a9a;font-size:.8rem;font-style:italic;">${data.note_en || ''}</span>`;
      noteWrap.style.display = '';
    } else {
      noteWrap.style.display = 'none';
    }

    /* CTA */
    const cta = document.getElementById('svcInfoCTA');
    cta.onclick = function () {
      closeModal();
      if (typeof ctaCallback === 'function') ctaCallback();
    };
    document.getElementById('svcInfoCTALabel').textContent = 'Order করুন →';

    /* Show */
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const box = document.getElementById('svcInfoModalBox');
      if (box) { box.style.animation = 'svcInfoSlideUp 0.32s cubic-bezier(.22,.68,0,1.2) both'; }
    }, 10);
  }

  function closeModal() {
    const modal = document.getElementById('svcInfoModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ── Inject CSS ───────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes svcInfoSlideUp {
      from { opacity:0; transform:translateY(28px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    .svc-info-btn {
      display:inline-flex;align-items:center;gap:5px;
      padding:0 12px;height:34px;border-radius:10px;
      background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.22);
      color:#6ecfee;font-size:.78rem;font-weight:800;cursor:pointer;
      transition:all 0.18s;white-space:nowrap;flex-shrink:0;
      font-family:inherit;letter-spacing:.01em;
    }
    .svc-info-btn:hover {
      background:rgba(0,200,255,0.16);border-color:rgba(0,200,255,0.45);
      color:#a8e8ff;transform:translateY(-1px);
    }
    .svc-info-btn svg { flex-shrink:0; }

    /* service-banner-card bottom row (Service Hub on home page) */
    .svc-hub-row {
      display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;
    }
    .svc-hub-btn {
      flex:1;min-width:0;
    }
  `;
  document.head.appendChild(style);

  /* ── Expose globally ──────────────────────────────────── */
  window.openServiceInfo = openModal;
  window.closeServiceInfo = closeModal;
  window.SERVICE_INFO = SERVICE_INFO;

})();

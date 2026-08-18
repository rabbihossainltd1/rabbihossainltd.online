/* ============================================================
   Shared plan catalog (single source of truth)
   ------------------------------------------------------------
   Used by BOTH the checkout page (js/checkout.js) and the cart
   page's inline plan picker (js/cart-page.js) so plan labels +
   prices never drift apart. Keep in sync with the backend catalog
   (services/catalog.js on the backend) — the backend is authoritative.
   ============================================================ */
(function () {
  'use strict';

  const SERVICES = {
    'visa-mastercard':   { name: 'Visa / Mastercard',                        fields: 'card',   title: 'Visa & Mastercard',        sub: 'Order a physical or virtual card by choosing a package.' },
    'meta-verified':     { name: 'Facebook Meta Verified',                   fields: 'meta',   title: 'Meta Verified',            sub: 'Apply to get your Facebook Page or Profile verified.' },
    'free-fire-topup':   { name: 'Free Fire Diamond Top-up',                 fields: 'ff',     title: 'Free Fire Diamond Top-up', sub: 'Verify UID, choose a package — auto delivery.' },
    'ff-drip':           { name: 'Free Fire Android Panel Drip Client (Root)', fields: 'ffDrip', title: 'Free Fire Drip Panel',   sub: 'Android (Root) panel — variant Choose।' },
    'ff-ff4x':           { name: 'Free Fire Android Panel (FF4X)',           fields: 'ffFf4x', title: 'Free Fire FF4X Panel',     sub: 'Android panel — variant Choose।' },
    'ff-ios':            { name: 'Free Fire iPhone Panel (iOS)',             fields: 'ffIos',  title: 'Free Fire iOS Panel',      sub: 'iPhone panel (Fluorite) — automatic key delivery.' },
    'ff-pc':             { name: 'Free Fire PC Panel',                       fields: 'ffPc',   title: 'Free Fire PC Panel',       sub: 'PC panel — variant Choose।' },
    'br-mods':           { name: 'BR Mods',                                  fields: 'ffBrMods', title: 'BR Mods Panel',          sub: 'BR Mods panel — no root required.' },
    'ethical-hacking':   { name: 'Ethical Hacking / Security Audit',         fields: 'security', title: 'Ethical Hacking / Security Audit', sub: 'Security audit and penetration testing service.' },
    'android-development': { name: 'Android App Development',                fields: 'android', title: 'Android App Development', sub: 'Build your Android app to your requirements.' },
    'web-development':   { name: 'Website Development',                      fields: 'webDev', title: 'Website Development',      sub: 'Share your project details to get started with a quote.' },
    'digital-branding':  { name: 'Digital Branding',                         fields: '',       title: 'Digital Branding',         sub: 'Logo, brand identity and digital branding package.' },
    'premium-services':  { name: 'Premium Digital Services',                 fields: '',       title: 'Premium Digital Services', sub: 'Request a custom premium digital service.' }
  };

  const PREMIUM_APPS = {
    chatgpt:'ChatGPT Subscription', gemini:'Gemini AI Subscription', canva:'Canva Pro',
    capcut:'CapCut Pro', youtube:'YouTube Premium', truecaller:'Truecaller Premium',
    imo:'imo Premium', netflix:'Netflix Subscription', grok:'Grok Subscription',
    vpn:'Premium VPN', antivirus:'Antivirus Subscription', adsremove:'Ads Remove Service',
    premiere:'Adobe Premiere Pro', photoshop:'Adobe Photoshop', illustrator:'Adobe Illustrator',
    windows:'Microsoft Windows Key', excel:'Microsoft Excel / Office'
  };
  Object.keys(PREMIUM_APPS).forEach(function (id) {
    SERVICES[id] = { name: 'Premium App & Subscription', fields: 'proapp', proapp: id, title: PREMIUM_APPS[id], sub: 'Choose a plan and order your subscription.' };
  });

  const APPS = [
    { id:'chatgpt', name:'ChatGPT', plans:[{label:'Go · 1 Month',usd:10},{label:'Plus · 1 Month',usd:20},{label:'Pro · 1 Month',usd:200}] },
    { id:'gemini', name:'Gemini', plans:[{label:'AI Pro · 1 Month',usd:19.99},{label:'AI Ultra · 1 Month',usd:249.99}] },
    { id:'grok', name:'Grok AI', plans:[{label:'Grok Basic · 1 Month',usd:5},{label:'Grok Plus · 1 Month',usd:15},{label:'Grok Plus · 3 Months',usd:30},{label:'Grok Plus · 12 Months',usd:120},{label:'Grok Premium · 1 Month',usd:20},{label:'Grok Premium · 3 Months',usd:50},{label:'Grok Premium · 12 Months',usd:100}] },
    { id:'netflix', name:'Netflix', plans:[{label:'Mobile · 1 Month',usd:2.99},{label:'Basic · 1 Month',usd:4.99},{label:'Standard · 1 Month',usd:6.99},{label:'Premium · 1 Month',usd:9.99}] },
    { id:'canva', name:'Canva', plans:[{label:'Pro · 1 Month',usd:12.99},{label:'Pro · 1 Year',usd:119.99},{label:'Teams · 1 Month / user',usd:14.99}] },
    { id:'capcut', name:'CapCut', plans:[{label:'Pro · 1 Month',usd:9.99},{label:'Pro · 1 Year',usd:89.99}] },
    { id:'youtube', name:'YouTube', plans:[{label:'Premium Individual · 1 Month',usd:3.99},{label:'Premium Family · 1 Month',usd:6.99},{label:'Premium Student · 1 Month',usd:2.49}] },
    { id:'truecaller', name:'Truecaller', plans:[{label:'Premium · 1 Month',usd:1.99},{label:'Premium · 3 Months',usd:4.99},{label:'Premium · 12 Months',usd:14.99},{label:'Gold · 1 Month',usd:4.99}] },
    { id:'imo', name:'imo', plans:[{label:'Premium · 1 Week',usd:0.29},{label:'Premium · 1 Month',usd:0.82},{label:'Premium · 3 Months',usd:2.07},{label:'Premium · 12 Months',usd:7.49}] },
    { id:'vpn', name:'Premium VPN', plans:[{label:'1 Device · 1 Year',usd:4.99},{label:'3 Devices · 1 Year',usd:11.99},{label:'5 Devices · 1 Year',usd:19.99},{label:'10 Devices · 1 Year',usd:29.99}] },
    { id:'adsremove', name:'Remove Ads', plans:[{label:'Lifetime',usd:5.99}] },
    { id:'antivirus', name:'Antivirus', plans:[{label:'1 Device · 1 Year',usd:4.99},{label:'3 Devices · 1 Year',usd:9.99},{label:'5 Devices · 1 Year',usd:19.99},{label:'10 Devices · 1 Year',usd:29.99}] },
    { id:'premiere', name:'Adobe Premiere Pro', plans:[{label:'Monthly Plan · 1 Month',usd:19.99},{label:'Annual Plan Paid Monthly · 12 Months',usd:130.88},{label:'Annual Plan Prepaid · 1 Year',usd:240.88}] },
    { id:'photoshop', name:'Adobe Photoshop', plans:[{label:'Monthly Plan · 1 Month',usd:18.99},{label:'Annual Paid Monthly · 12 Months',usd:130.88},{label:'Annual Prepaid · 1 Year',usd:240.88}] },
    { id:'illustrator', name:'Adobe Illustrator', plans:[{label:'Monthly Plan · 1 Month',usd:19.99},{label:'Annual Paid Monthly · 12 Months',usd:130.88},{label:'Annual Prepaid · 1 Year',usd:250.88}] },
    { id:'windows', name:'Windows License', plans:[{label:'Windows 10 Home · Lifetime',usd:11.99},{label:'Windows 10 Pro · Lifetime',usd:14.99},{label:'Windows 11 Home · Lifetime',usd:19.99},{label:'Windows 11 Pro · Lifetime',usd:16.99},{label:'Windows 11 Pro 2PC · Lifetime',usd:29.99}] },
    { id:'excel', name:'Microsoft Excel', plans:[{label:'Excel 2021 · Lifetime',usd:14.99},{label:'Microsoft 365 Excel · 1 Year / 1 User',usd:29.99},{label:'Microsoft 365 Family · 1 Year / 6 Users',usd:49.99},{label:'Excel + Word + PowerPoint · Lifetime',usd:39.99}] }
  ];

  const FF_VARIANTS = {
    ffDrip: { name:'ff_drip_variant', email:'drip_email', rows:[
      ['1 DAY','$0.90 / ৳113',0.90],['3 DAYS','$2.00 / ৳250',2.00],['7 DAYS','$4.00 / ৳500',4.00],['15 DAYS','$7.00 / ৳875',7.00],['30 DAYS','$10.00 / ৳1,250',10.00]] },
    ffFf4x: { name:'ff_ff4x_variant', email:'ff4x_email', rows:[
      ['1 Month','$5 / ৳625',5],['3 Months','$10 / ৳1,250',10],['1 Year','$30 / ৳3,750',30]] },
    ffIos: { name:'ff_ios_variant', email:'ios_email', rows:[
      ['1 DAY','$5.00 / ৳625',5],['7 DAYS','$14.00 / ৳1,750',14],['31 DAYS','$25.00 / ৳3,125',25],['Full Set-up (First Time)','$40.00 / ৳5,000',40]] },
    ffPc: { name:'ff_pc_variant', email:'pc_email', rows:[
      ['1 DAY','$0.50 / ৳63',0.50],['7 DAYS','$2.00 / ৳250',2],['30 DAYS','$5.00 / ৳625',5],['1 YEAR','$15.00 / ৳1,875',15]] },
    ffBrMods: { name:'ff_brmods_variant', email:'brmods_email', rows:[
      ['1 DAY','$0.90 / ৳113',0.90],['7 DAYS','$3.50 / ৳438',3.50],['15 DAYS','$6.00 / ৳750',6.00],['31 DAYS','$9.00 / ৳1,125',9.00]] }
  };

  const CARD_PRICE_OPTIONS = { Physical: [110,550,1200], Virtual: [12,55,105] };

  const META_OPTIONS = [
    { key: 'Page', label: 'Facebook Page Verification', usd: 12 },
    { key: 'Personal ID', label: 'Personal Profile (ID) Verification', usd: 12 }
  ];

  const FIXED_PRICES = {
    'meta-verified': 12,
    'ethical-hacking': 30,
    'android-development': 40,
    'web-development': 50,
    'digital-branding': 15,
    'premium-services': 10
  };

  window.RH_PLANS = {
    SERVICES: SERVICES,
    PREMIUM_APPS: PREMIUM_APPS,
    APPS: APPS,
    FF_VARIANTS: FF_VARIANTS,
    CARD_PRICE_OPTIONS: CARD_PRICE_OPTIONS,
    META_OPTIONS: META_OPTIONS,
    FIXED_PRICES: FIXED_PRICES
  };
})();

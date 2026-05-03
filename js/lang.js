(function () {
'use strict';
const LANG_KEY = 'siteLang';
const currentLang = localStorage.getItem(LANG_KEY) || 'en';
const BN = {
'Home': 'হোম',
'Services': 'সার্ভিস',
'Portfolio': 'পোর্টফোলিও',
'About': 'আমাদের সম্পর্কে',
'My Orders': 'আমার অর্ডার',
'Add Credit': 'ক্রেডিট যোগ করুন',
'Login': 'লগইন',
'Sign Up': 'সাইন আপ',
'Logout': 'লগআউট',
'Customer Service': 'কাস্টমার সার্ভিস',
'Settings': 'সেটিংস',
'Services Hub': 'সার্ভিস হাব',
'Top-up Now': 'টপ-আপ করুন',
'Apply Now': 'আবেদন করুন',
'Get Now': 'এখনই নিন',
'Get Card': 'কার্ড নিন',
'All Services': 'সকল সার্ভিস',
'Order Now': 'অর্ডার করুন',
'Open Service': 'সার্ভিস খুলুন',
'Current Balance': 'বর্তমান ব্যালেন্স',
'Services History + Status': 'সার্ভিস ইতিহাস + স্ট্যাটাস',
'Transaction History + Status':'লেনদেন ইতিহাস + স্ট্যাটাস',
'Services': 'সার্ভিস',
'Transactions': 'লেনদেন',
'Loading service orders...': 'সার্ভিস অর্ডার লোড হচ্ছে...',
'Loading payment requests...':'পেমেন্ট রিকোয়েস্ট লোড হচ্ছে...',
'Your service history and payment history status are shown below.':
'আপনার সার্ভিস ও পেমেন্ট ইতিহাস নিচে দেখানো হয়েছে।',
'pending': 'অপেক্ষমান',
'approved': 'অনুমোদিত',
'completed': 'সম্পন্ন',
'declined': 'বাতিল',
'failed': 'ব্যর্থ',
'processing': 'প্রক্রিয়াধীন',
'Add Credit to Wallet': 'ওয়ালেটে ক্রেডিট যোগ করুন',
'Payment Method': 'পেমেন্ট পদ্ধতি',
'Payment Information': 'পেমেন্ট তথ্য',
'Amount': 'পরিমাণ',
'Transaction ID': 'ট্রানজেকশন আইডি',
'Verify Payment': 'পেমেন্ট যাচাই করুন',
'bKash Temporarily Unavailable': 'bKash সাময়িকভাবে অনুপলব্ধ',
'Profile Settings': 'প্রোফাইল সেটিংস',
'Update your name, profile picture, customer support access, and password from one place.':
'এক জায়গা থেকে আপনার নাম, ছবি, পাসওয়ার্ড ও সাপোর্ট পরিবর্তন করুন।',
'Change Picture': 'ছবি পরিবর্তন',
'Name': 'নাম',
'Email': 'ইমেইল',
'New Password': 'নতুন পাসওয়ার্ড',
'Confirm Password': 'পাসওয়ার্ড নিশ্চিত করুন',
'Save Changes': 'পরিবর্তন সংরক্ষণ',
'Language / ভাষা': 'ভাষা',
'Save Language': 'ভাষা সংরক্ষণ',
'Your Order is Placed!': 'আপনার অর্ডার সম্পন্ন হয়েছে!',
'Please wait a few moments to complete the order.':
'অর্ডার সম্পন্ন হতে কিছুক্ষণ অপেক্ষা করুন।',
'It takes maximum': 'সর্বোচ্চ সময় লাগবে',
'to process.': 'প্রক্রিয়া সম্পন্ন হতে।',
'Redirecting to My Orders…': 'আমার অর্ডারে যাওয়া হচ্ছে...',
'Track your order status live from there.':
'সেখান থেকে লাইভ স্ট্যাটাস দেখুন।',
'View My Orders Now': 'এখনই আমার অর্ডার দেখুন',
'Order Placed': 'অর্ডার হয়েছে',
'Order is Placed!': 'অর্ডার সম্পন্ন!',
'Order সাধারণত': 'অর্ডার সাধারণত',
'15 মিনিটের মধ্যে': '১৫ মিনিটের মধ্যে',
'complete হয়': 'সম্পন্ন হয়',
'Live & Active': 'লাইভ ও সক্রিয়',
'24/7 Instant Service': '২৪/৭ তাৎক্ষণিক সার্ভিস',
'Start Top-up Now': 'এখনই টপ-আপ শুরু করুন',
};
function applyLang(lang) {
if (lang === 'bn') {
document.documentElement.setAttribute('lang', 'bn');
document.documentElement.setAttribute('data-lang', 'bn');
if (!document.getElementById('banglaFont')) {
const link = document.createElement('link');
link.id = 'banglaFont';
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap';
document.head.appendChild(link);
}
translateDOM();
} else {
document.documentElement.setAttribute('lang', 'en');
document.documentElement.setAttribute('data-lang', 'en');
restoreDOM();
}
}
function translateDOM() {
document.querySelectorAll('[data-i18n]').forEach(el => {
const key = el.getAttribute('data-i18n');
if (BN[key]) {
el._originalText = el._originalText || el.textContent;
el.textContent = BN[key];
}
});
const selectors = [
'nav a', '.nav-link', 'h1', 'h2', 'h3', 'h4',
'.section-label', '.orders-section-title', '.orders-only-title',
'.orders-only-subtitle', '.dashboard-section-title',
'.method-name', '.balance-text span',
'.empty-state', '.landing-popup-card h3', '.landing-popup-card p',
'.svc-hub-btn',
];
document.querySelectorAll(selectors.join(',')).forEach(el => {
if (el.querySelector('svg, img')) return;
const txt = el.textContent.trim();
if (BN[txt]) {
if (!el._i18nOriginal) el._i18nOriginal = el.innerHTML;
el.textContent = BN[txt];
}
});
document.querySelectorAll('nav a, .nav-mobile-link').forEach(el => {
if (el.closest('.bottom-nav') || el.closest('.mobile-nav-bar')) return;
el.childNodes.forEach(node => {
if (node.nodeType === 3) {
const txt = node.textContent.trim();
if (txt && BN[txt]) {
if (!node._i18nOrig) node._i18nOrig = node.textContent;
node.textContent = BN[txt];
}
}
});
});
document.querySelectorAll('.bottom-nav a span:last-child, .mobile-nav-bar a span:not(.nav-icon), .nav-mobile-label').forEach(el => {
if (el.querySelector('svg, img')) return;
const txt = el.textContent.trim();
if (txt && BN[txt]) {
if (!el._i18nOrig) el._i18nOrig = el.textContent;
el.textContent = BN[txt];
}
});
document.querySelectorAll('.profile-control-btn, .service-apply-btn, .home-svc-action, .svc-hub-btn').forEach(el => {
el.childNodes.forEach(node => {
if (node.nodeType === 3) {
const txt = node.textContent.trim();
if (txt && BN[txt]) {
if (!node._i18nOrig) node._i18nOrig = node.textContent;
node.textContent = ' ' + BN[txt];
}
}
});
});
}
function restoreDOM() {
document.querySelectorAll('[data-i18n]').forEach(el => {
if (el._originalText) el.textContent = el._originalText;
});
document.querySelectorAll('[data-lang-en]').forEach(el => {
if (el._i18nOriginal) el.innerHTML = el._i18nOriginal;
});
}
window.rabbiLang = {
current: currentLang,
t: function(key) { return currentLang === 'bn' ? (BN[key] || key) : key; },
apply: applyLang,
isBn: function() { return currentLang === 'bn'; },
};
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', () => applyLang(currentLang));
} else {
applyLang(currentLang);
}
window.addEventListener('load', () => setTimeout(() => applyLang(currentLang), 400));
if (currentLang === 'bn') {
const obs = new MutationObserver(() => translateDOM());
document.addEventListener('DOMContentLoaded', () => {
obs.observe(document.body, { childList: true, subtree: true, characterData: false });
});
}
})();
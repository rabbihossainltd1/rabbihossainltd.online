(function () {
'use strict';
const el = document.getElementById('typingText');
if (!el) return;
const titles = ['Ethical Hacker', 'Web Developer', 'Graphic Designer', 'App Builder'];
let tIdx = 0;
let cIdx = 0;
let deleting = false;
const SPEED_TYPE = 85;
const SPEED_DEL = 45;
const PAUSE_END = 1800;
const PAUSE_START = 400;
function tick() {
const word = titles[tIdx];
if (!deleting) {
el.textContent = word.slice(0, ++cIdx);
if (cIdx === word.length) {
deleting = true;
setTimeout(tick, PAUSE_END);
return;
}
} else {
el.textContent = word.slice(0, --cIdx);
if (cIdx === 0) {
deleting = false;
tIdx = (tIdx + 1) % titles.length;
setTimeout(tick, PAUSE_START);
return;
}
}
setTimeout(tick, deleting ? SPEED_DEL : SPEED_TYPE);
}
setTimeout(tick, 800);
})();
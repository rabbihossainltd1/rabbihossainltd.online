import { auth, db } from './firebase-core.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import {
collection, doc, addDoc, setDoc, onSnapshot,
query, orderBy, serverTimestamp, limit, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
(function () {
'use strict';
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function genTicketId() {
const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id='TKT-';
for(let i=0;i<8;i++) id+=c[Math.floor(Math.random()*c.length)]; return id;
}
function nowStr() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
let currentUser=null, isOpen=false, unsubMessages=null, activeUserId=null, unreadCount=0;
let botState='wait_first_msg';
const widget = document.getElementById('floatChatWidget');
const winEl = document.getElementById('floatChatWindow');
const closeBtn = document.getElementById('floatChatClose');
const toggle = document.getElementById('floatChatToggle');
const msgsEl = document.getElementById('floatChatMessages');
const inputEl = document.getElementById('floatChatInput');
const sendBtn = document.getElementById('floatChatSend');
const badge = document.getElementById('floatChatBadge');
const iconChat = document.getElementById('floatIconChat');
const iconClose= document.getElementById('floatIconClose');
if (!widget||!winEl) return;
function appendMsg(role,html,isHtml){
const wrap=document.createElement('div');
wrap.className='float-msg '+(role==='user'?'float-msg-user':'float-msg-admin');
const b=document.createElement('div'); b.className='float-msg-bubble';
if(isHtml) b.innerHTML=html; else b.textContent=html;
const t=document.createElement('div'); t.className='float-msg-time'; t.textContent=nowStr();
wrap.appendChild(b); wrap.appendChild(t); msgsEl.appendChild(wrap);
msgsEl.scrollTop=msgsEl.scrollHeight; return wrap;
}
function appendTyping(){
const w=document.createElement('div');
w.className='float-msg float-msg-admin float-typing-wrap';
w.innerHTML=`<div class="float-msg-bubble float-typing-bubble"><span class="float-typing-dot"></span><span class="float-typing-dot"></span><span class="float-typing-dot"></span></div>`;
msgsEl.appendChild(w); msgsEl.scrollTop=msgsEl.scrollHeight;
}
function removeTyping(){ document.querySelector('.float-typing-wrap')?.remove(); }
function botSay(html,isHtml,delay){
return new Promise(res=>{ appendTyping(); setTimeout(()=>{ removeTyping(); appendMsg('admin',html,isHtml); res(); },delay||800); });
}
function showQuickButtons(buttons){
document.getElementById('floatQuickBtns')?.remove();
const row=document.createElement('div'); row.className='float-quick-btns'; row.id='floatQuickBtns';
buttons.forEach(btn=>{ const b=document.createElement('button'); b.type='button'; b.className='float-quick-btn'; b.textContent=btn.label; b.addEventListener('click',()=>{ document.getElementById('floatQuickBtns')?.remove(); btn.action(); }); row.appendChild(b); });
msgsEl.appendChild(row); msgsEl.scrollTop=msgsEl.scrollHeight;
}
function showWaitingAnimation(){
document.getElementById('floatWaitingAnim')?.remove();
const w=document.createElement('div');
w.className='float-msg float-msg-admin float-waiting-wrap'; w.id='floatWaitingAnim';
w.innerHTML=`<div class="float-msg-bubble float-waiting-bubble"><div class="float-waiting-inner"><div class="float-wait-ring"><svg width="22" height="22" viewBox="0 0 50 50" fill="none"><circle cx="25" cy="25" r="20" stroke="rgba(0,200,255,.2)" stroke-width="4"/><circle cx="25" cy="25" r="20" stroke="#00c8ff" stroke-width="4" stroke-dasharray="60 66" stroke-linecap="round" class="float-wait-arc"/></svg></div><span class="float-waiting-text">এজেন্ট সংযুক্ত হচ্ছেন</span></div><div class="float-wait-dots"><span class="float-typing-dot"></span><span class="float-typing-dot"></span><span class="float-typing-dot"></span></div></div>`;
msgsEl.appendChild(w); msgsEl.scrollTop=msgsEl.scrollHeight;
}
function setInputLocked(locked,ph){
if(inputEl){ inputEl.disabled=locked; inputEl.placeholder=ph||'বার্তা লিখুন...'; }
if(sendBtn) sendBtn.disabled=locked;
}
function showAgentForm(){
document.getElementById('floatAgentForm')?.remove();
const ticketId=genTicketId(), displayName=currentUser?.displayName||'', email=currentUser?.email||'';
const wrap=document.createElement('div'); wrap.className='float-agent-form-wrap'; wrap.id='floatAgentForm';
wrap.innerHTML=`
<div class="float-form-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> এজেন্টের সাথে কথা বলুন</div>
<div class="float-form-ticket-id"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Ticket: <strong>${ticketId}</strong></div>
<input class="float-form-input" type="text" id="afName" placeholder="আপনার নাম *" value="${esc(displayName)}" />
<input class="float-form-input" type="email" id="afEmail" placeholder="Gmail / Email *" value="${esc(email)}" />
<input class="float-form-input" type="tel" id="afPhone" placeholder="ফোন নম্বর *" />
<textarea class="float-form-input float-form-textarea" id="afProblem" placeholder="সমস্যা সংক্ষেপে লিখুন *" rows="3"></textarea>
<div class="float-form-ticket-note">সংরক্ষণ করুন: <code>${ticketId}</code></div>
<button type="button" class="float-form-submit" id="afSubmit">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Submit করুন
</button>`;
msgsEl.appendChild(wrap); msgsEl.scrollTop=msgsEl.scrollHeight;
document.getElementById('afSubmit').addEventListener('click',()=>submitAgentForm(ticketId));
}
async function submitAgentForm(ticketId){
const name=document.getElementById('afName')?.value.trim();
const email=document.getElementById('afEmail')?.value.trim();
const phone=document.getElementById('afPhone')?.value.trim();
const problem=document.getElementById('afProblem')?.value.trim();
const submitEl=document.getElementById('afSubmit');
if(!name||!email||!phone||!problem){
if(submitEl){ const orig=submitEl.innerHTML; submitEl.textContent='সব ঘর পূরণ করুন!'; submitEl.style.cssText='background:rgba(255,80,80,.2);border-color:rgba(255,80,80,.5);'; setTimeout(()=>{ submitEl.innerHTML=orig; submitEl.style.cssText=''; },2200); } return;
}
if(submitEl){ submitEl.disabled=true; submitEl.textContent='সাবমিট হচ্ছে...'; }
try {
const userId=currentUser.uid;
activeUserId=userId;
const userEmail=currentUser.email||email;
await setDoc(doc(db,'supportRooms',userId),{
userId,userEmail,displayName:name,userPhone:phone,ticketId,
lastMessage:problem,lastAt:serverTimestamp(),unreadAdmin:1,status:'open'
},{merge:true});
await addDoc(collection(db,'supportChats',userId,'messages'),{
text:problem,role:'user',userId,userEmail,userName:name,userPhone:phone,ticketId,createdAt:serverTimestamp()
});
setDoc(doc(db,'supportTickets',ticketId),{
ticketId,userId,userName:name,userEmail,userPhone:phone,
problemDescription:problem,status:'open',createdAt:serverTimestamp(),updatedAt:serverTimestamp()
}).catch(e=>console.warn('supportTickets write skipped:',e));
document.getElementById('floatAgentForm')?.remove();
botState='agent_waiting';
await botSay('কিছুক্ষণ অপেক্ষা করুন আপনার সমস্যাটি একজন এজেন্ট এর কাছে ট্রান্সফার করা হচ্ছে',false,600);
showWaitingAnimation();
setInputLocked(true,'এজেন্টের জন্য অপেক্ষা করুন...');
subscribeToAdminReplies(userId);
} catch(err){
console.error('Ticket error:',err);
if(submitEl){ submitEl.disabled=false; submitEl.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> আবার চেষ্টা করুন`; }
}
}
function subscribeToAdminReplies(userId){
if(unsubMessages) unsubMessages();
const q=query(collection(db,'supportChats',userId,'messages'),orderBy('createdAt','asc'),limit(100));
let loaded=false; const seen=new Set();
unsubMessages=onSnapshot(q,snap=>{
if(!loaded){ snap.docs.forEach(d=>seen.add(d.id)); loaded=true; return; }
snap.docChanges().forEach(ch=>{
if(ch.type!=='added'||seen.has(ch.doc.id)) return;
seen.add(ch.doc.id); const d=ch.doc.data();
if(d.role==='system'&&d.type==='solved'){ handleTicketSolved(); }
else if(d.role==='admin'){
document.getElementById('floatWaitingAnim')?.remove();
botState='live'; setInputLocked(false,'বার্তা লিখুন...');
appendMsg('admin',d.text,false);
if(!isOpen){ unreadCount++; badge.textContent=unreadCount; badge.style.display='flex'; }
}
});
});
}
function handleTicketSolved(){
document.getElementById('floatWaitingAnim')?.remove();
document.getElementById('floatQuickBtns')?.remove();
botState='solved';
appendMsg('admin','আপনার সমস্যাটি সমাধান হয়েছে। ধন্যবাদ RabbiHossainLTD ব্যবহার করার জন্য।',false);
const inputArea=document.getElementById('floatChatInputArea')||inputEl?.parentElement;
if(inputEl) inputEl.style.display='none';
if(sendBtn) sendBtn.style.display='none';
document.getElementById('floatNewChatBtn')?.remove();
const ncBtn=document.createElement('button');
ncBtn.type='button'; ncBtn.id='floatNewChatBtn';
ncBtn.textContent='নতুন চ্যাট শুরু করুন';
ncBtn.style.cssText='width:100%;padding:10px;background:rgba(0,200,255,.12);border:1px solid rgba(0,200,255,.3);border-radius:10px;color:#9ee8ff;font-size:.85rem;font-weight:700;cursor:pointer;margin-top:4px;';
ncBtn.addEventListener('click',()=>{
if(unsubMessages){ unsubMessages(); unsubMessages=null; }
msgsEl.innerHTML='';
botState='wait_first_msg';
activeUserId=null;
ncBtn.remove();
if(inputEl){ inputEl.style.display=''; inputEl.value=''; inputEl.disabled=false; inputEl.placeholder='বার্তা লিখুন...'; }
if(sendBtn){ sendBtn.style.display=''; sendBtn.disabled=false; }
});
if(inputArea) inputArea.appendChild(ncBtn);
else msgsEl.appendChild(ncBtn);
}
async function startBotFlow(){
botState='greeted';
await botSay('আসসালামুয়ালাইকুম, Rabbi Hossain LTD তে আপনাকে স্বাগতম আপনাকে কিভাবে সহযোগিতা করতে পারি',false,900);
await new Promise(r=>setTimeout(r,350));
await botSay('আপনার সমস্যা নির্বাচন করুন নিচের অপশন গুলা থেকে',false,700);
botState='menu'; showMainMenu();
}
function showMainMenu(){
showQuickButtons([
{label:'পেমেন্ট কিভাবে করব?', action:()=>handleChoice('payment')},
{label:'কিভাবে অ্যাপ কিনব?', action:()=>handleChoice('app')},
{label:'গেমে টপআপ কিভাবে করব?', action:()=>handleChoice('topup')},
{label:'কুপন কোড পাবো কিভাবে?', action:()=>handleChoice('coupon')},
{label:'এজেন্ট এর সাথে কথা বলবো', action:()=>handleChoice('agent')},
]);
}
const LABELS={payment:'পেমেন্ট কিভাবে করব?',app:'কিভাবে অ্যাপ কিনব?',topup:'গেমে টপআপ কিভাবে করব?',coupon:'কুপন কোড পাবো কিভাবে?',agent:'এজেন্ট এর সাথে কথা বলবো'};
async function handleChoice(choice){
appendMsg('user',LABELS[choice],false); botState='answering';
if(choice==='payment'){
await botSay(
`<strong>পেমেন্ট করার নিয়ম:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>bKash</strong> — App খুলুন &rarr; Send Money &rarr; আমাদের নম্বরে পাঠান &rarr; Transaction ID রাখুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Nagad</strong> — App খুলুন &rarr; Send Money &rarr; আমাদের নম্বরে পাঠান &rarr; Transaction ID রাখুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Rocket</strong> — App খুলুন &rarr; Send Money &rarr; আমাদের নম্বরে পাঠান &rarr; Transaction ID রাখুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0b90b" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Binance Pay</strong> — Binance App &rarr; Pay &rarr; Send &rarr; আমাদের Binance ID দিন &rarr; USDT পাঠান।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Dashboard Wallet</strong> — Dashboard &rarr; Add Credit &rarr; সরাসরি ওয়ালেটে যোগ করুন।</span></div>`+
`</div><br>পেমেন্টের পর Transaction ID বা Screenshot সহ এজেন্টকে জানান।`,
true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='app'){
await botSay(
`<strong>অ্যাপ কেনার ধাপগুলো:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ১:</strong> Services পেজে যান এবং পছন্দের অ্যাপ খুঁজুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ২:</strong> "Get Now" বাটনে ক্লিক করুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ৩:</strong> প্রয়োজনীয় তথ্য পূরণ করুন এবং অর্ডার দিন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ৪:</strong> পেমেন্ট করুন এবং Transaction ID জানান।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>সাধারণত <strong style="color:#00ff88;">৫–৩০ মিনিটের</strong> মধ্যে ডেলিভারি দেওয়া হয়।</span></div>`+
`</div>`,true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='topup'){
await botSay(
`<strong>গেম টপআপ করার নিয়ম:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ১:</strong> আপনার গেমের Player ID বা UID সংগ্রহ করুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ২:</strong> Services পেজে গিয়ে আপনার গেমের টপআপ প্যাকেজ বেছে নিন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ৩:</strong> Player ID ও পরিমাণ দিয়ে অর্ডার দিন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>ধাপ ৪:</strong> পেমেন্ট করুন এবং কিছুক্ষণ অপেক্ষা করুন।</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>টপআপ সাধারণত <strong style="color:#00ff88;">১৫ মিনিটের</strong> মধ্যে সম্পন্ন হয়।</span></div>`+
`</div>`,true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='coupon'){
const tgSVG=`<svg width="13" height="13" viewBox="0 0 24 24" fill="#0088cc"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.54c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.374 14.51l-2.95-.924c-.64-.203-.654-.64.136-.948l11.52-4.44c.532-.194.998.13.482.95z"/></svg>`;
await botSay(
`কুপন কোড পেতে আমাদের Telegram গ্রুপে যোগ দিন।<br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item">${tgSVG}<span>সেখানে নিয়মিত কুপন কোড পোস্ট করা হয়।</span></div>`+
`<div class="float-answer-item">${tgSVG}<span>Special অফার ও ডিসকাউন্ট সবার আগে পাবেন।</span></div>`+
`</div><br>`+
`<a href="https://t.me/CuponCodeForRH" target="_blank" rel="noopener" `+
`style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(0,136,204,.15);border:1px solid rgba(0,136,204,.35);border-radius:10px;color:#4db8e8;font-size:.84rem;font-weight:800;text-decoration:none;">`+
`${tgSVG} Telegram গ্রুপে যোগ দিন</a>`,
true,900);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='agent'){
botState='agent_form';
await botSay('অনুগ্রহ করে নিচের ফর্মটি পূরণ করুন। Submit করলে একজন এজেন্ট শীঘ্রই যোগাযোগ করবেন।',false,750);
await new Promise(r=>setTimeout(r,300)); showAgentForm();
}
}
function showBackToMenu(){
showQuickButtons([
{label:'আরেকটি সমস্যা',action:()=>{ appendMsg('user','আরেকটি সমস্যা আছে',false); botSay('অবশ্যই! নিচের অপশন থেকে বেছে নিন।',false,500).then(()=>{ botState='menu'; showMainMenu(); }); }},
{label:'ধন্যবাদ, সাহায্য হয়েছে',action:()=>{ appendMsg('user','ধন্যবাদ',false); botSay('আপনাকে সাহায্য করতে পেরে ভালো লাগলো। আর কোনো সমস্যা হলে যোগাযোগ করুন।',false,700).then(()=>{ botState='wait_first_msg'; }); }},
]);
}
function openChat(){
isOpen=true; winEl.style.display='flex'; iconChat.style.display='none'; iconClose.style.display='';
unreadCount=0; badge.style.display='none'; badge.textContent='';
if(inputEl) setTimeout(()=>inputEl.focus(),60);
}
function closeChat(){
isOpen=false; winEl.style.display='none'; iconChat.style.display=''; iconClose.style.display='none';
}
async function sendUserMessage(){
if(!inputEl) return;
const text=inputEl.value.trim(); if(!text) return;
inputEl.value='';
appendMsg('user',text,false);
if(botState==='live'){
const uid=activeUserId||currentUser?.uid; if(!uid) return;
try{
await addDoc(collection(db,'supportChats',uid,'messages'),{text,role:'user',userId:uid,userEmail:currentUser?.email||'',createdAt:serverTimestamp()});
await updateDoc(doc(db,'supportRooms',uid),{lastMessage:text,lastAt:serverTimestamp(),unreadAdmin:increment(1)});
} catch(e){ appendMsg('admin','বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।',false); }
return;
}
if(botState==='wait_first_msg'){ startBotFlow(); return; }
if(botState==='menu'){ await botSay('অনুগ্রহ করে নিচের অপশন থেকে বেছে নিন।',false,600); showMainMenu(); return; }
await botSay('আপনার বার্তা পেয়েছি। নিচের অপশন থেকে সমস্যাটি বেছে নিন।',false,700); botState='menu'; showMainMenu();
}
toggle.addEventListener('click',()=>isOpen?closeChat():openChat());
closeBtn.addEventListener('click',closeChat);
sendBtn?.addEventListener('click',sendUserMessage);
inputEl?.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();sendUserMessage();} });
onAuthStateChanged(auth,user=>{ currentUser=user; });
})();
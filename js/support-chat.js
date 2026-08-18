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
w.innerHTML=`<div class="float-msg-bubble float-waiting-bubble"><div class="float-waiting-inner"><div class="float-wait-ring"><svg width="22" height="22" viewBox="0 0 50 50" fill="none"><circle cx="25" cy="25" r="20" stroke="rgba(255, 255, 255,.2)" stroke-width="4"/><circle cx="25" cy="25" r="20" stroke="#ffffff" stroke-width="4" stroke-dasharray="60 66" stroke-linecap="round" class="float-wait-arc"/></svg></div><span class="float-waiting-text">Connecting to an agent</span></div><div class="float-wait-dots"><span class="float-typing-dot"></span><span class="float-typing-dot"></span><span class="float-typing-dot"></span></div></div>`;
msgsEl.appendChild(w); msgsEl.scrollTop=msgsEl.scrollHeight;
}
function setInputLocked(locked,ph){
if(inputEl){ inputEl.disabled=locked; inputEl.placeholder=ph||'Type a message...'; }
if(sendBtn) sendBtn.disabled=locked;
}
function showAgentForm(){
document.getElementById('floatAgentForm')?.remove();
const ticketId=genTicketId(), displayName=currentUser?.displayName||'', email=currentUser?.email||'';
const wrap=document.createElement('div'); wrap.className='float-agent-form-wrap'; wrap.id='floatAgentForm';
wrap.innerHTML=`
<div class="float-form-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Talk to an agent</div>
<div class="float-form-ticket-id"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Ticket: <strong>${ticketId}</strong></div>
<input class="float-form-input" type="text" id="afName" placeholder="Your name *" value="${esc(displayName)}" />
<input class="float-form-input" type="email" id="afEmail" placeholder="Gmail / Email *" value="${esc(email)}" />
<input class="float-form-input" type="tel" id="afPhone" placeholder="Phone number *" />
<textarea class="float-form-input float-form-textarea" id="afProblem" placeholder="Briefly describe your problem *" rows="3"></textarea>
<div class="float-form-ticket-note">Save this: <code>${ticketId}</code></div>
<button type="button" class="float-form-submit" id="afSubmit">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Submit
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
if(submitEl){ const orig=submitEl.innerHTML; submitEl.textContent='Fill in all fields!'; submitEl.style.cssText='background:rgba(255,80,80,.2);border-color:rgba(255,80,80,.5);'; setTimeout(()=>{ submitEl.innerHTML=orig; submitEl.style.cssText=''; },2200); } return;
}
if(submitEl){ submitEl.disabled=true; submitEl.textContent='Submitting...'; }
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
});
document.getElementById('floatAgentForm')?.remove();
botState='agent_waiting';
await botSay('Please wait while your issue is transferred to an agent',false,600);
showWaitingAnimation();
setInputLocked(true,'Waiting for an agent...');
subscribeToAdminReplies(userId);
} catch(err){

if(submitEl){ submitEl.disabled=false; submitEl.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Try again`; }
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
botState='live'; setInputLocked(false,'Type a message...');
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
appendMsg('admin','Your issue has been resolved. Thank you for using RabbiHossainLTD.',false);
const inputArea=document.getElementById('floatChatInputArea')||inputEl?.parentElement;
if(inputEl) inputEl.style.display='none';
if(sendBtn) sendBtn.style.display='none';
document.getElementById('floatNewChatBtn')?.remove();
const ncBtn=document.createElement('button');
ncBtn.type='button'; ncBtn.id='floatNewChatBtn';
ncBtn.textContent='Start a new chat';
ncBtn.style.cssText='width:100%;padding:10px;background:rgba(255, 255, 255,.12);border:1px solid rgba(255, 255, 255,.3);border-radius:10px;color:#e4e4e0;font-size:.85rem;font-weight:700;cursor:pointer;margin-top:4px;';
ncBtn.addEventListener('click',()=>{
if(unsubMessages){ unsubMessages(); unsubMessages=null; }
msgsEl.innerHTML='';
botState='wait_first_msg';
activeUserId=null;
ncBtn.remove();
if(inputEl){ inputEl.style.display=''; inputEl.value=''; inputEl.disabled=false; inputEl.placeholder='Type a message...'; }
if(sendBtn){ sendBtn.style.display=''; sendBtn.disabled=false; }
});
if(inputArea) inputArea.appendChild(ncBtn);
else msgsEl.appendChild(ncBtn);
}
async function startBotFlow(){
botState='greeted';
await botSay('Assalamu Alaikum, welcome to RabbiHossainLTD. How can I help you?',false,900);
await new Promise(r=>setTimeout(r,350));
await botSay('Select your issue from the options below',false,700);
botState='menu'; showMainMenu();
}
function showMainMenu(){
showQuickButtons([
{label:'How do I make a payment?', action:()=>handleChoice('payment')},
{label:'How do I buy an app?', action:()=>handleChoice('app')},
{label:'How do I top up in a game?', action:()=>handleChoice('topup')},
{label:'How do I get a coupon code?', action:()=>handleChoice('coupon')},
{label:'Talk to an agent', action:()=>handleChoice('agent')},
]);
}
const LABELS={payment:'How do I make a payment?',app:'How do I buy an app?',topup:'How do I top up in a game?',coupon:'How do I get a coupon code?',agent:'Talk to an agent'};
async function handleChoice(choice){
appendMsg('user',LABELS[choice],false); botState='answering';
if(choice==='payment'){
await botSay(
`<strong>How to pay:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div style="color:#c4c4c2;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-family:'Outfit',sans-serif;">Mobile Banking</div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>bKash</strong> — open the Add Credit page &rarr; select bKash &rarr; Send Money to the number shown &rarr; Verify with your Transaction ID.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Nagad</strong> — open the Add Credit page &rarr; select Nagad &rarr; Send Money to the number shown &rarr; Verify with your Transaction ID.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Rocket</strong> — open the Add Credit page &rarr; select Rocket &rarr; Send Money to the number shown &rarr; Verify with your Transaction ID.</span></div>`+
`<div style="color:#f3ba2f;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin:10px 0 8px;font-family:'Outfit',sans-serif;">Crypto</div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0b90b" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>Binance Pay</strong> — Add Credit &rarr; Crypto &rarr; Binance Pay &rarr; pay via QR Scan or App &rarr; Verify with your Order ID.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span><strong>USDT (BSC/TRX/ETH/SOL/TON)</strong> — Add Credit &rarr; Crypto &rarr; Coin &rarr; choose the network, send to the address shown &rarr; Verify with your TxHash.</span></div>`+
`</div>`,
true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='app'){
await botSay(
`<strong>Steps to buy an app:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 1:</strong> find your desired service on the Services page.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 2:</strong> click the "Get Now" button.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 3:</strong> fill in the required information and place the order.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 4:</strong> make the payment and share your Transaction ID.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>Usually <strong style="color:#ffffff;">delivered within 5–30 minutes.</span></div>`+
`</div>`,true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='topup'){
await botSay(
`<strong>How to top up a game:</strong><br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 1:</strong> collect your game Player ID or UID.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 2:</strong> choose your top-up package on the Services page.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 3:</strong> Place the order with your Player ID and amount.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span><strong>Step 4:</strong> make the payment and wait a moment.</span></div>`+
`<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span>Top-ups are usually <strong style="color:#ffffff;">completed within 15 minutes.</span></div>`+
`</div>`,true,950);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='coupon'){
const tgSVG=`<svg width="13" height="13" viewBox="0 0 24 24" fill="#0088cc"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.54c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.374 14.51l-2.95-.924c-.64-.203-.654-.64.136-.948l11.52-4.44c.532-.194.998.13.482.95z"/></svg>`;
await botSay(
`Join our Telegram group to get coupon codes.<br><br>`+
`<div class="float-answer-list">`+
`<div class="float-answer-item">${tgSVG}<span>Coupon codes are posted there regularly.</span></div>`+
`<div class="float-answer-item">${tgSVG}<span>Get special offers and discounts before everyone else.</span></div>`+
`</div><br>`+
`<a href="https://t.me/CuponCodeForRH" target="_blank" rel="noopener" `+
`style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:rgba(255, 255, 255,.15);border:1px solid rgba(255, 255, 255,.35);border-radius:10px;color:#a0a09c;font-size:.84rem;font-weight:800;text-decoration:none;">`+
`${tgSVG} Join our Telegram group</a>`,
true,900);
await new Promise(r=>setTimeout(r,350)); showBackToMenu();
} else if(choice==='agent'){
botState='agent_form';
await botSay('Please fill out the form below. An agent will contact you shortly after you submit.',false,750);
await new Promise(r=>setTimeout(r,300)); showAgentForm();
}
}
function showBackToMenu(){
showQuickButtons([
{label:'Another issue',action:()=>{ appendMsg('user','I have another issue',false); botSay('Of course! Choose from the options below.',false,500).then(()=>{ botState='menu'; showMainMenu(); }); }},
{label:'Thank you, that helped',action:()=>{ appendMsg('user','Thank you',false); botSay('Glad I could help. Contact us again if you have any other issues.',false,700).then(()=>{ botState='wait_first_msg'; }); }},
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
} catch(e){ appendMsg('admin','Message could not be sent. Try again.',false); }
return;
}
if(botState==='wait_first_msg'){ startBotFlow(); return; }
if(botState==='menu'){ await botSay('Please choose from the options below.',false,600); showMainMenu(); return; }
await botSay('I received your message. Choose your issue from the options below.',false,700); botState='menu'; showMainMenu();
}
toggle.addEventListener('click',()=>isOpen?closeChat():openChat());
closeBtn.addEventListener('click',closeChat);
sendBtn?.addEventListener('click',sendUserMessage);
inputEl?.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();sendUserMessage();} });
onAuthStateChanged(auth,user=>{ currentUser=user; });
})();
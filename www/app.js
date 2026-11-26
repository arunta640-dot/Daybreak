(()=>{
'use strict';
/* ================= helpers ================= */
const $=(s,e=document)=>e.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const dstr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pd=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(k,n)=>{const d=pd(k);d.setDate(d.getDate()+n);return dstr(d)};
const today=()=>dstr(new Date());
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DL=['S','M','T','W','T','F','S'];
const fmtT=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return`${((h+11)%12)+1}:${pad(m)} ${h<12?'AM':'PM'}`};
const fmtD=k=>{
  const t=today();if(k===t)return'Today';if(k===addDays(t,1))return'Tomorrow';if(k===addDays(t,-1))return'Yesterday';
  const d=pd(k),o={month:'short',day:'numeric'};if(d.getFullYear()!==new Date().getFullYear())o.year='numeric';
  return d.toLocaleDateString(undefined,o);
};
function h(tag,attrs,...kids){
  const e=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs||{})){
    if(v==null||v===false)continue;
    if(k==='class')e.className=v;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,'');
    else e.setAttribute(k,v);
  }
  for(const c of kids.flat(2))if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(c));
  return e;
}
const NS='http://www.w3.org/2000/svg';
const I=d=>{const s=document.createElementNS(NS,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','ic');s.innerHTML=d;return s};
const ICONS={
  today:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  upcoming:'<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  lists:'<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  insights:'<path d="M5 20V11M12 20V4M19 20v-7"/>',
  settings:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'
};
const buzz=()=>{try{navigator.vibrate&&navigator.vibrate(8)}catch{}};

/* ================= state ================= */
const KEY='daybreak.v2';
const defaults=()=>({v:2,
  lists:[{id:'inbox',name:'Inbox',emoji:'📥',color:'#6366f1'},{id:'work',name:'Work',emoji:'💼',color:'#0ea5e9'},{id:'personal',name:'Personal',emoji:'🏡',color:'#f97316'}],
  tasks:[],routines:[],log:{},
  settings:{theme:'auto',accent:'indigo',name:'',notify:true,summaryOn:true,summaryTime:'08:00'}});
let S=load();
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===2){const d=defaults();return{...d,...s,settings:{...d.settings,...(s.settings||{})}}}}catch{}
  return defaults();
}
let saveT=null;
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}
  clearTimeout(saveT);saveT=setTimeout(()=>queueSync(false),500);
}
const V={view:'today',listId:null,filter:'active',sort:'due',q:''};
const ACC={indigo:'#5b5bf0',violet:'#8b5cf6',rose:'#f43f5e',orange:'#f97316',teal:'#0d9488',emerald:'#10a36b',sky:'#0ea5e9'};
const PR=['None','Low','Medium','High'];
const PCOL=['var(--muted)','var(--info)','var(--warn)','var(--bad)'];
const REP={'':'Does not repeat',daily:'Every day',weekdays:'Weekdays',weekly:'Every week',monthly:'Every month'};
const REPS={daily:'Daily',weekdays:'Weekdays',weekly:'Weekly',monthly:'Monthly'};
const listOf=id=>S.lists.find(l=>l.id===id)||S.lists[0];

/* ================= domain logic ================= */
const schedOn=(r,k)=>r.days.includes(pd(k).getDay());
const doneOn=(r,k)=>r.history.includes(k);
function streaks(r){
  let run=0,best=0;const t=today();
  for(let i=365;i>=0;i--){
    const k=addDays(t,-i);if(!schedOn(r,k))continue;
    if(doneOn(r,k)){run++;best=Math.max(best,run)}else if(k!==t)run=0;
  }
  return{cur:run,best};
}
const snap=()=>JSON.stringify(S);
function undoable(msg,before){showToast(msg,()=>{S=JSON.parse(before);save();render()})}
function bumpLog(k,n){S.log[k]=Math.max(0,(S.log[k]||0)+n);if(!S.log[k])delete S.log[k]}
function nextDue(t){
  const td=today();let d=t.due||td;
  const step=x=>{
    switch(t.repeat){
      case'daily':return addDays(x,1);
      case'weekdays':{let y=addDays(x,1);while([0,6].includes(pd(y).getDay()))y=addDays(y,1);return y}
      case'weekly':return addDays(x,7);
      case'monthly':{const o=pd(x),n=new Date(o.getFullYear(),o.getMonth()+1,1),last=new Date(n.getFullYear(),n.getMonth()+1,0).getDate();n.setDate(Math.min(o.getDate(),last));return dstr(n)}
    }
    return addDays(x,1);
  };
  let g=0;do{d=step(d)}while(d<=td&&++g<800);
  return d;
}
function toggleTask(id,done){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  const before=snap(),k=today();
  if(done&&t.repeat){
    bumpLog(k,1);t.due=nextDue(t);(t.subtasks||[]).forEach(s=>s.done=false);
    save();render();undoable('Done · repeats '+fmtD(t.due).toLowerCase(),before);return;
  }
  if(done){bumpLog(k,1);t.done=true;t.doneAt=Date.now()}
  else{if(t.doneAt)bumpLog(dstr(new Date(t.doneAt)),-1);t.done=false;t.doneAt=null}
  save();render();
  if(done)undoable('Task completed',before);
}
function toggleRoutine(id,done){
  const r=S.routines.find(x=>x.id===id);if(!r)return;
  const k=today();r.history=r.history.filter(x=>x!==k);
  if(done)r.history.push(k);
  r.history.sort();r.history=r.history.slice(-400);
  save();render();
}
function doneByKey(key){
  const[kind,id]=key.split(':');
  if(kind==='r')toggleRoutine(id,true);else if(kind==='t')toggleTask(id,true);
}
const cmpTask=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||(a.time||'99:99').localeCompare(b.time||'99:99')||(b.priority-a.priority)||(b.created-a.created);

/* ================= quick-add parser ================= */
function parseQuick(raw){
  let s=' '+raw.replace(/\s+/g,' ')+' ';const o={found:[]},td=today(),now=new Date();
  const grab=(re,cb)=>{const m=re.exec(s);if(!m)return;if(cb(m)!==false)s=s.slice(0,m.index)+' '+s.slice(m.index+m[0].length)};
  grab(/\s#([\w-]+)(?=\s)/i,m=>{const q=m[1].toLowerCase(),l=S.lists.find(x=>x.name.toLowerCase().startsWith(q));if(!l)return false;o.list=l.id;o.found.push(l.emoji+' '+l.name)});
  grab(/\s!(high|medium|med|low|h|m|l|1|2|3)(?=\s)/i,m=>{o.priority={high:3,h:3,1:3,medium:2,med:2,m:2,2:2,low:1,l:1,3:1}[m[1].toLowerCase()];o.found.push('❗ '+PR[o.priority])});
  grab(/\s(every ?day|daily|weekdays|every ?week|weekly|every ?month|monthly)(?=\s)/i,m=>{o.repeat={everyday:'daily',daily:'daily',weekdays:'weekdays',everyweek:'weekly',weekly:'weekly',everymonth:'monthly',monthly:'monthly'}[m[1].toLowerCase().replace(/\s/g,'')];o.found.push('🔁 '+REPS[o.repeat])});
  grab(/\s(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)(?=\s)/i,m=>{let hr=+m[1];if(hr<1||hr>12)return false;const pm=m[3].toLowerCase()==='pm';hr=hr%12+(pm?12:0);o.time=`${pad(hr)}:${m[2]||'00'}`;o.found.push('⏰ '+fmtT(o.time))});
  if(!o.time)grab(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/,m=>{o.time=`${pad(+m[1])}:${m[2]}`;o.found.push('⏰ '+fmtT(o.time))});
  grab(/\sin (\d{1,3}) (day|days|week|weeks)(?=\s)/i,m=>{o.due=addDays(td,+m[1]*(m[2][0].toLowerCase()==='w'?7:1))});
  if(!o.due)grab(/\s(today|tod|tomorrow|tmrw|tmr)(?=\s)/i,m=>{o.due=/^to(d|day)$/i.test(m[1])?td:addDays(td,1)});
  if(!o.due)grab(/\s(?:on\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thu|fri|sat)(?=\s)/i,m=>{
    const i=['sun','mon','tue','wed','thu','fri','sat'].indexOf(m[1].slice(0,3).toLowerCase());let d=addDays(td,1);while(pd(d).getDay()!==i)d=addDays(d,1);o.due=d});
  if(o.due)o.found.unshift('📅 '+fmtD(o.due));
  if(o.time&&!o.due){const[hh,mm]=o.time.split(':').map(Number);o.due=(hh*60+mm>now.getHours()*60+now.getMinutes())?td:addDays(td,1);o.found.unshift('📅 '+fmtD(o.due))}
  o.title=s.trim().replace(/\s+/g,' ');
  return o;
}

/* ================= reminders ================= */
const Cap=window.Capacitor;
const native=!!(Cap&&Cap.isNativePlatform&&Cap.isNativePlatform());
let LN=null;
if(native){try{LN=(Cap.Plugins&&Cap.Plugins.LocalNotifications)||Cap.registerPlugin('LocalNotifications')}catch{}}
const nid=s=>{let x=5381;for(let i=0;i<s.length;i++)x=((x*33)^s.charCodeAt(i))>>>0;return(x>>>1)%2000000000+100};
let lastSig='',syncQ=Promise.resolve();
function queueSync(force){if(LN)syncQ=syncQ.then(()=>doSync(force)).catch(()=>{})}
async function doSync(force){
  const td=today();
  const sig=JSON.stringify([td,S.settings.notify,S.settings.summaryOn,S.settings.summaryTime,
    S.routines.map(r=>[r.id,r.title,r.time,r.days,doneOn(r,td)]),
    S.tasks.filter(t=>!t.done&&t.time&&t.due&&t.remind).map(t=>[t.id,t.title,t.due,t.time,t.list])]);
  if(!force&&sig===lastSig)return;
  try{
    const pend=await LN.getPending();
    if(pend.notifications.length)await LN.cancel({notifications:pend.notifications});
    lastSig=sig;
    const perm=await LN.checkPermissions();
    if(perm.display!=='granted'||!S.settings.notify)return;
    const now=Date.now(),list=[];
    if(S.settings.summaryOn&&S.settings.summaryTime){
      const[sh,sm]=S.settings.summaryTime.split(':').map(Number);
      list.push({id:1,title:'Good morning ☀️',body:"Open Daybreak to see today's plan",schedule:{on:{hour:sh,minute:sm},allowWhileIdle:true}});
    }
    for(const r of S.routines){
      if(!r.time)continue;const[hh,mm]=r.time.split(':').map(Number);
      for(let i=0;i<14;i++){
        const k=addDays(td,i);if(!schedOn(r,k)||doneOn(r,k))continue;
        const at=pd(k);at.setHours(hh,mm,0,0);if(at.getTime()<now+3000)continue;
        list.push({id:nid('r:'+r.id+k),title:'⏰ '+r.title,body:'Daily routine · '+fmtT(r.time),schedule:{at,allowWhileIdle:true}});
      }
    }
    for(const t of S.tasks){
      if(t.done||!t.due||!t.time||!t.remind)continue;
      const[hh,mm]=t.time.split(':').map(Number),at=pd(t.due);at.setHours(hh,mm,0,0);if(at.getTime()<now+3000)continue;
      list.push({id:nid('t:'+t.id),title:t.title,body:listOf(t.list).name+' · '+fmtT(t.time),schedule:{at,allowWhileIdle:true}});
    }
    list.splice(450);
    if(list.length)await LN.schedule({notifications:list});
  }catch(e){lastSig=''}
}
async function askPerm(){
  if(LN){try{await LN.requestPermissions()}catch{}queueSync(true);render();return}
  if('Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission()}catch{}}
  render();
}
const permState=()=>LN?'Android alarms':('Notification'in window?Notification.permission:'unsupported');
async function webNotify(title,body,tag,key){
  if(!S.settings.notify||!('Notification'in window)||Notification.permission!=='granted')return false;
  try{
    const reg=navigator.serviceWorker&&await navigator.serviceWorker.ready;
    if(reg){await reg.showNotification(title,{body,tag,icon:'icon-192.png',badge:'icon-192.png',renotify:true,data:{key},actions:key?[{action:'done',title:'Mark done'}]:[]});return true}
  }catch{}
  try{new Notification(title,{body,tag,icon:'icon-192.png'});return true}catch{}
  return false;
}
const firedKey='daybreak.fired';
function fired(){try{return JSON.parse(localStorage.getItem(firedKey))||{}}catch{return{}}}
function markFired(f){try{localStorage.setItem(firedKey,JSON.stringify(f))}catch{}}
let lastDay=today();
function tick(){
  const now=new Date(),td=dstr(now),t=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if(td!==lastDay){lastDay=td;render();queueSync(true)}
  if(LN)return;
  const f=fired();for(const k of Object.keys(f))if(!k.endsWith(td))delete f[k];
  const go=(k,fn)=>{if(!f[k]){f[k]=1;fn()}};
  for(const r of S.routines)if(r.time&&schedOn(r,td)&&!doneOn(r,td)&&t>=r.time)go('r:'+r.id+'@'+td,()=>webNotify('⏰ '+r.title,'Daily routine · '+fmtT(r.time),'r'+r.id,'r:'+r.id));
  for(const x of S.tasks)if(!x.done&&x.remind&&x.time&&x.due===td&&t>=x.time)go('t:'+x.id+'@'+x.time+'@'+td,()=>webNotify(x.title,listOf(x.list).name+' · '+fmtT(x.time),'t'+x.id,'t:'+x.id));
  if(S.settings.summaryOn&&t>=S.settings.summaryTime)go('sum@'+td,()=>{
    const left=[...S.routines.filter(r=>schedOn(r,td)&&!doneOn(r,td)).map(r=>r.title),...S.tasks.filter(x=>!x.done&&x.due&&x.due<=td).map(x=>x.title)];
    if(left.length)webNotify(`Today: ${left.length} to do`,left.slice(0,4).join(' · ')+(left.length>4?' …':''),'summary');
  });
  markFired(f);
}

/* ================= toast ================= */
let toastT=null;
function showToast(msg,undo){
  $('#toastMsg').textContent=msg;const b=$('#toastBtn');
  b.classList.toggle('hidden',!undo);b.onclick=()=>{$('#toast').classList.remove('show');undo&&undo()};
  $('#toast').classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>$('#toast').classList.remove('show'),undo?5000:2200);
}

/* ================= rendering ================= */
function applyTheme(){
  const r=document.documentElement,st=S.settings;
  if(st.theme==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',st.theme);
  r.setAttribute('data-accent',st.accent);
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=ACC[st.accent]||'#5b5bf0';
}
const NAV=[['today','Today'],['upcoming','Upcoming'],['lists','Lists'],['insights','Insights'],['settings','Settings']];
function render(){
  applyTheme();
  const td=today();
  const overdue=S.tasks.filter(t=>!t.done&&t.due&&t.due<td).length;
  const nav=$('#nav');nav.replaceChildren(...NAV.map(([k,l])=>{
    const on=V.view===k||(V.view==='list'&&k==='lists');
    return h('button',{class:on?'on':'',onclick:()=>{V.view=k;V.q='';scrollTo(0,0);render()}},I(ICONS[k]),l,k==='today'&&overdue?h('span',{class:'badge'},overdue):null);
  }));
  renderHead();
  const m=$('#main');m.replaceChildren();
  ({today:rToday,upcoming:rUpcoming,lists:rLists,list:rList,insights:rInsights,settings:rSettings})[V.view](m);
  $('#fab').classList.toggle('hidden',V.view==='settings'||V.view==='insights');
}
function greet(){const hr=new Date().getHours();return`Good ${hr<5?'night':hr<12?'morning':hr<18?'afternoon':'evening'}${S.settings.name?', '+S.settings.name:''}`}
function renderHead(){
  const hd=$('#head');hd.replaceChildren();
  const open=S.tasks.filter(t=>!t.done).length;
  if(V.view==='list'){
    const all=V.listId==='all',l=all?{name:'All tasks',emoji:'🗂️'}:listOf(V.listId);
    hd.append(h('div',{class:'hl'},h('button',{class:'back','aria-label':'Back',onclick:()=>{V.view='lists';render()}},I(ICONS.back)),
      h('div',{},h('div',{class:'eyebrow'},'List'),h('h1',{},l.emoji+' '+l.name))));
    if(!all)hd.append(h('button',{class:'back','aria-label':'Edit list',onclick:()=>openList(l)},I(ICONS.edit)));
    return;
  }
  const eyebrow={today:new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}),
    upcoming:'What’s coming up',lists:open+' open task'+(open===1?'':'s'),insights:'Your progress',settings:'Make it yours'}[V.view];
  const title=V.view==='today'?greet():{upcoming:'Upcoming',lists:'Lists',insights:'Insights',settings:'Settings'}[V.view];
  hd.append(h('div',{},h('div',{class:'eyebrow'},eyebrow),h('h1',{},title)));
}
const sec=(title,count,extra)=>h('div',{class:'sec'},h('h2',{},title),h('div',{style:'display:flex;gap:8px;align-items:center'},extra||null,count!=null?h('span',{class:'cnt'},count):null));
const card=rows=>h('div',{class:'card'},rows);
const empty=(em,t,s,btn)=>h('div',{class:'card'},h('div',{class:'empty'},h('div',{class:'em'},em),h('b',{},t),s,btn?h('div',{style:'margin-top:14px'},btn):null));
const linkBtn=(txt,fn)=>h('button',{class:'tag acc',style:'border:0;cursor:pointer',onclick:fn},txt);

function taskRow(t,o={}){
  const td=today(),l=listOf(t.list),over=!t.done&&t.due&&t.due<td,subs=t.subtasks||[],sd=subs.filter(s=>s.done).length;
  const tags=[];
  if(!o.hideList)tags.push(h('span',{class:'tag'},h('i',{class:'dot',style:'background:'+l.color}),l.name));
  if(t.due&&!o.hideDue)tags.push(h('span',{class:'tag '+(over?'bad':t.due===td?'warn':'')},'📅 '+fmtD(t.due)));
  if(t.time)tags.push(h('span',{class:'tag'+(over?' bad':'')},'⏰ '+fmtT(t.time)));
  if(t.repeat)tags.push(h('span',{class:'tag acc'},'🔁 '+REPS[t.repeat]));
  if(subs.length)tags.push(h('span',{class:'tag'+(sd===subs.length?' ok':'')},'✓ '+sd+'/'+subs.length));
  return h('div',{class:'row'+(t.done?' done':'')},
    t.priority&&!t.done?h('i',{class:'bar',style:'background:'+PCOL[t.priority]}):null,
    h('input',{type:'checkbox',class:'chk p'+t.priority,checked:t.done,'aria-label':'Complete task',onchange:e=>{buzz();toggleTask(t.id,e.target.checked)}}),
    h('div',{class:'main',onclick:()=>openTask(t)},h('div',{class:'ttl'},t.title),
      t.notes?h('div',{class:'notes'},t.notes):null,tags.length?h('div',{class:'meta'},tags):null));
}
function routineRow(r){
  const td=today(),done=doneOn(r,td),s=streaks(r).cur,tags=[];
  if(r.time)tags.push(h('span',{class:'tag'},'⏰ '+fmtT(r.time)));
  if(r.days.length<7)tags.push(h('span',{class:'tag'},r.days.length===5&&![0,6].some(d=>r.days.includes(d))?'Weekdays':r.days.map(d=>DOW[d]).join(' ')));
  if(s>1)tags.push(h('span',{class:'tag ok'},'🔥 '+s+' days'));
  return h('div',{class:'row'+(done?' done':'')},
    h('input',{type:'checkbox',class:'chk',checked:done,'aria-label':'Complete routine',onchange:e=>{buzz();toggleRoutine(r.id,e.target.checked)}}),
    h('div',{class:'main',onclick:()=>openRoutine(r)},h('div',{class:'ttl'},r.title),tags.length?h('div',{class:'meta'},tags):null));
}
function ringSvg(done,total){
  const r=32,c=2*Math.PI*r,p=total?done/total:0;
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 78 78');svg.setAttribute('width',78);svg.setAttribute('height',78);svg.style.transform='rotate(-90deg)';
  const mk=(st,off)=>{const e=document.createElementNS(NS,'circle');e.setAttribute('cx',39);e.setAttribute('cy',39);e.setAttribute('r',r);e.setAttribute('fill','none');e.setAttribute('stroke-width',8);e.setAttribute('stroke',st);if(off!=null){e.setAttribute('stroke-dasharray',c);e.setAttribute('stroke-dashoffset',off);e.setAttribute('stroke-linecap','round')}return e};
  svg.append(mk('rgba(255,255,255,.28)'),mk('#fff',c*(1-p)));
  return h('div',{class:'ring'},svg,h('div',{class:'pct'},total?Math.round(p*100)+'%':'–'));
}

function rToday(m){
  const td=today(),nowT=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  const rs=S.routines.filter(r=>schedOn(r,td)).sort((a,b)=>doneOn(a,td)-doneOn(b,td)||(a.time||'99:99').localeCompare(b.time||'99:99'));
  const due=S.tasks.filter(t=>!t.done&&t.due&&t.due<=td).sort(cmpTask);
  const doneT=S.tasks.filter(t=>t.done&&t.doneAt&&dstr(new Date(t.doneAt))===td);
  const left=rs.filter(r=>!doneOn(r,td)).length+due.length;
  const nDone=(S.log[td]||0)+rs.filter(r=>doneOn(r,td)).length,total=nDone+left;
  const timed=[...rs.filter(r=>!doneOn(r,td)&&r.time).map(r=>({t:r.title,time:r.time})),...due.filter(x=>x.time&&x.due===td).map(x=>({t:x.title,time:x.time}))].sort((a,b)=>a.time.localeCompare(b.time));
  const nxt=timed.find(x=>x.time>=nowT)||null;
  const big=!total?'A fresh day':left?`${left} left to do`:'All done for today 🎉';
  const sm=!total?'Add a routine or task to get started.':nxt?`Next: ${nxt.t} · ${fmtT(nxt.time)}`:left?'You’ve got this.':`${nDone} completed. Enjoy the rest of your day.`;
  m.append(h('div',{class:'hero'},h('div',{class:'hin'},ringSvg(nDone,total),h('div',{},h('div',{class:'big'},big),h('div',{class:'sm'},sm)))));
  if(!LN&&'Notification'in window&&Notification.permission==='default'&&S.settings.notify&&(S.routines.some(r=>r.time)||S.tasks.some(t=>t.time)))
    m.append(h('div',{class:'banner'},h('span',{},'Turn on notifications to get your reminders.'),h('button',{class:'btn primary',onclick:askPerm},'Enable')));
  m.append(sec('Daily routine',rs.length||null,linkBtn('+ Add',()=>openRoutine(null))));
  m.append(rs.length?card(rs.map(routineRow)):empty('🌅',S.routines.length?'Nothing scheduled today':'Build your daily routine','Things you repeat every day — they reset at midnight.',S.routines.length?null:h('button',{class:'btn primary',onclick:()=>openRoutine(null)},'Add a routine')));
  if(due.length){m.append(sec('Tasks for today',due.length));m.append(card(due.map(t=>taskRow(t))))}
  if(doneT.length){m.append(sec('Completed today',doneT.length));m.append(card(doneT.map(t=>taskRow(t,{hideDue:true}))))}
}
function rUpcoming(m){
  const td=today(),ts=S.tasks.filter(t=>!t.done&&t.due&&t.due>td).sort(cmpTask);
  if(!ts.length){m.append(h('div',{style:'height:16px'}),empty('🗓️','Nothing scheduled ahead','Give a task a due date and it will show up here.',h('button',{class:'btn primary',onclick:()=>openTask(null,{due:addDays(td,1)})},'Plan a task')));return}
  const g={};ts.forEach(t=>(g[t.due]=g[t.due]||[]).push(t));
  Object.keys(g).sort().forEach(k=>{
    const lab=k===addDays(td,1)?'Tomorrow':pd(k).toLocaleDateString(undefined,{weekday:'long'});
    m.append(sec(lab+' · '+pd(k).toLocaleDateString(undefined,{month:'short',day:'numeric'}),g[k].length));
    m.append(card(g[k].map(t=>taskRow(t,{hideDue:true}))));
  });
}
function rLists(m){
  const input=h('input',{type:'text',placeholder:'Search all tasks',value:V.q,'aria-label':'Search',oninput:e=>{V.q=e.target.value;draw()}});
  m.append(h('div',{class:'search'},I(ICONS.search),input));
  const res=h('div');m.append(res);
  const open=id=>S.tasks.filter(t=>!t.done&&(id==='all'||t.list===id)).length;
  function draw(){
    res.replaceChildren();const q=V.q.trim().toLowerCase();
    if(q){
      const hits=S.tasks.filter(t=>(t.title+' '+(t.notes||'')+' '+(t.subtasks||[]).map(s=>s.t).join(' ')).toLowerCase().includes(q)).sort((a,b)=>a.done-b.done||cmpTask(a,b));
      res.append(sec('Results',hits.length),hits.length?card(hits.map(t=>taskRow(t))):empty('🔍','No matches','Try a different word.'));return;
    }
    const go=id=>()=>{V.view='list';V.listId=id;V.filter='active';scrollTo(0,0);render()};
    const lc=(emoji,color,name,n,fn)=>h('button',{class:'lcard',onclick:fn},h('div',{class:'ico',style:`background:color-mix(in srgb,${color} 16%,transparent)`},emoji),h('div',{},h('div',{class:'nm'},name),h('div',{class:'ct'},n+' open')));
    res.append(sec('Your lists'),h('div',{class:'grid'},
      lc('🗂️','var(--accent)','All tasks',open('all'),go('all')),
      S.lists.map(l=>lc(l.emoji,l.color,l.name,open(l.id),go(l.id))),
      h('button',{class:'lcard add',onclick:()=>openList(null)},h('div',{style:'font-size:26px;line-height:1'},'+'),'New list')));
  }
  draw();
}
function rList(m){
  const all=V.listId==='all';
  const items=S.tasks.filter(t=>(all||t.list===V.listId)&&(V.filter==='all'||(V.filter==='done')===t.done));
  const sorters={due:(a,b)=>a.done-b.done||cmpTask(a,b),priority:(a,b)=>a.done-b.done||(b.priority-a.priority)||cmpTask(a,b),created:(a,b)=>b.created-a.created,title:(a,b)=>a.title.localeCompare(b.title)};
  items.sort(sorters[V.sort]);
  m.append(h('div',{class:'chips'},[['active','Active'],['done','Done'],['all','All']].map(([k,l])=>h('button',{class:'chip'+(V.filter===k?' on':''),onclick:()=>{V.filter=k;render()}},l)),
    h('select',{'aria-label':'Sort',onchange:e=>{V.sort=e.target.value;render()}},[['due','Sort: Due date'],['priority','Sort: Priority'],['created','Sort: Newest'],['title','Sort: A–Z']].map(([v,l])=>h('option',{value:v,selected:V.sort===v},l)))));
  m.append(h('div',{style:'height:12px'}));
  m.append(items.length?card(items.map(t=>taskRow(t,{hideList:!all}))):empty(V.filter==='done'?'🏁':'✨',V.filter==='done'?'Nothing completed yet':'All clear','Tap + to add a task.'));
  if(S.tasks.some(t=>t.done&&(all||t.list===V.listId)))
    m.append(h('div',{style:'text-align:center;margin-top:18px'},h('button',{class:'btn danger',onclick:()=>{if(!confirm('Delete completed tasks'+(all?'':' in this list')+'?'))return;const b=snap();S.tasks=S.tasks.filter(t=>!(t.done&&(all||t.list===V.listId)));save();render();undoable('Cleared completed',b)}},'Clear completed')));
}
function rInsights(m){
  const td=today();
  const act=k=>(S.log[k]||0)+S.routines.filter(r=>doneOn(r,k)).length;
  const week=Array.from({length:7},(_,i)=>addDays(td,i-6));
  const wTotal=week.reduce((n,k)=>n+act(k),0);
  let sched=0,did=0;S.routines.forEach(r=>week.forEach(k=>{if(schedOn(r,k)){sched++;if(doneOn(r,k))did++}}));
  const best=S.routines.reduce((n,r)=>Math.max(n,streaks(r).cur),0);
  const open=S.tasks.filter(t=>!t.done).length,over=S.tasks.filter(t=>!t.done&&t.due&&t.due<td).length;
  m.append(h('div',{class:'tiles'},
    h('div',{class:'tile'},h('div',{class:'v'},wTotal),h('div',{class:'l'},'Completed this week')),
    h('div',{class:'tile'},h('div',{class:'v'},sched?Math.round(did/sched*100)+'%':'–'),h('div',{class:'l'},'Routine consistency')),
    h('div',{class:'tile'},h('div',{class:'v'},'🔥 '+best),h('div',{class:'l'},'Longest live streak')),
    h('div',{class:'tile'},h('div',{class:'v'},open),h('div',{class:'l'},over?over+' overdue':'Open tasks'))));
  const mx=Math.max(1,...week.map(act));
  m.append(sec('Last 7 days'));
  m.append(h('div',{class:'card'},h('div',{class:'bars'},week.map(k=>h('div',{class:'bcol'+(k===td?' today':'')},h('div',{class:'n'},act(k)||''),h('div',{class:'b',style:`height:${6+act(k)/mx*64}px`}),h('div',{class:'d'},DOW[pd(k).getDay()][0]))))));
  const start=addDays(td,-(28+pd(td).getDay()));
  const cells=Array.from({length:35},(_,i)=>addDays(start,i));
  m.append(sec('Last 5 weeks'));
  m.append(h('div',{class:'card'},h('div',{class:'hl7'},DL.map(x=>h('span',{},x))),h('div',{class:'heat'},cells.map(k=>{const n=k>td?0:act(k);return h('i',{class:(k>td?'fut ':'')+(k===td?'td ':'')+(n>=5?'l4':n>=3?'l3':n===2?'l2':n===1?'l1':''),title:k+': '+n})}))));
  if(S.routines.length){
    m.append(sec('Routine streaks'));
    m.append(card(S.routines.map(r=>{const s=streaks(r);return h('div',{class:'streak'},h('div',{},h('div',{class:'f'},r.title),h('div',{class:'s'},'Best: '+s.best+' day'+(s.best===1?'':'s'))),h('span',{class:'tag '+(s.cur?'ok':'')},'🔥 '+s.cur))})));
  }
}
function rSettings(m){
  const st=S.settings;
  const sw=(label,sub,on,fn)=>h('div',{class:'set'},h('div',{},label,sub?h('small',{},sub):null),h('input',{type:'checkbox',class:'switch',checked:on,onchange:e=>fn(e.target.checked)}));
  m.append(sec('Profile'));
  m.append(card(h('div',{class:'set'},h('div',{},'Your name',h('small',{},'Shown in your greeting')),h('input',{type:'text',value:st.name,maxlength:24,placeholder:'Optional',onchange:e=>{st.name=e.target.value.trim();save();render()}}))));
  m.append(sec('Appearance'));
  m.append(card(
    h('div',{class:'set'},h('div',{style:'flex:1'},h('div',{class:'seg'},[['auto','Auto'],['light','Light'],['dark','Dark']].map(([k,l])=>h('button',{class:st.theme===k?'on':'',onclick:()=>{st.theme=k;save();render()}},l))))),
    h('div',{class:'set',style:'padding-bottom:8px'},h('div',{},'Accent colour')),
    h('div',{class:'swatches'},Object.entries(ACC).map(([k,c])=>h('button',{class:'sw'+(st.accent===k?' on':''),style:'background:'+c,'aria-label':k,onclick:()=>{st.accent=k;save();render()}})))));
  m.append(sec('Reminders'));
  m.append(card(
    sw('Reminders','Status: '+permState(),st.notify,v=>{st.notify=v;save();if(v)askPerm()}),
    sw('Morning summary','A nudge to plan your day',st.summaryOn,v=>{st.summaryOn=v;save()}),
    h('div',{class:'set'},h('div',{},'Summary time'),h('input',{type:'time',value:st.summaryTime,onchange:e=>{st.summaryTime=e.target.value||'08:00';save()}})),
    h('div',{class:'set'},h('div',{},'Send a test notification'),h('button',{class:'btn',onclick:async()=>{
      await askPerm();
      if(LN){try{await LN.schedule({notifications:[{id:2,title:'Daybreak',body:'Notifications are working ✅',schedule:{at:new Date(Date.now()+2000),allowWhileIdle:true}}]});showToast('Test arrives in 2 seconds')}catch{showToast('Could not schedule')}}
      else showToast(await webNotify('Daybreak','Notifications are working ✅','test')?'Sent':'Not allowed in browser settings');
    }},'Send')),
    LN?h('div',{class:'set'},h('div',{},'Exact alarms',h('small',{},'Needed on Android 12+ for on-time reminders')),h('button',{class:'btn',onclick:async()=>{try{const r=await LN.checkExactNotificationSetting();if(r.exact_alarm==='granted')showToast('Exact alarms already allowed');else await LN.changeExactNotificationSetting()}catch{showToast('Not required on this device')}}},'Allow')):null));
  m.append(sec('Data'));
  m.append(card(
    deferredInstall?h('div',{class:'set'},h('div',{},'Install Daybreak',h('small',{},'Add it to your home screen')),h('button',{class:'btn primary',onclick:async()=>{deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;render()}},'Install')):null,
    h('div',{class:'set'},h('div',{},'Backup & restore',h('small',{},'Copy, download or paste your data')),h('button',{class:'btn',onclick:openBackup},'Open')),
    h('div',{class:'set'},h('div',{},'Reset everything',h('small',{},'Deletes all tasks and routines')),h('button',{class:'btn danger',onclick:()=>{if(confirm('Delete ALL Daybreak data? This cannot be undone.')){S=defaults();save();V.view='today';render();showToast('All data cleared')}}},'Reset'))));
  m.append(h('p',{class:'eyebrow',style:'text-align:center;margin:22px 0 0'},'Daybreak 1.0 · '+(LN?'reminders use Android alarms and work when the app is closed':'reminders fire while the app is running')));
}

/* ================= sheets ================= */
const sheet=$('#sheet');
const showSheet=node=>{sheet.replaceChildren(node);if(!sheet.open)sheet.showModal()};
sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
const kindSeg=(cur,onPick)=>h('div',{class:'seg'},h('button',{type:'button',class:cur==='task'?'on':'',onclick:()=>onPick('task')},'Task'),h('button',{type:'button',class:cur==='routine'?'on':'',onclick:()=>onPick('routine')},'Daily routine'));

function openTask(t,pre={}){
  const isNew=!t;
  const f=t?JSON.parse(JSON.stringify(t)):{title:pre.title||'',notes:'',list:pre.list||'inbox',priority:0,due:pre.due||'',time:'',repeat:'',remind:true,subtasks:[]};
  f.subtasks=f.subtasks||[];
  let parsedEl,subsBox;
  const drawParsed=()=>{if(!parsedEl)return;parsedEl.replaceChildren();if(!isNew)return;const p=parseQuick(f.title);p.found.forEach(x=>parsedEl.append(h('span',{class:'tag acc'},x)))};
  const drawSubs=focusLast=>{
    subsBox.replaceChildren();
    f.subtasks.forEach((s,i)=>subsBox.append(h('div',{class:'sub'},
      h('input',{type:'checkbox',class:'chk c',checked:s.done,'aria-label':'Subtask done',onchange:e=>{s.done=e.target.checked}}),
      h('input',{type:'text',value:s.t,placeholder:'Subtask',maxlength:120,oninput:e=>{s.t=e.target.value},onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();addSub()}}}),
      h('button',{type:'button',class:'x','aria-label':'Remove',onclick:()=>{f.subtasks.splice(i,1);drawSubs()}},'×'))));
    if(focusLast){const ins=subsBox.querySelectorAll('input[type=text]');ins[ins.length-1]&&ins[ins.length-1].focus()}
  };
  const addSub=()=>{f.subtasks.push({id:uid(),t:'',done:false});drawSubs(true)};
  const save1=()=>{
    let title=f.title.trim();if(!title){sheet.querySelector('.titlein').focus();return}
    if(isNew){
      const p=parseQuick(title);
      if(p.title)title=p.title;
      if(p.list)f.list=p.list;if(p.priority!=null)f.priority=p.priority;if(p.due)f.due=p.due;if(p.time)f.time=p.time;if(p.repeat)f.repeat=p.repeat;
    }
    if(f.repeat&&!f.due)f.due=today();
    const rec={...f,title,notes:(f.notes||'').trim(),subtasks:f.subtasks.filter(s=>s.t.trim()).map(s=>({...s,t:s.t.trim()}))};
    if(isNew){Object.assign(rec,{id:uid(),created:Date.now(),done:false,doneAt:null});S.tasks.push(rec)}else Object.assign(t,rec);
    save();sheet.close();render();
    if(rec.time&&rec.due&&S.settings.notify)askPerm();
  };
  const draw=()=>{
    parsedEl=h('div',{class:'parsed'});
    subsBox=h('div',{style:'display:flex;flex-direction:column;gap:10px'});
    const form=h('form',{class:'form',onsubmit:e=>{e.preventDefault();save1()}},
      h('div',{class:'grab'}),
      isNew?kindSeg('task',()=>openRoutine(null,{title:f.title})):h('h3',{},'Edit task'),
      h('input',{type:'text',class:'titlein',value:f.title,placeholder:isNew?'What needs doing?':'Title',maxlength:200,autocomplete:'off','aria-label':'Title',oninput:e=>{f.title=e.target.value;drawParsed()}}),
      isNew?parsedEl:null,
      isNew?h('div',{class:'hint'},'Tip: “Call Sam tomorrow 5pm #work !high” fills in the details for you.'):null,
      h('label',{class:'f'},'Notes',h('textarea',{placeholder:'Add details…',oninput:e=>{f.notes=e.target.value}},f.notes||'')),
      h('div',{class:'r2'},
        h('label',{class:'f'},'List',h('select',{onchange:e=>{f.list=e.target.value}},S.lists.map(l=>h('option',{value:l.id,selected:f.list===l.id},l.emoji+' '+l.name)))),
        h('label',{class:'f'},'Priority',h('select',{onchange:e=>{f.priority=+e.target.value}},PR.map((p,i)=>h('option',{value:i,selected:f.priority===i},p))))),
      h('div',{class:'r2'},
        h('label',{class:'f'},'Due date',h('input',{type:'date',value:f.due,onchange:e=>{f.due=e.target.value}})),
        h('label',{class:'f'},'Time',h('input',{type:'time',value:f.time,onchange:e=>{f.time=e.target.value;draw()}}))),
      (f.due||f.time)?h('button',{type:'button',class:'btn',onclick:()=>{f.due='';f.time='';draw()}},'Clear date & time'):null,
      h('label',{class:'f'},'Repeat',h('select',{onchange:e=>{f.repeat=e.target.value}},Object.entries(REP).map(([k,l])=>h('option',{value:k,selected:f.repeat===k},l)))),
      f.time?h('div',{class:'set',style:'padding:0;border:0'},h('div',{},'Remind me',h('small',{},'Notify at '+fmtT(f.time))),h('input',{type:'checkbox',class:'switch',checked:f.remind,onchange:e=>{f.remind=e.target.checked}})):null,
      h('div',{style:'display:flex;flex-direction:column;gap:10px'},h('label',{class:'f'},'Subtasks'),subsBox,h('button',{type:'button',class:'add-sub',onclick:addSub},'+ Add subtask')),
      h('div',{class:'acts'},
        !isNew?h('button',{type:'button',class:'btn danger',onclick:()=>{const b=snap();S.tasks=S.tasks.filter(x=>x.id!==t.id);save();sheet.close();render();undoable('Task deleted',b)}},'Delete'):null,
        !isNew?h('button',{type:'button',class:'btn',onclick:()=>{S.tasks.push({...JSON.parse(JSON.stringify(t)),id:uid(),created:Date.now(),done:false,doneAt:null});save();sheet.close();render();showToast('Duplicated')}},'Duplicate'):null,
        h('span',{class:'sp'}),h('button',{type:'submit',class:'btn primary'},'Save')));
    showSheet(form);drawSubs();drawParsed();
  };
  draw();
  if(isNew)setTimeout(()=>{const i=sheet.querySelector('.titlein');i&&i.focus()},60);
}
function openRoutine(r,pre={}){
  const isNew=!r;
  const f=r?{title:r.title,time:r.time,days:[...r.days]}:{title:pre.title||'',time:'',days:[0,1,2,3,4,5,6]};
  const draw=()=>{
    const form=h('form',{class:'form',onsubmit:e=>{
      e.preventDefault();const title=f.title.trim();if(!title){sheet.querySelector('.titlein').focus();return}
      const days=f.days.length?[...f.days].sort():[0,1,2,3,4,5,6];
      if(isNew)S.routines.push({id:uid(),title,time:f.time||'',days,history:[],created:Date.now()});else Object.assign(r,{title,time:f.time||'',days});
      save();sheet.close();V.view='today';render();if(f.time&&S.settings.notify)askPerm();
    }},
      h('div',{class:'grab'}),
      isNew?kindSeg('routine',()=>openTask(null,{title:f.title})):h('h3',{},'Edit routine'),
      h('input',{type:'text',class:'titlein',value:f.title,placeholder:'e.g. Take vitamins',maxlength:140,autocomplete:'off','aria-label':'Title',oninput:e=>{f.title=e.target.value}}),
      h('div',{class:'hint'},'Routines reset every morning and keep a streak.'),
      h('label',{class:'f'},'Reminder time (optional)',h('input',{type:'time',value:f.time,onchange:e=>{f.time=e.target.value}})),
      f.time?h('button',{type:'button',class:'btn',onclick:()=>{f.time='';draw()}},'Remove reminder'):null,
      h('label',{class:'f'},'Repeat on',h('div',{class:'days'},DL.map((n,i)=>h('button',{type:'button','aria-label':DOW[i],class:f.days.includes(i)?'on':'',onclick:e=>{f.days=f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i];e.currentTarget.classList.toggle('on')}},n)))),
      h('div',{class:'acts'},
        !isNew?h('button',{type:'button',class:'btn danger',onclick:()=>{if(!confirm('Delete this routine and its streak?'))return;const b=snap();S.routines=S.routines.filter(x=>x.id!==r.id);save();sheet.close();render();undoable('Routine deleted',b)}},'Delete'):null,
        h('span',{class:'sp'}),h('button',{type:'submit',class:'btn primary'},'Save')));
    showSheet(form);
  };
  draw();
  if(isNew)setTimeout(()=>{const i=sheet.querySelector('.titlein');i&&i.focus()},60);
}
const EMOJIS=['📥','💼','🏡','🛒','💪','📚','💡','🎯','✈️','💰','🍽️','❤️'];
const COLORS=['#6366f1','#0ea5e9','#14b8a6','#22c55e','#eab308','#f97316','#ef4444','#ec4899','#a855f7'];
function openList(l){
  const isNew=!l,f=l?{...l}:{name:'',emoji:'🎯',color:COLORS[Math.floor(Math.random()*COLORS.length)]};
  const draw=()=>{
    const form=h('form',{class:'form',onsubmit:e=>{
      e.preventDefault();const name=f.name.trim();if(!name){sheet.querySelector('.titlein').focus();return}
      if(isNew){const n={id:uid(),name,emoji:f.emoji,color:f.color};S.lists.push(n);V.listId=n.id}else Object.assign(l,{name,emoji:f.emoji,color:f.color});
      save();sheet.close();render();
    }},
      h('div',{class:'grab'}),h('h3',{},isNew?'New list':'Edit list'),
      h('input',{type:'text',class:'titlein',value:f.name,placeholder:'List name',maxlength:30,autocomplete:'off','aria-label':'List name',oninput:e=>{f.name=e.target.value}}),
      h('label',{class:'f'},'Icon',h('div',{class:'emojis'},EMOJIS.map(x=>h('button',{type:'button',class:f.emoji===x?'on':'',onclick:()=>{f.emoji=x;draw()}},x)))),
      h('label',{class:'f'},'Colour',h('div',{class:'cols'},COLORS.map(c=>h('button',{type:'button','aria-label':c,class:f.color===c?'on':'',style:'background:'+c,onclick:()=>{f.color=c;draw()}})))),
      h('div',{class:'acts'},
        !isNew&&l.id!=='inbox'?h('button',{type:'button',class:'btn danger',onclick:()=>{if(!confirm('Delete this list? Its tasks move to Inbox.'))return;const b=snap();S.tasks.forEach(t=>{if(t.list===l.id)t.list='inbox'});S.lists=S.lists.filter(x=>x.id!==l.id);V.view='lists';save();sheet.close();render();undoable('List deleted',b)}},'Delete'):null,
        h('span',{class:'sp'}),h('button',{type:'submit',class:'btn primary'},'Save')));
    showSheet(form);
  };
  draw();
  if(isNew)setTimeout(()=>{const i=sheet.querySelector('.titlein');i&&i.focus()},60);
}
function openBackup(){
  const json=JSON.stringify(S,null,2);
  const out=h('textarea',{readonly:true,style:'min-height:110px;font-size:12px'},json);
  const inn=h('textarea',{placeholder:'Paste a backup here to restore it…',style:'min-height:90px;font-size:12px'});
  showSheet(h('div',{class:'form'},h('div',{class:'grab'}),h('h3',{},'Backup & restore'),
    h('label',{class:'f'},'Your data',out),
    h('div',{class:'acts'},
      h('button',{type:'button',class:'btn',onclick:async()=>{try{await navigator.clipboard.writeText(json);showToast('Copied to clipboard')}catch{out.select();document.execCommand('copy');showToast('Copied')}}},'Copy'),
      h('button',{type:'button',class:'btn',onclick:()=>{const a=h('a',{href:URL.createObjectURL(new Blob([json],{type:'application/json'})),download:`daybreak-backup-${today()}.json`});document.body.append(a);a.click();a.remove()}},'Download file')),
    h('label',{class:'f'},'Restore',inn),
    h('div',{class:'acts'},h('button',{type:'button',class:'btn',onclick:()=>sheet.close()},'Close'),h('span',{class:'sp'}),
      h('button',{type:'button',class:'btn primary',onclick:()=>{
        try{const j=JSON.parse(inn.value);if(j.v!==2||!Array.isArray(j.tasks)||!Array.isArray(j.routines)||!Array.isArray(j.lists))throw 0;
          if(!confirm('Replace current data with this backup?'))return;S={...defaults(),...j,settings:{...defaults().settings,...(j.settings||{})}};save();sheet.close();render();showToast('Restored')}
        catch{showToast('That is not a valid Daybreak backup')}
      }},'Restore'))));
}

/* ================= wiring ================= */
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(V.view==='settings')render()});
$('#fab').onclick=()=>{
  const td=today();
  if(V.view==='list'&&V.listId!=='all')openTask(null,{list:V.listId});
  else if(V.view==='upcoming')openTask(null,{due:addDays(td,1)});
  else if(V.view==='today')openTask(null,{due:td});
  else openTask(null);
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(today()!==lastDay){lastDay=today();render()}queueSync(true);tick()}});
setInterval(tick,20000);
if('serviceWorker'in navigator&&!native){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='done'){doneByKey(e.data.key);showToast('Marked done')}});
}
{const id=new URLSearchParams(location.search).get('done');if(id){doneByKey(id);history.replaceState(null,'',location.pathname)}}
render();tick();
if(LN)LN.checkPermissions().then(p=>{if(p.display!=='granted'&&(S.routines.some(r=>r.time)||S.tasks.some(t=>t.time)))askPerm();else queueSync(true)}).catch(()=>{});
window.__daybreak={get S(){return S},V,render};
})();

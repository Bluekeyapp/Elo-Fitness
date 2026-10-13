import { P, NUTR, SHOP } from './program.js?v=3';
import { clampWeek, phaseForWeek, toggleExercise, finishWorkout, completedKeys, historyEntries, weekIsDone as stateWeekDone, programIsDone } from './state.js?v=3';
import { createStorage, parseImport } from './storage.js?v=3';
import { createTimer } from './timer.js?v=3';
import { registerUpdates } from './updates.js?v=3';

let phaseIdx=0, sessIdx=0, currentView='home', expandedEx=null;
let currentWeek=1, suggestedSessionIdx=0;
let done={}, history=[], sessionsDone={};
const storage=createStorage();
let {state, warnings}=storage.load();
let unsaved=false;
function notice(message){document.getElementById('storageNotice').textContent=message;}
function sync(){
  currentWeek=state.week; phaseIdx=phaseForWeek(currentWeek);
  done={}; sessionsDone={};
  for(const [key, record] of Object.entries(state.sessions)) record.checked.forEach((checked,i)=>{if(checked)done[key+'-'+i]=true;});
  for(const key of completedKeys(state)) sessionsDone[key]=true;
  history=historyEntries(state);
}
function commit(next){
  state=next; sync();
  try{storage.save(state);unsaved=false;}catch(error){unsaved=true;notice('Progression non sauvegardée sur cet appareil. Elle reste en mémoire : exportez-la avant de fermer. Les données précédentes sont conservées. '+error.message);}
}
const sessionKeyForWeek=(w,s)=>'w'+w+'-'+s.id;
const sessionKey=s=>sessionKeyForWeek(currentWeek,s);
const exerciseKey=(s,i)=>sessionKey(s)+'-'+i;
const weekIsDone=w=>stateWeekDone(state,w);
function savePrefs(){commit({...state,week:currentWeek});}
function keepFocus(render){
  const active=document.activeElement;
  const id=active?.id, action=active?.getAttribute('onclick');
  render();
  const replacement=id?document.getElementById(id):action?[...document.querySelectorAll('.view.active button')].find(b=>b.getAttribute('onclick')===action):null;
  if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
  else if(active && !active.isConnected)document.querySelector('.view.active h1, .view.active h2')?.focus({preventScroll:true});
}
const timer=createTimer({
  onChange({status,remaining}){
    document.getElementById('timerBar').classList.toggle('active',status!=='idle');
    document.getElementById('app').classList.toggle('timer-visible',status!=='idle');
    document.getElementById('wkHead').classList.toggle('timer-push',status!=='idle');
    document.getElementById('timerDisplay').textContent=status==='complete'?'Repos terminé':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
    document.getElementById('timerStatus').textContent=status==='complete'?'Repos terminé. Prêt pour la suite !':'';
    document.getElementById('timerCancel').textContent=status==='complete'?'Fermer':'Annuler';
  },
  onComplete(){try{navigator.vibrate?.([200,100,200]);}catch{/* Optional device capability. */}}
});
function startTimer(seconds){timer.start(seconds);}
function stopTimer(){const restore=document.activeElement?.id==='timerCancel';timer.stop();if(restore)document.getElementById('wkTitle').focus();}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)timer.reconcile();});
window.addEventListener('pageshow',()=>timer.reconcile());
window.addEventListener('focus',()=>timer.reconcile());

/* ─── VUES ─── */
function showView(v){
  currentView=v;expandedEx=null;
  document.querySelectorAll(".view").forEach(el=>el.classList.remove("active"));
  const tabBar=document.getElementById("tabBar");
  const tabIndex={home:0,prog:1,info:2};
  const map={home:"viewHome",workout:"viewWorkout",done:"viewDone",prog:"viewProg",info:"viewInfo"};
  document.getElementById(map[v]).classList.add("active");
  // Tab highlighting
  document.querySelectorAll(".tab-bar button").forEach(b=>{
    b.classList.toggle("on",b.dataset.tab===v);
    if(b.dataset.tab===v)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
  if(tabIndex[v]!==undefined)tabBar.style.setProperty("--active-index",tabIndex[v]);
  tabBar.classList.toggle("has-active",tabIndex[v]!==undefined);
  tabBar.style.display=(v==="done")?"none":"grid";
  // Affichage
  if(v==="home")renderHome();
  else if(v==="workout")renderWorkout();
  else if(v==="prog")renderProg();
  else if(v==="info")renderInfo();
  window.scrollTo(0,0);
  const heading=document.querySelector(".view.active h1, .view.active h2");
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}

/* ─── AFFICHAGE ACCUEIL ─── */
function renderHome(){
  phaseIdx=phaseForWeek(currentWeek);
  const phase=P[phaseIdx];
  suggestedSessionIdx=getSuggestedSessionIndex();
  const focus=phase.sessions[suggestedSessionIdx];
  const weekDone=phase.sessions.filter(s=>sessionsDone[sessionKey(s)]).length;
  const totalDone=Object.keys(sessionsDone).length;
  document.getElementById("weekBadge").textContent=`Semaine ${currentWeek}`;
  document.getElementById("homeFocusTitle").textContent=focus.title;
  document.getElementById("homeFocusSub").textContent=`${phase.name} • ${focus.day} • ${focus.ex.length} exercices`;
  const completeWeek=weekIsDone(currentWeek), completeProgram=programIsDone(state);
  if(completeWeek){
    document.getElementById('homeFocusTitle').textContent=completeProgram?'Programme terminé !':'Semaine '+currentWeek+' terminée !';
    document.getElementById('homeFocusSub').textContent=completeProgram?'Bravo pour les 12 semaines. Tu peux revoir chaque séance.':currentWeek<12?'Prête pour la semaine suivante ?':'Semaine 12 terminée. Consulte les autres semaines pour compléter le programme.';
  }
  document.getElementById('heroPlay').textContent=completeWeek?(currentWeek<12?'Semaine suivante →':'Revoir les séances'):'▶ Continuer';
  document.getElementById("homeStats").innerHTML=`
    <div class="stat"><strong>${currentWeek}/12</strong><span>Semaine active</span></div>
    <div class="stat"><strong>${weekDone}/${phase.sessions.length}</strong><span>Cette semaine</span></div>
    <div class="stat"><strong>${totalDone}</strong><span>Séances terminées</span></div>`;
  document.getElementById("weekStrip").innerHTML=`
    <button class="week-stepper-btn" onclick="shiftWeek(-1)" aria-label="Semaine précédente" ${currentWeek===1?"disabled":""}>‹</button>
    <div class="week-stepper-label">Semaine ${currentWeek}</div>
    <button class="week-stepper-btn" onclick="shiftWeek(1)" aria-label="Semaine suivante" ${currentWeek===12?"disabled":""}>›</button>`;
  const pills=document.getElementById("phasePills");
  pills.innerHTML=P.map((p,i)=>{
    const on=phaseIdx===i;
    return `<button class="${on?"on":""}" style="${on?"background:"+p.color+";color:#fff":"border-color:"+p.color+"55"}" aria-pressed="${on}" onclick="setPhase(${i})">${p.name}</button>`;
  }).join("");
  document.getElementById("phaseWeeks").textContent=`${phase.wk} • ${phase.name}`;
  document.getElementById("sessionWeeks").textContent=`${phase.sessions.length} séances • Semaine ${currentWeek}`;
  const grid=document.getElementById("sessGrid");
  grid.innerHTML=phase.sessions.map((s,i)=>{
    const complete=!!sessionsDone[sessionKey(s)];
    const cnt=complete?s.ex.length:s.ex.filter((_,j)=>done[exerciseKey(s,j)]).length;
    const pct=Math.round(cnt/s.ex.length*100);
    const badge=complete?"TERMINÉE":`${s.ex.length} exercices`;
    return `<button type="button" class="sess-card" style="${complete?"border-color:"+phase.color+";background:linear-gradient(155deg,"+phase.color+"33,#121212)":""}" onclick="openSession(${i})">
      <span class="day" style="color:${phase.color}">${s.day}</span>
      <span class="tag">${badge}</span>
      <span class="stitle">${s.title}</span>
      <span class="bar"><span class="bar-fill" style="width:${pct}%;background:${phase.color}"></span></span>
      <span class="cnt"><span>${cnt}/${s.ex.length}</span><span>${pct}%</span></span>
    </button>`;
  }).join("");
}
function getSuggestedSessionIndex(){
  const phase=P[phaseIdx];
  const next=phase.sessions.findIndex(s=>!sessionsDone[sessionKey(s)]);
  return next===-1?0:next;
}
function setWeek(w){stopTimer();currentWeek=clampWeek(w);phaseIdx=phaseForWeek(currentWeek);sessIdx=0;savePrefs();keepFocus(()=>currentView==="prog"?renderProg():renderHome())}
function shiftWeek(delta){setWeek(currentWeek+delta)}
function setPhase(i){setWeek(i*4+1)}
function openSuggestedSession(){if(weekIsDone(currentWeek)){if(currentWeek<12)setWeek(currentWeek+1);else document.querySelector(".sess-card")?.focus();}else openSession(suggestedSessionIdx)}
function openSession(i){stopTimer();sessIdx=i;showView("workout")}

/* ─── AFFICHAGE SÉANCE ─── */
function renderWorkout(){
  const phase=P[phaseIdx],sess=phase.sessions[sessIdx];
  const doneCount=sessionsDone[sessionKey(sess)]?sess.ex.length:sess.ex.filter((_,j)=>done[exerciseKey(sess,j)]).length;
  document.getElementById("wkTitle").textContent=sess.title;
  document.getElementById("wkSub").textContent=`Semaine ${currentWeek} • ${phase.name} • ${sess.day} • ${doneCount}/${sess.ex.length} faits`;
  document.getElementById("wkWarm").innerHTML=`<span class="wi">🔥</span><span>Échauffement 5 min : ${sess.warm}</span>`;
  document.getElementById("finishBtn").style.background=phase.color;
  document.getElementById("finishBtn").textContent=sessionsDone[sessionKey(sess)]?"Séance enregistrée ✓":"Terminer et enregistrer ✓";
  const list=document.getElementById("exList");
  list.innerHTML=sess.ex.map((ex,i)=>{
    const key=exerciseKey(sess,i);
    const isDone=!!done[key];
    const isOpen=expandedEx===i;
    return `<div class="ex-item${isDone?" checked":""}">
      <div class="ex-row">
        <button class="ex-check${isDone?" on":""}" aria-pressed="${isDone}" aria-label="${isDone?"Décocher":"Cocher"} ${ex.n}" onclick="toggleEx('${key}')">${isDone?"✓":""}</button>
        <button type="button" class="ex-info" aria-expanded="${isOpen}" aria-controls="exercise-detail-${i}" onclick="toggleExpand(${i})">
          <span class="ex-name">${ex.n}</span>
          <span class="ex-meta">
            <span class="accent">${ex.s}×${ex.r}</span>
            <span>${ex.w}</span>
            ${ex.rest>0?`<span>⏱ ${ex.rest}s</span>`:""}
          </span>
        </button>
      </div>
      <div id="exercise-detail-${i}" class="ex-expand${isOpen?" open":""}">
        <div class="ex-tip">💡 ${ex.tip}</div>
        ${ex.rest>0?`<button class="rest-btn" style="background:${phase.color}22;color:${phase.color}" onclick="startTimer(${ex.rest})">⏱ Lancer ${ex.rest}s de repos</button>`:""}
      </div>
    </div>`;
  }).join("");
}
function toggleEx(key){
  const sess=P[phaseIdx].sessions[sessIdx];
  commit(toggleExercise(state,sessionKey(sess),Number(key.split('-').at(-1))));
  if(sessionsDone[sessionKey(sess)])stopTimer();
  keepFocus(renderWorkout);
}
function toggleExpand(i){expandedEx=expandedEx===i?null:i;keepFocus(renderWorkout)}

function finishSession(){
  const sess=P[phaseIdx].sessions[sessIdx], key=sessionKey(sess);
  const count=state.sessions[key]?.checked.filter(Boolean).length||0;
  stopTimer();
  if(count<sess.ex.length && !confirm(count+' / '+sess.ex.length+' exercices cochés. Terminer cette séance partielle ? Elle ne comptera pas comme une séance complète.'))return;
  commit(finishWorkout(state,key));
  document.querySelector('#viewDone h2').textContent=count===sess.ex.length?'Bravo !':count?'Séance partielle':'Séance arrêtée';
  document.querySelector('#viewDone p').textContent=count===sess.ex.length?'Tous les exercices sont cochés. Cette séance compte une seule fois dans tes progrès.':count+' / '+sess.ex.length+' exercices faits. Tu peux reprendre cette séance à tout moment.';
  showView('done');
}
function resetAndHome(){showView("home")}

/* ─── AFFICHAGE PROGRESSIONS ─── */
function renderProg(){
  phaseIdx=phaseForWeek(currentWeek);
  const phase=P[phaseIdx];
  const totalSessions=Array.from({length:12},(_,i)=>P[phaseForWeek(i+1)].sessions.length).reduce((a,b)=>a+b,0);
  const totalDone=Object.keys(sessionsDone).length;
  const programPct=Math.round(totalDone/totalSessions*100);
  const weekSessions=phase.sessions.length;
  const weekDone=phase.sessions.filter(s=>sessionsDone[sessionKey(s)]).length;
  const weekTotalEx=phase.sessions.reduce((sum,s)=>sum+s.ex.length,0);
  const weekDoneEx=phase.sessions.reduce((sum,s)=>sum+(sessionsDone[sessionKey(s)]?s.ex.length:s.ex.filter((_,j)=>done[exerciseKey(s,j)]).length),0);
  const weekPct=Math.round(weekDoneEx/weekTotalEx*100);
  const nextIdx=getSuggestedSessionIndex();
  const visibleGoals=phase.prog.slice(0,3);
  const hiddenGoalCount=phase.prog.length-visibleGoals.length;
  document.getElementById("progList").innerHTML=`
    <div class="prog-summary">
      <div class="prog-summary-top">
        <div>
          <span>Semaine ${currentWeek} • ${phase.name}</span>
          <strong>${weekPct}% terminé</strong>
        </div>
        <div class="prog-summary-count">${weekDone}/${weekSessions}</div>
      </div>
      <div class="prog-meter"><div class="prog-meter-fill" style="width:${weekPct}%;background:${phase.color}"></div></div>
      <div class="prog-quick">
        <div><strong>${weekDoneEx}/${weekTotalEx}</strong>Exercices</div>
        <div><strong>${programPct}%</strong>Programme</div>
      </div>
    </div>
    ${weekIsDone(currentWeek)?`<div class="week-complete"><p>${programIsDone(state)?'Programme terminé !': 'Semaine '+currentWeek+' terminée !'}</p>${currentWeek<12?'<button class="play-btn" onclick="shiftWeek(1)">Semaine suivante →</button>':''}</div>`:''}
    <div class="prog-week-nav">
      <button class="week-stepper-btn" onclick="shiftWeek(-1)" aria-label="Semaine précédente" ${currentWeek===1?"disabled":""}>‹</button>
      <div class="week-stepper-label">Semaine ${currentWeek}</div>
      <button class="week-stepper-btn" onclick="shiftWeek(1)" aria-label="Semaine suivante" ${currentWeek===12?"disabled":""}>›</button>
    </div>
    <div class="prog-block">
      <div class="prog-block-title">
        <strong>Séances</strong>
        <span>${phase.wk}</span>
      </div>
      ${phase.sessions.map((s,i)=>{
        const complete=!!sessionsDone[sessionKey(s)];
        const cnt=complete?s.ex.length:s.ex.filter((_,j)=>done[exerciseKey(s,j)]).length;
        const pct=Math.round(cnt/s.ex.length*100);
        return `<button type="button" class="prog-session${complete?" done":""}" style="${complete?"border-color:"+phase.color:""}" onclick="openSession(${i})">
          <span class="prog-session-top">
            <span class="prog-session-copy">
              <span class="prog-session-day" style="color:${phase.color}">${s.day}</span>
              <span class="prog-session-name">${s.title}</span>
            </span>
            <span class="prog-session-status">${complete?"Terminée":i===nextIdx?"À faire":pct?`${pct}%`:"0%"}</span>
          </span>
          <span class="prog-session-bar"><span class="prog-session-fill" style="width:${pct}%;background:${phase.color}"></span></span>
          <span class="prog-session-meta"><span>${cnt}/${s.ex.length} exercices</span></span>
        </button>`;
      }).join("")}
    </div>
    <div class="prog-block">
      <div class="prog-block-title">
        <strong>Objectifs phase</strong>
        <span>${phase.name}</span>
      </div>
      <div class="prog-phase">
        <div class="prog-phase-title" style="color:${phase.color}">${phase.name} — ${phase.wk}</div>
        ${visibleGoals.map(pr=>`<div class="prog-item"><div class="prog-dot" style="background:${phase.color}"></div>${pr}</div>`).join("")}
        ${hiddenGoalCount>0?`<details class="prog-more"><summary>Voir les ${hiddenGoalCount} autres objectifs</summary>${phase.prog.slice(3).map(pr=>`<div class="prog-item">${pr}</div>`).join("")}</details>`:""}
      </div>
    </div>`;
}

/* ─── AFFICHAGE CONSEILS ─── */
function renderInfo(){
  let h=`<div class="section-label" style="color:#E8453F">NUTRITION ET RÉCUPÉRATION</div>`;
  h+=NUTR.map(n=>`<div class="info-card"><span class="ii">${n.i}</span><div><h4>${n.t}</h4><p>${n.d}</p></div></div>`).join("");
  h+=`<div class="section-label" style="color:#D4782F;margin-top:20px">MATÉRIEL RECOMMANDÉ</div>`;
  h+=SHOP.map(s=>`<div class="info-card"><span class="ii">🛒</span><div><h4>${s.wk}</h4><p>${s.item}</p></div></div>`).join("");
  h+=`<div class="section-label" style="color:#9B2335;margin-top:20px">HISTORIQUE</div>`;
  if(!history.length)h+=`<p style="font-size:13px;color:#555">Aucune séance terminée pour le moment.</p>`;
  else h+=history.map(e=>`<div class="hist-item"><span class="hs">Sem. ${e.week||"?"} • ${e.session}${e.complete?" — Terminée":" — Partielle ("+e.count+"/"+e.total+")"}</span><span class="hd">${e.date?new Date(e.date).toLocaleDateString("fr-FR"):"Date inconnue"}</span></div>`).join("");
  document.getElementById("infoContent").innerHTML=h;
}


function download(value,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportProgress(){download(state,'glutelab-progression.json');}
function exportRaw(){try{download(storage.raw(),'glutelab-donnees-originales.json');}catch{notice('Lecture des données originales impossible. Exportez la progression en mémoire.');}}
document.getElementById('importFile').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{
    if(file.size>5_000_000)throw new Error('Fichier trop volumineux (5 Mo maximum).');
    const next=parseImport(await file.text());
    if(!confirm('Remplacer toute la progression actuelle par ce fichier (semaine '+next.week+', '+completedKeys(next).length+' séances terminées) ? Cette action écrase les progrès actuels. Exportez-les d’abord si nécessaire.'))return;
    storage.save(next,{replace:true});state=next;unsaved=false;sync();stopTimer();notice('Sauvegarde importée et enregistrée.');showView('home');
  }catch(error){notice('Import refusé, progression actuelle conservée. '+error.message);}
});
window.addEventListener('storage',event=>{
  if(event.key==='gl-state-v1')notice('La progression a changé dans un autre onglet. Rechargez avant de continuer pour éviter d’écraser ses changements.');
});
Object.assign(window,{showView,openSuggestedSession,shiftWeek,setPhase,openSession,toggleEx,toggleExpand,finishSession,resetAndHome,startTimer,stopTimer,exportProgress,exportRaw});
sync();notice(warnings.join(' '));showView('home');
window.addEventListener('beforeunload',event=>{if(unsaved){event.preventDefault();event.returnValue='';}});
registerUpdates(document.getElementById('updateButton'),document.getElementById('updateStatus'),()=>{
  if(unsaved){notice('Exportez la progression non sauvegardée avant de recharger pour la mise à jour.');return false;}
  return true;
});

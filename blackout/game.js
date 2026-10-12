(() => {
 'use strict';
 let storage;try{storage=window.localStorage;}catch{storage=null;}
 const $=id=>document.getElementById(id),save=BPSave.load(storage),settings=save.settings,pressed=new Set(),held=new Set();
 const W=BPWorld.weapons,G=BPWorld.gear,A=BPWorld.archetypes,U=BPWorld.upgrades,MISSIONS=BPWorld.missions,DIFFS=BPWorld.order,DL=BPWorld.difficulties,Meta=BPMeta,HOLD=BPWorld.holdoutMaps;
 const holdoutMap=id=>HOLD.find(h=>h.id===id)||HOLD[0],holdoutOpen=h=>!h.locks||!!save.missions[h.locks]?.done;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){settings.shake=0;settings.flash=true;}
 let scene=null,mode='menu',bindingTarget=null,lastHud=0,radioUntil=0,toastUntil=0,bannerUntil=0,comboUntil=0,mouseFire=false,mouseAim=false,wheelSwap=false,hadSaveFailure=false,selected=null,armoryTab='weapons',armoryItem=null,armoryFrom='menu',run=null,timeScale=1,slowUntil=0,debriefTimers=[];
 // Co-op is host-authoritative and two-player, and can travel two ways. NET is the LAN transport: direct sockets, only
 // in the desktop app (the web build has no preload/window.BPNet). ONLINE goes through a relay by room code (online.js,
 // server/relay.js) and works in both builds, but only once a relay address is configured. Both offer the same calls
 // and carry the same messages; LINK is whichever one the current lobby is using.
 const NET=(typeof window!=='undefined'&&window.BPNet&&window.BPNet.available)?window.BPNet:null,ONLINE=window.BPOnline&&window.BPOnline.available?window.BPOnline:null;let LINK=null;
 // netRole is only 'host'/'guest' while a co-op run is live; "lobby" is the whole session (see the squad lobby section).
 let netRole='solo',netConnected=false,netGuestInput={},netBroadcastAt=0,netPort=47321,lobby=null;
 for(const [via,name] of [[NET,'lan'],[ONLINE,'online']])if(via){via.onHostEvent(msg=>{if(lobby?.link===name)onHostMsg(msg);});via.onGuestEvent(msg=>{if(lobby?.link===name)onGuestMsg(msg);});}
 const labels={up:'Move up',down:'Move down',left:'Move left',right:'Move right',sprint:'Sprint',roll:'Roll / dive',slide:'Slide',interact:'Interact / vault',reload:'Reload',swap:'Swap weapon',gadget:'Stim injector',melee:'Melee',grenade:'Lethal gadget',tactical:'Tactical gadget',slot1:'Primary weapon',slot2:'Secondary weapon'};
 const pad=new BPGamepad(),padTaps=new Set(),PAD_REACH=300,PAD_TURN=14,ASSIST_TURN=45,ASSIST_CONE=.7,ASSIST_BREAK=.6,padActionLabel=key=>({grenade:'Deploy gadget',cycle:'Switch gadget',fire:'Fire',aim:'Steady aim'})[key]||labels[key];
 let padGadget='lethal',padState=null,padActive=false,padAngle=0,padTarget=0,padAimIdle=0,padMenuStick=0,padBindingTarget=null,padLock=null,padLockLost=0,padReach=PAD_REACH;
 const today=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/86400000),fmt=n=>Math.round(n).toLocaleString('en-US'),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const missionMeta=id=>MISSIONS.find(m=>m.id===id),gearName=k=>k?G[k].name:'NONE';
 function displayKey(code){return code.replace(/^Key|^Digit/,'').replace('Left','').replace('Right','');}
 function keyLabel(action){return padActive?BPGamepad.glyphs[pad.brand||'generic'][settings.padBindings[action]]||'—':displayKey(settings.bindings[action]||'');}
 function strip(){$('controls-strip').textContent=`${keyLabel('sprint')} SPRINT / ${keyLabel('slide')} SLIDE / ${keyLabel('roll')} ROLL / ${keyLabel('interact')} VAULT / ${keyLabel('swap')} SWAP / ${keyLabel('reload')} RELOAD / ${keyLabel('melee')} MELEE / ${padActive?'START':'ESC'} PAUSE`;}
 // Mirrors the in-game controls-strip for the main menu footer, which otherwise never reflects rebinding or a connected controller.
 function menuHint(){const move=padActive?'LEFT STICK':[settings.bindings.up,settings.bindings.left,settings.bindings.down,settings.bindings.right].map(displayKey).join(' '),aim=padActive?'RIGHT STICK':'MOUSE';
  $('menu-controls').innerHTML=`<kbd>${esc(move)}</kbd> MOVE <span>·</span> <kbd>${esc(aim)}</kbd> AIM <span>·</span> <kbd>${esc(keyLabel('roll'))}</kbd> EVADE <span>·</span> <kbd>${esc(keyLabel('swap'))}</kbd> SWAP`;}
 function setPadActive(value){padActive=value;if(value&&scene&&!scene.audio.unlocked)scene.audio.unlock();document.body.classList.toggle('pad',value);if(value&&scene?.sim)padAngle=padTarget=me(scene.sim).angle;padAimIdle=0;strip();menuHint();}
 function padStatus(){const name=settings.gamepad?pad.name:null;$('gamepad-status').textContent=!BPGamepad.supported?'NOT SUPPORTED IN THIS BROWSER':!settings.gamepad?'OFF':name?(BPGamepad.brandName[pad.brand]||'CONTROLLER')+' · '+name.slice(0,34):'PRESS ANY BUTTON ON THE CONTROLLER';}
 function persist(){const ok=BPSave.write(storage,save);if(!ok&&!hadSaveFailure){hadSaveFailure=true;toast('STORAGE UNAVAILABLE / PROGRESS LASTS THIS SESSION');}return ok;}
 function clearInput(){held.clear();pressed.clear();padTaps.clear();padState=null;padLock=null;mouseFire=false;mouseAim=false;wheelSwap=false;}
 function toast(text,duration=2.5){$('toast').textContent=text;$('toast').style.opacity='1';toastUntil=performance.now()+duration*1000;}
 function banner(eyebrow,title,sub='',duration=2.6,tone='',art=''){$('banner-art').innerHTML=art;$('banner-eyebrow').textContent=eyebrow;$('banner-title').textContent=title;$('banner-sub').textContent=sub;const b=$('banner');b.className='banner show '+tone;bannerUntil=performance.now()+duration*1000;}
 function radio(e){$('radio-speaker').textContent=e.speaker;$('radio-text').textContent=e.text;$('radio').hidden=false;radioUntil=scene.sim.time+(e.duration||6);}
 const rank=()=>Meta.rankOf(save.xp);
 function refreshWallet(){const r=rank();for(const id of ['wallet','ops-credits','armory-credits'])$(id).textContent=fmt(save.credits)+' CR';for(const id of ['ops-rank','armory-rank'])$(id).textContent='RANK '+r.rank+' · '+r.title;
  $('rank-chip').innerHTML=`<i></i> RANK ${r.rank} · ${esc(r.title)}`;const d=save.daily,day=today();$('streak-chip').textContent=d.day===day?`DAILY OP DONE · STREAK ${d.streak}`:d.day===day-1?`DAILY OP READY · KEEP THE ${d.streak}-DAY STREAK`:'DAILY OP BONUS READY';
  const fresh=[...save.owned.weapons,...save.owned.gear].filter(k=>!save.seen.includes(k)&&!['rifle','pistol'].includes(k)).length;$('armory-badge').textContent=fresh?'NEW ×'+fresh:fmt(save.credits)+' CR';$('armory-badge').classList.toggle('new',!!fresh);setArt($('armory-art'),'weapon',Meta.loadout(save).primary);}
 function updateContinue(){const next=Meta.nextMission(save),cur=save.run&&missionMeta(save.run.mission),done=MISSIONS.filter(m=>save.missions[m.id]?.done).length,medals=MISSIONS.reduce((n,m)=>n+(save.missions[m.id]?.medals.length||0),0);
  
  $('status').textContent=cur?'CHECKPOINT SECURED':done===MISSIONS.length?'ACT II COMPLETE':done?'OPERATIONS '+done+' / '+MISSIONS.length:'AWAITING DEPLOYMENT';
  const show=cur||next||MISSIONS[MISSIONS.length-1];
  // The campaign card shows the operation it leads to, over a still of that operation.
  $('continue-kicker').textContent='CAMPAIGN · '+show.act.replace(' / ',' · ');$('continue-title').textContent=show.title;$('continue-sub').textContent=cur?'CONTINUE FROM CHECKPOINT':next?(done?'NEXT OPERATION':'DEPLOY INTO CAMPAIGN'):'REPLAY ANY OPERATION';$('continue-chip').textContent=done+' / '+MISSIONS.length+' OPERATIONS';$('continue-art').style.backgroundImage='url("blackout/assets/menu/campaign-'+show.id+'.jpg")';
  $('dossier-act').textContent=String(show.n).padStart(2,'0')+' / '+show.act.replace(' / ',' · ');$('dossier-title').textContent=show.title;$('dossier-copy').textContent=show.brief;$('dossier-chapter').textContent='CHAPTER '+['ONE','TWO','THREE','FOUR','FIVE','SIX'][show.n-1];$('dossier-sector').textContent=show.sector.replace(' / ',' · ');
  $('dossier-progress').textContent=done+' / '+MISSIONS.length;$('dossier-medals').textContent=medals+' / '+MISSIONS.length*5;$('dossier-status').textContent=cur?'CHECKPOINT SAVED':done===MISSIONS.length?'HUNTING VOSS':done?'ON THE RUN':'MISSING IN ACTION';$('dossier-n').textContent=String(show.n).padStart(2,'0')+' / '+String(MISSIONS.length).padStart(2,'0');
  const best=Math.max(0,...Object.values(save.holdout));$('holdout-chip').textContent=best?'BEST WAVE '+best:'';$('holdout').classList.remove('locked');refreshWallet();}
 const SCREENS=['menu','ops','armory','lobby'];
 // The menu score plays on every screen in SCREENS and hands over to the mission's own ambience once a run starts.
 function score(){scene?.audio?.music(SCREENS.includes(mode));}
 // The animated title-screen backdrop (fire over the cover painting, plus a small live battle run by the real
 // simulation - see menu-scene.js) only runs while the main menu is the screen in front and the window has focus.
 // Reduced motion leaves the painting still.
 const menuScene=new BPMenuScene($('menu-scene'),{still:reduced,front:$('menu-troops')});
 function backdrop(){menuScene.lite(settings.quality==='low');menuScene.play(!!scene&&mode==='menu'&&!document.hidden&&document.hasFocus());}
 for(const type of ['focus','blur'])window.addEventListener(type,backdrop);document.addEventListener('visibilitychange',backdrop);
 // Menu navigation sounds: a soft tick whenever the pointer, keyboard or controller lands on a control, a confirm when a
 // button is used, a lower note for backing out and a short rise when a click starts a run. They stay silent during
 // play, and a control that plays its own sound (buy, deny, ready...) keeps that instead of the generic one.
 const NAV='button,select,input,a[href]';let navAt=null,navLive=false,navFrom='menu',navClick=0;
 const navOn=()=>!!scene&&mode!=='playing',navOf=e=>e.target instanceof Element?e.target.closest(NAV):null,navQuiet=()=>performance.now()-scene.audio.uiAt;
 // A click often moves focus (a new screen focuses its first button); that landing is part of the click, not a hover.
 function navLand(el){if(!el||el===navAt||el.disabled)return;navAt=el;if(navOn()&&performance.now()-navClick>50&&navQuiet()>90)scene.audio.ui('hover');}
 document.addEventListener('pointerover',e=>navLand(navOf(e)));document.addEventListener('pointerout',e=>{if(navAt&&!(e.relatedTarget instanceof Node&&navAt.contains(e.relatedTarget)))navAt=null;});document.addEventListener('focusin',e=>navLand(navOf(e)));
 document.addEventListener('click',()=>{navLive=navOn();navFrom=mode;navClick=performance.now();},true);
 document.addEventListener('click',e=>{const el=navOf(e);if(!navLive||!el||el.disabled||!el.matches('button,a')||scene.audio.uiAt>=navClick)return;scene.audio.ui(mode==='playing'&&navFrom!=='paused'?'launch':el.matches('.text-button,.close,#armory-back')?'back':'select');});
 document.addEventListener('change',e=>{if(navOn()&&navOf(e)&&navQuiet()>60)scene.audio.ui('tick');});
 // Sound can only start after the first click, key press or controller input, so that is when it is switched on.
 for(const type of ['pointerdown','keydown'])window.addEventListener(type,()=>{if(scene&&!scene.audio.unlocked)scene.audio.unlock();},true);
 function setMode(value){mode=value;document.body.dataset.phase=value;const game=['playing','paused','dead','complete'].includes(value);document.body.classList.toggle('playing',game);for(const id of SCREENS)$(id).hidden=value!==id;$('hud').hidden=!['playing','paused'].includes(value);$('pause').hidden=value!=='paused';$('ending').hidden=!['dead','complete'].includes(value);if(!game){$('danger').style.opacity='0';$('flashout').style.opacity='0';document.body.classList.remove('downed');}score();backdrop();clearInput();if(scene?.game?.canvas)scene.game.canvas.style.cursor=value==='playing'?'none':'default';}
 // ---------- operations board ----------
 function openOps(id){if(!scene)return;selected=id||selected||save.run?.mission||Meta.nextMission(save)?.id||'crash';if(!Meta.unlocked(save,selected))selected=Meta.nextMission(save)?.id||'crash';scene.audio?.stopAmbient();setMode('ops');renderOps();$('ops').scrollTop=0;$('deploy').focus({preventScroll:true});}
 function medalRow(id){const got=save.missions[id]?.medals||[];return Meta.medalsFor().map(m=>`<i class="${got.includes(m.id)?'on':''}" title="${m.name}"></i>`).join('');}
 function renderOps(){const list=$('mission-list');list.replaceChildren();
  for(const m of MISSIONS){const st=save.missions[m.id],open=Meta.unlocked(save,m.id),b=document.createElement('button');b.type='button';b.className='mission-card'+(m.id===selected?' active':'')+(open?'':' locked')+(st?.done?' done':'');b.dataset.mission=m.id;
   b.innerHTML=`<span class="mc-n">${String(m.n).padStart(2,'0')}</span><span class="mc-body"><b>${open?m.title:'CLASSIFIED'}</b><small>${open?m.act:'COMPLETE '+esc(MISSIONS[m.n-2]?.title||'')+' TO DECLASSIFY'}</small><span class="medals">${medalRow(m.id)}</span></span><span class="mc-tag">${save.run?.mission===m.id?'CHECKPOINT':st?.best?st.best.rating+' / '+DL[st.best.difficulty].label:open?'NEW':'🔒'}</span>`;
   b.addEventListener('click',()=>{selected=m.id;renderOps();});list.append(b);}
  const m=missionMeta(selected),st=save.missions[m.id],open=Meta.unlocked(save,m.id);
  $('brief-act').textContent=m.act+' / CHAPTER '+m.n;$('brief-title').textContent=open?m.title:'CLASSIFIED';$('brief-sector').textContent=m.sector;$('brief-copy').textContent=open?m.brief:'Finish the previous operation to declassify this file.';
  $('brief-terrain').textContent=m.terrain;$('brief-threats').textContent=m.threats.map(t=>A[t].name).join(' · ');$('brief-best').textContent=st?.best?`${st.best.rating} · ${fmt(st.best.score)} · ${DL[st.best.difficulty].label}`:'—';$('brief-medals').innerHTML=medalRow(m.id);
  const rec=$('brief-rec');rec.replaceChildren();const head=document.createElement('p');head.className='rec-note';head.innerHTML=`<b>RECOMMENDED</b> ${esc(m.rec.note)}`;rec.append(head);
  for(const [kind,key] of [...m.rec.weapons.map(k=>['weapon',k]),...m.rec.gear.map(k=>['gear',k])]){const item=kind==='weapon'?W[key]:G[key],have=Meta.owns(save,kind,key),slot=kind==='weapon'?(item.slot===0?'primary':'secondary'):item.slot,on=save.loadout[slot]===key,cost=Meta.price(save,kind,key),b=document.createElement('button');b.type='button';b.className='rec-item'+(have?' owned':'')+(on?' on':'');
   b.innerHTML=`<i class="rec-art">${ICON(kind,key)}</i><span>${esc(item.name)}</span><b>${on?'EQUIPPED':have?'EQUIP':save.credits>=cost?'BUY '+fmt(cost)+' CR':fmt(cost)+' CR'}</b>`;
   b.addEventListener('click',()=>{if(!have){const r=Meta.buy(save,kind,key);if(!r.ok){toast(r.reason);scene.audio.ui('deny');return;}scene.audio.ui('buy');toast(item.name+' PURCHASED');}save.loadout[slot]=key;save.loadout=Meta.loadout(save);persist();refreshWallet();renderOps();});rec.append(b);}
  const dp=$('difficulty-pick');dp.replaceChildren();for(const d of DIFFS){const b=document.createElement('button');b.type='button';b.className=(settings.difficulty===d?'active ':'')+d;b.innerHTML=`<span>${DL[d].label}</span><small>×${DL[d].reward} CR</small>`;b.addEventListener('click',()=>{settings.difficulty=d;persist();renderOps();});dp.append(b);}
  $('difficulty-note').textContent={story:'Forgiving fire and frequent medkits. For the story.',standard:'The intended fight. Cover matters; mistakes are survivable.',intense:'Faster, deadlier enemies that throw grenades at campers.',insane:'Skill tier. Twice the soldiers, three-round bursts that lead your movement, grenades for anyone who camps. Fight from cover or die.'}[settings.difficulty];
  // Rook's own card beside the briefing: the soldier carries whatever primary is equipped, over rank and progress to the next one.
  const r=rank();setHtml($('ops-figure'),BPIcons.soldier(Meta.loadout(save).primary,0));$('ops-op-rank').textContent='RANK '+r.rank+' · '+r.title;$('ops-op-xp').style.width=(r.into/r.span*100).toFixed(1)+'%';$('ops-op-next').textContent=fmt(r.span-r.into)+' XP TO RANK '+(r.rank+1);
  loadoutSlots($('loadout'));
  const resume=save.run?.mission===m.id;$('resume-run').hidden=!resume;if(resume)$('resume-run').innerHTML=`RESUME CHECKPOINT · ${esc(m.title)} <span>↗</span>`;$('deploy').querySelector('span').textContent=!open?'LOCKED':resume?'RESTART OPERATION':st?.done?'REPLAY OPERATION':'DEPLOY';$('deploy').disabled=!open;refreshWallet();}
 // The four loadout tiles (two guns, two gadgets), shared by the operations board and the squad lobby. A slot named in
 // "off" is shown but cannot be changed, with that note in place of its detail line.
 function loadoutSlots(box,off={}){const lo=Meta.loadout(save);box.replaceChildren();
  for(const [slot,label] of [['primary','PRIMARY'],['secondary','SECONDARY'],['lethal','LETHAL'],['tactical','TACTICAL']]){const key=lo[slot],b=document.createElement('button');b.type='button';b.className='slot'+(off[slot]?' locked':'');b.dataset.slot=slot;const w=slot==='primary'||slot==='secondary'?W[key]:null;
   b.innerHTML=`<div class="slot-art">${key?ICON(w?'weapon':'gear',key):''}</div><small>${label}</small><b>${esc(w?w.short:gearName(key))}</b><span>${off[slot]?esc(off[slot]):w?esc(w.name.split(' / ')[1]):key?'×'+(G[key].count+(save.upgrades.bandolier||0)):'EMPTY / CHOOSE'}</span>`;b.addEventListener('click',()=>{if(off[slot]){scene.audio.ui('deny');return;}openPicker(slot);});box.append(b);}}
 function loadoutChanged(){if(mode==='lobby'){renderLobby();lobbySync();}else renderOps();}
 function openPicker(slot){const list=$('picker-list'),gun=slot==='primary'||slot==='secondary';list.replaceChildren();$('picker-eyebrow').textContent=slot.toUpperCase();$('picker-title').textContent=gun?'CHOOSE A WEAPON.':'CHOOSE A GADGET.';
  const keys=gun?Object.keys(W).filter(k=>W[k].slot===(slot==='primary'?0:1)):[null,...Object.keys(G).filter(k=>G[k].slot===slot)];
  for(const key of keys){const have=key===null||(gun?save.owned.weapons:save.owned.gear).includes(key),item=key&&(gun?W[key]:G[key]),b=document.createElement('button');b.type='button';b.className='pick'+(save.loadout[slot]===key?' on':'')+(have?'':' locked');
   const lvl=gun?Meta.masteryLevel(save.mastery[key]||0):0;b.innerHTML=key===null?'<div class="pick-art"></div><div><b>NONE</b><span>Leave this slot empty.</span></div>':`<div class="pick-art">${ICON(gun?'weapon':'gear',key)}</div><div><b>${esc(item.name)}${gun&&lvl?' <em>'+'★'.repeat(lvl)+'</em>':''}</b><span>${have?esc(item.desc):'LOCKED · '+(item.drop?'DROPPED BY '+esc(item.drop).toUpperCase()+' · ':'')+'ARMORY '+fmt(item.price)+' CR'}</span></div>`;
   b.addEventListener('click',()=>{if(!have){$('picker').close();openArmory(gun?'weapons':'gear',key,mode==='lobby'?'lobby':'ops');return;}save.loadout[slot]=key;save.loadout=Meta.loadout(save);persist();$('picker').close();loadoutChanged();scene.audio.ui('select');});list.append(b);}
  $('picker').showModal();list.querySelector('.on,button')?.focus();}
 // ---------- armory ----------
 function openArmory(tab='weapons',item=null,from=mode==='ops'?'ops':mode==='complete'||mode==='dead'?'menu':'menu'){armoryTab=tab;armoryItem=item;armoryFrom=from;scene?.audio?.stopAmbient();setMode('armory');renderArmory();($('armory-list').querySelector('.active')||$('armory-list').querySelector('button'))?.focus();}
 function armoryBack(){if(armoryFrom==='lobby'&&lobby)showLobby();else if(armoryFrom==='ops')openOps(selected);else menu();}
 function bars(w){const max={damage:240*1,rate:16,range:1900,mobility:1.1,capacity:75},dps=w.damage*w.pellets/w.rate;return [['DAMAGE',Math.min(1,w.damage*w.pellets/200)],['FIRE RATE',Math.min(1,(1/w.rate)/16)],['RANGE',w.range/max.range],['MOBILITY',(w.mobility-.6)/.5],['MAGAZINE',Math.min(1,w.capacity/max.capacity)],['DPS',Math.min(1,dps/420)]].map(([l,v])=>`<div class="bar"><span>${l}</span><i style="--v:${Math.max(.04,Math.min(1,v)).toFixed(2)}"></i></div>`).join('');}
 function renderArmory(){for(const b of $('armory-tabs').children)b.classList.toggle('active',b.dataset.tab===armoryTab);const list=$('armory-list'),detail=$('armory-detail');list.replaceChildren();refreshWallet();
  list.hidden=armoryTab==='record';detail.classList.toggle('wide',armoryTab==='record');if(armoryTab==='record'){renderRecord(detail);return;}
  const entries=armoryTab==='weapons'?Object.keys(W).sort((a,b)=>W[a].slot-W[b].slot||W[a].price-W[b].price).map(k=>['weapon',k]):armoryTab==='gear'?Object.keys(G).sort((a,b)=>G[a].slot.localeCompare(G[b].slot)||G[a].price-G[b].price).map(k=>['gear',k]):Object.keys(U).map(k=>['upgrade',k]);
  if(!armoryItem||!entries.some(e=>e[1]===armoryItem))armoryItem=entries[0][1];
  for(const [kind,key] of entries){const item=kind==='weapon'?W[key]:kind==='gear'?G[key]:U[key],have=Meta.owns(save,kind,key),lvl=kind==='upgrade'?save.upgrades[key]||0:0,cost=Meta.price(save,kind,key),fresh=have&&kind!=='upgrade'&&!save.seen.includes(key)&&!['rifle','pistol'].includes(key),b=document.createElement('button');b.type='button';b.className='armory-item'+(key===armoryItem?' active':'')+(have?' owned':'');b.dataset.item=key;
   const tag=kind==='upgrade'?(lvl>=3?'MAX':'LV '+lvl+' · '+fmt(cost)+' CR'):have?(Object.values(save.loadout).includes(key)?'EQUIPPED':'OWNED'):fmt(cost)+' CR';
   b.innerHTML=`<span class="ai-art">${ICON(kind,key)}</span><span class="ai-kind">${kind==='weapon'?(item.slot===0?'PRIMARY':'SECONDARY'):kind==='gear'?item.slot.toUpperCase():'UPGRADE'}</span><b>${esc(item.name)}</b><span class="ai-tag${fresh?' new':''}">${fresh?'NEW · ':''}${tag}</span>`;
   b.addEventListener('click',()=>{armoryItem=key;renderArmory();});b.addEventListener('focus',()=>{if(armoryItem!==key){armoryItem=key;renderDetail(kind,key);for(const x of list.children)x.classList.toggle('active',x===b);}});list.append(b);}
  renderDetail(entries.find(e=>e[1]===armoryItem)[0],armoryItem);}
 function renderDetail(kind,key){const detail=$('armory-detail'),item=kind==='weapon'?W[key]:kind==='gear'?G[key]:U[key],have=Meta.owns(save,kind,key),cost=Meta.price(save,kind,key);
  if(have&&kind!=='upgrade'&&!save.seen.includes(key)){save.seen.push(key);persist();}
  let body='',actions=[];
  if(kind==='weapon'){const kills=save.mastery[key]||0,lvl=Meta.masteryLevel(kills),next=Meta.MASTERY[lvl];const slot=item.slot===0?'primary':'secondary';
   body=`<p class="ad-kind">${item.slot===0?'PRIMARY':'SECONDARY'} · ${item.cls.toUpperCase()}${item.pierce?' · PIERCES '+item.pierce:''}${item.explosive?' · EXPLOSIVE':''}${item.breach?' · BREACHES COVER':''}</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p><div class="bars">${bars(item)}</div>
    <div class="mastery"><b>MASTERY ${'★'.repeat(lvl)}${'☆'.repeat(3-lvl)}</b><span>${kills} KILLS${next?' · '+(next-kills)+' TO '+Meta.MASTERY_PERKS[lvl].toUpperCase():' · MASTERED'}</span></div><p class="ad-source">${have?'IN YOUR ARMORY':item.drop?'FIELD DROP: '+esc(item.drop).toUpperCase()+' — KILL ONE AND WALK OVER THE GUN':'ARMORY ONLY'}</p>`;
   if(have)actions.push([save.loadout[slot]===key?'EQUIPPED AS '+slot.toUpperCase():'EQUIP AS '+slot.toUpperCase(),()=>{save.loadout[slot]=key;save.loadout=Meta.loadout(save);persist();renderArmory();scene.audio.ui('select');}]);}
  else if(kind==='gear'){body=`<p class="ad-kind">${item.slot.toUpperCase()} GADGET · ${item.count} CHARGES PER MISSION</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p><p class="ad-source">${have?'IN YOUR ARMORY':'ARMORY ONLY'} · ${item.slot==='lethal'?keyLabel('grenade'):keyLabel('tactical')} TO USE</p>`;
   if(have)actions.push([save.loadout[item.slot]===key?'EQUIPPED':'EQUIP',()=>{save.loadout[item.slot]=key;save.loadout=Meta.loadout(save);persist();renderArmory();scene.audio.ui('select');}]);}
  else{const lvl=save.upgrades[key]||0;body=`<p class="ad-kind">PERMANENT UPGRADE · LEVEL ${lvl} / 3</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p><div class="pips">${[0,1,2].map(i=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</div>`;}
  if(!have&&cost!=null)actions.unshift([save.credits>=cost?`BUY · ${fmt(cost)} CR`:`${fmt(cost)} CR · NEED ${fmt(cost-save.credits)} MORE`,()=>{const r=Meta.buy(save,kind,key);if(!r.ok){toast(r.reason);scene.audio.ui('deny');return;}scene.audio.ui('buy');if(kind==='weapon'){save.loadout[item.slot===0?'primary':'secondary']=key;}else if(kind==='gear')save.loadout[item.slot]=key;save.loadout=Meta.loadout(save);if(kind!=='upgrade')save.seen.push(key);persist();renderArmory();banner('ARMORY',kind==='upgrade'?item.name+' LV '+save.upgrades[key]:item.name,kind==='upgrade'?'UPGRADE INSTALLED':'PURCHASED · EQUIPPED',2.2,'gold',ICON(kind,key));}]);
  detail.innerHTML=`<div class="ad-art ad-${kind}">${ICON(kind,key)}</div>`+body+'<div class="ad-actions"></div>';const box=detail.querySelector('.ad-actions');actions.forEach(([label,fn],i)=>{const b=document.createElement('button');b.type='button';b.className=i===0&&!have?'primary':'secondary';b.innerHTML=`<span>${label}</span>`;b.addEventListener('click',fn);box.append(b);});}
 function renderRecord(detail){const r=rank(),c=Meta.refreshContracts(save,today());persist();
  detail.innerHTML=`<p class="ad-kind">SERVICE RECORD / ROOK</p><h3>RANK ${r.rank} · ${esc(r.title)}</h3><div class="xp-track big"><i style="width:${(r.into/r.span*100).toFixed(1)}%"></i></div><p>${fmt(r.into)} / ${fmt(r.span)} XP TO RANK ${r.rank+1} · EVERY RANK PAYS ${150*(r.rank+1)} CR</p>
   <h4>DAILY CONTRACTS <small>RESET AT MIDNIGHT</small></h4><div class="contracts">${c.map(x=>`<div class="contract${x.done?' done':''}"><span>${esc(x.text)}</span><i style="--v:${(x.progress/x.goal).toFixed(2)}"></i><b>${x.done?'PAID':x.progress+' / '+x.goal} · ${x.reward} CR</b></div>`).join('')}</div>
   <h4>RECORD</h4><div class="record"><span>HOSTILES <b>${fmt(save.stats.kills)}</b></span><span>OPERATIONS <b>${save.stats.missions}</b></span><span>DAILY STREAK <b>${save.daily.streak}</b></span><span>HOLDOUT BEST <b>${DIFFS.map(d=>save.holdout[d]?DL[d].label[0]+save.holdout[d]:'').filter(Boolean).join(' · ')||'—'}</b></span></div>
   <h4>MEDALS</h4><div class="medal-table">${MISSIONS.map(m=>`<span>${String(m.n).padStart(2,'0')} ${Meta.unlocked(save,m.id)?esc(m.title):'CLASSIFIED'}<b class="medals">${medalRow(m.id)}</b></span>`).join('')}</div>`;}
 // ---------- runs ----------
 function launch(o){if(!scene)return;scene.audio.unlock();scene.audio.stopAmbient();for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  scene.sim=BPCore.create({training:o.mode==='training',mission:o.mission,difficulty:o.difficulty,checkpoint:o.checkpoint||null,loadout:o.loadout,owned:[...save.owned.weapons],profile:Meta.profile(save),seed:o.seed||1701,guest:o.guest||undefined});$('retry').hidden=false;scene.names=o.names||null;$('hud-name').textContent=lobby?callsign():'ROOK';
  const meta=missionMeta(o.mission),training=o.mode==='training',hold=o.mode==='holdout',hm=hold?holdoutMap(o.mission):null;padGadget=scene.sim.player.lethal||!scene.sim.player.tactical?'lethal':'tactical';
  scene.renderer.build(scene.sim);scene.accumulator=0;padAngle=padTarget=scene.sim.player.angle||0;padAimIdle=0;padReach=PAD_REACH;timeScale=1;scene.audio.startAmbient(scene.sim.map.theme);
  $('training-equipment').hidden=!training;$('range-weapon').value='rifle';$('chapter').textContent=training?'LIVE FIRE / ALL EQUIPMENT':hold?'HOLDOUT / '+DL[o.difficulty].label:meta.act+' · '+DL[o.difficulty].label;$('mission-title').textContent=training?'TRAINING RANGE':hold?hm.title:meta.title;$('sector').textContent=training?'FIELD LAB / SECTOR 00':hold?'SIMULATION / '+hm.sector:meta.sector;
  $('pause-copy').textContent=training?'The range waits. Nothing here changes your campaign.':hold?'Waves resume when you do. Dying ends the run and banks its credits.':'Your checkpoint is secure. The city can wait.';$('retry').textContent=training?'RESET THE RANGE':hold?'RESTART HOLDOUT':'RETRY CHECKPOINT';
  $('radio').hidden=true;radioUntil=0;$('banner').className='banner';setMode('playing');$('status').textContent=training?'TRAINING ACTIVE':'ROOK / SIGNAL ACTIVE';scene.scale.refresh();scene.game.canvas.focus();lastHud=0;hud();drain();
  if(!training&&!hold&&!o.checkpoint?.stage)banner(meta.act,meta.title,meta.sector,3.4);if(hold)banner('HOLDOUT',hm.title,'SURVIVE AS LONG AS YOU CAN',3);}
 function freshCheckpoint(){return {stage:0,time:0,kills:0,damage:0,flows:0,credits:0,intel:0,killed:[],dead:[]};}
 function startMission(id,resume=false){if(!Meta.unlocked(save,id))return;const lo=Meta.loadout(save);
  if(resume&&save.run?.mission===id){run={...save.run};launch({mode:'campaign',mission:id,difficulty:run.difficulty,checkpoint:run.checkpoint,loadout:lo});return;}
  run={mode:'campaign',mission:id,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};save.run={...run,checkpoint:freshCheckpoint()};persist();launch({mode:'campaign',mission:id,difficulty:run.difficulty,loadout:lo});}
 function startHoldout(mapId='holdout'){netRole='solo';run={mode:'holdout',mission:mapId,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};launch({mode:'holdout',mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed:1701+Math.floor(Math.random()*1e6)});}
 // HOLDOUT always opens the lobby: solo by default, and (desktop build only) the open squad slot can host or join a LAN game.
 function openHoldoutPicker(role='solo'){
  const list=$('picker-list');list.replaceChildren();$('picker-eyebrow').textContent='HOLDOUT';$('picker-title').textContent='CHOOSE A KILLHOUSE.';
  for(const h of HOLD){const open=holdoutOpen(h),b=document.createElement('button');b.type='button';b.className='pick'+(open?'':' locked')+(role==='lobby'&&lobby?.map===h.id?' on':'');
   b.innerHTML=`<div class="pick-art"></div><div><b>${esc(h.title)}</b><span>${open?esc(h.sector):'LOCKED · COMPLETE '+esc(missionMeta(h.locks)?.title||'')+' TO UNLOCK'}</span></div>`;
   b.addEventListener('click',()=>{if(!open){scene.audio.ui('deny');return;}$('picker').close();scene.audio.ui('select');if(role==='lobby')lobbySetMap(h.id);else startHoldout(h.id);});list.append(b);}
  if(!$('picker').open)$('picker').showModal();(list.querySelector('.on')||list.querySelector('button:not(.locked)'))?.focus();}
 // ---------- LAN co-op: squad lobby ----------
 // Both players sit in the same lobby screen. The host owns the killhouse, enemy pressure and the deploy countdown; each
 // side owns its own callsign, loadout and (for the guest) ready state. Guest -> host: hello, profile, chat, input.
 // Host -> guest: lobby, chat, countdown, countdownCancel, start, snapshot, events. Everything received is re-validated.
 const CALLSIGNS=['VIPER','GHOST','RAVEN','MAKO','ONYX','HAVOC','EMBER','NOMAD'],blueprints=new Map();
 function callsign(){if(!settings.callsign){settings.callsign=CALLSIGNS[Math.floor(Math.random()*CALLSIGNS.length)];persist();}return settings.callsign;}
 function myProfile(){return {name:callsign(),rank:rank().rank,loadout:Meta.loadout(save),ready:lobby?.role==='host'||!!lobby?.ready};}
 function cleanProfile(m){const lo=m?.loadout||{},rk=Math.max(1,Math.min(99,Math.floor(Number(m?.rank)||1)));
  return {name:BPSave.callsign(m?.name)||'OPERATOR',rank:rk,title:Meta.rankOf(Meta.need(rk)).title,ready:m?.ready===true,
   loadout:{primary:W[lo.primary]?.slot===0?lo.primary:'rifle',secondary:W[lo.secondary]?.slot===1?lo.secondary:'pistol',lethal:G[lo.lethal]?.slot==='lethal'?lo.lethal:null,tactical:G[lo.tactical]?.slot==='tactical'?lo.tactical:null}};}
 const lobbyLinked=()=>!!lobby&&(lobby.role==='host'?!!lobby.peer:lobby.phase==='linked');
 function lobbySync(){if(!lobbyLinked())return;if(lobby.role==='host')LINK.hostSend({type:'lobby',host:myProfile(),map:lobby.map,difficulty:settings.difficulty});else LINK.guestSend({type:'profile',...myProfile()});}
 function feed(text,who=''){if(!lobby)return;lobby.feed.push({who,text:String(text).slice(0,120)});if(lobby.feed.length>40)lobby.feed.shift();renderFeed();}
 function renderFeed(){const box=$('lobby-feed');box.replaceChildren();for(const f of lobby?.feed||[]){const row=document.createElement('p');if(f.who){const b=document.createElement('b');b.textContent=f.who;row.append(b);}else row.className='sys';row.append(f.text);box.append(row);}box.scrollTop=box.scrollHeight;}
 const ONLINE_ERRORS={'no-such-room':'NO LOBBY WITH THAT CODE / CHECK IT WITH THE HOST','room-full':'THAT LOBBY ALREADY HAS TWO PLAYERS',version:'THIS COPY OF THE GAME IS OUT OF DATE / UPDATE TO PLAY ONLINE',busy:'THE ONLINE SERVICE IS FULL / TRY AGAIN SHORTLY','too-many-attempts':'TOO MANY ATTEMPTS / WAIT A MINUTE AND TRY AGAIN'};
 const onlineError=err=>ONLINE_ERRORS[err?.message]||'COULD NOT REACH THE ONLINE SERVICE / CHECK YOUR CONNECTION';
 function openLobby(role,map,link='lan'){const via=role==='solo'?null:link==='online'?ONLINE:NET;if(!scene||role!=='solo'&&!via)return;netLeave();LINK=via;
  const l=lobby={role,link:via?link:null,code:'',ping:null,phase:role==='host'?'open':role==='guest'?'joining':'solo',map:map||HOLD[0].id,difficulty:settings.difficulty,peer:null,ready:false,feed:[],countdown:0,timer:null,addresses:[],status:'',host:'',inRun:false,runId:0};
  $('lobby-callsign').value=callsign();$('lobby-ip').value=link==='online'?'':settings.lastHost||'';$('lobby-chat').value='';
  if(role==='host'&&link==='online'){feed('OPENING AN ONLINE LOBBY');ONLINE.hostStart().then(code=>{if(lobby!==l)return;l.code=code;feed('LOBBY OPEN / SHARE YOUR ROOM CODE WITH YOUR SQUADMATE');renderLobby();},err=>{if(lobby!==l)return;l.status=onlineError(err);feed(l.status);renderLobby();});}
  else if(role==='host'){feed('LOBBY OPEN / SHARE YOUR ADDRESS WITH YOUR SQUADMATE');NET.listLocalAddresses().then(a=>{if(lobby===l){l.addresses=a;renderLobby();}});
   NET.hostStart().then(port=>{netPort=port;if(lobby===l)renderLobby();},()=>{if(lobby===l){l.status='COULD NOT OPEN PORT '+netPort+' / IS ANOTHER COPY OF THE GAME ALREADY HOSTING?';renderLobby();}});}
  else if(role==='guest')feed(link==='online'?"ENTER THE HOST'S ROOM CODE TO JOIN THEIR SQUAD":"ENTER THE HOST'S ADDRESS TO JOIN THEIR SQUAD");
  showLobby();(role==='guest'?$('lobby-ip'):role==='host'?$('lobby-map'):$('lobby-go')).focus({preventScroll:true});}
 // Also the way back from a finished run or the armory: a session that was mid-run drops back to "not ready" here.
 function showLobby(){if(!lobby)return;if(lobby.inRun){lobby.inRun=false;lobby.ready=false;netRole='solo';}
  scene.audio?.stopAmbient();scene.audio?.vitals(100,false);for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  setMode('lobby');$('status').textContent=lobby.role==='solo'?'HOLDOUT LOBBY':lobby.role==='host'?'SQUAD LOBBY / HOSTING':'SQUAD LOBBY';$('lobby').scrollTop=0;renderLobby();renderFeed();lobbySync();}
 // Leaving for the main menu ends the whole session: the host stops listening, the guest hangs up.
 function netLeave(){const l=lobby;netRole='solo';netConnected=false;netGuestInput={};if(!l)return;lobby=null;clearInterval(l.timer);$('retry').hidden=false;if(l.role==='host')LINK?.hostStop();else if(l.role==='guest')LINK?.guestDisconnect();LINK=null;}
 function blueprint(id){if(!blueprints.has(id)){let svg='';
   try{const s=BPCore.create({mission:id,difficulty:'standard',seed:1});svg=`<svg viewBox="0 0 ${s.map.width} ${s.map.height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`+s.walls.filter(b=>!b.dead).map(b=>`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.kind==='building'||b.kind==='rock'?'#8c9a7f':'#dfad70'}" opacity="${b.low?.3:.65}"/>`).join('')+'</svg>';}catch{}
   blueprints.set(id,svg);}return blueprints.get(id);}
 // The guest's co-op kit is guns only (see stepGuest in core.js), so their card and loadout never advertise gadgets.
 function operatorKit(lo,gadgets){const tiles=[['weapon',lo.primary,W[lo.primary].short],['weapon',lo.secondary,W[lo.secondary].short]];
  if(gadgets)tiles.push(['gear',lo.lethal,lo.lethal?GEAR_SHORT[lo.lethal]:'NO LETHAL'],['gear',lo.tactical,lo.tactical?GEAR_SHORT[lo.tactical]:'NO TACTICAL']);
  return tiles.map(([kind,key,name])=>`<span class="kit${key?'':' none'}"><i>${key?ICON(kind,key):''}</i><b>${esc(name)}</b></span>`).join('')+(gadgets?'':'<span class="kit note"><b>GUNS ONLY</b><small>CO-OP KIT</small></span>');}
 function setHtml(el,html){if(el.dataset.html!==html){el.dataset.html=html;el.innerHTML=html;return true;}return false;}
 function renderLobby(){const l=lobby;if(!l)return;const host=l.role==='host',solo=l.role==='solo',online=l.link==='online',lead=host||solo,linked=lobbyLinked(),mine=myProfile(),r=rank(),p=l.peer,counting=l.countdown>0,left=Math.max(1,Math.ceil((l.countdown-performance.now())/1000));
  $('lobby-eyebrow').innerHTML=`HOLDOUT <span>—</span> ${solo?'ENDLESS WAVES':online?'ONLINE CO-OP':'LAN CO-OP'}`;$('lobby-title').textContent=solo?'HOLDOUT LOBBY.':host?'YOUR SQUAD LOBBY.':p?p.name+"'S LOBBY.":'JOIN A SQUAD.';
  // What the other player needs to find this lobby: a room code online, an address on a LAN. Once linked it also shows the delay between the two.
  const share=online?l.code:l.addresses[0]||'',lag=linked&&l.ping!=null?' · PING '+l.ping+' MS':'';
  $('lobby-link').hidden=solo;$('lobby-link-label').textContent=(online?'ROOM CODE':host?'YOUR ADDRESS · PORT '+netPort:'HOST ADDRESS')+lag;
  $('lobby-link-value').textContent=host?(online?l.code||(l.status?'UNAVAILABLE':'OPENING…'):l.addresses.join('  ·  ')||'NO LAN ADDRESS FOUND'):linked?l.host:'NOT CONNECTED';$('lobby-copy').hidden=!host||!share;
  // Your own card keeps its callsign field alive across updates, so it is patched in place rather than rebuilt.
  $('op-self').className='operator self'+(lead||l.ready?' ready':'');$('op-self-tag').textContent=solo?'OPERATOR':host?'HOST':'SQUAD 02';$('op-self-state').textContent=solo?'READY':host?'LOBBY LEADER':!linked?'NOT CONNECTED':l.ready?'READY':'NOT READY';
  setHtml($('op-self-figure'),BPIcons.soldier(mine.loadout.primary,lead?0:1));if(document.activeElement!==$('lobby-callsign'))$('lobby-callsign').value=mine.name;$('op-self-rank').textContent='RANK '+r.rank+' · '+r.title;setHtml($('op-self-kit'),operatorKit(mine.loadout,lead));
  // The second card is your squadmate, an empty slot waiting for one, or (solo) the way to open the lobby to a friend.
  const peer=$('op-peer'),top=(tag,state)=>`<div class="op-top"><span class="op-tag">${tag}</span><span class="op-state">${state}</span></div>`;peer.className='operator'+(p?(host&&!p.ready?'':' ready'):' empty');
  setHtml(peer,p?`${top(host?'SQUAD 02':'HOST',host?(p.ready?'READY':'NOT READY'):'LOBBY LEADER')}<div class="op-figure">${BPIcons.soldier(p.loadout.primary,host?1:0)}</div><div class="op-plate"><label>SQUADMATE</label><b class="op-name">${esc(p.name)}</b><small>RANK ${p.rank} · ${esc(p.title)}</small></div><div class="op-kit">${operatorKit(p.loadout,!host)}</div>`
   :solo?`${top('SQUAD 02','OPEN SLOT')}<div class="op-figure">${BPIcons.soldier('rifle',1)}</div><div class="op-plate"><label>CO-OP</label><b class="op-name">BRING A FRIEND</b><small>${ONLINE&&NET?'PLAY TOGETHER ONLINE OR ON THE SAME NETWORK':ONLINE?'PLAY TOGETHER ONLINE WITH A ROOM CODE':NET?'TWO PLAYERS ON THE SAME NETWORK':'CO-OP NEEDS THE DESKTOP APP OR AN ONLINE SERVICE'}</small></div><div class="op-kit op-invite">${[[ONLINE,'online','ONLINE'],[NET,'lan','LAN']].filter(q=>q[0]).map(([,link,label])=>`<span class="invite-row"><em>${label}</em><button type="button" class="secondary" data-link="${link}" data-role="host">HOST</button><button type="button" class="secondary" data-link="${link}" data-role="guest">JOIN</button></span>`).join('')}</div>`
   :`${top(host?'SQUAD 02':'HOST',host?'OPEN SLOT':linked?'SYNCING':'NOT CONNECTED')}<div class="op-figure">${BPIcons.soldier('rifle',host?1:0)}</div><div class="op-plate"><label>${host?'SQUADMATE':'HOST'}</label><b class="op-name">${host?'WAITING<i>…</i>':'NO HOST YET'}</b><small>${host?(online?'SHARE YOUR ROOM CODE TO FILL THIS SLOT':'SHARE YOUR ADDRESS TO FILL THIS SLOT'):'CONNECT TO SEE THEIR LOBBY'}</small></div><div class="op-kit"></div>`);
  $('lobby-comms').hidden=solo;$('lobby-records').hidden=!solo;
  if(solo)setHtml($('lobby-records'),`<h4>YOUR BEST HOLDOUT RUNS <small>ONE RECORD PER ENEMY PRESSURE</small></h4><div class="rec-tiles">${DIFFS.map(d=>`<span class="rec-tile${d===settings.difficulty?' on':''}"><small>${DL[d].label}</small><b>${save.holdout[d]?'WAVE '+save.holdout[d]:'—'}</b></span>`).join('')}</div>`);
  $('lobby-join').hidden=lead||linked;$('lobby-brief').hidden=!lead&&!linked;$('lobby-join-status').textContent=lead?'':l.status;$('lobby-join-copy').textContent=online?'Ask the host for the five-character room code shown at the top of their lobby.':'Ask the host for the address shown at the top of their lobby.';$('lobby-ip').placeholder=online?'ROOM CODE':'192.168.1.23';$('lobby-ip').maxLength=online?5:64;$('lobby-connect').disabled=l.phase==='connecting';$('lobby-connect').textContent=l.phase==='connecting'?'CONNECTING…':'CONNECT';
  const hm=holdoutMap(l.map),diff=lead?settings.difficulty:l.difficulty;$('lobby-map-title').textContent=hm.title;$('lobby-map-sector').textContent=hm.sector;setHtml($('lobby-map-art'),blueprint(l.map));$('lobby-map').disabled=!lead;$('lobby-map-note').textContent=$('lobby-diff-note').textContent=lead?'':'SET BY THE HOST';
  // Rebuilt only when their content changes, so a squadmate's update never steals keyboard or controller focus.
  const dp=$('lobby-difficulty'),dsig=diff+'|'+lead;if(dp.dataset.sig!==dsig){dp.dataset.sig=dsig;dp.replaceChildren();for(const d of DIFFS){const b=document.createElement('button');b.type='button';b.className=(diff===d?'active ':'')+d;b.disabled=!lead;b.innerHTML=`<span>${DL[d].label}</span><small>×${DL[d].reward} CR</small>`;
    b.addEventListener('click',()=>{if(settings.difficulty===d)return;settings.difficulty=lobby.difficulty=d;persist();feed('ENEMY PRESSURE SET TO '+DL[d].label.toUpperCase());lobbyChanged();dp.querySelector('.active')?.focus({preventScroll:true});});dp.append(b);}}
  const box=$('lobby-loadout'),lsig=JSON.stringify([mine.loadout,lead,save.upgrades.bandolier||0]);if(box.dataset.sig!==lsig){box.dataset.sig=lsig;loadoutSlots(box,lead?{}:{lethal:'HOST ONLY IN CO-OP',tactical:'HOST ONLY IN CO-OP'});}
  $('lobby-loadout-note').textContent=lead?'TWO GUNS / ONE LETHAL / ONE TACTICAL':'TWO GUNS';
  const go=$('lobby-go'),label=go.querySelector('span');go.hidden=!lead&&!linked;go.classList.toggle('counting',counting);
  if(solo){go.disabled=false;label.textContent='DEPLOY';}
  else if(host){go.disabled=!p?.ready;label.textContent=counting?'DEPLOYING IN '+left+' · CANCEL':!p?'WAITING FOR A PLAYER':!p.ready?'WAITING FOR '+p.name:'DEPLOY SQUAD';}
  else{go.disabled=counting;label.textContent=counting?'DEPLOYING IN '+left:l.ready?'READY · STAND DOWN':'READY UP';}
  $('lobby-hint').textContent=solo?'Waves never end. Dying ends the run and banks its credits.'
   :host?(l.status||(!p?(online?'Your squadmate picks HOLDOUT, then JOIN under ONLINE, and enters your room code.':'Your squadmate picks HOLDOUT, then JOIN under LAN, and enters your address.'):counting?'Deploying both of you.':p.ready?'Everyone is ready.':p.name+' can change guns until they ready up.'))
   :!linked?'':counting?'The host is deploying the squad.':l.ready?'Waiting for the host to deploy.':'Pick your guns, then ready up.';
  $('lobby-leave').textContent=solo?'BACK TO MAIN MENU':'LEAVE LOBBY';}
 function lobbyChanged(){if(!lobby)return;if(lobby.role==='host')cancelCountdown();renderLobby();lobbySync();}
 function lobbySetMap(id){if(!lobby||lobby.role==='guest'||lobby.map===id)return;lobby.map=id;feed('KILLHOUSE SET TO '+holdoutMap(id).title);lobbyChanged();}
 function lobbyGo(){const l=lobby;if(!l)return;
  if(l.role==='solo'){lobby=null;startHoldout(l.map);}
  else if(l.role==='host'){if(l.countdown){cancelCountdown();return;}if(!l.peer?.ready)return;LINK.hostSend({type:'countdown',seconds:3});feed('DEPLOYING THE SQUAD');startCountdown(3);}
  else if(l.phase==='linked'&&!l.countdown){l.ready=!l.ready;scene.audio.ui('select');renderLobby();lobbySync();}}
 // Runs on both sides so each shows the same count; only the host's reaching zero starts the run (the guest waits for "start").
 function startCountdown(seconds){const l=lobby;clearInterval(l.timer);l.countdown=performance.now()+seconds*1000;let last=0;
  l.timer=setInterval(()=>{if(lobby!==l){clearInterval(l.timer);return;}if(mode!=='lobby'||l.role==='host'&&!l.peer?.ready){cancelCountdown();return;}
   const left=Math.ceil((l.countdown-performance.now())/1000);if(left<=0){clearInterval(l.timer);l.timer=null;if(l.role==='host')beginHostedRun(l.map);return;}
   if(left!==last){last=left;scene.audio.ui('tick');renderLobby();}},100);renderLobby();}
 function cancelCountdown(){const l=lobby;if(!l||!l.countdown)return;clearInterval(l.timer);l.timer=null;l.countdown=0;if(l.role==='host'){LINK.hostSend({type:'countdownCancel'});feed('DEPLOYMENT CANCELLED');}renderLobby();}
 async function lobbyConnect(){const l=lobby;if(!l||l.role!=='guest'||l.phase!=='joining')return;const ip=$('lobby-ip').value.trim();
  if(l.link==='online'){const code=ip.toUpperCase();if(!/^[A-Z0-9]{5}$/.test(code)){l.status='ENTER THE FIVE-CHARACTER ROOM CODE FROM THE TOP OF THE HOST\'S LOBBY';renderLobby();scene.audio.ui('deny');return;}
   l.phase='connecting';l.status='JOINING LOBBY '+code+'…';renderLobby();
   try{await ONLINE.guestConnect(code);}catch(err){if(lobby===l){l.phase='joining';l.status=onlineError(err);renderLobby();scene.audio.ui('deny');}return;}
   if(lobby!==l){if(lobby?.link!=='online')ONLINE.guestDisconnect();return;}
   l.phase='linked';l.host=code;l.status='';LINK.guestSend({type:'hello',...myProfile()});feed('JOINED LOBBY '+code);scene.audio.ui('select');renderLobby();$('lobby-go').focus({preventScroll:true});return;}
  if(!/^[A-Za-z0-9.:-]{1,64}$/.test(ip)){l.status="ENTER THE ADDRESS SHOWN AT THE TOP OF THE HOST'S LOBBY";renderLobby();scene.audio.ui('deny');return;}
  l.phase='connecting';l.status='CONNECTING TO '+ip.toUpperCase()+'…';renderLobby();
  try{await NET.guestConnect(ip,netPort);}catch{if(lobby===l){l.phase='joining';l.status='COULD NOT REACH '+ip.toUpperCase()+' / CHECK THE ADDRESS AND THAT THE HOST HAS A LOBBY OPEN';renderLobby();scene.audio.ui('deny');}return;}
  if(lobby!==l){if(lobby?.link!=='lan'||lobby.role!=='guest')NET.guestDisconnect();return;}
  l.phase='linked';l.host=ip;l.status='';settings.lastHost=ip;persist();LINK.guestSend({type:'hello',...myProfile()});feed('CONNECTED TO '+ip.toUpperCase());scene.audio.ui('select');renderLobby();$('lobby-go').focus({preventScroll:true});}
 function lobbySay(){const box=$('lobby-chat'),text=box.value.trim().slice(0,120);if(!lobby||!text)return;box.value='';feed(text,callsign());if(lobbyLinked())(lobby.role==='host'?LINK.hostSend:LINK.guestSend).call(LINK,{type:'chat',text});}
 function lobbyHeard(msg){const text=typeof msg.text==='string'?msg.text.trim().slice(0,120):'';if(text&&lobby.peer){feed(text,lobby.peer.name);if(mode==='lobby')scene.audio.ui('tick');}}
 // Each side times a round trip to the other every couple of seconds; the lobby and the in-game readout show it.
 function linkPing(msg){const l=lobby,send=m=>l.role==='host'?LINK.hostSend(m):LINK.guestSend(m);if(msg.type==='ping'){send({type:'pong',at:msg.at});return true;}
  if(msg.type!=='pong')return false;const rtt=performance.now()-Number(msg.at);if(rtt>=0&&rtt<60000){l.rtt=l.rtt==null?rtt:l.rtt*.7+rtt*.3;const shown=Math.max(1,Math.round(l.rtt));if(shown!==l.ping){l.ping=shown;if(mode==='lobby')renderLobby();}}return true;}
 setInterval(()=>{if(lobbyLinked()&&LINK)(lobby.role==='host'?LINK.hostSend:LINK.guestSend).call(LINK,{type:'ping',at:performance.now()});},2000);
 function onHostMsg(msg){const l=lobby;if(!l||l.role!=='host'||!msg)return;
  // Online only: the connection to the relay itself dropped, which takes the room and the squadmate with it.
  if(msg.type==='linkLost'){onHostMsg({type:'guestLeft'});l.code='';l.status='CONNECTION TO THE ONLINE SERVICE WAS LOST / LEAVE AND HOST AGAIN';feed(l.status);renderLobby();return;}
  if(linkPing(msg))return;
  if(msg.type==='guestJoined'){l.peer=cleanProfile(msg);netConnected=true;feed(l.peer.name+' JOINED THE SQUAD');scene.audio.ui('select');renderLobby();lobbySync();}
  else if(msg.type==='guestLeft'){const name=l.peer?.name;l.peer=null;netConnected=false;netGuestInput={};cancelCountdown();if(name)feed(name+' LEFT THE SQUAD');
   // A squadmate who leaves takes the revive mechanic with them: nobody is left to carry tags, so a host who was
   // already down has lost the run, and one still standing simply carries on alone.
   if(l.inRun&&['playing','paused'].includes(mode)){const sim=scene.sim;if(sim.guest){sim.guest.dead=true;sim.guest.vanished=true;}sim.tags=[];if(sim.player.dead&&!sim.dead){sim.dead=true;sim.events.push({type:'death'});}else toast('PLAYER DISCONNECTED / CONTINUING SOLO');}renderLobby();}
  else if(!l.peer)return;
  else if(msg.type==='profile'){const was=l.peer.ready;l.peer=cleanProfile(msg);if(was!==l.peer.ready){feed(l.peer.name+(l.peer.ready?' IS READY':' STOOD DOWN'));if(mode==='lobby')scene.audio.ui(l.peer.ready?'select':'tick');if(!l.peer.ready)cancelCountdown();}renderLobby();}
  else if(msg.type==='chat')lobbyHeard(msg);
  else if(msg.type==='input'&&msg.input&&typeof msg.input==='object'){netGuestInput=cleanInput(msg.input);if(Number.isInteger(msg.seq))netGuestSeq=msg.seq;netGuestFresh=true;netGuestAt=performance.now();}}
 function beginHostedRun(mapId){const l=lobby;if(!l||l.role!=='host')return;clearInterval(l.timer);l.timer=null;l.countdown=0;l.inRun=true;netRole='host';netGuestInput={};netBroadcastAt=0;wallsSent=new Map();netGuestSeq=0;netGuestFresh=false;netGuestAt=performance.now();
  run={mode:'holdout',mission:mapId,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};const seed=1701+Math.floor(Math.random()*1e6);
  launch({mode:'holdout',mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed,guest:l.peer?{loadout:l.peer.loadout}:undefined,names:l.peer?{player:callsign(),guest:l.peer.name,self:'player'}:null});
  LINK.hostSend({type:'start',mission:mapId,difficulty:run.difficulty,seed});}
 // ---------- co-op netcode ----------
 // The host simulates; the guest sends input and draws what the host reports. Three things keep that playable beyond a LAN:
 //  - updates are small: numbers are rounded, a wall is only mentioned when it changes, and fields only the simulation
 //    needs are left out (about a fifth of the original size, before the relay compresses it);
 //  - between updates the guest keeps everything moving along its last reported velocity, so motion is smooth at any rate;
 //  - the guest moves its own operator at once from its own input, using the movement rule the host applies, and is then
 //    eased toward the host's answer. Inputs are numbered and each update says which one it includes, so the comparison
 //    is against where the guest was when it sent that input, not where it has got to since.
 const NET_ROUND=(k,v)=>typeof v==='number'&&v%1?Math.round(v*100)/100:v,SIM_ONLY=['lastX','lastY','side','clip','cooldown','burstT','burstAim','seen','woke','hunt','zone','spawned'],
  SNAP_KEYS=['player','guest','enemies','projectiles','grenades','zones','mines','hazards','spawnWarnings','pickups','decoy','director','goal','progress','stage','stats','dark','dead','completed','time','boss','tags','station'];
 let wallsSent=new Map(),netGuestSeq=0,netGuestFresh=false,netGuestAt=0,netSeq=0,netSendIn=0,netTaps={},netHist=[],pred={ready:false};
 const leanOp=op=>op&&{...op,ammo:Object.fromEntries(op.slots.map(k=>[k,op.ammo[k]])),reserve:Object.fromEntries(op.slots.map(k=>[k,op.reserve[k]]))};
 function buildSnapshot(s){const walls=[];
  // Both sides build the same map, so a wall is only sent once it differs from how it started, and then only when it changes again.
  for(const w of s.walls){const sig=(w.dead?'x':'')+(Number.isFinite(w.hp)?Math.round(w.hp):''),known=wallsSent.get(w.id);if(known===sig)continue;wallsSent.set(w.id,sig);
   if(known===undefined&&!w.deployed&&!w.dead&&!(w.hp<w.maxHp))continue;walls.push(known===undefined&&w.deployed?w:Number.isFinite(w.hp)?{id:w.id,dead:w.dead,hp:w.hp}:{id:w.id,dead:w.dead});}
  return {player:leanOp(s.player),guest:leanOp(s.guest),enemies:s.enemies.map(e=>{const o={...e};for(const k of SIM_ONLY)delete o[k];return o;}),walls,
   projectiles:s.projectiles.filter(b=>b.active).map(b=>({active:true,x:b.x,y:b.y,vx:b.vx,vy:b.vy,enemy:b.enemy,weapon:b.weapon,explosive:b.explosive})),
   grenades:s.grenades,zones:s.zones,mines:s.mines,hazards:s.hazards,spawnWarnings:s.spawnWarnings,pickups:s.pickups,decoy:s.decoy,director:s.director,goal:s.goal,progress:s.progress,stage:s.stage,stats:s.stats,dark:s.dark,dead:s.dead,completed:s.completed,time:s.time,boss:s.boss,tags:s.tags,station:s.station,ack:netGuestSeq};}
 // Guest input arrives from another machine, so it is rebuilt field by field before the simulation ever sees it.
 function cleanInput(i){const n=v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0,on=k=>i[k]===true;
  return {mx:n(i.mx),my:n(i.my),aimX:Number.isFinite(i.aimX)?i.aimX:undefined,aimY:Number.isFinite(i.aimY)?i.aimY:undefined,sprint:on('sprint'),fire:on('fire'),aiming:on('aiming'),melee:on('melee'),meleeDown:on('meleeDown'),reload:on('reload'),swap:on('swap'),interactDown:on('interactDown'),slot:i.slot===0||i.slot===1?i.slot:undefined};}
 // One guest frame: gather input (single presses are held until the next send so none are lost), send it thirty times
 // a second, then move everything on screen forward by one frame.
 function guestFrame(s,dt){const own=s.guest,fi=input();for(const k of ['swap','melee','reload'])if(fi[k])netTaps[k]=true;if(fi.slot!==undefined)netTaps.slot=fi.slot;
  netSendIn-=dt;if(netSendIn<=0){netSendIn=1/30;netSeq++;LINK?.guestSend({type:'input',seq:netSeq,input:{mx:fi.mx,my:fi.my,aimX:fi.aimX,aimY:fi.aimY,sprint:fi.sprint,fire:fi.fire,aiming:fi.aiming,meleeDown:fi.meleeDown,interactDown:fi.interactDown,...netTaps}});netTaps={};
   if(pred.ready){netHist.push({seq:netSeq,x:pred.x,y:pred.y});if(netHist.length>150)netHist.shift();}}
  s.time+=dt;for(const e of s.enemies){if(e.dead){e.deathAge=(e.deathAge||0)+dt;continue;}e.x+=e.vx*dt;e.y+=e.vy*dt;e.shotAge=(e.shotAge||0)+dt;if(e.attack>0)e.attackAge=Math.min(e.attack,e.attackAge+dt);}
  for(const b of s.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;}
  const mate=s.player;if(mate&&!mate.dead){mate.x+=mate.vx*dt;mate.y+=mate.vy*dt;mate.shotAge+=dt;if(['roll','dive','slide','vault','melee'].includes(mate.state))mate.age+=dt;}
  if(!own||own.dead){pred.ready=false;return;}
  // Own operator: the host's movement rule (see stepGuest in core.js), run here on local input in the same fixed steps.
  if(!pred.ready)pred={ready:true,x:own.x,y:own.y,vx:own.vx||0,vy:own.vy||0,carry:0,angle:own.angle};
  const w=W[own.slots[own.slot]]||W.rifle,len=Math.hypot(fi.mx,fi.my),nx=len?fi.mx/len:0,ny=len?fi.my/len:0,sprint=fi.sprint&&len>0&&own.stamina>4&&!fi.fire&&!fi.aiming&&!own.reload,speed=(sprint?360:fi.aiming?175:250)*w.mobility*(own.state==='melee'?.45:own.reload?.7:1),body={x:pred.x,y:pred.y,radius:16},step=BPCore.DT,ease=Math.min(1,step*(len?25:31));
  pred.carry=Math.min(pred.carry+dt,.1);while(pred.carry>=step){pred.carry-=step;pred.vx+=(nx*speed-pred.vx)*ease;pred.vy+=(ny*speed-pred.vy)*ease;BPCore.move(s,body,pred.vx*step,pred.vy*step);}
  pred.x=body.x;pred.y=body.y;if(Number.isFinite(fi.aimX))pred.angle=Math.atan2(fi.aimY-pred.y,fi.aimX-pred.x);
  Object.assign(own,{x:pred.x,y:pred.y,vx:pred.vx,vy:pred.vy,angle:pred.angle});own.shotAge+=dt;if(own.state!=='melee')own.state=sprint?'sprint':len?'run':'idle';if(Math.hypot(pred.vx,pred.vy)>8)own.moveAngle=Math.atan2(pred.vy,pred.vx);}
 // An update has arrived. Compare the host's position for our operator with where we were when we sent the input it
 // includes (about half a send interval later, since the host has been applying it for a little while). A small
 // difference is eased out over the next few updates; a large one - a revive, a blast - is simply accepted.
 function reconcile(payload){const g=payload.guest;if(!g||typeof g!=='object'||!pred.ready||g.dead){pred.ready=false;netHist=[];return;}
  const at=netHist.findIndex(h=>h.seq===payload.ack),snap=()=>{Object.assign(pred,{x:g.x,y:g.y,vx:g.vx||0,vy:g.vy||0});netHist=[];};
  if(at<0){if(Math.hypot(g.x-pred.x,g.y-pred.y)>90)snap();}
  else{const a=netHist[at],b=netHist[at+1]||pred,ex=g.x-(a.x+b.x)/2,ey=g.y-(a.y+b.y)/2;netHist.splice(0,at);
   if(Math.hypot(ex,ey)>90)snap();else{pred.x+=ex*.18;pred.y+=ey*.18;for(const h of netHist){h.x+=ex*.18;h.y+=ey*.18;}}}
  Object.assign(g,{x:pred.x,y:pred.y,vx:pred.vx,vy:pred.vy,angle:pred.angle});}
 function onGuestMsg(msg){const l=lobby;if(!l||l.role!=='guest'||!msg)return;
  // A failed or abandoned connection attempt also reports "hostClosed"; it only means something once we were linked.
  if(msg.type==='hostClosed'){if(l.phase!=='linked')return;const was=l.inRun;clearInterval(l.timer);l.timer=null;l.countdown=0;l.phase='joining';l.peer=null;l.ready=false;l.status=was?'THE HOST DISCONNECTED / RUN ENDED':'THE HOST CLOSED THE LOBBY';feed(l.status);if(was)showLobby();else renderLobby();return;}
  if(l.phase!=='linked'||linkPing(msg))return;
  switch(msg.type){
  case 'lobby':{const first=!l.peer,map=HOLD.some(h=>h.id===msg.map)?msg.map:l.map,diff=DIFFS.includes(msg.difficulty)?msg.difficulty:l.difficulty;l.peer={...cleanProfile(msg.host),ready:true};
   if(first)feed('JOINED '+l.peer.name+"'S SQUAD");else{if(map!==l.map)feed('KILLHOUSE SET TO '+holdoutMap(map).title);if(diff!==l.difficulty)feed('ENEMY PRESSURE SET TO '+DL[diff].label.toUpperCase());}
   l.map=map;l.difficulty=diff;renderLobby();break;}
  case 'chat':lobbyHeard(msg);break;
  case 'countdown':if(!l.inRun&&mode==='lobby'){feed('THE HOST IS DEPLOYING THE SQUAD');startCountdown(Math.max(1,Math.min(10,Number(msg.seconds)||3)));}break;
  case 'countdownCancel':if(l.countdown){cancelCountdown();feed('DEPLOYMENT CANCELLED');}break;
  case 'start':beginGuestRun(msg);break;
  case 'snapshot':if(l.inRun&&scene.sim&&msg.payload&&typeof msg.payload==='object'){reconcile(msg.payload);applySnapshot(scene.sim,msg.payload);}break;
  case 'events':if(l.inRun&&Array.isArray(msg.list))for(const e of msg.list){scene.renderer.event(e);scene.audio.event(e);onEvent(e,true);}break;}}
 // Only the parts of the world an update is supposed to carry are taken from it. Wall entries change a wall we already
 // have, or add one the host deployed during the run.
 function applySnapshot(sim,payload){if(Array.isArray(payload.walls)&&sim.walls){const byId=new Map(sim.walls.map(w=>[w.id,w]));for(const w of payload.walls){if(!w||typeof w!=='object')continue;const existing=byId.get(w.id);if(existing)Object.assign(existing,w);else if(w.deployed&&Number.isFinite(w.x)&&Number.isFinite(w.y))sim.walls.push(w);}}
  for(const k of SNAP_KEYS)if(k in payload)sim[k]=payload[k];}
 function beginGuestRun(o){const l=lobby;if(!l||!HOLD.some(h=>h.id===o.mission)||!DIFFS.includes(o.difficulty))return;clearInterval(l.timer);l.timer=null;l.countdown=0;l.inRun=true;l.runId++;netRole='guest';netSeq=0;netSendIn=0;netTaps={};netHist=[];pred={ready:false};
  for(const d of [$('picker'),$('settings')])if(d.open)d.close();scene.audio.unlock();scene.audio.stopAmbient();for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  run={mode:'holdout',mission:o.mission,difficulty:o.difficulty,floor:o.difficulty,deaths:0};
  scene.sim=BPCore.create({mission:o.mission,difficulty:o.difficulty,loadout:Meta.loadout(save),seed:o.seed||1701});scene.names={player:l.peer?.name||'HOST',guest:callsign(),self:'guest'};
  const hm=holdoutMap(o.mission);scene.renderer.build(scene.sim,scene.sim.player);scene.accumulator=0;timeScale=1;scene.audio.startAmbient(scene.sim.map.theme);
  $('training-equipment').hidden=true;$('chapter').textContent='HOLDOUT / '+DL[o.difficulty].label;$('mission-title').textContent=hm.title;$('sector').textContent='SIMULATION / '+hm.sector;
  // The simulation lives on the host, so a guest can step away but cannot pause or restart it.
  $('pause-copy').textContent='The fight carries on without you. Only the host can pause or restart the run.';$('retry').hidden=true;$('hud-name').textContent=callsign();
  $('radio').hidden=true;radioUntil=0;$('banner').className='banner';setMode('playing');$('status').textContent='ROOK / SIGNAL ACTIVE';scene.scale.refresh();scene.game.canvas.focus();lastHud=0;
  banner('HOLDOUT',hm.title,'SURVIVE AS LONG AS YOU CAN',3);}
 function startTraining(){run={mode:'training',mission:'range',difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};launch({mode:'training',mission:'range',difficulty:settings.difficulty});}
 // Hosting a squad: restarting from the pause menu restarts for both players; after a finished run it leads back to the lobby.
 function retry(){if(!run)return;if(lobby?.role==='host'&&lobby.inRun){if(mode==='paused')beginHostedRun(run.mission);else showLobby();return;}if(run.mode==='training')startTraining();else if(run.mode==='holdout')startHoldout(run.mission);else startMission(run.mission,!!save.run);}
 function pause(){if(mode!=='playing')return;if(netRole==='guest'&&LINK){netSeq++;LINK.guestSend({type:'input',seq:netSeq,input:{}});}setMode('paused');scene.audio.pause();$('resume').focus();}
 function resume(){if(mode!=='paused')return;scene.audio.unlock();scene.audio.resume();scene.audio.startAmbient(scene.sim.map.theme);setMode('playing');scene.accumulator=0;scene.game.canvas.focus();}
 function menu(){netLeave();scene?.audio.stopAmbient();scene?.audio.vitals(100,false);for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];setMode('menu');updateContinue();$('continue').focus();}
 function payDifficulty(){return DIFFS[Math.min(DIFFS.indexOf(run.difficulty),DIFFS.indexOf(run.floor||run.difficulty))];}
 function end(e){const s=scene.sim;scene.audio.stopAmbient();scene.audio.vitals(100,false);$('debrief').hidden=true;$('ending-next').hidden=true;$('ending-armory').hidden=run.mode==='training';
  if(e.type==='complete'&&run.mode==='campaign'){const meta=missionMeta(run.mission),summary=Meta.summarize(s,{rating:e.rating,score:e.score,deaths:run.deaths||0,difficulty:payDifficulty()}),report=Meta.settle(save,summary,today());save.run=null;persist();setMode('complete');
   $('ending-eyebrow').textContent='CHAPTER '+meta.n+' / '+meta.title+' / COMPLETE';$('ending-title').innerHTML=['NO ONE IS<br>COMING.','THE QUARTER<br>FALLS SILENT.','THE LOG<br>NAMES HIM.','UNDER THE<br>CORDON.','THE KEY<br>TURNS.','EVERY NAME<br>BURNS.'][meta.n-1];$('ending-copy').textContent=meta.outro;
   $('run-stats').innerHTML=`<span>FIELD RATING<b>${e.rating}</b></span><span>HOSTILES<b>${s.stats.kills}</b></span><span>BEST COMBO<b>×${s.stats.bestCombo}</b></span><span>TIME<b>${formatTime(e.time)}</b></span>`;
   const next=MISSIONS[meta.n];$('ending-next').hidden=!next;if(next)$('ending-next').innerHTML=`NEXT · ${esc(next.title)} <b>↗</b>`;$('ending-retry').textContent='REPLAY '+meta.title+' ↗';debrief(report);(next?$('ending-next'):$('ending-retry')).focus();return;}
  if(run.mode==='holdout'){const summary=Meta.summarize(s,{difficulty:payDifficulty()}),report=Meta.settle(save,summary,today());save.stats.deaths++;persist();setMode('dead');$('ending-eyebrow').textContent='HOLDOUT / '+DL[run.difficulty].label;$('ending-title').innerHTML=`WAVE ${s.stats.wave}<br>SURVIVED.`;$('ending-copy').textContent=report.newBest?'A new personal record. The killhouse resets — and so do you.':'Every wave you cleared paid out. Spend it, then come back for one more.';
   $('run-stats').innerHTML=`<span>WAVES<b>${s.stats.wave}</b></span><span>HOSTILES<b>${s.stats.kills}</b></span><span>BEST COMBO<b>×${s.stats.bestCombo}</b></span><span>TIME<b>${formatTime(s.time)}</b></span>`;$('ending-retry').textContent=lobby?'BACK TO THE LOBBY ↗':'GO AGAIN ↗';debrief(report);$('ending-retry').focus();return;}
  setMode('dead');if(run.mode==='campaign'){run.deaths=(run.deaths||0)+1;if(save.run)save.run.deaths=run.deaths;save.stats.deaths++;persist();}
  const meta=missionMeta(run.mission);$('ending-eyebrow').textContent='ROOK / SIGNAL LOST';$('ending-title').innerHTML='STAY IN<br>THE FIGHT.';
  $('ending-copy').textContent=s.training?'Live fire got the better of you. Reset the range and try a different approach.':(s.difficulty==='insane'?'Insane punishes open ground. Fight from corners, break line of sight when a telegraph lights up, and relocate before grenades land. ':'Your last checkpoint is secure. Watch attack telegraphs and use cover. ')+(meta?.rec?.note||'');
  $('ending-retry').textContent=s.training?'RESET THE RANGE ↗':'RETRY CHECKPOINT ↗';$('run-stats').innerHTML=`<span>HOSTILES<b>${s.stats.kills}</b></span><span>TIME<b>${formatTime(s.time)}</b></span>${run.mode==='campaign'?`<span>CREDITS AT RISK<b>${fmt(s.stats.credits)}</b></span>`:''}`;$('ending-retry').focus();}
 // The tally counts each line up with a tick, then fills the XP bar and calls out rank-ups, medals, mastery and contracts.
 function debrief(report){const box=$('debrief-lines'),awards=$('debrief-awards');box.replaceChildren();awards.replaceChildren();$('debrief').hidden=false;$('debrief-credits').textContent='0';const before=report.rankBefore,after=report.rankAfter||before;
  $('xp-rank').textContent='RANK '+before.rank+' · '+before.title;$('xp-fill').style.transition='none';$('xp-fill').style.width=(before.into/before.span*100)+'%';$('xp-note').textContent='+'+fmt(report.xp)+' XP';
  let total=0,t=350;const later=(fn,ms)=>debriefTimers.push(setTimeout(fn,ms));
  for(const l of report.lines){later(()=>{const row=document.createElement('div');row.className='dl';row.innerHTML=`<span>${esc(l.label)}${l.note?' <small>'+esc(l.note)+'</small>':''}</span><b>+0</b>`;box.append(row);const b=row.querySelector('b'),start=performance.now(),from=total;total+=l.value;const to=total;scene.audio.ui('tick');
    const step=()=>{const k=Math.min(1,(performance.now()-start)/320);b.textContent='+'+fmt(l.value*k);$('debrief-credits').textContent=fmt(from+(to-from)*k);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);box.scrollTop=box.scrollHeight;},t);t+=Math.max(140,420-report.lines.length*18);}
  later(()=>{$('debrief-credits').textContent=fmt(report.credits);scene.audio.ui('total');$('xp-fill').style.transition='width .9s cubic-bezier(.2,.8,.2,1)';$('xp-fill').style.width=(after.rank>before.rank?100:after.into/after.span*100)+'%';refreshWallet();},t+200);
  const award=(cls,eyebrow,title,sub,sound,art='')=>{const a=document.createElement('div');a.className='award '+cls;a.innerHTML=`${art?'<div class="award-art">'+art+'</div>':''}<small>${esc(eyebrow)}</small><b>${esc(title)}</b><span>${esc(sub)}</span>`;awards.append(a);scene.audio.ui(sound);};
  t+=1150;for(const r of report.rankUps){later(()=>{$('xp-rank').textContent='RANK '+r.rank+' · '+r.title;$('xp-fill').style.transition='none';$('xp-fill').style.width='0%';requestAnimationFrame(()=>{$('xp-fill').style.transition='width .7s ease';$('xp-fill').style.width=(after.rank===r.rank?after.into/after.span*100:100)+'%';});award('gold','RANK UP','RANK '+r.rank+' · '+r.title,'+'+r.bonus+' CR','rank');},t);t+=700;}
  for(const m of report.medals){later(()=>award('medal','MEDAL',m.name,'+150 CR','medal'),t);t+=380;}
  for(const m of report.mastery){later(()=>award('mastery','WEAPON MASTERY',W[m.weapon].short+' '+'★'.repeat(m.level),m.perk.toUpperCase(),'medal',ICON('weapon',m.weapon)),t);t+=380;}
  for(const c of report.contracts.filter(c=>c.done)){later(()=>award('contract','CONTRACT',c.text,'PAID','medal'),t);t+=300;}
  if(report.newBest)later(()=>award('best','NEW PERSONAL BEST','RECORD','SAVED TO YOUR SERVICE RECORD','medal'),t);}
 function onEvent(e,isGuest=false){const s=scene.sim;
  // A guest never owns save/run state (the host's save is authoritative for this pass), so it skips every
  // branch below that would persist() or settle() a run, and shows a plain message instead of a full ending.
  if(isGuest&&(e.type==='death'||e.type==='complete')){const token=lobby?.runId;toast(e.type==='death'?'SQUAD WIPED OUT / BACK TO THE LOBBY':'RUN COMPLETE / BACK TO THE LOBBY',2.5);setTimeout(()=>{if(lobby?.inRun&&lobby.runId===token)showLobby();},2500);return;}
  if(isGuest&&['checkpoint','unlock','weaponfound'].includes(e.type))return;
  switch(e.type){
  case 'radio':radio(e);break;case 'toast':toast(e.text);break;case 'flow':toast('PERFECT FLOW / MOMENTUM RETAINED',1.5);break;
  case 'checkpoint':if(run?.mode==='campaign'){save.run={...run,checkpoint:e.checkpoint};persist();}break;
  case 'unlock':for(const k of e.items){if(W[k]&&!save.owned.weapons.includes(k))save.owned.weapons.push(k);if(G[k]&&!save.owned.gear.includes(k))save.owned.gear.push(k);}persist();banner('SUPPLY CACHE','M870 + FRAG GRENADES','SHOTGUN ON THE GROUND · '+keyLabel('interact')+' TO SWAP IT IN',4,'gold',ICON('weapon','shotgun'));break;
  case 'weaponfound':if(!save.owned.weapons.includes(e.weapon)){save.owned.weapons.push(e.weapon);persist();}banner('NEW WEAPON',W[e.weapon].name,'ADDED TO YOUR ARMORY · '+keyLabel('interact')+' TO EQUIP NOW',3.6,'gold',ICON('weapon',e.weapon));break;
  case 'pickup':if(e.kind!=='weapon')toast(e.kind==='health'?'HEALTH RESTORED':e.kind==='armor'?'ARMOR REINFORCED':e.kind==='supply'?'FIELD EQUIPMENT RESTORED':e.kind==='lethal'?'LETHAL RESUPPLIED':e.kind==='tactical'?'TACTICAL RESUPPLIED':e.kind==='intel'||e.kind==='cache'?'':'AMMUNITION RECOVERED',1.5);break;
  case 'intel':banner('CLASSIFIED','INTEL RECOVERED','+200 CR ON COMPLETION · MEDAL',3,'gold',ICON('pickup','intel'));break;case 'cache':toast('CREDIT CACHE / +120 CR',2);break;
  case 'objective':banner(e.partial?'OBJECTIVE':'OBJECTIVE COMPLETE',e.partial?e.name:e.name.toUpperCase(),'',2.4);break;
  case 'stage':if(e.stage>0){const st=s.map.stages[e.stage];setTimeout(()=>{if(mode==='playing')banner('NEW OBJECTIVE',st.name.toUpperCase(),st.hint,3);},2500);}break;
  case 'kill':comboUntil=performance.now()+3500;if(e.combo>=2){const name={2:'DOUBLE KILL',3:'TRIPLE KILL',5:'RAMPAGE',8:'UNSTOPPABLE',12:'BLACKOUT'}[e.combo];if(name)banner('×'+e.combo+' COMBO',name,'',1.4,'combo');}
   if(e.boss){slowUntil=performance.now()+1100;banner('TARGET DOWN',A[e.enemy].name+' DESTROYED','',3,'gold');}break;
  case 'waveclear':banner('WAVE '+e.wave+' CLEARED','+'+e.bonus+' CR','SUPPLIES RESTOCKED',2.6,'gold');slowUntil=performance.now()+700;break;
  case 'wave':banner('HOLDOUT','WAVE '+e.wave,e.wave%5===0?'COMMANDER INBOUND':'',2,e.wave%5===0?'danger':'');break;
  case 'armorbreak':toast('ARMOR BROKEN',1.4);break;case 'bossphase':toast('THE '+A[s.enemies.find(x=>x.id===e.id)?.type||'commander'].name+' IS ADAPTING',2);break;
  case 'flash':if(e.self&&!settings.flash){$('flashout').style.transition='none';$('flashout').style.opacity='.85';requestAnimationFrame(()=>{$('flashout').style.transition='opacity 1.3s ease-out';$('flashout').style.opacity='0';});}break;
  // Co-op: one operator down is a setback, not the end. Both players get told who fell and what happens next.
  case 'down':case 'tags':case 'revive':{const self=netRole==='guest'?'guest':'player',mine=e.who===self,mate=scene.names?.[self==='guest'?'player':'guest']||'YOUR SQUADMATE';
   if(e.type==='down')banner(mine?'OPERATOR DOWN':'SQUADMATE DOWN',mine?'YOU ARE DOWN':mate+' IS DOWN',mine?mate+' HAS TO CARRY YOUR DOG TAGS TO THE REVIVE STATION':'GRAB THEIR DOG TAGS / TAKE THEM TO THE REVIVE STATION',4.5,'danger');
   else if(e.type==='tags')toast(mine?mate+' HAS YOUR TAGS / HANG ON':'DOG TAGS RECOVERED / HOLD '+keyLabel('interact')+' AT THE REVIVE STATION',3);
   else banner('REVIVED',mine?'BACK IN THE FIGHT':mate+' IS BACK IN THE FIGHT','',2.8,'gold');break;}
  case 'death':case 'complete':end(e);break;}}
 function drain(){if(!scene?.sim)return;const events=scene.sim.events.splice(0);if(netRole==='host'&&netConnected&&events.length)LINK.hostSend({type:'events',list:events});for(const e of events){scene.renderer.event(e);scene.audio.event(e);onEvent(e);if(mode!=='playing'&&(e.type==='death'||e.type==='complete'))break;}}
 function formatTime(time){return Math.floor(time/60).toString().padStart(2,'0')+':'+Math.floor(time%60).toString().padStart(2,'0');}
 function minimap(s){const sx=148/s.map.width,sy=114/s.map.height;let svg='<svg viewBox="0 0 148 114" aria-label="Mission map">';for(const b of s.walls)if(!b.dead&&(b.kind==='building'||b.kind==='rock'))svg+=`<rect x="${b.x*sx}" y="${b.y*sy}" width="${b.w*sx}" height="${b.h*sy}" fill="${b.kind==='rock'?'#4f5a4c':'#68755e'}" opacity=".55"/>`;else if(!b.dead&&b.kind==='gate')svg+=`<rect x="${b.x*sx}" y="${b.y*sy}" width="${Math.max(1.5,b.w*sx)}" height="${Math.max(1.5,b.h*sy)}" fill="#d18c72"/>`;
  const own=me(s),mate=s.guest&&(own===s.guest?s.player:s.guest);
  for(const e of s.enemies)if(e.active&&!e.dead&&!(e.gone>0)&&BPCore.distance(e,own)<1000)svg+=`<circle cx="${e.x*sx}" cy="${e.y*sy}" r="${A[e.type].boss?2.6:1.4}" fill="#d18c72"/>`;if(!s.training&&BPCore.stageDef(s).kind!=='endless')svg+=`<rect x="${s.goal.x*sx-2}" y="${s.goal.y*sy-2}" width="4" height="4" fill="none" stroke="#e2b074" stroke-width="1"/>`;
  if(s.station)svg+=`<path d="M${s.station.x*sx-3} ${s.station.y*sy}h6m-3-3v6" stroke="#9fd08a" stroke-width="1.4" fill="none"/>`;for(const q of s.tags||[])if(!q.carrier)svg+=`<circle cx="${q.x*sx}" cy="${q.y*sy}" r="2.2" fill="none" stroke="#e2b074" stroke-width="1.2"/>`;
  if(mate&&!mate.dead)svg+=`<circle cx="${mate.x*sx}" cy="${mate.y*sy}" r="2" fill="#8fe3ff"/>`;svg+=`<circle cx="${own.x*sx}" cy="${own.y*sy}" r="2" fill="#e3e6c9"/></svg>`;return svg;}
 // Whose vitals and weapons the HUD shows: your own character, which for a co-op guest is s.guest, not the host's s.player.
 function me(s){return netRole==='guest'&&s.guest||s.player;}
 // Who the camera follows: your own operator, or your squadmate while you are down and they are still fighting.
 function watch(s){const own=me(s),mate=s.guest&&(own===s.guest?s.player:s.guest);return own.dead&&mate&&!mate.dead?mate:own;}
 // What X / E would do right now. Controller X reloads when this is empty.
 function context(){const s=scene.sim,p=s.player,st=BPCore.stageDef(s),own=me(s);
  // Co-op: standing on the revive station with a squadmate's tags turns interact into the revive hold.
  if(s.station&&(s.tags||[]).some(q=>q.carrier===(own===s.guest?'guest':'player'))&&!own.dead&&BPCore.distance(own,s.station)<=64)return {kind:'revive',label:'HOLD TO REVIVE '+(scene.names?.[own===s.guest?'player':'guest']||'SQUADMATE')};if(!s.training&&['clear','extract'].includes(st.kind)&&BPCore.distance(st,p)<90)return {kind:'interact',label:st.kind==='extract'?'EXTRACT':'INTERACT'};const gun=BPCore.nearbyWeapon(s);if(gun)return {kind:'weapon',label:'SWAP FOR '+W[gun.weapon].short,weapon:gun.weapon};
  if(s.training&&s.pickups.some(o=>o.type==='supply'&&BPCore.distance(o,p)<100))return {kind:'interact',label:'RESUPPLY'};if(s.walls.some(b=>!b.dead&&b.low&&b.kind!=='underpass'&&BPCore.circleBox(p.x+Math.cos(p.angle)*48,p.y+Math.sin(p.angle)*48,35,b)||!b.dead&&b.low&&b.kind!=='underpass'&&BPCore.circleBox(p.x+p.vx*.2,p.y+p.vy*.2,35,b)))return {kind:'vault',label:'VAULT LOW COVER'};return null;}
 const ICON=(kind,key)=>BPIcons.svg(kind,key),GEAR_SHORT={frag:'FRAG',incendiary:'INCENDIARY',mine:'PROX MINE',flash:'FLASHBANG',smoke:'SMOKE',emp:'EMP',decoy:'DECOY',cover:'COVER'};
 function setArt(el,kind,key){const id=kind+':'+(key||'');if(el.dataset.art===id)return false;el.dataset.art=id;el.innerHTML=key?ICON(kind,key):'';return true;}
 // Equipped weapon panel: picture, slot, magazine (pips for small magazines), reserve, and the other gun waiting on the swap key.
 function weaponHud(s){const p=me(s),key=p.slots[p.slot],w=W[key],alt=p.slots[1-p.slot],box=$('weapon-hud');
  if(setArt($('weapon-art'),'weapon',key)){box.classList.remove('swapped');void box.offsetWidth;box.classList.add('swapped');}
  $('weapon-slot-label').textContent=`${keyLabel('slot'+(p.slot+1))} · ${p.slot===0?'PRIMARY':'SECONDARY'}`;$('weapon-name').textContent=w.name;
  const ammo=p.ammo[key],reserve=p.reserve[key],low=p.reload<=0&&ammo<=Math.max(1,w.capacity*.2),dry=ammo===0&&reserve===0,k=p.reload>0?1-p.reload/p.reloadTotal:0;
  $('ammo').textContent=p.reload>0?'—':String(ammo).padStart(2,'0');$('ammo').classList.toggle('low',low);$('reserve').textContent=p.reload>0?'RELOADING':dry?'NO AMMO':'/ '+reserve;box.classList.toggle('reloading',p.reload>0);box.classList.toggle('dry',dry);box.classList.toggle('low',low&&!dry);
  const mag=$('mag');if(w.capacity<=12){if(mag.dataset.cap!==key){mag.dataset.cap=key;mag.className='mag mag-pips';mag.innerHTML='<i></i>'.repeat(w.capacity);}[...mag.children].forEach((pip,i)=>pip.classList.toggle('on',p.reload>0?i<Math.floor(k*w.capacity):i<ammo));}
  else{if(mag.dataset.cap!=='bar'){mag.dataset.cap='bar';mag.className='mag mag-bar';mag.innerHTML='<i></i>';}mag.firstChild.style.width=((p.reload>0?k:ammo/w.capacity)*100).toFixed(1)+'%';}
  const slots=$('weapon-slots'),sig=alt+'|'+keyLabel('swap')+'|'+p.slot;if(slots.dataset.sig!==sig){slots.dataset.sig=sig;slots.innerHTML=`<div class="alt-art">${ICON('weapon',alt)}</div><span class="alt-name">${esc(keyLabel('slot'+(2-p.slot)))} · ${esc(W[alt].short)}</span><b class="alt-ammo"></b><span class="alt-key"><kbd>${esc(keyLabel('swap'))}</kbd> SWAP</span>`;}
  slots.querySelector('.alt-ammo').textContent=p.ammo[alt]+' / '+p.reserve[alt];}
 // Stim, lethal and tactical tiles: picture, count, key, and a fill bar while the stim is injecting. Counts bump when they change.
 function gearHud(s){const p=me(s),box=$('equipment'),tiles=[['pickup','stim','gadget',p.stims,'STIM',p.heal>0?1-p.heal/p.healTotal:0],['gear',p.lethal,'grenade',p.grenades,p.lethal?GEAR_SHORT[p.lethal]:'NO LETHAL',0],['gear',p.tactical,'tactical',p.tacticals,p.tactical?GEAR_SHORT[p.tactical]:'NO TACTICAL',0]];
  if(box.children.length!==3)box.innerHTML='<div class="equip"><kbd></kbd><div class="eq-art"></div><b class="eq-count"></b><small class="eq-name"></small><i class="eq-fill"></i></div>'.repeat(3);
  tiles.forEach(([kind,key,action,count,name,fill],i)=>{const el=box.children[i],cnt=el.querySelector('.eq-count'),txt=key?'×'+count:'—',slot=i===1?'lethal':i===2?'tactical':null,picked=padActive&&slot===padGadget;setArt(el.querySelector('.eq-art'),kind,key);
   // On a controller one button deploys the selected gadget; the other tile shows the switch button instead.
   el.querySelector('kbd').textContent=padActive&&slot?keyLabel(picked?'grenade':'cycle'):keyLabel(action);el.classList.toggle('selected',picked);
   if(cnt.textContent!==txt){if(cnt.textContent){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}cnt.textContent=txt;}el.querySelector('.eq-name').textContent=name;el.classList.toggle('empty',!key||count<=0);el.classList.toggle('active',fill>0);el.querySelector('.eq-fill').style.width=(fill*100).toFixed(0)+'%';});}
 function hud(){const s=scene.sim,p=me(s),key=p.slots[p.slot],w=W[key],st=BPCore.stageDef(s),now=performance.now();$('objective').textContent=st.name;$('objective-hint').textContent=st.hint;
  const prog=st.kind==='destroy'||st.kind==='survive'||st.kind==='endless';$('objective-progress').hidden=!prog;if(prog)$('objective-fill').style.width=(st.kind==='endless'?(s.director.phase==='rest'?100:0):s.progress*100)+'%';if(st.kind==='survive')$('objective-hint').textContent=`${Math.max(0,Math.ceil(st.time-s.director.clock))}s remaining · ${st.hint}`;if(st.kind==='endless')$('objective').textContent=s.director.wave?`Wave ${s.director.wave} · ${s.enemies.filter(e=>!e.dead).length+s.spawnWarnings.length+(s.director.queue?.length||0)} hostiles`:'Get ready';
  // Co-op with someone down: the objective line says what has to happen next, for whichever side of it you are on.
  if(s.guest&&!s.guest.vanished&&(s.player.dead||s.guest.dead)&&!s.dead){const mate=scene.names?.[p===s.guest?'player':'guest']||'Your squadmate',held=(s.tags||[]).some(q=>q.carrier);
   if(p.dead){$('objective').textContent='You are down';$('objective-hint').textContent=held?mate+' has your dog tags and is heading for the revive station.':mate+' has to pick up your dog tags and carry them to the revive station.';}
   else{$('objective').textContent=held?'Carry the tags to the revive station':'Recover '+mate+"'s dog tags";$('objective-hint').textContent=held?'Follow the green marker, then hold '+keyLabel('interact')+' on the pad for '+BPCore.REVIVE_TIME+' seconds.':'Follow the amber marker to where they fell.';}$('objective-progress').hidden=true;}
  $('health-number').textContent=Math.ceil(p.health);$('health-bar').style.width=p.health+'%';$('health-bar').style.background=p.health<30?'#d18b70':'#d3ddbb';$('armor-bar').style.width=Math.min(100,p.armor/p.maxArmor*100)+'%';$('stamina-bar').style.width=p.stamina+'%';$('armor').textContent=Math.ceil(p.armor);
  gearHud(s);
  weaponHud(s);
  $('state-label').textContent=p.dead?'DOWN':p.heal>0?'HEALING':p.reload>0?'RELOADING':p.state==='idle'?'READY':p.state.toUpperCase();$('elapsed').textContent=formatTime(s.time);$('net-ping').hidden=!(lobby?.inRun&&lobby.ping!=null);if(lobby?.ping!=null)$('net-ping').textContent='PING '+lobby.ping+' MS';$('flow').textContent=s.flowTime>0?'PERFECT FLOW':'';$('minimap').innerHTML=minimap(s);
  $('run-credits').textContent=s.training?'RANGE':fmt(s.stats.credits)+' CR';const combo=now<comboUntil&&s.combo>=2;$('combo-mult').textContent=combo?'×'+s.combo+' COMBO':'';$('combo').classList.toggle('hot',combo);
  const boss=s.boss&&s.enemies.find(e=>e.id===s.boss);$('boss').hidden=!boss;if(boss){const t=A[boss.type];$('boss-name').textContent=t.name;$('boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';$('boss-note').textContent=t.barrier?(boss.barrierOff?'BARRIER DESTROYED':boss.shieldDown>0?'BARRIER DOWN · '+Math.ceil(boss.shieldDown)+'s':'BARRIER UP · BREAK A GENERATOR OR EMP IT'):t.armor?(boss.disabled>0?'SYSTEMS DOWN · FULL DAMAGE':'HEAVY ARMOUR · EXPLOSIVES'):t.blink?'RELOCATES AFTER EVERY SHOT':'';}
  const c=context();$('interact-prompt').hidden=!c;if(c){$('interact-prompt').querySelector('kbd').textContent=keyLabel('interact');$('interact-prompt').querySelector('span').textContent=c.label;}$('interact-prompt').classList.toggle('has-art',c?.kind==='weapon');setArt($('prompt-art'),'weapon',c?.kind==='weapon'?c.weapon:null);
  if(s.time>radioUntil)$('radio').hidden=true;if(now>toastUntil)$('toast').style.opacity='0';if(now>bannerUntil)$('banner').classList.remove('show');scene.audio.pressure(s.director.pressure);
  document.body.classList.toggle('downed',!!p.dead&&!s.dead);const hurt=mode==='playing'&&p.health<35&&!s.dead&&!p.dead?1-p.health/35:0,el=$('danger');el.style.opacity=hurt?(.35+.6*hurt).toFixed(2):p.heal>0?'0':'0';el.classList.toggle('pulse',!!hurt&&!settings.flash);el.style.setProperty('--beat',(.45+.7*(p.health/35)).toFixed(2)+'s');document.body.classList.toggle('healing',p.heal>0);scene.audio.vitals(p.health,mode==='playing'&&!s.dead&&!p.dead);
 }
 function bindButton(list,label,value,listening,prompt,pick){const button=document.createElement('button');button.type='button';button.innerHTML=`<span>${label}</span><b>${listening?prompt:value}</b>`;button.classList.toggle('listening',listening);button.addEventListener('click',pick);list.append(button);return button;}
 function bindings(){const list=$('bindings'),padList=$('pad-bindings');list.replaceChildren();padList.replaceChildren();
  for(const [key,label] of Object.entries(labels))bindButton(list,label,displayKey(settings.bindings[key]),bindingTarget===key,'PRESS KEY',()=>{bindingTarget=key;padBindingTarget=null;bindings();}).dataset.action=key;
  for(const key of Object.keys(BPSave.padBindings))bindButton(padList,padActionLabel(key),BPGamepad.glyphs[pad.brand||'generic'][settings.padBindings[key]],padBindingTarget===key,'PRESS BUTTON',()=>{padBindingTarget=key;bindingTarget=null;bindings();}).dataset.padAction=key;
  strip();menuHint();}
 function showSettings(){if(mode==='playing')pause();for(const id of ['difficulty','volume','shake','quality'])$(id).value=settings[id];for(const id of ['music','flash','gamepad','aimAssist'])$(id).checked=settings[id];padStatus();bindings();$('settings').showModal();$('settings').querySelector('button,select,input')?.focus({preventScroll:true});}
 function settingsChanged(){settings.difficulty=$('difficulty').value;settings.volume=Number($('volume').value);settings.shake=Number($('shake').value);settings.music=$('music').checked;settings.flash=$('flash').checked;settings.gamepad=$('gamepad').checked;settings.aimAssist=$('aimAssist').checked;settings.quality=$('quality').value;padStatus();
  if(scene){scene.settings=settings;if(scene.sim&&['playing','paused'].includes(mode)&&run){scene.sim.difficulty=settings.difficulty;if(DIFFS.indexOf(settings.difficulty)<DIFFS.indexOf(run.floor||run.difficulty))run.floor=settings.difficulty;if(save.run&&run.mode==='campaign')save.run.floor=run.floor;}scene.audio.settings=settings;scene.audio.stopAmbient();if(mode==='playing')scene.audio.startAmbient(scene.sim.map.theme);score();backdrop();}if(mode==='ops')renderOps();if(mode==='lobby'&&lobby&&lobby.role!=='guest'&&lobby.difficulty!==settings.difficulty){lobby.difficulty=settings.difficulty;lobbyChanged();}persist();}
 $('continue').addEventListener('click',()=>openOps());$('training').addEventListener('click',startTraining);$('holdout').addEventListener('click',()=>openLobby('solo'));$('armory-button').addEventListener('click',()=>openArmory('weapons',null,'menu'));
 $('deploy').addEventListener('click',()=>startMission(selected,false));$('resume-run').addEventListener('click',()=>startMission(selected,true));$('ops-armory').addEventListener('click',()=>openArmory('weapons',null,'ops'));$('ops-settings').addEventListener('click',showSettings);$('ops-back').addEventListener('click',menu);
 $('armory-back').addEventListener('click',armoryBack);for(const b of $('armory-tabs').children)b.addEventListener('click',()=>{armoryTab=b.dataset.tab;armoryItem=null;renderArmory();});
 $('picker-close').addEventListener('click',()=>$('picker').close());
 $('pause-button').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('retry').addEventListener('click',retry);$('exit').addEventListener('click',menu);$('ending-menu').addEventListener('click',menu);$('ending-retry').addEventListener('click',()=>{if(mode==='complete'&&run.mode==='campaign'){startMission(run.mission,false);}else retry();});
 $('ending-next').addEventListener('click',()=>{const meta=missionMeta(run.mission),next=MISSIONS[meta.n];if(next)openOps(next.id);});$('ending-armory').addEventListener('click',()=>openArmory('weapons',null,lobby?'lobby':'menu'));
 // Squad lobby controls. The callsign is cleaned as it is typed and announced to the squad once the field is left.
 $('lobby-go').addEventListener('click',lobbyGo);$('lobby-map').addEventListener('click',()=>{if(lobby&&lobby.role!=='guest')openHoldoutPicker('lobby');});$('op-peer').addEventListener('click',e=>{const b=e.target.closest('[data-link]');if(b&&lobby?.role==='solo'){scene.audio.ui('select');openLobby(b.dataset.role,lobby.map,b.dataset.link);}});$('lobby-armory').addEventListener('click',()=>openArmory('weapons',null,'lobby'));$('lobby-settings').addEventListener('click',showSettings);$('lobby-leave').addEventListener('click',menu);
 $('lobby-copy').addEventListener('click',()=>{const b=$('lobby-copy'),done=ok=>{b.textContent=ok?'COPIED':'COPY FAILED';setTimeout(()=>{b.textContent='COPY';},1400);};try{navigator.clipboard.writeText(lobby.link==='online'?lobby.code:lobby.addresses[0]).then(()=>done(true),()=>done(false));}catch{done(false);}});
 const isEnter=e=>e.code==='Enter'||e.code==='NumpadEnter';
 $('lobby-connect').addEventListener('click',lobbyConnect);$('lobby-ip').addEventListener('keydown',e=>{if(isEnter(e))lobbyConnect();});$('lobby-send').addEventListener('click',lobbySay);$('lobby-chat').addEventListener('keydown',e=>{if(isEnter(e))lobbySay();});
 $('lobby-callsign').addEventListener('input',e=>{const el=e.target,at=el.selectionStart,clean=el.value.toUpperCase().replace(/[^A-Z0-9 _-]/g,'');if(clean!==el.value){el.value=clean;el.setSelectionRange(at,at);}});
 $('lobby-callsign').addEventListener('change',e=>{settings.callsign=BPSave.callsign(e.target.value)||callsign();e.target.value=settings.callsign;persist();renderLobby();lobbySync();});$('lobby-callsign').addEventListener('keydown',e=>{if(isEnter(e))e.target.blur();});
 $('settings-button').addEventListener('click',showSettings);$('pause-settings').addEventListener('click',showSettings);$('settings').addEventListener('close',()=>{bindingTarget=padBindingTarget=null;settingsChanged();});$('settings').addEventListener('cancel',()=>{bindingTarget=padBindingTarget=null;});for(const id of ['difficulty','volume','shake','quality','music','flash','gamepad','aimAssist'])$(id).addEventListener('change',settingsChanged);
 $('reset-bindings').addEventListener('click',()=>{settings.bindings={...BPSave.bindings};settings.padBindings={...BPSave.padBindings};bindingTarget=padBindingTarget=null;bindings();persist();});$('sound').addEventListener('click',()=>{settings.muted=!settings.muted;$('sound').textContent=settings.muted?'SOUND OFF':'SOUND ON';persist();if(scene){scene.audio.unlock();scene.audio.stopAmbient();if(mode==='playing')scene.audio.startAmbient(scene.sim.map.theme);score();}});$('sound').textContent=settings.muted?'SOUND OFF':'SOUND ON';strip();menuHint();
 const option=(sel,value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;$(sel).append(o);};
 for(const [key,w] of Object.entries(W))option('range-weapon',key,w.name);for(const [key,g] of Object.entries(G))option(g.slot==='lethal'?'range-lethal':'range-tactical',key,g.name);
 $('range-weapon').addEventListener('change',()=>{if(!scene.sim?.training)return;const key=$('range-weapon').value,p=scene.sim.player;p.slots[W[key].slot]=key;p.slot=W[key].slot;p.reload=0;hud();});
 for(const kind of ['lethal','tactical'])$('range-'+kind).addEventListener('change',()=>{if(!scene.sim?.training)return;scene.sim.player[kind]=$('range-'+kind).value;hud();});
 window.addEventListener('keydown',e=>{if(padActive)setPadActive(false);if(padBindingTarget&&e.code==='Escape'){e.preventDefault();padBindingTarget=null;bindings();return;}if(bindingTarget){e.preventDefault();if(e.code==='Escape'){bindingTarget=null;bindings();return;}if(!e.repeat){const old=settings.bindings[bindingTarget],other=Object.keys(settings.bindings).find(k=>settings.bindings[k]===e.code);if(other)settings.bindings[other]=old;settings.bindings[bindingTarget]=e.code;bindingTarget=null;bindings();persist();}return;}if($('settings').open||$('picker').open)return;
  if(mode==='lobby'&&e.target instanceof HTMLInputElement){if(e.code==='Escape')e.target.blur();return;}
  if(e.code==='Escape'){e.preventDefault();if(mode==='playing')pause();else if(mode==='paused')resume();else if(mode==='ops'||mode==='lobby'){scene.audio.ui('back');menu();}else if(mode==='armory'){scene.audio.ui('back');armoryBack();}return;}if(mode!=='playing')return;if(Object.values(settings.bindings).includes(e.code)){e.preventDefault();if(!held.has(e.code))pressed.add(e.code);held.add(e.code);}}, {passive:false});
 window.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});window.addEventListener('pagehide',()=>{if(scene){scene.audio.destroy();scene.game.destroy(true);}});
 window.addEventListener('wheel',e=>{if(mode==='playing'&&Math.abs(e.deltaY)>4)wheelSwap=true;},{passive:true});
 window.addEventListener('pointermove',e=>{if(padActive&&Math.hypot(e.movementX,e.movementY)>3)setPadActive(false);});window.addEventListener('pointerdown',()=>{if(padActive)setPadActive(false);});
 window.addEventListener('gamepadconnected',()=>{padStatus();if(settings.gamepad&&mode==='playing')toast((BPGamepad.brandName[pad.brand]||'CONTROLLER')+' CONNECTED');});window.addEventListener('gamepaddisconnected',()=>{padStatus();if(padActive&&mode==='playing')pause();});
 function menuRoot(){return $('picker').open?$('picker'):$(mode==='paused'?'pause':['dead','complete'].includes(mode)?'ending':mode);}
 function padMenu(state){const root=menuRoot(),header=$('picker').open?[]:[$('sound'),$('settings-button')],buttons=[...root.querySelectorAll('button'),...header].filter(b=>b&&b.offsetParent!==null&&!b.disabled),at=buttons.indexOf(document.activeElement),flick=Math.abs(state.move.y)>.6?Math.sign(state.move.y):0;
  let dir=Number(state.tap.has('down')||state.tap.has('right'))-Number(state.tap.has('up')||state.tap.has('left'));if(flick!==padMenuStick){padMenuStick=flick;dir=dir||flick;}
  if(mode==='armory'&&!$('picker').open&&(state.tap.has('lb')||state.tap.has('rb'))){const tabs=['weapons','gear','upgrades','record'];armoryTab=tabs[(tabs.indexOf(armoryTab)+(state.tap.has('rb')?1:3))%4];armoryItem=null;renderArmory();$('armory-list').querySelector('button')?.focus();return;}
  if(state.tap.has('b')){if($('picker').open||['paused','ops','lobby','armory'].includes(mode))scene.audio.ui('back');if($('picker').open)$('picker').close();else if(mode==='paused')resume();else if(mode==='ops'||mode==='lobby')menu();else if(mode==='armory')armoryBack();return;}
  if(at<0){if(dir||state.tap.has('a'))buttons[0]?.focus();return;}
  if(dir){const nextBtn=buttons[(at+dir+buttons.length)%buttons.length];nextBtn.focus();nextBtn.scrollIntoView({block:'nearest'});}if(state.tap.has('a'))buttons[at].click();}
 // Full controller navigation for the settings dialog: up/down moves between every control (buttons, selects,
 // checkboxes, ranges); left/right adjusts the focused control's value when it has one, otherwise also navigates.
 function padSettings(state){
  if(padBindingTarget){if(state.tap.has('start')){padBindingTarget=null;bindings();return;}
   const name=[...state.tap].find(n=>n!=='start');if(name){const b=settings.padBindings,other=Object.keys(b).find(k=>b[k]===name);if(other)b[other]=b[padBindingTarget];b[padBindingTarget]=name;padBindingTarget=null;bindings();persist();}
   return;}
  if(bindingTarget)return;
  if(state.tap.has('b')||state.tap.has('start')){$('settings').close();return;}
  const fields=[...$('settings').querySelectorAll('button,select,input')].filter(el=>el.offsetParent!==null&&!el.disabled),at=fields.indexOf(document.activeElement);
  const flick=Math.abs(state.move.y)>.6?Math.sign(state.move.y):0;
  let vdir=Number(state.tap.has('down'))-Number(state.tap.has('up'));if(flick!==padMenuStick){padMenuStick=flick;vdir=vdir||flick;}
  const hdir=Number(state.tap.has('right'))-Number(state.tap.has('left'));
  if(at<0){if(vdir||hdir||state.tap.has('a'))fields[0]?.focus();return;}
  const field=fields[at],adjustable=field.tagName==='SELECT'||field.type==='range'||field.type==='checkbox';
  if(hdir&&adjustable){
   if(field.tagName==='SELECT')field.selectedIndex=Math.max(0,Math.min(field.options.length-1,field.selectedIndex+hdir));
   else if(field.type==='range'){const step=Number(field.step)||.05,min=Number(field.min),max=Number(field.max);field.value=Math.round(Math.min(max,Math.max(min,Number(field.value)+step*hdir))*100)/100;}
   else field.checked=!field.checked;
   field.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const dir=vdir||hdir;
  if(dir){const next=fields[(at+dir+fields.length)%fields.length];next.focus();next.scrollIntoView({block:'nearest'});return;}
  if(state.tap.has('a')){if(field.tagName==='BUTTON')field.click();else if(field.type==='checkbox'){field.checked=!field.checked;field.dispatchEvent(new Event('change',{bubbles:true}));}}
 }
 function pollPad(dt){const state=settings.gamepad?pad.poll():null;if(!state){padState=null;if(padActive)setPadActive(false);return;}
  if(state.active&&!padActive)setPadActive(true);
  if($('settings').open){padSettings(state);return;}
  if(state.tap.has('start')&&mode==='playing'){pause();return;}if(state.tap.has('start')&&mode==='paused'){resume();return;}
  if(mode!=='playing'){padMenu(state);return;}
  padState=state;const pb=settings.padBindings,p=me(scene.sim),aimHeld=state.down.has(pb.aim),stick=state.aim.len?Math.atan2(state.aim.y,state.aim.x):null;for(const [action,name] of Object.entries(pb))if(state.tap.has(name))padTaps.add(action);
  // Aim assist: pressing steady aim locks onto the best target the gun is roughly facing; pulling the stick away switches target or releases.
  if(!aimHeld||!settings.aimAssist)padLock=null;else if(state.tap.has(pb.aim))padLock=assistTarget(padAngle);
  if(padLock){padLockLost=BPCore.lineOfSight(scene.sim,p,padLock)?0:padLockLost+dt;if(padLock.dead||padLock.gone>0||padLockLost>.35)padLock=null;else if(stick!==null&&Math.abs(wrapAngle(stick-Math.atan2(padLock.y-p.y,padLock.x-p.x)))>ASSIST_BREAK)padLock=assistTarget(stick);}
  if(padLock){padTarget=Math.atan2(padLock.y-p.y,padLock.x-p.x);padAimIdle=0;}else if(stick!==null){padTarget=stick;padAimIdle=0;}else{padAimIdle+=dt;if(padAimIdle>.8&&state.move.len&&!state.down.has(pb.fire)&&!aimHeld)padTarget=Math.atan2(state.move.y,state.move.x);}
  padAngle+=wrapAngle(padTarget-padAngle)*(1-Math.exp(-dt*(padLock?ASSIST_TURN:PAD_TURN)));padReach+=((padLock?Math.max(60,BPCore.distance(p,padLock)):PAD_REACH)-padReach)*(1-Math.exp(-dt*18));}
 function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
 function assistTarget(angle){const s=scene.sim,p=me(s),view=scene.cameras.main.worldView;let best=null,bestScore=Infinity;padLockLost=0;
  for(const e of s.enemies){if(e.dead||e.gone>0||!view.contains(e.x,e.y)||!BPCore.lineOfSight(s,p,e))continue;const off=Math.abs(wrapAngle(Math.atan2(e.y-p.y,e.x-p.x)-angle)),score=off+BPCore.distance(p,e)/3000;if(off<ASSIST_CONE&&score<bestScore){best=e;bestScore=score;}}
  return best;}
 const padPointer={get x(){const cam=scene.cameras.main,p=me(scene.sim);return p.x+Math.cos(p.angle)*padReach-cam.midPoint.x+cam.width/2;},get y(){const cam=scene.cameras.main,p=me(scene.sim);return p.y+Math.sin(p.angle)*padReach-cam.midPoint.y+cam.height/2;}};
 function input(){const b=settings.bindings,pb=settings.padBindings,g=padState,down=key=>held.has(b[key])||!!g&&g.down.has(pb[key]),tap=key=>pressed.has(b[key])||padTaps.has(key);
  let mx=Number(down('right'))-Number(down('left')),my=Number(down('down'))-Number(down('up')),aimX,aimY;if(g&&g.move.len&&!mx&&!my){mx=g.move.x;my=g.move.y;}
  if(padActive){const p=me(scene.sim);aimX=p.x+Math.cos(padAngle)*padReach;aimY=p.y+Math.sin(padAngle)*padReach;}else{const pointer=scene.input.activePointer,world=scene.cameras.main.getWorldPoint(pointer.x,pointer.y);aimX=world.x;aimY=world.y;}
  let interact=tap('interact'),reload=tap('reload');if(padTaps.has('interact')&&!pressed.has(b.interact)&&!context()){interact=false;reload=true;}
  const swap=tap('swap')||wheelSwap;wheelSwap=false;const pl=me(scene.sim);
  if(padTaps.has('cycle')){const next=padGadget==='lethal'?'tactical':'lethal';if(pl[next]){padGadget=next;scene.audio.ui('select');toast('GADGET · '+GEAR_SHORT[pl[next]],1);}else toast(next==='lethal'?'NO LETHAL EQUIPPED':'NO TACTICAL EQUIPPED',1.2);}
  const deploy=padTaps.has('grenade')&&!pressed.has(b.grenade),grenade=pressed.has(b.grenade)||deploy&&padGadget==='lethal',tactical=pressed.has(b.tactical)||deploy&&padGadget==='tactical',other=padGadget==='lethal'?pl.tactical&&pl.tacticals:pl.lethal&&pl.grenades,hint=deploy&&other?' / '+keyLabel('cycle')+' SWITCHES GADGET':'';
  if(grenade&&!(pl.lethal&&pl.grenades))toast((pl.lethal?'NO '+GEAR_SHORT[pl.lethal]+' LEFT':'NO LETHAL EQUIPPED')+hint,1.6);if(tactical&&!(pl.tactical&&pl.tacticals))toast((pl.tactical?'NO '+GEAR_SHORT[pl.tactical]+' LEFT':'NO TACTICAL EQUIPPED')+hint,1.6);if(tap('gadget')&&!pl.stims)toast('NO STIMS LEFT / FIND A MEDKIT',1.4);
  return {mx,my,sprint:down('sprint'),roll:tap('roll'),slide:tap('slide'),interact,reload,swap,gadget:tap('gadget'),melee:tap('melee'),meleeDown:down('melee'),interactDown:down('interact'),grenade,tactical,fire:mouseFire||!!g&&g.down.has(pb.fire),aiming:mouseAim||!!g&&g.down.has(pb.aim),aimX,aimY,slot:tap('slot1')?0:tap('slot2')?1:undefined};}
 class FieldScene extends Phaser.Scene {
  constructor(){super('field');}
  preload(){this.load.on('progress',v=>{$('load-bar').style.width=Math.round(v*100)+'%';});this.load.on('loaderror',file=>{if(this.loadFailed)return;this.loadFailed=true;$('load-text').textContent=location.protocol==='file:'?'CANNOT RUN FROM A LOCAL FILE / RUN "NPM RUN SERVE" THEN OPEN HTTP://127.0.0.1:8127/BLACKOUT-PROTOCOL.HTML':'ASSET LOAD FAILED: '+file.key+' / REFRESH TO RETRY';});BPRender.preload(this);BPAudio.preload(this);}
  create(){scene=this;this.settings=settings;this.renderer=new BPRender(this);this.audio=new BPAudio(this,settings);this.accumulator=0;this.cameras.main.setZoom(1.03);this.game.canvas.tabIndex=0;this.game.canvas.setAttribute('aria-label','Top-down battlefield. Use WASD to move, mouse to aim, and left click to fire, or a controller: left stick to move, right stick to aim, right trigger to fire, Y to swap weapons.');this.input.mouse.disableContextMenu();this.input.on('pointerdown',pointer=>{if(mode!=='playing')return;this.audio.unlock();if(pointer.button===0)mouseFire=true;if(pointer.button===2)mouseAim=true;});this.input.on('pointerup',pointer=>{if(pointer.button===0)mouseFire=false;if(pointer.button===2)mouseAim=false;});this.game.canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('pointerup',e=>{if(e.button===0)mouseFire=false;if(e.button===2)mouseAim=false;});if(!this.loadFailed)$('loading').hidden=true;updateContinue();document.body.dataset.phase='menu';score();backdrop();
   const inspect=()=>({mode,camera:{scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY,zoom:this.cameras.main.zoom,width:this.cameras.main.width,height:this.cameras.main.height,originX:this.cameras.main.originX,originY:this.cameras.main.originY},world:JSON.parse(JSON.stringify({map:this.sim.map,walls:this.sim.walls,player:this.sim.player,guest:this.sim.guest,tags:this.sim.tags,station:this.sim.station,enemies:this.sim.enemies,stage:this.sim.stage,goal:this.sim.goal,time:this.sim.time,completed:this.sim.completed,dead:this.sim.dead,stats:this.sim.stats,hazards:this.sim.hazards,grenades:this.sim.grenades,pickups:this.sim.pickups,difficulty:this.sim.difficulty,spawnWarnings:this.sim.spawnWarnings,zones:this.sim.zones,director:this.sim.director,progress:this.sim.progress,mission:this.sim.mission,training:this.sim.training}))});
   if(new URLSearchParams(location.search).has('qa'))window.BPQA={sim:()=>this.sim,end:e=>end(e),settle:()=>Meta,save};
   const lobbyInfo=()=>lobby&&{link:lobby.link,code:lobby.code,ping:lobby.ping,role:lobby.role,phase:lobby.phase,map:lobby.map,difficulty:lobby.difficulty,ready:lobby.ready,peer:lobby.peer,counting:lobby.countdown>0,inRun:lobby.inRun};
   window.BPApp={inspect,snapshot:()=>this.sim?{mode,lobby:lobbyInfo(),training:this.sim.training,mission:this.sim.mission,time:this.sim.time,stage:this.sim.stage,health:this.sim.player.health,armor:this.sim.player.armor,stamina:this.sim.player.stamina,x:this.sim.player.x,y:this.sim.player.y,state:this.sim.player.state,weapon:this.sim.player.slots[this.sim.player.slot],slots:[...this.sim.player.slots],ammo:this.sim.player.ammo[this.sim.player.slots[this.sim.player.slot]],reload:this.sim.player.reload,stims:this.sim.player.stims,grenades:this.sim.player.grenades,tacticals:this.sim.player.tacticals,kills:this.sim.stats.kills,flows:this.sim.stats.flows,credits:this.sim.stats.credits,activeEnemies:this.sim.enemies.filter(e=>!e.dead&&e.active).length,projectiles:this.sim.projectiles.filter(p=>p.active).length,particles:this.renderer.particles.filter(p=>p.active).length,danger:Number($('danger').style.opacity||0),iconTextures:this.textures.getTextureKeys().filter(k=>/^[wgp]:/.test(k)).length,audioUnlocked:this.audio.unlocked,audioContext:this.sound.context?.state,averageFps:this.game.loop.actualFps,save:JSON.parse(JSON.stringify(save))}:{mode,lobby:lobbyInfo(),save:JSON.parse(JSON.stringify(save))}};
  }
  update(time,delta){let dt=Math.min(delta/1000,.05);pollPad(dt);if(mode!=='playing'||!this.sim)return;
   if(netRole==='guest'){guestFrame(this.sim,dt);
    this.renderer.update(this.sim,dt,padActive?padPointer:this.input.activePointer,watch(this.sim));
    if(time-lastHud>70){lastHud=time;hud();}return;}
   const now=performance.now();timeScale+=((now<slowUntil?.32:1)-timeScale)*Math.min(1,dt*(now<slowUntil?14:5));dt*=timeScale;this.accumulator+=dt;
   let frameInput=input();if(netRole==='host'){
    // A guest whose input stops arriving (paused, or a stalled connection) stands still instead of running on with its last order.
    if(performance.now()-netGuestAt>800)netGuestInput={...netGuestInput,mx:0,my:0,sprint:false,fire:false,meleeDown:false,interactDown:false};
    // Single presses count once, on the step after they arrive, however many frames pass before the next input does.
    frameInput={...frameInput,guest:netGuestFresh?netGuestInput:{...netGuestInput,swap:false,melee:false,reload:false,slot:undefined}};netGuestFresh=false;}
   let steps=0;while(this.accumulator>=BPCore.DT&&steps<7&&mode==='playing'){BPCore.step(this.sim,frameInput);this.accumulator-=BPCore.DT;steps++;pressed.clear();padTaps.clear();
    frameInput={...frameInput,roll:false,slide:false,interact:false,reload:false,swap:false,gadget:false,melee:false,grenade:false,tactical:false,slot:undefined,
      guest:netRole==='host'?{...frameInput.guest,swap:false,melee:false,reload:false,slot:undefined}:undefined};}
   drain();
   if(netRole==='host'&&netConnected){netBroadcastAt-=dt;if(netBroadcastAt<=0){netBroadcastAt=lobby?.link==='online'?1/20:1/30;LINK.hostSend(JSON.stringify({type:'snapshot',payload:buildSnapshot(this.sim)},NET_ROUND));}}
   if(mode==='playing'||mode==='dead')this.renderer.update(this.sim,dt,padActive?padPointer:this.input.activePointer,watch(this.sim));if(time-lastHud>70&&mode==='playing'){lastHud=time;hud();}}
 }
 function renderType(){const choice=new URLSearchParams(location.search).get('renderer');if(choice==='canvas')return Phaser.CANVAS;if(choice==='webgl')return Phaser.WEBGL;
  try{const testCanvas=document.createElement('canvas'),gl=testCanvas.getContext('webgl',{failIfMajorPerformanceCaveat:true});if(!gl)return Phaser.CANVAS;const ext=gl.getExtension('WEBGL_debug_renderer_info'),name=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'';const software=/swiftshader|llvmpipe|software/i.test(name);gl.getExtension('WEBGL_lose_context')?.loseContext();return software?Phaser.CANVAS:Phaser.AUTO;}catch{return Phaser.CANVAS;}}
 try{new Phaser.Game({type:renderType(),parent:'game',backgroundColor:'#252d24',scene:FieldScene,scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},render:{antialias:true,pixelArt:false,roundPixels:false,powerPreference:'high-performance'},fps:{target:60,forceSetTimeOut:false},audio:{disableWebAudio:false},input:{keyboard:false}});}catch(err){$('load-text').textContent='COULD NOT INITIALIZE THE GAME. PLEASE REFRESH.';console.error(err);}
})();

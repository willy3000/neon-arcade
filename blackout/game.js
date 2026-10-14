(() => {
 'use strict';
 // In the desktop build, window.BPStore (preload.js) persists to a file instead of localStorage, which
 // is scoped to the page's origin - and the desktop shell's local server binds a fresh random port
 // every launch, so localStorage alone would start empty each time.
 let storage;try{storage=window.BPStore||window.localStorage;}catch{storage=null;}
 const $=id=>document.getElementById(id),save=BPSave.load(storage),settings=save.settings,pressed=new Set(),held=new Set();
 const W=BPWorld.weapons,G=BPWorld.gear,A=BPWorld.archetypes,U=BPWorld.upgrades,SUP=BPWorld.support,PERKS=BPWorld.perks,SLOTN=BPWorld.perkSlotNames,MISSIONS=BPWorld.missions,DIFFS=BPWorld.order,DL=BPWorld.difficulties,Meta=BPMeta,HOLD=BPWorld.holdoutMaps;
 // The armory files guns by category (BPWorld.categories); catOf is the one a gun belongs to.
 const CATS=BPWorld.categories,catOf=k=>CATS.find(c=>c.cls.includes(W[k]?.cls))?.id||'all',GEAR_CATS=[{id:'lethal',name:'LETHAL'},{id:'tactical',name:'TACTICAL'}];
 const holdoutMap=id=>HOLD.find(h=>h.id===id)||HOLD[0],holdoutOpen=h=>!h.locks||!!save.missions[h.locks]?.done;
 // Developer shortcut for trying out the armory: ?credits=99999 on the page address sets the wallet to that amount. It only
 // works on a local address, which is how 'npm run start:rich' and 'npm run serve' run the game; a hosted copy ignores it.
 {const grant=Math.floor(Number(new URLSearchParams(location.search).get('credits')));if(grant>0&&['127.0.0.1','localhost'].includes(location.hostname)){save.credits=Math.min(1e8,grant);BPSave.write(storage,save);}}
 // A save that already meets a career challenge (from play before the challenge existed) is given its award at once.
 if(Meta.claim(save).length)BPSave.write(storage,save);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){settings.shake=0;settings.flash=true;}
 let sprintLatch=false,aimLatch=false,aimWas=false,flowChain=0,flowAt=-1e9;
 let scene=null,mode='menu',bindingTarget=null,lastHud=0,radioUntil=0,toastUntil=0,bannerUntil=0,comboUntil=0,mouseFire=false,mouseAim=false,wheelSwap=false,hadSaveFailure=false,selected=null,armoryTab='weapons',armoryCat='all',armoryGear='all',armoryItem=null,armoryFrom='menu',run=null,timeScale=1,slowUntil=0,debriefTimers=[];
 // Squad play is host-authoritative, and can travel two ways. NET is the LAN transport: direct sockets, only
 // in the desktop app (the web build has no preload/window.BPNet). ONLINE goes through a relay by room code (online.js,
 // server/relay.js) and works in both builds, but only once a relay address is configured. Both offer the same calls
 // and carry the same messages; LINK is whichever one the current lobby is using. A LAN lobby takes up to three
 // guests (team deathmatch); an online one is still two-player.
 const NET=(typeof window!=='undefined'&&window.BPNet&&window.BPNet.available)?window.BPNet:null,DESKTOP=window.BPDesktop||null,ONLINE=window.BPOnline&&window.BPOnline.available?window.BPOnline:null;let LINK=null;
 // netRole is only 'host'/'guest' while a co-op run is live; "lobby" is the whole session (see the squad lobby section).
 let netRole='solo',netConnected=false,netBroadcastAt=0,netPort=47321,lobby=null;
 // A squad is the lobby leader plus up to three more operators (s.mates in the simulation), known by these names.
 // netSeat is which of them this copy plays once it has joined someone else's run. On the host, netSeats says which
 // seat each connected player holds and netInputs keeps the latest controls received for each seat.
 const MATE_IDS=['guest','m2','m3','m4','m5','m6','m7'],myId=()=>netRole==='guest'?MATE_IDS[netSeat]:'player';let netSeat=0,netSeats=new Map(),netInputs=[];
 for(const [via,name] of [[NET,'lan'],[ONLINE,'online']])if(via){via.onHostEvent(msg=>{if(lobby?.link===name)onHostMsg(msg);});via.onGuestEvent(msg=>{if(lobby?.link===name)onGuestMsg(msg);});}
 const labels={up:'Move up',down:'Move down',left:'Move left',right:'Move right',sprint:'Sprint',roll:'Roll / dive',slide:'Slide',interact:'Interact / vault',reload:'Reload',swap:'Swap weapon',gadget:'Stim injector',melee:'Melee',grenade:'Lethal gadget',tactical:'Tactical gadget',support:'Field support',slot1:'Primary weapon',slot2:'Secondary weapon',order:'Squad order (AI partner)'};
 const pad=new BPGamepad(),padTaps=new Set(),PAD_REACH=300,PAD_TURN=14,ASSIST_TURN=45,ASSIST_CONE=.7,ASSIST_BREAK=.6,padActionLabel=key=>({grenade:'Deploy gadget',cycle:'Switch gadget',fire:'Fire',aim:'Steady aim',order:'Squad order'})[key]||labels[key];
 let padGadget='lethal',padState=null,padActive=false,padAngle=0,padTarget=0,padAimIdle=0,padMenuStick=0,padMenuStickX=0,padBindingTarget=null,padLock=null,padLockLost=0,padReach=PAD_REACH;
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
 function persist(){save.presets[save.preset]={...save.loadout};const ok=BPSave.write(storage,save);if(!ok&&!hadSaveFailure){hadSaveFailure=true;toast('STORAGE UNAVAILABLE / PROGRESS LASTS THIS SESSION');}return ok;}
 function clearInput(){held.clear();pressed.clear();padTaps.clear();padState=null;padLock=null;mouseFire=false;mouseAim=false;wheelSwap=false;}
 function toast(text,duration=2.5){$('toast').textContent=text;$('toast').style.opacity='1';toastUntil=performance.now()+duration*1000;}
 // The toast and the banner sit outside the HUD so that the menu, armory and lobby screens can show them too; away from
 // a run nothing else is ticking, so they are cleared here.
 setInterval(()=>{if(mode==='playing')return;const now=performance.now();if(now>toastUntil)$('toast').style.opacity='0';pumpBanner();},200);
 // Banners wait their turn instead of writing over one another. The one on screen keeps it for at least BANNER_MIN
 // seconds; with others waiting it is then cut short, and the next one goes up. A combo call never waits (it is old news
 // a second later): it shows if nothing else is up, replaces another combo call, and is otherwise dropped. A banner
 // already waiting is not queued twice.
 const BANNER_MIN=1.4,bannerQueue=[];let bannerShownAt=0,bannerTone='';
 function showBanner(q){$('banner-art').innerHTML=q.art;$('banner-eyebrow').textContent=q.eyebrow;$('banner-title').textContent=q.title;$('banner-sub').textContent=q.sub;const b=$('banner');b.className='banner show '+q.tone;bannerShownAt=performance.now();bannerTone=q.tone;bannerUntil=bannerShownAt+q.duration*1000;}
 function banner(eyebrow,title,sub='',duration=2.6,tone='',art=''){const q={eyebrow,title,sub,duration,tone,art},now=performance.now();
  if(now>bannerUntil||bannerTone==='combo'&&!bannerQueue.length){if(tone!=='combo'||now>bannerUntil||bannerTone==='combo')showBanner(q);return;}
  if(tone==='combo'||bannerQueue.some(o=>o.title===title&&o.eyebrow===eyebrow))return;
  if(bannerQueue.length>=4)bannerQueue.shift();bannerQueue.push(q);bannerUntil=Math.min(bannerUntil,Math.max(bannerShownAt+BANNER_MIN*1000,now));}
 function pumpBanner(){if(performance.now()<=bannerUntil)return;if(bannerQueue.length)showBanner(bannerQueue.shift());else $('banner').classList.remove('show');}
 function radio(e){$('radio-speaker').textContent=e.speaker;$('radio-text').textContent=e.text;$('radio').hidden=false;radioUntil=scene.sim.time+(e.duration||6);}
 const rank=()=>Meta.rankOf(save.xp);
 function refreshWallet(){const r=rank();for(const id of ['wallet','ops-credits','armory-credits'])$(id).textContent=fmt(save.credits)+' CR';for(const id of ['ops-rank','armory-rank'])$(id).textContent='RANK '+r.rank+' · '+r.title;
  $('rank-chip').innerHTML=`<i></i> RANK ${r.rank} · ${esc(r.title)}`;
  {const st=challengeStatus();$('view-challenges').title='Seeded challenges: '+st+'. Contracts reset at midnight.';$('challenge-dot').hidden=!/DAILY READY/.test(st);}$('menu-contracts').innerHTML=Meta.refreshContracts(save,today()).map(x=>`<div class="contract${x.done?' done':''}"><span>${esc(x.text)}</span><b>${x.done?'PAID':x.progress+' / '+x.goal} · ${x.reward} CR</b><i style="--v:${(x.progress/x.goal).toFixed(2)}"></i></div>`).join('');const d=save.daily,day=today();$('streak-chip').textContent=d.day===day?`DAILY OP DONE · STREAK ${d.streak}`:d.day===day-1?`DAILY OP READY · KEEP THE ${d.streak}-DAY STREAK`:'DAILY OP BONUS READY';
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
 // The menu, the pre-game screens and dialogs are laid out for a 1366x768 window and scaled to fit whatever window they
 // are in, larger or smaller (see the body.fit rules in style.css), so no screen ever needs to scroll as a page.
 // --screen-w/h give the window's size in those scaled units. Below FIT_MIN the text would be too small to read (a
 // phone-sized browser window), so the screens stay at their natural size there and scroll instead.
 // The in-run HUD grows with the window in the same way, so it is as readable on a 1440p or 4K screen as on the
 // 1366x768 it is drawn for (--hud-scale); it never shrinks below its drawn size, which a smaller window keeps as it is.
 const FIT_MIN=.63;let hudScale=1;
 // Accessibility (settings): the text size scales the type every label is set in (--t1 to --t3) and the labels drawn
 // in the field; the palette recolours gameplay marks in the renderer and on the HUD (data-palette in style.css).
 const textK=()=>[1,1.15,1.3].includes(+settings.textScale)?+settings.textScale:1;
 function applyAccess(){const k=textK(),root=document.documentElement.style;root.setProperty('--t1',(13*k).toFixed(1)+'px');root.setProperty('--t2',(14*k).toFixed(1)+'px');root.setProperty('--t3',(16*k).toFixed(1)+'px');
  document.body.classList.toggle('text-large',k>1);document.body.dataset.palette=settings.palette||'standard';window.BPRender?.palette?.(settings.palette);scene?.renderer?.textScale(hudScale*k);}
 function fitScreens(){const raw=Math.min(innerWidth/1366,innerHeight/768),fit=raw>=FIT_MIN,k=fit?Math.min(2.6,raw):1,root=document.documentElement.style;root.setProperty('--ui-scale',k.toFixed(3));hudScale=Math.max(1,k);root.setProperty('--hud-scale',hudScale.toFixed(3));scene?.renderer?.textScale(hudScale*textK());root.setProperty('--screen-w',(innerWidth/k).toFixed(1));root.setProperty('--screen-h',(innerHeight/k).toFixed(1));
  document.body.classList.toggle('fit',fit);document.body.classList.toggle('tall',fit&&innerHeight/k>=850);}
 window.addEventListener('resize',fitScreens);fitScreens();
 // The menu score plays on every screen in SCREENS and hands over to the mission's own ambience once a run starts.
 // The menu score also plays over the end of a run (the debrief, or the screen after being killed): the mission's own
 // ambience and drone have stopped by then.
 function score(){scene?.audio?.music(SCREENS.includes(mode)||mode==='dead'||mode==='complete');}
 // Commander voice-over cues. The welcome is spoken once per launch, the first time the main menu can make sound: at
 // once in the desktop app, after the first click or key press in a browser. The rest are in launch(), beginGuestRun()
 // and onEvent(); audio.js decides whether a line may actually speak.
 let greeted=false,voiceHurt=false,voiceDry=false;
 // Team deathmatch call-outs are made on the moment the match changes: taking the lead, falling four behind, and
 // coming within three of the win. tdmCalls remembers which have been made so each is said when it happens, not every frame.
 let tdmCalls={ahead:false,behind:false,close:false};
 function tdmVoice(T,us,them){const lead=us-them,c=tdmCalls;if(T.result)return;
  if(T.limit-us<=3&&T.limit>5&&!c.close){c.close=true;scene.audio.say('vo-tdm-close',{cut:true,rest:20});return;}
  if(lead>0&&!c.ahead&&us+them>=4){c.ahead=true;c.behind=false;scene.audio.say('vo-tdm-lead',{rest:40});}else if(lead<=0)c.ahead=false;
  if(lead<=-4&&!c.behind){c.behind=true;scene.audio.say('vo-tdm-behind',{rest:40});}else if(lead>=0)c.behind=false;}
 // The commander on what you have just done. A streak is named at each step of the kill chain (two, three, five,
 // eight, twelve); a double kill comes round too often to be called every time, so it has two lines and a long rest.
 const STREAK_VOICE={3:'vo-streak-triple',5:'vo-streak-heat',8:'vo-streak-unstoppable',12:'vo-streak-blackout'};
 function streakVoice(e){if(e.boss){scene.audio.say('vo-boss-down',{cut:true,rest:10});return;}
  if(e.combo===2)voice('double',{rest:45});else if(STREAK_VOICE[e.combo])scene.audio.say(STREAK_VOICE[e.combo],{cut:e.combo>=5,rest:15});
  else if(e.source==='melee')scene.audio.say('vo-knife',{rest:75});}
 function greet(){if(!greeted&&scene&&mode==='menu')greeted=scene.audio.say('vo-welcome',{cut:true,rest:0});}
 // Moments that come round often have several lines, spoken in turn, so the same cue does not always get the same words.
 const VOICE={wave:['vo-hostiles','vo-stay-sharp','vo-contact','vo-hold'],lull:['vo-watch-six','vo-area-clear','vo-quiet'],stage:['vo-objective','vo-stay-sharp'],
  double:['vo-streak-double','vo-streak-double-2'],
  holdout:['vo-mode-holdout','vo-mode-holdout-2','vo-mode-holdout-3','vo-mode-holdout-4'],tdm:['vo-mode-tdm'],campaign:['vo-mode-campaign','vo-mode-campaign-2','vo-mode-campaign-3','vo-mode-campaign-4'],range:['vo-range','vo-range-2','vo-range-3']},voiceTurn={},voiceLast={};
 function voice(cue,opts){const lines=VOICE[cue];voiceTurn[cue]=((voiceTurn[cue]??-1)+1)%lines.length;return scene.audio.say(lines[voiceTurn[cue]],opts);}
 // Opening a mode announces it every time, with one of that mode's lines picked at random and never the same one twice
 // running. It cuts off whatever the commander was saying, so stepping from one mode to another never overlaps.
 // The newer modes have no lines of their own (no new voice is recorded for them): a versus mode uses team
 // deathmatch's, a co-op mode holdout's, and a cue with no lines at all is simply skipped.
 function voiceAny(cue){if(!scene)return false;if(!VOICE[cue]&&MODES[cue])cue=MODES[cue].versus?'tdm':'holdout';const lines=VOICE[cue];if(!lines?.length)return false;let i;do i=Math.floor(Math.random()*lines.length);while(lines.length>1&&i===voiceLast[cue]);
  const said=scene.audio.say(lines[i],{cut:true,rest:0});if(said)voiceLast[cue]=i;return said;}
 // The commander's word on a gun or gadget as it is bought or equipped: what it is and how to use it in the field.
 // ...and on a map as the lobby leader picks it: what the ground is like and what to bring (vo-map-<map>.ogg, where
 // the map is the killhouse id without its "holdout-" prefix, and "killhouse" for the default one).
 function mapVoice(id){scene?.audio.say('vo-map-'+(id==='holdout'?'killhouse':id.replace('holdout-','')),{cut:true,rest:20});}
 function itemVoice(kind,key){const tag={weapon:'w',gear:'g',support:'s',perk:'p'}[kind];if(key&&tag)scene?.audio.say('vo-'+tag+'-'+key,{cut:true,rest:90});}
 // The animated title-screen backdrop (fire over the cover painting, plus a small live battle run by the real
 // simulation - see menu-scene.js) only runs while the main menu is the screen in front and the window has focus.
 // While it runs, its gunfire and explosions are heard as a far-off battle under the score (audio.distant).
 // Reduced motion leaves the painting still.
 const menuScene=new BPMenuScene($('menu-scene'),{still:reduced,front:$('menu-troops'),onEvent:e=>{if(scene&&mode==='menu'&&!window.BPIntro?.active)scene.audio.distant(e);}});
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
 document.addEventListener('click',e=>{const el=navOf(e);if(!navLive||!el||el.disabled||!el.matches('button,a')||scene.audio.uiAt>=navClick)return;scene.audio.ui(mode==='playing'&&navFrom!=='paused'?'launch':el.matches('.text-button,.close,.back-button')?'back':'select');});
 document.addEventListener('change',e=>{if(navOn()&&navOf(e)&&navQuiet()>60)scene.audio.ui('tick');});
 // Sound can only start after the first click, key press or controller input, so that is when it is switched on.
 for(const type of ['pointerdown','keydown'])window.addEventListener(type,()=>{if(scene&&!scene.audio.unlocked)scene.audio.unlock();if(!greeted)setTimeout(greet,200);},true);
 function setMode(value){const inRun=m=>m==='playing'||m==='paused';if(inRun(mode)&&!inRun(value)){toastUntil=bannerUntil=0;bannerQueue.length=0;$('toast').style.opacity='0';$('banner').classList.remove('show');}mode=value;document.body.dataset.phase=value;const game=['playing','paused','dead','complete'].includes(value);document.body.classList.toggle('playing',game);for(const id of SCREENS)$(id).hidden=value!==id;
  $('hud').hidden=!['playing','paused'].includes(value);$('pause').hidden=value!=='paused';$('quit-button').hidden=!DESKTOP||game;quitArmed(false);$('ending').hidden=!['dead','complete'].includes(value);if(!game){$('danger').style.opacity='0';$('flashout').style.opacity='0';document.body.classList.remove('downed');}score();backdrop();clearInput();if(scene?.game?.canvas)scene.game.canvas.style.cursor=value==='playing'?'none':'default';}
 // ---------- operations board ----------
 function openOps(id){if(!scene)return;selected=id||selected||save.run?.mission||Meta.nextMission(save)?.id||'crash';if(!Meta.unlocked(save,selected))selected=Meta.nextMission(save)?.id||'crash';scene.audio?.stopAmbient();setMode('ops');renderOps();$('ops').scrollTop=0;$('deploy').focus({preventScroll:true});}
 function medalRow(id){const got=save.missions[id]?.medals||[];return Meta.medalsFor().map(m=>`<i class="${got.includes(m.id)?'on':''}" title="${m.name}"></i>`).join('');}
 // Mutators picked on the ops board for the next replay (kept for the session, offered only on cleared operations).
 const opsMutators=new Set();
 function renderOps(){const list=$('mission-list');list.replaceChildren();
  for(const m of MISSIONS){const st=save.missions[m.id],open=Meta.unlocked(save,m.id),b=document.createElement('button');b.type='button';b.className='mission-card'+(m.id===selected?' active':'')+(open?'':' locked')+(st?.done?' done':'');b.dataset.mission=m.id;b.style.setProperty('--art',`url('${new URL('blackout/assets/menu/killhouse-holdout-'+m.id+'.jpg',document.baseURI).href}')`);
   b.innerHTML=`<span class="mc-n">${String(m.n).padStart(2,'0')}</span><span class="mc-body"><b>${open?m.title:'CLASSIFIED'}</b><small>${open?m.act:'CLEAR '+esc(MISSIONS[m.n-2]?.title||'')+' FIRST'}</small><span class="medals">${medalRow(m.id)}</span></span><span class="mc-tag">${save.run?.mission===m.id?'CHECKPOINT':st?.best?st.best.rating+' / '+DL[st.best.difficulty].label:open?'NEW':'🔒'}</span>`;
   b.addEventListener('click',()=>{selected=m.id;renderOps();});list.append(b);}
  const m=missionMeta(selected),st=save.missions[m.id],open=Meta.unlocked(save,m.id);
  // The briefing shows the selected operation's map too, behind a heavier shade than the cards (it carries the most text).
  {const br=document.querySelector('#ops .briefing')||document.querySelector('.briefing');br?.style.setProperty('--art',`url('${new URL('blackout/assets/menu/killhouse-holdout-'+m.id+'.jpg',document.baseURI).href}')`);br?.classList.toggle('locked',!open);}
  $('brief-act').textContent=m.act+' / CHAPTER '+m.n;$('brief-title').textContent=open?m.title:'CLASSIFIED';$('brief-sector').textContent=m.sector;$('brief-copy').textContent=open?m.brief:'Finish the previous operation to declassify this file.';
  $('brief-terrain').textContent=m.terrain;$('brief-threats').textContent=m.threats.map(t=>A[t].name).join(' · ');$('brief-best').textContent=st?.best?`${st.best.rating} · ${fmt(st.best.score)} · ${DL[st.best.difficulty].label}`:'—';$('brief-medals').innerHTML=medalRow(m.id);
  const rec=$('brief-rec');rec.replaceChildren();const head=document.createElement('p');head.className='rec-note';head.innerHTML=`<b>RECOMMENDED</b> ${esc(m.rec.note)}`;rec.append(head);
  for(const [kind,key] of [...m.rec.weapons.map(k=>['weapon',k]),...m.rec.gear.map(k=>['gear',k])]){const item=kind==='weapon'?W[key]:G[key],have=Meta.owns(save,kind,key),slot=kind==='weapon'?(item.slot===0?'primary':'secondary'):item.slot,on=save.loadout[slot]===key,cost=Meta.price(save,kind,key),b=document.createElement('button');b.type='button';b.className='rec-item'+(have?' owned':'')+(on?' on':'');b.dataset.rar=RAR(kind,key);
   const rk=have?0:Meta.locked(save,kind,key);b.innerHTML=`<i class="rec-art">${ICON(kind,key)}</i><span>${esc(item.name)}</span><b>${on?'EQUIPPED':have?'EQUIP':rk?'RANK '+rk:save.credits>=cost?'BUY '+fmt(cost)+' CR':fmt(cost-save.credits)+' CR SHORT'}</b>`;
   b.addEventListener('click',()=>{if(!have){const r=Meta.buy(save,kind,key);if(!r.ok){toast(r.reason);scene.audio.ui('deny');return;}scene.audio.ui('buy');toast(item.name+' PURCHASED');}save.loadout[slot]=key;save.loadout=Meta.loadout(save);persist();refreshWallet();renderOps();itemVoice(kind,key);});rec.append(b);}
  const dp=$('difficulty-pick');dp.replaceChildren();for(const d of DIFFS){const b=document.createElement('button');b.type='button';b.className=(settings.difficulty===d?'active ':'')+d;b.innerHTML=`<i class="pressure-art">${BPIcons.pressure(d)}</i><span>${DL[d].label}</span><small>×${DL[d].reward} CR</small>`;b.addEventListener('click',()=>{settings.difficulty=d;persist();renderOps();});dp.append(b);}
  $('difficulty-note').textContent={story:'Forgiving fire and frequent medkits. For the story.',standard:'The intended fight. Cover matters; mistakes are survivable.',intense:'Faster, deadlier enemies that throw grenades at campers.',insane:'Skill tier. Twice the soldiers, three-round bursts that lead your movement, grenades for anyone who camps. Fight from cover or die.'}[settings.difficulty];
  {const oc=Meta.OP_CHALLENGES[m.id],done=!!st?.opChallenge,cleared=!!st?.done,muts=Object.entries(BPWorld.mutators),mult=[...opsMutators].reduce((a,k)=>a*BPWorld.mutators[k].reward,1);
   setHtml($('brief-extra'),(oc&&open?`<p class="op-challenge${done?' done':''}"><b>OPERATION CHALLENGE</b> ${esc(oc.text)} <span>${done?'COMPLETE':'+'+fmt(oc.reward)+' CR · ONCE'}</span></p>`:'')+
    (open?`<h4>MUTATORS <small>${cleared?'OPTIONAL RULES FOR A REPLAY'+(opsMutators.size?' · PAYS ×'+mult.toFixed(2):''):'OPEN ONCE THIS OPERATION IS CLEARED'}</small></h4><div class="mutators">${muts.map(([k,u])=>`<button type="button" class="mutator${opsMutators.has(k)?' on':''}" data-mutator="${k}" ${cleared?'':'disabled'} title="${esc(u.desc)}"><b>${esc(u.name)}</b><small>×${u.reward}</small></button>`).join('')}</div>${cleared&&opsMutators.size?`<p class="mutator-desc">${[...opsMutators].map(k=>esc(BPWorld.mutators[k].desc)).join(' ')}</p>`:''}`:''));}
  // Rook's own card beside the briefing: the soldier carries whatever primary is equipped, over rank and progress to the next one.
  const r=rank();setHtml($('ops-figure'),BPIcons.soldier(Meta.loadout(save).primary,0));$('ops-op-rank').textContent='RANK '+r.rank+' · '+r.title;$('ops-op-xp').style.width=(r.into/r.span*100).toFixed(1)+'%';$('ops-op-next').textContent=fmt(r.span-r.into)+' XP TO RANK '+(r.rank+1);
  loadoutSlots($('loadout'));
  const resume=save.run?.mission===m.id;$('resume-run').hidden=!resume;if(resume)$('resume-run').innerHTML=`RESUME CHECKPOINT · ${esc(m.title)} <span>↗</span>`;$('deploy').querySelector('span').textContent=!open?'LOCKED':resume?'RESTART OPERATION':st?.done?'REPLAY OPERATION':'DEPLOY';$('deploy').disabled=!open;refreshWallet();
  // Recommended, not required: offered until bootcamp is finished or any operation is done, never blocking deploy.
  // Bootcamp is recommended until it has been done (or an operation finished), and stays on the board after that as a
  // way back to the drills.
  {const fresh=!save.drill&&!Object.keys(save.missions).length;$('ops-bootcamp').hidden=false;$('ops-bootcamp').classList.toggle('done',!fresh);$('ops-bootcamp-tag').textContent=fresh?'RECOMMENDED':'BOOTCAMP';
   $('ops-bootcamp-copy').textContent=fresh?'New in the field? Play BOOTCAMP first to learn the ropes — movement, dodging, flow and gadgets in a few quick steps.':'Sharpen the slide, vault, dodge and knife drills any time.';$('ops-bootcamp-start').textContent=fresh?'START BOOTCAMP':'REPLAY BOOTCAMP';}}
 // The four loadout tiles (two guns, two gadgets), shared by the operations board and the squad lobby. A slot named in
 // "off" is shown but cannot be changed, with that note in place of its detail line.
 function loadoutSlots(box,off={}){const lo=Meta.loadout(save);box.replaceChildren();
  // Three loadouts kept side by side. Picking one swaps the whole kit; whatever is changed afterwards is saved into it.
  const row=document.createElement('div');row.className='presets';row.innerHTML='<small>LOADOUT</small>';
  ['A','B','C'].forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className='preset'+(i===save.preset?' on':'');b.textContent=name;b.setAttribute('aria-label','Loadout '+name);b.dataset.preset=i;
   b.addEventListener('click',()=>{if(i===save.preset)return;save.presets[save.preset]={...save.loadout};save.preset=i;save.loadout=Meta.loadout(save,save.presets[i]);persist();scene.audio.ui('select');loadoutChanged();});row.append(b);});box.append(row);
  for(const [slot,label] of [['primary','PRIMARY'],['secondary','SECONDARY'],['lethal','LETHAL'],['tactical','TACTICAL']]){const key=lo[slot],b=document.createElement('button');b.type='button';b.className='slot'+(off[slot]?' locked':'');b.dataset.slot=slot;const w=slot==='primary'||slot==='secondary'?W[key]:null;b.dataset.rar=RAR(w?'weapon':'gear',key);
   b.innerHTML=`<div class="slot-art">${key?ICON(w?'weapon':'gear',key):''}</div><small>${label}</small><b>${esc(w?w.short:gearName(key))}</b><span>${off[slot]?esc(off[slot]):w?esc(w.name.split(' / ')[1]):key?'×'+(G[key].count+(save.upgrades.bandolier||0)):'EMPTY / CHOOSE'}</span>`;b.addEventListener('click',()=>{if(off[slot]){scene.audio.ui('deny');return;}openPicker(slot);});box.append(b);}
  // Under the four slots: the field support carried, and a perk for each slot the player's rank has opened.
  const row2=document.createElement('div'),open=Meta.perkSlots(save);row2.className='extras';
  const extra=(slot,kind,key,label,name,shut)=>{const b=document.createElement('button');b.type='button';b.className='extra'+(shut?' locked':'')+(key?'':' none');b.dataset.slot=slot;b.dataset.rar=RAR(kind,key);b.title=label;
   b.innerHTML=`<i>${key?ICON(kind,key):''}</i><span><small>${label}</small><b>${esc(name)}</b></span>`;b.addEventListener('click',()=>{if(shut){scene.audio.ui('deny');toast(shut);return;}openPicker(slot);});row2.append(b);};
  extra('support','support',lo.support,'SUPPORT',lo.support?SUP[lo.support].short:'NONE',off.extras||'');
  [0,1,2].forEach(i=>extra('perk'+i,'perk',lo.perks[i],SLOTN[i],i>=open?'RANK '+BPWorld.perkSlots[i]:lo.perks[i]?PERKS[lo.perks[i]].short:'NONE',off.extras||(i>=open?'PERK SLOT '+(i+1)+' OPENS AT RANK '+BPWorld.perkSlots[i]:'')));box.append(row2);}
 function loadoutChanged(){if(mode==='lobby'){renderLobby();lobbySync();}else renderOps();}
 // The picker for any loadout slot: a gun, a gadget, the field support, or the perk for one of the three perk slots ("perk0".."perk2").
 function openPicker(slot){const list=$('picker-list'),gun=slot==='primary'||slot==='secondary',pi=slot.startsWith('perk')?Number(slot[4]):-1,kind=gun?'weapon':slot==='support'?'support':pi>=0?'perk':'gear',table=itemTable(kind);
  list.replaceChildren();list.classList.remove('maps','modes');$('picker-eyebrow').textContent=kind==='support'?'FIELD SUPPORT':pi>=0?SLOTN[pi]+' PERK':slot.toUpperCase();$('picker-title').textContent=gun?'CHOOSE A WEAPON.':kind==='support'?'CHOOSE FIELD SUPPORT.':pi>=0?'CHOOSE A PERK.':'CHOOSE A GADGET.';
  const keys=gun?Object.keys(W).filter(k=>W[k].slot===(slot==='primary'?0:1)):[null,...Object.keys(table).filter(k=>kind==='support'||table[k].slot===(pi>=0?pi:slot))],current=pi>=0?save.loadout.perks[pi]:save.loadout[slot];
  for(const key of keys){const have=key===null||Meta.owns(save,kind,key),item=key&&table[key],b=document.createElement('button');b.type='button';b.className='pick'+(current===key?' on':'')+(have?'':' locked')+(key&&sealed(kind,key)?' sealed':'');b.dataset.rar=RAR(kind,key);
   const lvl=gun?Meta.masteryLevel(save.mastery[key]||0):0;b.innerHTML=key===null?'<div class="pick-art"></div><div><b>NONE</b><span>Leave this slot empty.</span></div>':`<div class="pick-art">${ICON(kind,key)}</div><div><small class="pick-grade">${RAR_TAG(kind,key)}</small><b>${esc(item.name)}${gun&&lvl?' <em>'+'★'.repeat(lvl)+'</em>':''}</b><span>${have?esc(item.desc):'LOCKED · '+lockNote(kind,key)}</span></div>`;
   b.addEventListener('click',()=>{if(!have){$('picker').close();openArmory(ARMORY_TAB[kind],key,mode==='lobby'?'lobby':'ops');return;}equip(kind,key,slot);persist();$('picker').close();loadoutChanged();scene.audio.ui('select');itemVoice(kind,key);});list.append(b);}
  $('picker').showModal();list.querySelector('.on,button')?.focus();}
 // The table an item of each kind is defined in, which armory tab shows it, and how its row and card name its kind.
 const itemTable=kind=>kind==='weapon'?W:kind==='gear'?G:kind==='support'?SUP:kind==='perk'?PERKS:U,ARMORY_TAB={weapon:'weapons',gear:'gear',support:'support',perk:'perks',upgrade:'upgrades'};
 const kindLabel=(kind,item)=>kind==='weapon'?(item.slot===0?'PRIMARY':'SECONDARY'):kind==='gear'?item.slot.toUpperCase():kind==='support'?'FIELD SUPPORT':kind==='perk'?SLOTN[item.slot]+' PERK':'UPGRADE';
 // Puts an owned item in the loadout: a gun or gadget in its own slot, the field support, or a perk in its perk slot.
 function equip(kind,key,slot){const item=key&&itemTable(kind)[key];if(kind==='perk'){const i=item?item.slot:Number(slot[4]);save.loadout.perks=[...save.loadout.perks];save.loadout.perks[i]=key;}
  else save.loadout[kind==='support'?'support':kind==='weapon'?(item.slot===0?'primary':'secondary'):item?item.slot:slot]=key;save.loadout=Meta.loadout(save);}
 const equipped=key=>Object.values(save.loadout).flat().includes(key);
 // Something the player cannot have yet - its rank is ahead of them, or it is a challenge award they have not earned -
 // is shown as a silhouette with what it asks for. What they could buy with more credits is shown as it is.
 const sealed=(kind,key)=>kind!=='upgrade'&&!Meta.owns(save,kind,key)&&(!!itemTable(kind)[key].challenge||!!Meta.locked(save,kind,key));
 // Why an item is not the player's yet: the challenge that awards it and how far along that is, or its rank and price.
 function lockNote(kind,key){const item=itemTable(kind)[key],ch=item.challenge&&Meta.challenge(save,item.challenge),rk=Meta.locked(save,kind,key);return ch?ch.text.toUpperCase()+' · '+ch.progress+' / '+ch.goal:(rk?'RANK '+rk+' · ':'')+'ARMORY '+fmt(Meta.price(save,kind,key))+' CR';}
 // ---------- armory ----------
 function openArmory(tab='weapons',item=null,from=mode==='ops'?'ops':mode==='complete'||mode==='dead'?'menu':'menu'){armoryTab=tab;armoryItem=item;armoryFrom=from;if(item&&W[item]&&armoryCat!=='all')armoryCat=catOf(item);if(item&&G[item]&&armoryGear!=='all')armoryGear=G[item].slot;scene?.audio?.stopAmbient();setMode('armory');scene?.audio?.say('vo-armory',{cut:true,rest:0});renderArmory();($('armory-list').querySelector('.active')||$('armory-list').querySelector('button'))?.focus();}
 function armoryBack(){if(armoryFrom==='lobby'&&lobby)showLobby();else if(armoryFrom==='ops')openOps(selected);else menu();}
 function bars(w){const max={damage:240*1,rate:16,range:1900,mobility:1.1,capacity:75},dps=w.damage*w.pellets/w.rate;return [['DAMAGE',Math.min(1,w.damage*w.pellets/200)],['FIRE RATE',Math.min(1,(1/w.rate)/16)],['RANGE',w.range/max.range],['MOBILITY',(w.mobility-.6)/.5],['MAGAZINE',Math.min(1,w.capacity/max.capacity)],['DPS',Math.min(1,dps/420)]].map(([l,v])=>`<div class="bar"><span>${l}</span><i style="--v:${Math.max(.04,Math.min(1,v)).toFixed(2)}"></i></div>`).join('');}
 function renderArmory(){for(const b of $('armory-tabs').children)b.classList.toggle('active',b.dataset.tab===armoryTab);const list=$('armory-list'),detail=$('armory-detail');list.replaceChildren();refreshWallet();
  list.hidden=armoryTab==='record';if(armoryTab==='intel'){detail.classList.remove('wide');renderIntelList(list);return;}detail.classList.toggle('wide',armoryTab==='record');if(armoryTab==='record'){detail.dataset.rar=0;detail.classList.remove('sealed');renderRecord(detail);return;}
  // Guns and gadgets are filed in a second row of tabs: ALL, then one per gun category, or LETHAL and TACTICAL for
  // gadgets. Each shows how many of its items are owned and a dot if one of them has not been looked at yet.
  // Rebuilt only when that changes, so it keeps focus.
  const cats=$('armory-cats'),gearTab=armoryTab==='gear';cats.hidden=armoryTab!=='weapons'&&!gearTab;
  if(!cats.hidden){const cur=gearTab?armoryGear:armoryCat,pool=Object.keys(gearTab?G:W),owned=gearTab?save.owned.gear:save.owned.weapons,inCat=(k,id)=>id==='all'||(gearTab?G[k].slot:catOf(k))===id,csig=armoryTab+'|'+cur+'|'+owned.length+'|'+save.seen.length;
   if(cats.dataset.sig!==csig){cats.dataset.sig=csig;cats.replaceChildren();
    for(const c of [{id:'all',name:'ALL'},...(gearTab?GEAR_CATS:CATS)]){const keys=pool.filter(k=>inCat(k,c.id)),fresh=keys.some(k=>owned.includes(k)&&!save.seen.includes(k)&&!['rifle','pistol'].includes(k)),b=document.createElement('button');b.type='button';b.dataset.cat=c.id;b.className=(c.id===cur?'active':'')+(fresh?' fresh':'');b.innerHTML=`${c.name} <small>${keys.filter(k=>owned.includes(k)).length}/${keys.length}</small>`;
     b.addEventListener('click',()=>{if((gearTab?armoryGear:armoryCat)===c.id)return;if(gearTab)armoryGear=c.id;else armoryCat=c.id;armoryItem=null;renderArmory();cats.querySelector('.active')?.focus({preventScroll:true});});cats.append(b);}}}
  const entries=armoryTab==='weapons'?Object.keys(W).filter(k=>armoryCat==='all'||catOf(k)===armoryCat).sort((a,b)=>W[a].slot-W[b].slot||W[a].price-W[b].price).map(k=>['weapon',k]):armoryTab==='gear'?Object.keys(G).filter(k=>armoryGear==='all'||G[k].slot===armoryGear).sort((a,b)=>G[a].slot.localeCompare(G[b].slot)||G[a].price-G[b].price).map(k=>['gear',k]):armoryTab==='support'?Object.keys(SUP).sort((a,b)=>SUP[a].cost-SUP[b].cost).map(k=>['support',k]):armoryTab==='perks'?Object.keys(PERKS).sort((a,b)=>PERKS[a].slot-PERKS[b].slot||PERKS[a].tier-PERKS[b].tier).map(k=>['perk',k]):Object.keys(U).map(k=>['upgrade',k]);
  if(!armoryItem||!entries.some(e=>e[1]===armoryItem))armoryItem=entries[0][1];
  const up=Meta.nextUp(save);
  for(const [kind,key] of entries){const item=itemTable(kind)[key],have=Meta.owns(save,kind,key),ch=item.challenge&&Meta.challenge(save,item.challenge),lvl=kind==='upgrade'?save.upgrades[key]||0:0,cost=Meta.price(save,kind,key),fresh=have&&kind!=='upgrade'&&!save.seen.includes(key)&&!['rifle','pistol'].includes(key),b=document.createElement('button');b.type='button';b.className='armory-item'+(key===armoryItem?' active':'')+(have?' owned':'');b.dataset.item=key;b.dataset.rar=RAR(kind,key);
   // Locked by rank, marked down because it was found in the field, or the suggested next buy for the next operation.
   const rk=have||cost==null?0:Meta.locked(save,kind,key),next=!!up&&up.kind===kind&&up.key===key;b.classList.toggle('locked',!!rk);b.classList.toggle('sealed',sealed(kind,key));b.classList.toggle('next',next);
   const tag=(next?'NEXT UP · ':'')+(kind==='upgrade'?(lvl>=3?'MAX':'LV '+lvl+' · '+(rk?'RANK '+rk:fmt(cost)+' CR')):have?(equipped(key)?'EQUIPPED':'OWNED'):ch?'CHALLENGE · '+ch.progress+' / '+ch.goal:rk?'RANK '+rk:fmt(cost)+' CR'+(kind==='weapon'&&save.found.includes(key)?' · FOUND':''));
   b.innerHTML=`<span class="ai-art">${ICON(kind,key)}</span><span class="ai-kind">${kindLabel(kind,item)} · ${RAR_TAG(kind,key)}</span><b>${esc(item.name)}</b><span class="ai-tag${fresh?' new':''}">${fresh?'NEW · ':''}${tag}</span>`;
   b.addEventListener('click',()=>{armoryItem=key;renderArmory();});b.addEventListener('focus',()=>{if(armoryItem!==key){armoryItem=key;renderDetail(kind,key);for(const x of list.children)x.classList.toggle('active',x===b);}});list.append(b);}
  renderDetail(entries.find(e=>e[1]===armoryItem)[0],armoryItem);}
 // A gun's real numbers beside the bars, what it does beyond them, and how it compares with the gun in that slot now
 // (green where it is better, red where it is worse) - so a purchase can be judged on more than its price.
 function weaponFacts(key){const w=W[key],st=Meta.weaponStats(key),eqKey=Meta.loadout(save)[w.slot===0?'primary':'secondary'],eq=eqKey&&eqKey!==key?Meta.weaponStats(eqKey):null,traits=Meta.weaponTraits(key);
  const rows=[['DAMAGE','per',0],['RATE / S','rps',1],['SUSTAINED','sustained',0],['MAG','mag',0],['RELOAD','reload',2,true],['RANGE','range',0],['MOBILITY','mobility',2]];
  const tips={per:'Damage per shot (all pellets)',rps:'Rounds a second',sustained:'Damage a second over a magazine and its reload',mag:'Magazine',reload:'Reload time',range:'Effective range',mobility:'Movement speed carrying it'};
  const cell=([label,k,d,low])=>{const v=st[k],diff=eq?(v-eq[k])/(eq[k]||1):0,better=low?diff<0:diff>0,shown=k==='mobility'?Math.round(v*100)+'%':k==='reload'?v.toFixed(2)+' S':v.toFixed(d);
   return `<span title="${tips[k]}"><small>${label}</small><b>${shown}</b>${eq&&Math.abs(diff)>=.02?`<em class="${better?'up':'down'}">${diff>0?'+':''}${Math.round(diff*100)}%</em>`:''}</span>`;};
  return `${traits.length?`<div class="ad-traits">${traits.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<div class="ad-numbers">${rows.map(cell).join('')}</div>${eq?`<p class="ad-compare">COMPARED WITH YOUR ${esc(W[eqKey].short)}</p>`:''}`;}
 function renderDetail(kind,key){const detail=$('armory-detail'),item=itemTable(kind)[key],have=Meta.owns(save,kind,key),cost=Meta.price(save,kind,key);detail.dataset.rar=RAR(kind,key);
  if(have&&kind!=='upgrade'&&!save.seen.includes(key)){save.seen.push(key);persist();}
  let body='',actions=[];
  if(kind==='weapon'){const kills=save.mastery[key]||0,lvl=Meta.masteryLevel(kills),next=Meta.MASTERY[lvl];const slot=item.slot===0?'primary':'secondary',fitted=save.kit[key]||0,part=Meta.KIT[fitted],partCost=Meta.price(save,'kit',key);
   body=`<p class="ad-kind">${RAR_TAG(kind,key)} · TIER ${item.tier} · ${item.slot===0?'PRIMARY':'SECONDARY'} · ${item.cls.toUpperCase()}</p><h3>${esc(item.name)}</h3><p class="ad-role">ROLE · ${esc(item.role||item.cls.toUpperCase())}</p><p>${esc(item.desc)}</p>${weaponFacts(key)}<div class="bars">${bars(item)}</div>
    <div class="mastery"><b>MASTERY ${'★'.repeat(lvl)}${'☆'.repeat(3-lvl)}</b><span>${kills} KILLS${next?' · '+(next-kills)+' TO '+Meta.MASTERY_PERKS[lvl].toUpperCase():' · MASTERED'}</span></div><div class="kit-parts">${Meta.KIT.map((k,i)=>`<span class="${i<fitted?'on':''}"><b>${k.name}</b>${k.desc} ${i<fitted?'FITTED':'MASTERY '+'★'.repeat(i+1)}</span>`).join('')}</div>
    <p class="ad-source">${have?'IN YOUR ARMORY':save.found.includes(key)?'FOUND IN THE FIELD · 25% OFF':item.drop?'CARRIED BY '+esc(item.drop).toUpperCase()+' — TAKE ONE IN THE FIELD TO USE IT FOR THAT RUN AND GET 25% OFF HERE':'ARMORY ONLY'}</p>`;
   if(have)actions.push([save.loadout[slot]===key?'EQUIPPED AS '+slot.toUpperCase():'EQUIP AS '+slot.toUpperCase(),()=>{save.loadout[slot]=key;save.loadout=Meta.loadout(save);persist();renderArmory();scene.audio.ui('select');itemVoice('weapon',key);}]);
   // Weapon kit: the next part can be fitted once the gun's mastery has reached that level.
   if(have&&part)actions.push([lvl<=fitted?`${part.name} · NEEDS MASTERY ${'★'.repeat(fitted+1)}`:save.credits>=partCost?`FIT ${part.name} · ${fmt(partCost)} CR`:`${part.name} · ${fmt(partCost)} CR · NEED ${fmt(partCost-save.credits)} MORE`,()=>{const r=Meta.buy(save,'kit',key);if(!r.ok){toast(r.reason);scene.audio.ui('deny');return;}scene.audio.ui('buy');persist();renderArmory();banner('ARMORY',part.name,item.name+' · '+part.desc.toUpperCase(),2.2,'gold',ICON('weapon',key));}]);}
  else if(kind==='gear'){body=`<p class="ad-kind">${RAR_TAG(kind,key)} · TIER ${item.tier} · ${item.slot.toUpperCase()} GADGET · ${item.count} CHARGES PER MISSION</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p><p class="ad-source">${have?'IN YOUR ARMORY':'ARMORY ONLY'} · ${item.slot==='lethal'?keyLabel('grenade'):keyLabel('tactical')} TO USE</p>`;
   if(have)actions.push([save.loadout[item.slot]===key?'EQUIPPED':'EQUIP',()=>{save.loadout[item.slot]=key;save.loadout=Meta.loadout(save);persist();renderArmory();scene.audio.ui('select');itemVoice('gear',key);}]);}
  // Field support and perks: what it does, the challenge that awards it (with progress) if it is not for sale, and equipping it.
  else if(kind==='support'||kind==='perk'){const ch=item.challenge&&Meta.challenge(save,item.challenge),sup=kind==='support',on=sup?save.loadout.support===key:save.loadout.perks[item.slot]===key,shut=!sup&&item.slot>=Meta.perkSlots(save),opens=sup?0:BPWorld.perkSlots[item.slot];
   body=`<p class="ad-kind">${RAR_TAG(kind,key)} · ${sup?'FIELD SUPPORT · '+item.cost+' SCORE TO CALL':SLOTN[item.slot]+' PERK · SLOT '+(item.slot+1)}</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p>`
    +(ch?`<div class="challenge${ch.done?' done':''}"><b>CAREER CHALLENGE</b><span>${esc(ch.text)}</span><div class="xp-track big"><i style="width:${(ch.progress/ch.goal*100).toFixed(1)}%"></i></div><small>${ch.progress} / ${ch.goal} · ${have?'EARNED':'CANNOT BE BOUGHT'}</small></div>`:'')
    +`<p class="ad-source">${have?'YOURS':ch?'AWARDED WHEN THE CHALLENGE IS MET':'ARMORY ONLY'} · ${sup?'THE METER FILLS WITH YOUR SCORE · '+esc(keyLabel('support'))+' TO CALL IT IN':shut?'PERK SLOT '+(item.slot+1)+' OPENS AT RANK '+opens:'ONE PERK PER SLOT'}</p>`;
   if(have)actions.push([on?'EQUIPPED':shut?'SLOT OPENS AT RANK '+opens:'EQUIP',()=>{if(shut){scene.audio.ui('deny');return;}equip(kind,key);persist();renderArmory();scene.audio.ui('select');itemVoice(kind,key);}]);}
  else{const lvl=save.upgrades[key]||0;body=`<p class="ad-kind">${RAR_TAG(kind,key)} · PERMANENT UPGRADE · LEVEL ${lvl} / 3</p><h3>${esc(item.name)}</h3><p>${esc(item.desc)}</p><div class="pips">${[0,1,2].map(i=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</div>`;}
  // A gun or gadget that is a challenge award shows that challenge and how far along it is, like the abilities and perks do.
  if(item.challenge&&(kind==='weapon'||kind==='gear')){const ch=Meta.challenge(save,item.challenge);
   body=body.replace('<p class="ad-source">',`<div class="challenge${ch.done?' done':''}"><b>CAREER CHALLENGE</b><span>${esc(ch.text)}</span><div class="xp-track big"><i style="width:${(ch.progress/ch.goal*100).toFixed(1)}%"></i></div><small>${ch.progress} / ${ch.goal} · ${have?'EARNED':'CANNOT BE BOUGHT'}</small></div><p class="ad-source">`).replace('ARMORY ONLY','AWARDED WHEN THE CHALLENGE IS MET');}
  detail.classList.toggle('sealed',sealed(kind,key));
  const rk=have||cost==null?0:Meta.locked(save,kind,key);
  if(!have&&cost!=null)actions.unshift([rk?`${fmt(cost)} CR · UNLOCKS AT RANK ${rk}`:save.credits>=cost?`BUY · ${fmt(cost)} CR`:`${fmt(cost)} CR · NEED ${fmt(cost-save.credits)} MORE`,()=>{const r=Meta.buy(save,kind,key);if(!r.ok){toast(r.reason);scene.audio.ui('deny');return;}scene.audio.ui('buy');itemVoice(kind,key);if(kind!=='upgrade'){equip(kind,key);save.seen.push(key);}persist();renderArmory();banner('ARMORY',kind==='upgrade'?item.name+' LV '+save.upgrades[key]:item.name,kind==='upgrade'?'UPGRADE INSTALLED':'PURCHASED · EQUIPPED',2.2,'gold',ICON(kind,key));}]);
  detail.innerHTML=`<div class="ad-art ad-${kind}">${ICON(kind,key)}</div>`+body+'<div class="ad-actions"></div>';const box=detail.querySelector('.ad-actions');actions.forEach(([label,fn],i)=>{const b=document.createElement('button');b.type='button';b.className=i===0&&!have?'primary':'secondary';b.innerHTML=`<span>${label}</span>`;b.addEventListener('click',fn);box.append(b);});}
 // ---------- Intel: the armory's file on every hostile ----------
 // Each file is drawn in its threat grade's colour (the armory's own five, grey to red). A hostile never met is its
 // silhouette in that colour; the file fills in as it is sighted, studied (one kill) and completed (Meta.intelOf).
 const GRADE=['LOW THREAT','MODERATE THREAT','DANGEROUS','ELITE','BOSS'],GRADE_SHORT=['LOW','MODERATE','DANGEROUS','ELITE','BOSS'],PORTRAITS=new Map();let armoryIntel='all';
 function intelArt(k){if(!PORTRAITS.has(k)&&scene?.renderer?.portrait){PORTRAITS.set(k,null);scene.renderer.portrait(k).then(url=>{if(!url){PORTRAITS.delete(k);return;}PORTRAITS.set(k,url);for(const img of document.querySelectorAll(`img[data-portrait="${k}"]`))img.src=url;});}
  const url=PORTRAITS.get(k);return `<img class="icon intel-portrait" data-portrait="${k}" alt=""${url?` src="${url}"`:''}>`;}
 const fileNo=k=>String(Meta.INTEL_KEYS.indexOf(k)+1).padStart(2,'0');
 function intelNumbers(k){const a=A[k],dmg=!a.damage?'—':a.pellets?a.damage+' × '+a.pellets:a.burst?a.damage+' × '+a.burst:String(a.damage);
  const cells=[['HEALTH',a.hp],['SPEED',a.speed||'FIXED'],['RANGE',a.range||'—'],['DAMAGE',dmg],['ATTACKS',a.damage?'EVERY '+a.rate+' S':'—'],['BOUNTY',a.bounty+' CR']];
  const traits=[a.boss&&'BOSS',a.armor&&'ARMOURED · BULLETS ×'+a.armor,a.front&&'SHIELDED FRONT',a.barrier&&'BARRIER',a.rear&&'WEAK REAR ×'+a.rear,a.cloak&&'CLOAKED',a.flying&&'FLYING',a.machine&&'MACHINE · EMP',a.medic&&'REVIVES THE FALLEN',a.builds&&'BUILDS SENTRIES',a.jams&&'JAMS SUPPORT',a.spotter&&'MARKS YOU',a.kamikaze&&'EXPLODES',a.lob&&'LOBS SHELLS',a.shell&&'MORTAR',a.locked&&'LASER SIGHT',a.melee&&'BLADE',a.push&&'PUSHES IN',a.blink&&'BLINKS'].filter(Boolean);
  return `${traits.length?`<div class="ad-traits">${traits.map(x=>`<span>${x}</span>`).join('')}</div>`:''}<div class="ad-numbers intel-numbers">${cells.map(([l,v])=>`<span><small>${l}</small><b>${v}</b></span>`).join('')}</div><p class="ad-compare">STANDARD PRESSURE · TOUGHER ON HIGHER PRESSURE AND IN LATE HOLDOUT WAVES</p>`;}
 function renderIntelList(list){const cats=$('armory-cats'),keys=Meta.INTEL_KEYS,sum=Meta.intelSummary(save),csig='intel|'+armoryIntel+'|'+sum.seen+'|'+sum.studied+'|'+sum.complete;cats.hidden=false;
  if(cats.dataset.sig!==csig){cats.dataset.sig=csig;cats.replaceChildren();
   for(const c of [{id:'all',name:'ALL'},...GRADE_SHORT.map((name,i)=>({id:String(i+1),name}))]){const ks=keys.filter(k=>c.id==='all'||String(BPWorld.intel[k].tier)===c.id),b=document.createElement('button');b.type='button';b.dataset.cat=c.id;b.className=c.id===armoryIntel?'active':'';if(c.id!=='all')b.dataset.rar=c.id;
    b.innerHTML=`${c.name} <small>${ks.filter(k=>Meta.intelOf(save,k).level).length}/${ks.length}</small>`;b.addEventListener('click',()=>{if(armoryIntel===c.id)return;armoryIntel=c.id;armoryItem=null;renderArmory();cats.querySelector('.active')?.focus({preventScroll:true});});cats.append(b);}
   const tally=document.createElement('span');tally.className='cats-sum';tally.textContent=`IDENTIFIED ${sum.seen}/${sum.total} · STUDIED ${sum.studied} · COMPLETE ${sum.complete}`;cats.append(tally);}
  const entries=keys.filter(k=>armoryIntel==='all'||String(BPWorld.intel[k].tier)===armoryIntel);if(!entries.includes(armoryItem))armoryItem=entries[0];
  for(const k of entries){const i=Meta.intelOf(save,k),b=document.createElement('button');b.type='button';b.className='armory-item intel-item'+(k===armoryItem?' active':'')+(i.level?' owned':' sealed');b.dataset.item=k;b.dataset.rar=i.tier;
   const tag=i.level===3?'COMPLETE · '+i.kills+' KILLED':i.level===2?'STUDIED · '+i.kills+' / '+i.goal:i.level===1?'SIGHTED · NO KILLS YET':'NO CONTACT';
   b.innerHTML=`<span class="ai-art">${intelArt(k)}</span><span class="ai-kind">FILE ${fileNo(k)} · <i class="rar">${GRADE[i.tier-1]}</i></span><b>${i.level?esc(A[k].name):'UNIDENTIFIED'}</b><span class="ai-tag">${tag}</span>`;
   b.addEventListener('click',()=>{armoryItem=k;renderArmory();});b.addEventListener('focus',()=>{if(armoryItem!==k){armoryItem=k;renderIntel(k);for(const x of list.children)x.classList.toggle('active',x===b);}});list.append(b);}
  renderIntel(armoryItem);}
 function renderIntel(k){const detail=$('armory-detail'),i=Meta.intelOf(save,k),t=BPWorld.intel[k],a=A[k],where=Meta.intelWhere(k);detail.dataset.rar=i.tier;detail.classList.toggle('sealed',!i.level);
  const steps=`<div class="intel-steps">${Meta.INTEL_LEVELS.slice(1).map((L,j)=>`<span class="${i.level>j?'on':''}">${L}</span>`).join('')}</div>`;
  let body=`<p class="ad-kind"><i class="rar">${GRADE[i.tier-1]}</i> · INTEL FILE ${fileNo(k)}</p><h3>${i.level?esc(a.name):'UNIDENTIFIED HOSTILE'}</h3>`+steps;
  if(!i.level)body+=`<p>No contact yet. This file opens the first time you get a clear look at one in the field.</p><p class="intel-where"><b>LAST REPORTED</b> ${where.map(esc).join('<br>')||'UNKNOWN'}</p>`;
  else{body+=`<p class="ad-role">ROLE · ${esc(t.role)}</p><p>${esc(t.desc)}</p><p class="intel-where"><b>MET IN</b> ${where.map(esc).join('<br>')}</p>`;
   if(i.level>=2)body+=`<div class="intel-note"><b>HOW TO BEAT IT</b><span>${esc(TIPS[k]||t.weak)}</span></div>`+intelNumbers(k);else body+=`<p class="intel-locked">KILL ONE TO LEARN HOW TO BEAT IT AND WHAT IT CAN TAKE</p>`;
   if(i.level>=3)body+=`<div class="intel-note weak"><b>WEAK POINT</b><span>${esc(t.weak)}</span></div>${a.drop?`<p class="ad-source">DROPS ${esc(a.drop).toUpperCase()} WHEN KILLED</p>`:''}`;else if(i.level>=2)body+=`<p class="intel-locked">${i.goal-i.kills} MORE KILL${i.goal-i.kills===1?'':'S'} FOR ITS WEAK POINT</p>`;}
  body+=`<div class="intel-progress"><div class="xp-track big"><i style="width:${Math.min(100,i.kills/i.goal*100).toFixed(1)}%"></i></div><small>${i.kills} / ${i.goal} KILLS · ${i.paid?'FILE COMPLETE · '+fmt(i.pay)+' CR PAID':'COMPLETE THE FILE FOR '+fmt(i.pay)+' CR'}</small></div>`;
  detail.innerHTML=`<div class="ad-art ad-intel">${intelArt(k)}</div>`+body;}
 // Sightings and kills from the field (a guest's machine gets the host's events too, so both squadmates' files fill).
 function intelNote(kind,e){const s=scene?.sim;if(!s||s.tdm||s.training||!BPWorld.intel?.[e.enemy])return;const name=A[e.enemy].name;
  if(kind==='sight'){if(Meta.intelSight(save,e.enemy)){persist();toast('INTEL · NEW FILE OPENED: '+name,2.2);}return;}
  if(!e.by||e.bot)return;const r=Meta.intelKill(save,e.enemy);if(!r)return;
  if(r.complete){persist();refreshWallet();banner('INTEL FILE COMPLETE',name,'+'+fmt(r.pay)+' CR · THE FULL FILE IS IN THE ARMORY',2.6,'gold');}
  else if(r.studied){persist();toast('INTEL · '+name+' STUDIED / HOW TO BEAT IT IS IN THE ARMORY',2.4);}
  else if(r.opened){persist();toast('INTEL · NEW FILE OPENED: '+name,2.2);}}
 function renderRecord(detail){const r=rank(),c=Meta.refreshContracts(save,today());persist();
  detail.innerHTML=`<div class="record-col"><p class="ad-kind">SERVICE RECORD / ROOK</p><h3>RANK ${r.rank} · ${esc(r.title)}</h3><div class="xp-track big"><i style="width:${(r.into/r.span*100).toFixed(1)}%"></i></div><p>${fmt(r.into)} / ${fmt(r.span)} XP TO RANK ${r.rank+1} · EVERY RANK PAYS ${150*(r.rank+1)} CR</p>
   <h4>DAILY CONTRACTS <small>RESET AT MIDNIGHT</small></h4><div class="contracts">${c.map(x=>`<div class="contract${x.done?' done':''}"><span>${esc(x.text)}</span><i style="--v:${(x.progress/x.goal).toFixed(2)}"></i><b>${x.done?'PAID':x.progress+' / '+x.goal} · ${x.reward} CR</b></div>`).join('')}</div>
</div><div class="record-col">
   <h4>RECORD</h4><div class="record"><span>HOSTILES <b>${fmt(save.stats.kills)}</b></span><span>OPERATIONS <b>${save.stats.missions}</b></span><span>DAILY STREAK <b>${save.daily.streak}</b></span><span>INTEL FILES <b>${Meta.intelSummary(save).seen} / ${Meta.intelSummary(save).total}</b></span><span>HOLDOUT BEST <b>${DIFFS.map(d=>save.holdout[d]?DL[d].label[0]+save.holdout[d]:'').filter(Boolean).join(' · ')||'—'}</b></span></div>
   <h4>MEDALS</h4><div class="medal-table">${MISSIONS.map(m=>`<span>${String(m.n).padStart(2,'0')} ${Meta.unlocked(save,m.id)?esc(m.title):'CLASSIFIED'}<b class="medals">${medalRow(m.id)}</b></span>`).join('')}</div></div>`;}
 // ---------- runs ----------
 function launch(o){if(!scene)return;if(!o.drill){drill=null;$('skip-drill').hidden=true;}scene.audio.unlock();scene.audio.stopAmbient();for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  // A seeded challenge is played on level terms: its fixed kit only, and none of the armory's permanent upgrades.
  const coop=o.mode==='extract'||o.mode==='trials';scene.record=o.mode==='trials'?[]:null;scene.ghost=o.mode==='trials'?makeGhost(o):null;scene.sim=BPCore.create({training:o.mode==='training',mission:o.mission,difficulty:o.difficulty,checkpoint:o.checkpoint||null,loadout:o.loadout,owned:o.fair?Object.values(o.loadout).filter(k=>W[k]):[...save.owned.weapons],profile:o.fair?null:Meta.profile(save),mutators:o.mutators,seed:o.seed||1701,mode:coop?'holdout':o.mode,rules:o.rules,extraction:o.mode==='extract',trial:o.mode==='trials'?o.trial:undefined,guest:o.guest||undefined,mates:o.mates||undefined,squad:o.squad,limit:o.limit,support:o.support});$('retry').hidden=false;scene.names=o.names||null;for(const m of scene.sim.mates)if(m.vip)scene.names={...(scene.names||{}),[m.id]:m.name};scene.selfId='player';$('hud-name').textContent=lobby||o.names?callsign():'ROOK';
  const meta=missionMeta(o.mission),training=o.mode==='training',tdm=o.mode==='tdm',hold=o.mode==='holdout'||tdm||coop,hm=hold?holdoutMap(o.mission):null,label=tdm?MODES[o.rules]?.label||'TEAM DEATHMATCH':coop?MODES[o.mode].label:'HOLDOUT';padGadget=scene.sim.player.lethal||!scene.sim.player.tactical?'lethal':'tactical';
  scene.renderer.build(scene.sim);scene.accumulator=0;padAngle=padTarget=scene.sim.player.angle||0;padAimIdle=0;padReach=PAD_REACH;timeScale=1;scene.audio.startAmbient(scene.sim.map.theme);
  $('training-equipment').hidden=!training;$('range-weapon').value='rifle';$('chapter').textContent=training?'LIVE FIRE / ALL EQUIPMENT':hold?label+' / '+DL[o.difficulty].label:meta.act+' · '+DL[o.difficulty].label;$('mission-title').textContent=training?'TRAINING RANGE':hold?hm.title:meta.title;$('sector').textContent=training?'FIELD LAB / SECTOR 00':hold?'SIMULATION / '+hm.sector:meta.sector;
  $('pause-copy').textContent=training?'The range waits. Nothing here changes your campaign.':tdm?'The match holds while you are paused. Leave now and it does not count.':o.mode==='extract'?'The patrols hold while you are paused. Leave now and the loot is lost.':o.mode==='trials'?'The clock stops while you are paused.':hold?'Waves resume when you do. Dying ends the run and banks its credits.':'Your checkpoint is secure. The city can wait.';$('retry').textContent=training?'RESET THE RANGE':tdm?'RESTART MATCH':o.mode==='trials'?'RESTART THE COURSE':o.mode==='extract'?'RESTART THE RUN':hold?'RESTART HOLDOUT':'RETRY CHECKPOINT';
  $('radio').hidden=true;radioUntil=0;$('banner').className='banner';setMode('playing');$('status').textContent=training?'TRAINING ACTIVE':'ROOK / SIGNAL ACTIVE';scene.scale.refresh();scene.game.canvas.focus();lastHud=0;hud();drain();
  if(!training&&!hold&&!o.checkpoint?.stage)banner(meta.act,meta.title,meta.sector,3.4);if(hold&&!o.fair)banner(tdm?'TEAM DEATHMATCH':'HOLDOUT',hm.title,tdm?'TEAM '+(scene.sim.player.team?'DELTA':'ALPHA')+' · FIRST TO '+scene.sim.tdm.limit+' KILLS':'SURVIVE AS LONG AS YOU CAN',3);feedRows=[];
  // The commander's order for this kind of run. It cuts in over anything else he was saying; a quick retry does not repeat it.
  if(!training)scene.audio.say(hold&&!tdm?'vo-mission':'vo-move-out',{cut:true,rest:25});voiceHurt=voiceDry=false;tdmCalls={ahead:false,behind:false,close:false};}
 function freshCheckpoint(){return {stage:0,time:0,kills:0,damage:0,flows:0,credits:0,intel:0,killed:[],dead:[]};}
 function startMission(id,resume=false){if(!Meta.unlocked(save,id))return;const lo=Meta.loadout(save);
  if(resume&&save.run?.mission===id){run={...save.run};launch({mode:'campaign',mission:id,difficulty:run.difficulty,checkpoint:run.checkpoint,loadout:lo,mutators:run.mutators||[]});return;}
  const mutators=save.missions[id]?.done?[...opsMutators]:[];run={mode:'campaign',mission:id,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0,mutators};save.run={...run,checkpoint:freshCheckpoint()};persist();launch({mode:'campaign',mission:id,difficulty:run.difficulty,loadout:lo,mutators});}
 // A lobby run played on this machine alone: holdout (with an AI teammate if the open slot was filled), or a team
 // deathmatch against AI operators, whose teams and rules ("vs") were set in the lobby.
 function startArena(kind='holdout',mapId='holdout',fill=false,vs=null){netRole='solo';
  if(kind==='trials'){const daily=!!settings.trialDaily,seed=trialSeed(mapId,daily);run={mode:'trials',mission:mapId,difficulty:'standard',floor:'standard',deaths:0,trial:{seed,daily}};
   launch({mode:'trials',mission:mapId,difficulty:'standard',loadout:Meta.loadout(save),seed:1701,trial:{seed}});return;}
  const crew=botCrew((kind==='holdout'||kind==='extract')&&fill?1:0);
  const vsMode=isVs(kind);run={mode:vsMode?'tdm':kind,rules:vsMode?kind:undefined,mission:mapId,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0,fill,vs};const seed=1701+Math.floor(Math.random()*1e6);
  if(vsMode)launch({mode:'tdm',rules:kind,mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed,mutators:vsMutators(),...(vs||{})});
  else launch({mode:kind,mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed,mutators:kind==='extract'?vsMutators():undefined,mates:crew.length?crew.map(c=>({loadout:c.loadout,bot:true})):undefined,names:crew.length?crewNames(crew):null});}
 function startHoldout(mapId='holdout'){startArena('holdout',mapId,false);}
 // A seeded challenge (Meta.challengeFor): today's daily or this week's weekly, on its own map, pressure, kit and
 // mutator, from its own seed. The attempt is counted as it starts; whether it can set a record rides with the run.
 function startChallenge(kind){const cfg=Meta.challengeFor(kind,today()),start=Meta.startChallenge(save,cfg,today());persist();lobby=null;netRole='solo';
  run={mode:'holdout',mission:cfg.map,difficulty:cfg.difficulty,floor:cfg.difficulty,deaths:0,fill:false,challenge:cfg,eligible:start.eligible,runId:Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6).toString(36)};
  launch({mode:'holdout',mission:cfg.map,difficulty:cfg.difficulty,loadout:cfg.loadout,seed:cfg.seed,fair:true,mutators:cfg.mutators});
  banner(cfg.label,holdoutMap(cfg.map).title,(start.eligible?'THIS RUN COUNTS':'PRACTICE RUN · NOT RECORDED')+(cfg.mutators.length?' · '+cfg.mutators.map(k=>BPWorld.mutators[k].name).join(' + '):''),3.4,start.eligible?'gold':'');}
 const kitLine=lo=>[W[lo.primary]?.short,W[lo.secondary]?.short,G[lo.lethal]?.name,G[lo.tactical]?.name,SUP[lo.support]?.name].filter(Boolean).join(' · ');
 // The challenges panel (main menu, under the daily contracts): today's daily and this week's weekly in full - map,
 // kit as it will actually be carried, the twist, the rules, your standing and this machine's board for each.
 const untilReset=kind=>{const now=new Date(),end=new Date(now);end.setHours(24,0,0,0);if(kind==='weekly')end.setDate(end.getDate()+(8-end.getDay())%7);const h=Math.max(0,Math.round((end-now)/3600000));return h>=48?Math.floor(h/24)+' DAYS':h>=1?h+' H':'UNDER AN HOUR';};
 function challengeStatus(){return ['daily','weekly'].map(kind=>{const cfg=Meta.challengeFor(kind,today()),key=kind+':'+cfg.period,best=save.challenges?.best?.[key],tries=save.challenges?.attempts?.[key]||0;
   return kind.toUpperCase()+' '+(best?fmt(best.score):cfg.once&&tries?'PLAYED':'READY');}).join(' · ');}
 function challengePanel(kind){const day=today(),cfg=Meta.challengeFor(kind,day),key=kind+':'+cfg.period,best=save.challenges?.best?.[key],tries=save.challenges?.attempts?.[key]||0,map=holdoutMap(cfg.map),side=cfg.mutators.includes('sidearms'),lo=cfg.loadout;
   const kit=[['PRIMARY',side?'NONE · SIDEARMS ONLY':W[lo.primary]?.name],['SECONDARY',W[lo.secondary]?.name],['LETHAL',G[lo.lethal]?.name],['TACTICAL',G[lo.tactical]?.name],['SUPPORT',SUP[lo.support]?.name]].filter(r=>r[1]);
   const twist=cfg.mutators.map(k=>BPWorld.mutators[k]),practice=cfg.once&&tries>0,rows=Meta.challengeBoard(save,kind).slice(0,5),cur=cfg.period;
   return `<section class="ch-panel ch-${kind}"><header class="ch-head"><span class="ch-kind">${esc(cfg.label)}</span><span class="ch-reset">NEW ${kind==='daily'?'CHALLENGE':'WEEK'} IN ${untilReset(kind)}</span></header>
    <div class="ch-map"><i style="background-image:url('blackout/assets/menu/killhouse-${cfg.map}.jpg')"></i><div><small>KILLHOUSE</small><b>${esc(map.title)}</b><span>${esc(map.sector)} · ${DL[cfg.difficulty].label} PRESSURE</span></div></div>
    <dl class="ch-kit">${kit.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <p class="ch-twist">${twist.length?twist.map(m=>`<b>${esc(m.name)}</b> ${esc(m.desc)}`).join('<br>'):'<b>NO TWIST</b> The killhouse as it is.'}</p>
    <ul class="ch-rules"><li>${cfg.once?'Only your first attempt today is recorded; later runs are practice.':'Your best attempt this week is recorded; play as often as you like.'}</li><li>The kit above only: no armory upgrades, perks or kit parts.</li><li>Score: wave × 1,000 + hostiles × 10 + best combo × 25.</li></ul>
    <div class="ch-standing"><span>${best?'YOUR BEST <b>'+fmt(best.score)+'</b> · WAVE '+best.wave:practice?'ATTEMPT USED':'NOT PLAYED YET'}</span><span>${tries} ATTEMPT${tries===1?'':'S'}</span></div>
    <button type="button" class="${practice?'secondary':'primary'} ch-play" data-challenge="${kind}"><span>${practice?'PRACTICE RUN':best?'PLAY AGAIN':'PLAY'} ↗</span></button>
    <h4>LOCAL BOARD <small>THIS MACHINE ONLY</small></h4><div class="ch-board">${rows.length?rows.map((e,i)=>`<div class="board-row${e.period===cur?' current':''}"><span class="br-rank">#${i+1}</span><b>${fmt(e.score)}</b><span>WAVE ${e.wave} · ×${e.combo}</span><span>${e.period===cur?(kind==='daily'?'TODAY':'THIS WEEK'):new Date(e.at).toISOString().slice(0,10)}</span></div>`).join(''):'<p class="board-empty">No recorded runs yet.</p>'}</div></section>`;}
 function openChallenges(){const p=$('challenges');setHtml($('challenges-list'),challengePanel('daily')+challengePanel('weekly'));p.classList.remove('closing');if(!p.open)p.showModal();p.querySelector('.ch-play')?.focus();}
 function closeChallenges(){const p=$('challenges');if(!p.open||p.classList.contains('closing'))return;p.classList.add('closing');setTimeout(()=>{p.classList.remove('closing');p.close();},200);}
 // The mode picker: co-op modes and versus modes, each with its picture, what it is and how many can play. A mode
 // that cannot be played over an online lobby (the versus ones, for now) says so and is not offered.
 function openModePicker(){const l=lobby;if(!l||l.role==='guest')return;const list=$('picker-list');list.replaceChildren();list.classList.add('maps','modes');$('picker-eyebrow').textContent='COMBAT MODES';$('picker-title').textContent='CHOOSE A MODE.';
  for(const [head,keys] of [['CO-OP · AGAINST THE AI',Object.keys(MODES).filter(k=>!isVs(k))],['VERSUS · TEAM AGAINST TEAM',Object.keys(MODES).filter(isVs)]]){const h=document.createElement('h4');h.className='pick-head';h.textContent=head;list.append(h);
   for(const k of keys){const M=MODES[k],off=l.link==='online'&&isVs(k)||l.role==='host'&&l.peers.length>=M.seats,b=document.createElement('button');b.type='button';b.className='pick'+(l.mode===k?' on':'')+(off?' locked':'');b.dataset.pickMode=k;
    b.innerHTML=`<div class="pick-art" style="background-image:url('blackout/assets/menu/mode-${M.art||k}.jpg')"></div><div><b>${M.label}</b><span>${esc(M.sub)}</span><small>${off?(l.link==='online'?'LAN OR SOLO ONLY FOR NOW':'TOO MANY PLAYERS IN THE LOBBY'):esc(M.note)}</small></div>`;
    b.addEventListener('click',()=>{if(off){scene.audio.ui('deny');return;}$('picker').close();lobbySetMode(k);});list.append(b);}}
  if(!$('picker').open)$('picker').showModal();(list.querySelector('.on')||list.querySelector('button:not(.locked)'))?.focus();}
 // The map picker, for either lobby mode: team deathmatch is fought over the same killhouses holdout uses.
 function openHoldoutPicker(role='solo'){
  const list=$('picker-list');list.replaceChildren();list.classList.remove('modes');list.classList.add('maps');$('picker-eyebrow').textContent=lobby?MODES[lobby.mode].label:'HOLDOUT';$('picker-title').textContent=isVs(lobby?.mode)?'CHOOSE A MAP.':'CHOOSE A KILLHOUSE.';
  // Each killhouse is shown by a screenshot of it in play (blackout/qa/killhouse-shots.cjs captures them).
  for(const h of HOLD){const open=holdoutOpen(h),b=document.createElement('button');b.type='button';b.className='pick'+(open?'':' locked')+(role==='lobby'&&lobby?.map===h.id?' on':'');
   b.innerHTML=`<div class="pick-art" style="background-image:url('blackout/assets/menu/killhouse-${h.id}.jpg')"></div><div><b>${esc(h.title)}</b><span>${open?esc(h.sector)+(isVs(lobby?.mode)?' · '+(h.size==='small'?'SMALL · 1V1–2V2':'LARGE · 3V3–4V4'):'')+(h.pay>1?' · PAYS ×'+h.pay:''):'LOCKED · COMPLETE '+esc(missionMeta(h.locks)?.title||'')+' TO UNLOCK'}</span></div>`;
   b.addEventListener('click',()=>{if(!open){scene.audio.ui('deny');return;}$('picker').close();scene.audio.ui('select');if(role==='lobby')lobbySetMap(h.id);else startHoldout(h.id);});list.append(b);}
  if(!$('picker').open)$('picker').showModal();(list.querySelector('.on')||list.querySelector('button:not(.locked)'))?.focus();}
 // ---------- the lobby ----------
 // Every holdout run and team deathmatch match starts here: pick the mode, the map, the enemy pressure and a loadout.
 // Played alone it is one operator plus AI teammates: three in team deathmatch, one in holdout if the open slot is
 // filled. On a LAN the host's lobby takes one more player in holdout and three in team deathmatch, and whatever
 // seats are still empty when a deathmatch deploys go to AI teammates.
 // The host owns the mode, map, enemy pressure and the deploy countdown; each side owns its own callsign, loadout and
 // (for a guest) ready state. Guest -> host: hello, profile, chat, input. Host -> guest: lobby, chat, countdown,
 // countdownCancel, start, snapshot, events, full. Everything received is re-validated.
 const CALLSIGNS=['VIPER','GHOST','RAVEN','MAKO','ONYX','HAVOC','EMBER','NOMAD'];
 // The combat modes. A versus mode is team deathmatch's engine with rules of its own (BPCore VERSUS): it is launched as
 // mode 'tdm' with rules set to the mode's key, so seats, AI, LAN play, the scoreboard and the pay all carry over.
 const MODES={holdout:{label:'HOLDOUT',sub:'ENDLESS WAVES',note:'ONE OR TWO OPERATORS',seats:2},tdm:{label:'TEAM DEATHMATCH',sub:'ALPHA V DELTA · UP TO 4 V 4',note:'UP TO EIGHT PLAYERS · AI OPTIONAL',seats:8,versus:true},
  arms:{label:'ARMS RACE',sub:'A NEW GUN FOR EVERY KILL',note:'TWELVE GUNS, THEN THE KNIFE · UP TO EIGHT PLAYERS',seats:8,versus:true},
  uplink:{label:'UPLINK',sub:'TAKE AND HOLD THE RELAYS',note:'THREE RELAYS · A POINT A SECOND FOR EACH ONE HELD',seats:8,versus:true},
  hunted:{label:'HUNTED',sub:'ONE HUNTER V THE SQUAD',note:"DELTA'S FIRST SEAT IS THE HUNTER · ONE LIFE",seats:5,versus:true},
  breach:{label:'BREACH',sub:'PLANT OR DEFEND · ROUNDS',note:'ONE LIFE A ROUND · FIRST TO FOUR',seats:8,versus:true},
  extract:{label:'EXTRACTION',sub:'TAKE THE LOOT · GET OUT',note:'ONE OR TWO OPERATORS · DIE AND THE LOOT IS LOST',seats:2},
  trials:{label:'FLOW TRIALS',sub:'RACE THE CLOCK',note:'SOLO · GATES, TARGETS, PERFECT FLOWS',seats:1}};
 // A flow-trial course: the map's own (the same every time) or today's (the same for everyone today).
 const trialSeed=(map,daily)=>daily?(today()*7919+[...map].reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,7))%1e9:[...map].reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,17)%1e9;
 const isVs=k=>!!MODES[k]?.versus;
 const BOT_KITS=[{primary:'rifle',secondary:'pistol'},{primary:'smg',secondary:'machinepistol'},{primary:'shotgun',secondary:'pistol'}];
 function callsign(){if(!settings.callsign){settings.callsign=CALLSIGNS[Math.floor(Math.random()*CALLSIGNS.length)];persist();}return settings.callsign;}
 // AI teammates: each gets a callsign nobody in the squad is using and one of three standard kits.
 function botCrew(n,taken=[]){const free=CALLSIGNS.filter(c=>c!==callsign()&&!taken.includes(c));return Array.from({length:n},(_,i)=>({name:free[i%free.length],rank:0,title:'AI TEAMMATE',ready:true,bot:true,loadout:{...BOT_KITS[i%BOT_KITS.length],lethal:null,tactical:null}}));}
 // The callsign shown over each operator in a run, by the name the simulation knows them by.
 function crewNames(crew){const names={player:callsign(),self:'player'};crew.forEach((c,i)=>{names[MATE_IDS[i]]=c.name;});return names;}
 function myProfile(){return {name:callsign(),rank:rank().rank,loadout:Meta.loadout(save),ready:lobby?.role==='host'||!!lobby?.ready};}
 function cleanProfile(m){const lo=m?.loadout||{},rk=Math.max(1,Math.min(99,Math.floor(Number(m?.rank)||1)));
  return {name:BPSave.callsign(m?.name)||'OPERATOR',rank:rk,title:Meta.rankOf(Meta.need(rk)).title,ready:m?.ready===true,
   loadout:{primary:W[lo.primary]?.slot===0?lo.primary:'rifle',secondary:W[lo.secondary]?.slot===1?lo.secondary:'pistol',lethal:G[lo.lethal]?.slot==='lethal'?lo.lethal:null,tactical:G[lo.tactical]?.slot==='tactical'?lo.tactical:null,
    support:SUP[lo.support]?lo.support:null,perks:[0,1,2].map(i=>{const k=Array.isArray(lo.perks)?lo.perks[i]:null;return PERKS[k]?.slot===i?k:null;})}};}
 const lobbyLinked=()=>!!lobby&&(lobby.role==='host'?lobby.peers.length>0:lobby.phase==='linked');
 // Holdout: who holds the seat after the lobby leader's - the player who joined, or an AI teammate when a solo player
 // has filled the open slot. null is a seat still open.
 function lobbySquad(l=lobby){const seats=1,out=l.peers.slice(0,seats).map(p=>({...p})),bots=botCrew(seats,out.map(p=>p.name)),ai=l.fill&&l.role==='solo';
  while(out.length<seats)out.push(ai?bots[out.length]:null);return out;}
 // ---------- team deathmatch seats ----------
 // Eight seats: 0-3 are Team Alpha, 4-7 Team Delta. A seat holds the lobby leader ('host'), a player who has joined
 // ({peer:id}), an AI operator ('bot') or nobody (null). The lobby leader adds and removes AI and sets the rules;
 // anyone can move to a seat with no player in it, and an AI in that seat changes places with them.
 const teamOf=n=>n<4?0:1,humans=(l,t)=>l.seats.filter((q,n)=>teamOf(n)===t&&q&&q!=='bot').length,teamsOk=l=>l.role==='guest'||[0,1].every(t=>l.seats.some((q,n)=>teamOf(n)===t&&q));
 let lastSeats=null;
 function seatsInit(l){if(l.role==='guest')return;if(l.seats&&l.mode==='hunted')for(let n=5;n<8;n++)if(l.seats[n]==='bot')l.seats[n]=null;if(!l.seats)l.seats=lastSeats?lastSeats.map(q=>q&&q.peer?'bot':q):['host','bot','bot','bot','bot','bot','bot','bot'];l.limit=BPCore.TDM.limits.includes(settings.tdmLimit)?settings.tdmLimit:BPCore.TDM.limit;l.support=settings.tdmSupport!==false;
  for(const p of l.peers)if(!l.seats.some(q=>q&&q.peer===p.id))seatPeer(l,p);}
 // A player who joins takes an empty seat on the team with fewer players, or an AI's seat if none is empty.
 function seatPeer(l,p){const t=humans(l,0)<=humans(l,1)?0:1,find=(x,what)=>l.seats.findIndex((q,n)=>teamOf(n)===x&&q===what),n=[find(t,null),find(t,'bot'),find(1-t,null),find(1-t,'bot')].find(i=>i>=0);
  if(n===undefined)return false;l.seats[n]={peer:p.id};return true;}
 function seatMove(l,who,n){if(!Number.isInteger(n)||n<0||n>7)return false;const cur=l.seats[n];if(cur&&cur!=='bot')return false;const from=l.seats.findIndex(q=>who==='host'?q==='host':!!q&&q.peer===who);if(from<0||from===n)return false;
  l.seats[n]=l.seats[from];l.seats[from]=cur;return true;}
 // The seats as everyone sees them: who is in each, by name, with what they carry.
 function seatsView(l){if(l.role==='guest')return (l.seats8||[]).map((q,n)=>q&&n===l.mySeat?{...q,...myProfile(),title:rank().title,bot:false,host:false}:q);const taken=[callsign(),...l.peers.map(p=>p.name)],free=CALLSIGNS.filter(c=>!taken.includes(c));
  return l.seats.map((q,n)=>{if(!q)return null;if(q==='bot')return {name:free[n%free.length]||'AI '+(n+1),bot:true,ready:true,rank:0,title:'AI OPERATOR',loadout:{...BOT_KITS[n%BOT_KITS.length],lethal:'frag',tactical:null,support:null,perks:[null,null,null]}};
   if(q==='host')return {...myProfile(),title:rank().title,host:true,ready:true};const p=l.peers.find(x=>x.id===q.peer);return p?{...p}:null;});}
 // The roster a match is built from: the lobby leader first, then every other filled seat in order.
 function rosterOf(l){const view=seatsView(l).map((q,n)=>q&&{...q,seat:n,team:teamOf(n)}).filter(Boolean),at=view.findIndex(q=>q.host);return at<0?view:[view[at],...view.filter((q,i)=>i!==at)];}
 // What a match needs from the lobby: every operator in roster order, their callsigns, and the rules.
 function matchOf(l){const all=rosterOf(l),hunter=all.find(r=>r.team===1),roster=l.mode==='hunted'?all.filter(r=>r.team===0||r===hunter):all,names={self:'player'};roster.forEach((r,i)=>{names[i?MATE_IDS[i-1]:'player']=r.name;});
  return {roster,vs:{squad:roster.map(r=>({team:r.team,loadout:r.loadout,bot:!!r.bot})),names,limit:l.limit,support:l.support}};}
 function renderTeams(l){const lead=l.role!=='guest',view=seatsView(l),mine=lead?l.seats.indexOf('host'):l.mySeat,linked=lobbyLinked();
  const tools=l.role==='solo'&&NET?`<span class="team-tools"><em>PLAY WITH FRIENDS OVER LAN</em><button type="button" class="secondary" data-link="lan" data-role="host">HOST A MATCH</button><button type="button" class="secondary" data-link="lan" data-role="guest">JOIN A MATCH</button></span>`:'';
  // One seat: a head (a face for a player, a visored mask for an AI, in the team's helmet), who is in it, their whole
  // kit - both guns, both gadgets, field support and perks - and at the right either how ready they are or, for a seat
  // that can be taken or changed, the buttons for that.
  const kit=lo=>[['weapon',lo.primary],['weapon',lo.secondary],['gear',lo.lethal],['gear',lo.tactical],['support',lo.support],...(lo.perks||[]).map(k=>['perk',k])].filter(x=>x[1]&&itemTable(x[0])[x[1]])
   .map(([kind,key])=>`<i class="kit-i kit-${kind}" data-rar="${RAR(kind,key)}" title="${esc(itemTable(kind)[key].name)}">${ICON(kind,key)}</i>`).join('');
  const row=(q,n)=>{const me=n===mine,move=!me&&(!q||q.bot)&&(lead||linked)?`<button type="button" class="chip-button" data-seat="${n}">${q?'TAKE SEAT':'MOVE HERE'}</button>`:'',ai=lead&&(!q||q.bot)?`<button type="button" class="chip-button" data-ai="${n}">${q?'REMOVE AI':'ADD AI'}</button>`:'';
   const ready=q&&(q.host||(me?lead||l.ready:q.ready)),state=!q||q.bot?'':`<span class="seat-state ${q.host?'host':ready?'ready':'wait'}">${me?'YOU · ':''}${q.host?'HOST':ready?'READY':'NOT READY'}</span>`;
   return `<div class="seat${q?q.bot?' ai':' player':' open'}${me?' me':''}"><i class="seat-head">${BPIcons.face(q?q.bot?'ai':'player':'open',teamOf(n))}</i><span class="seat-who"><b>${q?esc(q.name):'OPEN SLOT'}</b><small>${!q?'NOBODY HERE':q.bot?'AI OPERATOR':'RANK '+q.rank+' · '+esc(q.title||'')}</small></span><span class="seat-side">${state}${move}${ai}</span>${q?`<span class="seat-kit">${kit(q.loadout)}</span>`:''}</div>`;};
  const team=(t,name)=>{const four=[0,1,2,3].map(i=>view[t*4+i]||null),pl=four.filter(q=>q&&!q.bot).length,ai=four.filter(q=>q&&q.bot).length;
   return `<div class="team ${t?'delta':'alpha'}"><h4>TEAM ${name} <small>${pl} PLAYER${pl===1?'':'S'} · ${ai} AI</small></h4>${four.map((q,i)=>row(q,t*4+i)).join('')}</div>`;};
  setHtml($('teams'),tools+team(0,'ALPHA')+team(1,'DELTA'));}
 // The rules of the match, under the teams: the kills needed to win and whether field support can be called.
 // Mutators a match can carry (Veterans is about hostile soldiers, so it has no place against people).
 const VS_MUTATORS=['night','sidearms','scarcity'];
 const vsMutators=()=>(Array.isArray(settings.vsMutators)?settings.vsMutators:[]).filter(k=>VS_MUTATORS.includes(k));
 // What each versus mode asks, in a line, for the rules panel.
 const VS_RULE={arms:'TWELVE GUNS, A STEP UP FOR EVERY KILL · THE FIRST KNIFE KILL ON THE LAST STEP WINS · A KNIFE KILL SETS THE VICTIM BACK A STEP',
  uplink:'THREE RELAYS · STAND IN ONE UNCONTESTED TO TAKE IT · A POINT A SECOND FOR EACH HELD · FIRST TO 150',
  hunted:"DELTA'S FIRST SEAT IS THE HUNTER: CLOAKED, BLINKS INSTEAD OF ROLLING · NOBODY REDEPLOYS · THE SQUAD WINS BY KILLING IT OR LASTING FOUR MINUTES",
  breach:'ONE LIFE A ROUND · 20 S SETUP FOR THE DEFENDERS · PLANT THE CHARGE (HOLD INTERACT AT THE SITE) OR WIPE THE OTHER SIDE · FIRST TO FOUR, SIDES SWAP AFTER THREE'};
 function renderRules(l){const lead=l.role!=='guest',rec=save.tdm[settings.difficulty],off=lead?'':' disabled',muts=lead?vsMutators():l.mutators||[],plain=l.mode==='tdm',noSupport=['arms','hunted'].includes(l.mode);
  setHtml($('lobby-records'),`<h4>MATCH RULES <small>${lead?'YOURS TO SET':'SET BY THE HOST'}${rec&&plain?' · YOUR RECORD AT THIS AI SKILL: '+rec.wins+' WON OF '+rec.played:''}</small></h4><div class="rules">`
   +(plain?`<span class="rule"><em>KILLS TO WIN</em>${BPCore.TDM.limits.map(n=>`<button type="button" class="chip-button${n===l.limit?' on':''}" data-limit="${n}"${off}>${n}</button>`).join('')}</span>`:`<p class="rule-text">${VS_RULE[l.mode]}</p>`)
   +(noSupport?'':`<span class="rule"><em>FIELD SUPPORT</em><button type="button" class="chip-button${l.support?' on':''}" data-support="1"${off}>${l.support?'ON':'OFF'}</button></span>`)
   +`<span class="rule"><em>MUTATORS</em>${VS_MUTATORS.map(k=>`<button type="button" class="chip-button${muts.includes(k)?' on':''}" data-vsmut="${k}"${off} title="${esc(BPWorld.mutators[k].desc)}">${esc(BPWorld.mutators[k].short||BPWorld.mutators[k].name)}</button>`).join('')}</span></div>`);}
 // What a click in the teams panel or the rules does. A guest asks the host for a seat; everything else is the leader's.
 function teamClick(e){const l=lobby,seat=e.target.closest('[data-seat]'),ai=e.target.closest('[data-ai]'),lim=e.target.closest('[data-limit]'),sup=e.target.closest('[data-support]'),vm=e.target.closest('[data-vsmut]'),link=e.target.closest('[data-link]');if(!l||!isVs(l.mode))return;
  if(link&&l.role==='solo'){scene.audio.ui('select');openLobby(link.dataset.role,l.map,link.dataset.link,l.mode);return;}
  if(seat){const n=Number(seat.dataset.seat);if(l.role==='guest'){if(lobbyLinked())LINK.guestSend({type:'seat',seat:n});}else if(seatMove(l,'host',n))lobbyChanged();scene.audio.ui('select');return;}
  if(l.role==='guest')return;
  if(vm){const k=vm.dataset.vsmut,cur=vsMutators();settings.vsMutators=cur.includes(k)?cur.filter(x=>x!==k):[...cur,k];persist();scene.audio.ui('tick');lobbyChanged();return;}
  if(ai){const n=Number(ai.dataset.ai);if(l.mode==='hunted'&&n>4){scene.audio.ui('deny');return;}if(l.seats[n]===null)l.seats[n]='bot';else if(l.seats[n]==='bot')l.seats[n]=null;scene.audio.ui('tick');lobbyChanged();}
  else if(lim){l.limit=settings.tdmLimit=Number(lim.dataset.limit);scene.audio.ui('tick');lobbyChanged();}
  else if(sup){l.support=settings.tdmSupport=!l.support;scene.audio.ui('tick');lobbyChanged();}}
 // Each guest is sent the lobby as it stands: in team deathmatch all eight seats and which is theirs, in holdout the squad.
 function lobbySync(){const l=lobby;if(!lobbyLinked())return;if(l.role!=='host'){LINK.guestSend({type:'profile',...myProfile()});return;}
  if(isVs(l.mode)){const seats=seatsView(l).map(q=>q&&{name:q.name,rank:q.rank,loadout:q.loadout,ready:q.ready,bot:!!q.bot,host:!!q.host});
   for(const p of l.peers)LINK.hostSend({type:'lobby',host:myProfile(),mode:l.mode,map:l.map,difficulty:settings.difficulty,seats,you:l.seats.findIndex(q=>q&&q.peer===p.id),limit:l.limit,support:l.support,mutators:vsMutators()},p.id);return;}
  const squad=lobbySquad(l).filter(Boolean).map(q=>({name:q.name,rank:q.rank,loadout:q.loadout,ready:q.ready,bot:!!q.bot}));
  l.peers.forEach((p,i)=>LINK.hostSend({type:'lobby',host:myProfile(),mode:l.mode,map:l.map,difficulty:settings.difficulty,squad,seat:i},p.id));}
 function feed(text,who=''){if(!lobby)return;lobby.feed.push({who,text:String(text).slice(0,120)});if(lobby.feed.length>40)lobby.feed.shift();renderFeed();}
 function renderFeed(){const box=$('lobby-feed');box.replaceChildren();for(const f of lobby?.feed||[]){const row=document.createElement('p');if(f.who){const b=document.createElement('b');b.textContent=f.who;row.append(b);}else row.className='sys';row.append(f.text);box.append(row);}box.scrollTop=box.scrollHeight;}
 const ONLINE_ERRORS={'no-such-room':'NO LOBBY WITH THAT CODE / CHECK IT WITH THE HOST','room-full':'THAT LOBBY ALREADY HAS TWO PLAYERS',version:'THIS COPY OF THE GAME IS OUT OF DATE / UPDATE TO PLAY ONLINE',busy:'THE ONLINE SERVICE IS FULL / TRY AGAIN SHORTLY','too-many-attempts':'TOO MANY ATTEMPTS / WAIT A MINUTE AND TRY AGAIN'};
 const onlineError=err=>ONLINE_ERRORS[err?.message]||'COULD NOT REACH THE ONLINE SERVICE / CHECK YOUR CONNECTION';
 // The lobby opens the way it was last left: same mode, same map, same choice about the AI teammate. An online lobby
 // is two-player holdout for now; team deathmatch is played alone or over a LAN.
 function openLobby(role,map,link='lan',kind){const via=role==='solo'?null:link==='online'?ONLINE:NET;if(!scene||role!=='solo'&&!via)return;netLeave();LINK=via;
  const kept=holdoutMap(settings.lobbyMap),l=lobby={role,link:via?link:null,mode:via&&link==='online'?'holdout':MODES[kind]?kind:settings.lobbyMode,fill:settings.fill,peers:[],squad:[],seat:0,kicked:'',code:'',ping:null,phase:role==='host'?'open':role==='guest'?'joining':'solo',map:map||(holdoutOpen(kept)?kept.id:HOLD[0].id),difficulty:settings.difficulty,peer:null,ready:false,feed:[],countdown:0,timer:null,addresses:[],status:'',host:'',inRun:false,runId:0};seatsInit(l);
  $('lobby-callsign').value=callsign();$('lobby-ip').value=link==='online'?'':settings.lastHost||'';$('lobby-chat').value='';
  if(role==='host'&&link==='online'){feed('OPENING AN ONLINE LOBBY');setTimeout(()=>{if(lobby===l&&!l.code&&!l.status){l.waking=true;feed('STILL CONNECTING / AN IDLE ONLINE SERVICE CAN TAKE UP TO A MINUTE TO WAKE');renderLobby();}},7000);ONLINE.hostStart().then(code=>{if(lobby!==l)return;l.code=code;feed('LOBBY OPEN / SHARE YOUR ROOM CODE WITH YOUR SQUADMATE');renderLobby();},err=>{if(lobby!==l)return;l.status=onlineError(err);feed(l.status);renderLobby();});}
  else if(role==='host'){feed('LOBBY OPEN / SHARE YOUR ADDRESS WITH YOUR SQUAD');NET.listLocalAddresses().then(a=>{if(lobby===l){l.addresses=a;renderLobby();}});
   NET.hostStart(undefined,7).then(port=>{NET.hostLimit(MODES[l.mode].seats-1);return port;}).then(port=>{netPort=port;if(lobby===l)renderLobby();},()=>{if(lobby===l){l.status='COULD NOT OPEN PORT '+netPort+' / IS ANOTHER COPY OF THE GAME ALREADY HOSTING?';renderLobby();}});}
  else if(role==='guest')feed(link==='online'?"ENTER THE HOST'S ROOM CODE TO JOIN THEIR SQUAD":"ENTER THE HOST'S ADDRESS TO JOIN THEIR SQUAD");
  showLobby();(role==='guest'?$('lobby-ip'):role==='host'?$('lobby-map'):$('lobby-go')).focus({preventScroll:true});}
 // Also the way back from a finished run or the armory: a session that was mid-run drops back to "not ready" here.
 function showLobby(){if(!lobby)return;if(lobby.inRun){lobby.inRun=false;lobby.ready=false;netRole='solo';}
  scene.audio?.stopAmbient();scene.audio?.vitals(100,false);for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  setMode('lobby');$('lobby').scrollTop=0;renderLobby();renderFeed();lobbySync();}
 // Backing out of a hosted or joined lobby ends that session and drops you into your own holdout lobby (the AI
 // teammate is a click away); backing out of your own lobby goes to the main menu.
 function lobbyBack(){if(lobby&&lobby.role!=='solo')openLobby('solo');else menu();}
 // Leaving for the main menu ends the whole session: the host stops listening, the guest hangs up.
 function netLeave(){const l=lobby;netRole='solo';netConnected=false;netInputs=[];netSeats=new Map();netSeat=0;if(scene)scene.selfId='player';if(!l)return;lobby=null;clearInterval(l.timer);$('retry').hidden=false;if(l.role==='host')LINK?.hostStop();else if(l.role==='guest')LINK?.guestDisconnect();LINK=null;}
 // A squadmate's kit is guns only (see stepMate in core.js), so their card and loadout never advertise gadgets.
 function operatorKit(lo,gadgets){const tiles=[['weapon',lo.primary,W[lo.primary].short],['weapon',lo.secondary,W[lo.secondary].short]];
  if(gadgets)tiles.push(['gear',lo.lethal,lo.lethal?GEAR_SHORT[lo.lethal]:'NO LETHAL'],['gear',lo.tactical,lo.tactical?GEAR_SHORT[lo.tactical]:'NO TACTICAL']);
  return tiles.map(([kind,key,name])=>`<span class="kit${key?'':' none'}" data-rar="${RAR(kind,key)}"><i>${key?ICON(kind,key):''}</i><b>${esc(name)}</b></span>`).join('')+(gadgets?'':'<span class="kit note"><b>GUNS ONLY</b><small>CO-OP KIT</small></span>');}
 function setHtml(el,html){if(el.dataset.html!==html){el.dataset.html=html;el.innerHTML=html;return true;}return false;}
 // One squad card other than your own: a player, an AI teammate, or (q is null) an open slot. o.invite puts the
 // buttons that open this lobby to a friend where the kit would be.
 function seatCard(el,n,q,o={}){const tag='SQUAD 0'+(n+1),top=(t,state)=>`<div class="op-top"><span class="op-tag">${t}</span><span class="op-state">${state}</span></div>`,kit=html=>`<div class="op-kit${o.invite?' op-invite':''}">${html}</div>`;
  el.hidden=false;el.className='operator'+(!q?' empty':q.bot?' ai ready':q.ready||o.leader?' ready':'');
  setHtml(el,!q?`${top(o.tag||tag,o.state)}<div class="op-figure">${BPIcons.soldier('rifle',o.tag?0:1)}</div><div class="op-plate"><label>${o.label}</label><b class="op-name">${o.name}</b><small>${o.note}</small></div>${kit(o.invite||'')}`
   :`${top(o.leader?'HOST':tag,q.bot?'AI TEAMMATE':o.leader?'LOBBY LEADER':q.ready?'READY':'NOT READY')}<div class="op-figure">${BPIcons.soldier(q.loadout.primary,o.leader?0:1)}</div><div class="op-plate"><label>${q.bot?'AI':'SQUADMATE'}</label><b class="op-name">${esc(q.name)}</b><small>${q.bot?o.note:'RANK '+q.rank+' · '+esc(q.title)}</small></div>${kit(o.invite||operatorKit(q.loadout,!!o.leader))}`);}
 function renderLobby(){const l=lobby;if(!l)return;const host=l.role==='host',solo=l.role==='solo',online=l.link==='online',lead=host||solo,linked=lobbyLinked(),mine=myProfile(),r=rank(),p=l.peer,tdm=isVs(l.mode),M=MODES[l.mode],counting=l.countdown>0,left=Math.max(1,Math.ceil((l.countdown-performance.now())/1000));
  if(mode==='lobby')$('status').textContent=solo?M.label+' LOBBY':host?'SQUAD LOBBY / HOSTING':'SQUAD LOBBY';
  $('lobby-eyebrow').innerHTML=`${M.label} <span>—</span> ${solo?M.sub:online?'ONLINE CO-OP':tdm?'LAN SQUAD':'LAN CO-OP'}`;$('lobby-title').textContent=solo?(tdm?'DEATHMATCH LOBBY.':'HOLDOUT LOBBY.'):host?'YOUR SQUAD LOBBY.':p?p.name+"'S LOBBY.":'JOIN A SQUAD.';
  // What the other players need to find this lobby: a room code online, an address on a LAN. Once linked it also shows the delay between the two.
  const share=online?l.code:l.addresses[0]||'',lag=linked&&l.quiet?' · NO SIGNAL':linked&&l.ping!=null?' · PING '+l.ping+' MS':'';
  $('lobby-link').hidden=solo;$('lobby-link-label').textContent=(online?'ROOM CODE':host?'YOUR ADDRESS · PORT '+netPort:'HOST ADDRESS')+lag;
  $('lobby-link-value').textContent=host?(online?l.code||(l.status?'UNAVAILABLE':l.waking?'WAKING UP…':'OPENING…'):l.addresses.join('  ·  ')||'NO LAN ADDRESS FOUND'):linked?l.host:'NOT CONNECTED';$('lobby-copy').hidden=!host||!share;
  // Your own card keeps its callsign field alive across updates, so it is patched in place rather than rebuilt.
  $('op-self').className='operator self'+(lead||l.ready?' ready':'');$('op-self-tag').textContent=solo?'OPERATOR':host?'HOST':'SQUAD 0'+(l.seat+2);$('op-self-state').textContent=solo?'READY':host?'LOBBY LEADER':!linked?'NOT CONNECTED':l.ready?'READY':'NOT READY';
  setHtml($('op-self-figure'),BPIcons.soldier(mine.loadout.primary,lead?0:1));if(document.activeElement!==$('lobby-callsign'))$('lobby-callsign').value=mine.name;$('op-self-rank').textContent='RANK '+r.rank+' · '+r.title;setHtml($('op-self-kit'),operatorKit(mine.loadout,lead||tdm));
  // The other cards are the rest of the squad: one in holdout, three in team deathmatch. Played alone, the first of
  // them is also the way to open the lobby to a friend, and in holdout the way to put an AI teammate in the open slot.
  const invite=!solo?'':[[ONLINE&&!tdm,'online','ONLINE'],[NET,'lan','LAN']].filter(q=>q[0]).map(([,link,label])=>`<span class="invite-row"><em>${label}</em><button type="button" class="secondary" data-link="${link}" data-role="host">HOST</button><button type="button" class="secondary" data-link="${link}" data-role="guest">JOIN</button></span>`).join('')
    +(tdm?'':`<span class="invite-row fill"><em>AI</em><button type="button" class="secondary" data-fill="1">${l.fill?'REMOVE AI TEAMMATE':'ADD AI TEAMMATE'}</button></span>`);
  const seats=tdm?[]:lead?lobbySquad(l).map((q,i)=>({q,n:i+1,o:i||!invite?{}:{invite}})):!linked?[{q:null,n:1,o:{}}]:[{q:p,n:0,o:{leader:true}},...l.squad.map((q,i)=>({q,n:i+1,o:{}})).filter((x,i)=>i!==l.seat)];
  // Team deathmatch shows your own card beside the two teams' seats instead of squad cards.
  $('op-self').parentElement.classList.toggle('four',seats.length>1);$('op-self').parentElement.classList.toggle('versus',tdm);$('teams').hidden=!tdm;if(tdm)renderTeams(l);
  [$('op-peer'),$('op-m2'),$('op-m3')].forEach((el,i)=>{const c=seats[i];if(!c){el.hidden=true;return;}const o={...c.o};
   if(!c.q)Object.assign(o,solo?{state:'OPEN SLOT',label:'CO-OP',name:'BRING A FRIEND',note:ONLINE&&NET?'PLAY TOGETHER ONLINE OR ON THE SAME NETWORK, OR ADD AN AI TEAMMATE':ONLINE?'PLAY TOGETHER ONLINE WITH A ROOM CODE, OR ADD AN AI TEAMMATE':NET?'A FRIEND ON THE SAME NETWORK, OR AN AI TEAMMATE':'ADD AN AI TEAMMATE · CO-OP NEEDS THE DESKTOP APP'}
    :host?{state:'OPEN SLOT',label:'SQUADMATE',name:'WAITING<i>…</i>',note:online?'SHARE YOUR ROOM CODE TO FILL THIS SLOT':'SHARE YOUR ADDRESS TO FILL THIS SLOT'}
    :{tag:'HOST',state:linked?'SYNCING':'NOT CONNECTED',label:'HOST',name:'NO HOST YET',note:'CONNECT TO SEE THEIR LOBBY'});
   else if(c.q.bot)o.note=host?'A LAN PLAYER CAN TAKE THIS SLOT':tdm?'FILLS AN EMPTY SLOT':'FIGHTS BESIDE YOU AND CAN REVIVE YOU';
   seatCard(el,c.n,c.q,o);});
  $('lobby-comms').hidden=solo;$('lobby-records').hidden=!solo&&!tdm;$('lobby-records').classList.toggle('lobby-rules',tdm);
  // Each killhouse keeps its own records. The default one also shows records set before killhouses were tracked apart.
  if(tdm)renderRules(l);
  else if(l.mode==='extract'){const here=holdoutMap(l.map),x=save.extract?.[l.map];setHtml($('lobby-records'),`<h4>EXTRACTION / ${esc(here.title)} <small>${here.pay>1?'PAYS ×'+here.pay+' CREDITS · ':''}DIE AND THE LOOT IS LOST</small></h4><div class="rec-tiles"><span class="rec-tile"><small>RUNS</small><b>${x?.runs||0}</b></span><span class="rec-tile"><small>EXTRACTED</small><b>${x?.out||0}</b></span><span class="rec-tile on"><small>BEST HAUL</small><b>${x?.best?fmt(x.best)+' CR':'—'}</b></span></div>`);}
  else if(l.mode==='trials'){const here=holdoutMap(l.map),key=c=>l.map+':'+trialSeed(l.map,c),rec=c=>save.trials?.[key(c)],cell=(c,label)=>{const q=rec(c);return `<button type="button" class="rec-tile course${!!settings.trialDaily===c?' on':''}" data-course="${c?1:0}"><small>${label}</small><b>${q?q.best.toFixed(2)+' S':'NOT RUN'}</b>${q?`<small>${q.hit}/${q.targets} TARGETS · ${q.flows} FLOWS${save.ghosts?.[key(c)]?' · GHOST SAVED':''}</small>`:''}</button>`;};
   setHtml($('lobby-records'),`<h4>FLOW TRIALS / ${esc(here.title)} <small>TIME + 3 S A MISSED TARGET − 0.5 S A PERFECT FLOW · RACE YOUR BEST RUN'S GHOST</small></h4><div class="rec-tiles">${cell(false,'THIS MAP\'S COURSE')}${cell(true,"TODAY'S COURSE")}</div>`);}
  else if(solo){const here=holdoutMap(l.map),rec=save.killhouse[l.map]||{},best=d=>rec[d]||(l.map==='holdout'?save.holdout[d]:0);
   setHtml($('lobby-records'),`<h4>YOUR BEST RUNS / ${esc(here.title)} <small>${here.pay>1?'PAYS ×'+here.pay+' CREDITS · ':''}ONE RECORD PER ENEMY PRESSURE</small></h4><div class="rec-tiles">${DIFFS.map(d=>`<span class="rec-tile${d===settings.difficulty?' on':''}"><small>${DL[d].label}</small><b>${best(d)?'WAVE '+best(d):'—'}</b></span>`).join('')}</div>`);}
  $('lobby-join').hidden=lead||linked;$('lobby-brief').hidden=!lead&&!linked;$('lobby-join-status').textContent=lead?'':l.status;$('lobby-join-copy').textContent=online?'Ask the host for the five-character room code shown at the top of their lobby.':'Ask the host for the address shown at the top of their lobby.';$('lobby-ip').placeholder=online?'ROOM CODE':'192.168.1.23';$('lobby-ip').maxLength=online?5:64;$('lobby-connect').disabled=l.phase==='connecting';$('lobby-connect').textContent=l.phase==='connecting'?'CONNECTING…':'CONNECT';
  // The mode switch, under the loadout: one tile per mode over a still of that mode in play (blackout/qa/mode-shots.cjs
  // captures them). Like the pressure buttons, it is rebuilt only when it changes, so a squadmate's update never steals keyboard or controller focus.
  $('lobby-modes').hidden=!lead&&!linked;
  const mp=$('lobby-mode'),msig=l.mode+'|'+lead+'|'+online;if(mp.dataset.sig!==msig){mp.dataset.sig=msig;mp.replaceChildren();
   // The switch shows the mode in force and a way to all of them: the modes themselves are chosen in a picker.
   const cur=document.createElement('button');cur.type='button';cur.className='mode-tile active';cur.dataset.mode=l.mode;cur.disabled=!lead;cur.innerHTML=`<i style="background-image:url('blackout/assets/menu/mode-${MODES[l.mode].art||l.mode}.jpg')"></i><b>${MODES[l.mode].label}</b><small>${MODES[l.mode].sub}</small>`;
   const all=document.createElement('button');all.type='button';all.className='mode-tile all-modes';all.dataset.modes='1';all.disabled=!lead;all.innerHTML=`<b>ALL MODES ↗</b><small>${Object.keys(MODES).length} MODES · CO-OP AND VERSUS</small>`;
   for(const b of [cur,all]){b.addEventListener('click',()=>{scene.audio.ui('select');openModePicker();});mp.append(b);}}
  $('lobby-mode-note').textContent=!lead?'SET BY THE HOST':online?'DEATHMATCH IS SOLO OR LAN FOR NOW':M.note;$('lobby-map-label').textContent=tdm?'MAP':'KILLHOUSE';
  const hm=holdoutMap(l.map),diff=lead?settings.difficulty:l.difficulty;$('lobby-map-title').textContent=hm.title;$('lobby-map-sector').textContent=hm.sector;$('lobby-map-art').style.backgroundImage='url("blackout/assets/menu/killhouse-'+l.map+'.jpg")';$('lobby-map').disabled=!lead;$('lobby-map-note').textContent=$('lobby-diff-note').textContent=lead?'':'SET BY THE HOST';
  // Team deathmatch: say whether the map suits the number of operators - a small map with eight is fast and chaotic.
  if(isVs(l.mode)&&lead){const n=(l.seats||[]).filter(Boolean).length;$('lobby-map-note').textContent=hm.size==='small'?(n>4?'SMALL MAP · FAST AND CLOSE WITH '+n+' · A LARGE MAP SUITS 4V4':'SMALL MAP · FAST AND CLOSE'):'LARGE MAP · ROOM TO MANOEUVRE';}
  const dp=$('lobby-difficulty'),dsig=diff+'|'+lead;if(dp.dataset.sig!==dsig){dp.dataset.sig=dsig;dp.replaceChildren();for(const d of DIFFS){const b=document.createElement('button');b.type='button';b.className=(diff===d?'active ':'')+d;b.disabled=!lead;b.innerHTML=`<i class="pressure-art">${BPIcons.pressure(d)}</i><span>${DL[d].label}</span><small>×${DL[d].reward} CR</small>`;
    b.addEventListener('click',()=>{if(settings.difficulty===d)return;settings.difficulty=lobby.difficulty=d;persist();feed('ENEMY PRESSURE SET TO '+DL[d].label.toUpperCase());lobbyChanged();dp.querySelector('.active')?.focus({preventScroll:true});});dp.append(b);}}
  const box=$('lobby-loadout'),lsig=JSON.stringify([mine.loadout,lead||tdm,save.upgrades.bandolier||0,save.preset,Meta.perkSlots(save)]);if(box.dataset.sig!==lsig){box.dataset.sig=lsig;loadoutSlots(box,lead||tdm?{}:{lethal:'HOST ONLY IN CO-OP',tactical:'HOST ONLY IN CO-OP',extras:'FIELD SUPPORT AND PERKS ARE THE HOST\'S ONLY IN CO-OP'});}
  // In team deathmatch every player brings a whole loadout, and "enemy pressure" is how good the AI operators are.
  $('lobby-loadout-note').textContent=lead||tdm?'2 GUNS · LETHAL · TACTICAL':'2 GUNS';$('lobby-diff-label').textContent=tdm?'AI SKILL':'ENEMY PRESSURE';
  const go=$('lobby-go'),label=go.querySelector('span'),waiting=l.peers.find(q=>!q.ready);go.hidden=!lead&&!linked;go.classList.toggle('counting',counting);
  if(solo){go.disabled=tdm&&!teamsOk(l);label.textContent=!tdm?'DEPLOY':teamsOk(l)?'START MATCH':'EACH TEAM NEEDS SOMEONE';}
  else if(host&&tdm){go.disabled=!!waiting||!teamsOk(l);label.textContent=counting?'STARTING IN '+left+' · CANCEL':!teamsOk(l)?'EACH TEAM NEEDS SOMEONE':waiting?'WAITING FOR '+waiting.name:'START MATCH';}
  else if(host){go.disabled=!p?.ready;label.textContent=counting?'DEPLOYING IN '+left+' · CANCEL':!p?'WAITING FOR A PLAYER':!p.ready?'WAITING FOR '+p.name:'DEPLOY SQUAD';}
  else{go.disabled=counting;label.textContent=counting?'DEPLOYING IN '+left:l.ready?'READY · STAND DOWN':'READY UP';}
  $('lobby-hint').textContent=solo?(tdm?'First team to '+l.limit+' kills wins. Add or remove AI in any seat; everyone redeploys after going down.':l.fill?'An AI teammate fights beside you. The run ends when you are both down.':'Waves never end. Dying ends the run and banks its credits.')
   :host&&tdm?(l.status||(counting?'Deploying the squad.':waiting?waiting.name+' can change guns until they ready up.':l.peers.length?'Everyone is ready. First team to '+l.limit+' kills wins.':'Up to seven friends pick COMBAT MODES, switch to TEAM DEATHMATCH, then JOIN A MATCH and enter your address.'))
   :host?(l.status||(!p?(online?'Your squadmate picks COMBAT MODES, then JOIN under ONLINE, and enters your room code.':'Your squadmate picks COMBAT MODES, then JOIN under LAN, and enters your address.'):counting?'Deploying both of you.':p.ready?'Everyone is ready.':p.name+' can change guns until they ready up.'))
   :!linked?'':counting?'The host is deploying the squad.':l.ready?'Waiting for the host to deploy.':'Pick your guns, then ready up.';
  $('lobby-leave').innerHTML='<span>‹</span> '+(solo?'MAIN MENU':'LEAVE LOBBY');}
 // Whoever leads the lobby has its mode, map and AI choice remembered for next time.
 function lobbyChanged(){const l=lobby;if(!l)return;if(l.role==='host')cancelCountdown();if(l.seats&&l.role!=='guest')lastSeats=[...l.seats];if(l.role!=='guest'){if(l.link!=='online')settings.lobbyMode=l.mode;settings.lobbyMap=l.map;settings.fill=l.fill;persist();}renderLobby();lobbySync();}
 function lobbySetMap(id){if(!lobby||lobby.role==='guest'||lobby.map===id)return;lobby.map=id;feed((isVs(lobby.mode)?'MAP':'KILLHOUSE')+' SET TO '+holdoutMap(id).title);lobbyChanged();mapVoice(id);}
 // Changing mode changes how many seats the lobby has. Going down to two-player holdout keeps the first player who
 // joined; anyone else is told why and dropped.
 function lobbySetMode(k){const l=lobby;if(!l||l.role==='guest'||!MODES[k]||l.mode===k||l.link==='online'&&isVs(k))return;l.mode=k;if(isVs(k))seatsInit(l);feed('MODE SET TO '+MODES[k].label);scene.audio.ui('select');voiceAny(k);
  if(l.role==='host'){const seats=MODES[k].seats-1;for(const p of l.peers.slice(seats)){LINK.hostSend({type:'full',reason:'mode'},p.id);LINK.hostKick?.(p.id);}LINK.hostLimit?.(seats);}
  lobbyChanged();$('lobby-mode').querySelector('.active')?.focus({preventScroll:true});}
 function lobbyFill(){const l=lobby;if(!l||l.role!=='solo'||!['holdout','extract'].includes(l.mode))return;l.fill=!l.fill;scene.audio.ui('select');lobbyChanged();$('op-peer').querySelector('[data-fill]')?.focus({preventScroll:true});}
 // A team deathmatch starts once both teams have someone in them and every player who has joined is ready; holdout waits for its one squadmate.
 const squadReady=l=>isVs(l.mode)?teamsOk(l)&&l.peers.every(p=>p.ready):!!l.peer?.ready;
 function lobbyGo(){const l=lobby;if(!l)return;
  if(l.role==='solo'){if(isVs(l.mode)&&!teamsOk(l)){scene.audio.ui('deny');return;}lobby=null;startArena(l.mode,l.map,l.fill,isVs(l.mode)?matchOf(l).vs:null);}
  else if(l.role==='host'){if(l.countdown){cancelCountdown();return;}if(!squadReady(l))return;if(!l.peers.length){beginHostedRun(l.map);return;}LINK.hostSend({type:'countdown',seconds:3});feed('DEPLOYING THE SQUAD');startCountdown(3);}
  else if(l.phase==='linked'&&!l.countdown){l.ready=!l.ready;scene.audio.ui('select');renderLobby();lobbySync();}}
 // Runs on both sides so each shows the same count; only the host's reaching zero starts the run (the guest waits for "start").
 function startCountdown(seconds){const l=lobby;clearInterval(l.timer);l.countdown=performance.now()+seconds*1000;let last=0;
  l.timer=setInterval(()=>{if(lobby!==l){clearInterval(l.timer);return;}if(mode!=='lobby'||l.role==='host'&&!(l.peers.length&&squadReady(l))){cancelCountdown();return;}
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
 // "who" is the player it came from when the host heard it directly; a guest is told by name whose line the host is passing on.
 function lobbyHeard(msg,who){const text=typeof msg.text==='string'?msg.text.trim().slice(0,120):'',name=who?.name||BPSave.callsign(msg.name)||lobby.peer?.name;if(text&&name){feed(text,name);if(mode==='lobby')scene.audio.ui('tick');}}
 // Each side times a round trip to the other every couple of seconds; the lobby and the in-game readout show it.
 function linkPing(msg){const l=lobby,send=m=>l.role==='host'?LINK.hostSend(m,msg.from):LINK.guestSend(m);if(msg.type==='ping'){send({type:'pong',at:msg.at});return true;}
  if(msg.type!=='pong')return false;const rtt=performance.now()-Number(msg.at);if(rtt>=0&&rtt<60000){l.rtt=l.rtt==null?rtt:l.rtt*.7+rtt*.3;const shown=Math.max(1,Math.round(l.rtt));if(shown!==l.ping){l.ping=shown;if(mode==='lobby')renderLobby();}}return true;}
 // The same timer notices when nothing at all has arrived for a while - a dropped connection can take the system most
 // of a minute to report - and says so in the lobby and in the run, rather than leaving a frozen squadmate unexplained.
 setInterval(()=>{const l=lobby;if(!l||!lobbyLinked()||!LINK){if(l)l.quiet=false;return;}(l.role==='host'?LINK.hostSend:LINK.guestSend).call(LINK,{type:'ping',at:performance.now()});
  const quiet=!!l.heardAt&&performance.now()-l.heardAt>6000;if(quiet===!!l.quiet)return;l.quiet=quiet;if(mode==='lobby')renderLobby();if(l.inRun&&mode==='playing')toast(quiet?'NO SIGNAL FROM YOUR SQUADMATE / WAITING FOR THE CONNECTION':'CONNECTION RESTORED',quiet?5:2);},2000);
 // Every message from a guest says which connection it came on ("from", set by the transport: see electron/net/host.js).
 // The online relay has only ever one guest and sends none, so that guest is simply number 0.
 function onHostMsg(msg){const l=lobby;if(!l||l.role!=='host'||!msg)return;l.heardAt=performance.now();const from=msg.from??0,peer=l.peers.find(q=>(q.id??0)===from);
  // Online only: the connection to the relay itself dropped, which takes the room and the squadmate with it.
  if(msg.type==='linkLost'){for(const q of [...l.peers])onHostMsg({type:'guestLeft',from:q.id});l.code='';l.status='CONNECTION TO THE ONLINE SERVICE WAS LOST / LEAVE AND HOST AGAIN';feed(l.status);renderLobby();return;}
  if(linkPing(msg))return;
  if(msg.type==='guestJoined'){if(peer)return;
   // The transport already turns callers away at the limit; this covers one who connected just as the mode changed.
   if(l.peers.length>=MODES[l.mode].seats-1){LINK.hostSend({type:'full'},msg.from);LINK.hostKick?.(msg.from);return;}
   const joined={id:msg.from,...cleanProfile(msg)};if(isVs(l.mode)&&!seatPeer(l,joined)){LINK.hostSend({type:'full'},msg.from);LINK.hostKick?.(msg.from);return;}l.peers.push(joined);l.peer=l.peers[0];netConnected=true;cancelCountdown();feed(joined.name+' JOINED THE SQUAD');scene.audio.ui('select');scene.audio.say('vo-squad',{rest:60});renderLobby();lobbySync();}
  else if(msg.type==='guestLeft'){if(!peer)return;l.peers=l.peers.filter(q=>q!==peer);l.peer=l.peers[0]||null;netConnected=l.peers.length>0;if(l.seats){const n=l.seats.findIndex(q=>q&&q.peer===peer.id);if(n>=0)l.seats[n]='bot';}cancelCountdown();feed(peer.name+' LEFT THE SQUAD');
   if(l.inRun&&['playing','paused'].includes(mode)){const sim=scene.sim,seat=netSeats.get(from),m=seat===undefined?null:sim.mates[seat];netSeats.delete(from);if(seat!==undefined)netInputs[seat]=null;
    // In team deathmatch an AI teammate takes over the seat. In holdout a squadmate who leaves takes the revive
    // mechanic with them: nobody is left to carry tags, so a host who was already down has lost the run, and one
    // still standing simply carries on alone.
    if(m&&sim.tdm){m.bot=true;toast(peer.name+' DISCONNECTED / AN AI TEAMMATE HAS TAKEN OVER',3);}
    else if(m){m.dead=true;m.vanished=true;sim.tags=[];if(sim.player.dead&&!sim.dead){sim.dead=true;sim.events.push({type:'death'});}else toast('PLAYER DISCONNECTED / CONTINUING SOLO');}}
   renderLobby();lobbySync();}
  else if(!peer)return;
  else if(msg.type==='profile'){const was=peer.ready;Object.assign(peer,cleanProfile(msg));if(was!==peer.ready){feed(peer.name+(peer.ready?' IS READY':' STOOD DOWN'));if(mode==='lobby')scene.audio.ui(peer.ready?'select':'tick');if(!peer.ready)cancelCountdown();}renderLobby();if(l.peers.length>1||isVs(l.mode))lobbySync();}
  // A guest asking for another seat in team deathmatch.
  else if(msg.type==='seat'){if(isVs(l.mode)&&!l.inRun&&seatMove(l,peer.id,msg.seat))lobbyChanged();}
  // A line of chat is shown here and passed on to everyone else in the squad under the sender's name.
  else if(msg.type==='chat'){lobbyHeard(msg,peer);const text=typeof msg.text==='string'?msg.text.trim().slice(0,120):'';if(text)for(const q of l.peers)if(q!==peer)LINK.hostSend({type:'chat',text,name:peer.name},q.id);}
  else if(msg.type==='input'&&msg.input&&typeof msg.input==='object'){const slot=netInputs[netSeats.get(from)];if(slot){slot.input=cleanInput(msg.input);if(Number.isInteger(msg.seq))slot.seq=msg.seq;slot.fresh=true;slot.at=performance.now();}}}
 // The squad for this run is fixed here: players in the order they joined, then AI teammates. Each player is told
 // which seat is theirs along with everything needed to build the same battlefield.
 function beginHostedRun(mapId){const l=lobby;if(!l||l.role!=='host')return;clearInterval(l.timer);l.timer=null;l.countdown=0;l.inRun=true;netRole='host';netBroadcastAt=0;wallsSent=new Map();
  // Team deathmatch: every filled seat, the host first. Each player is told which operator on the roster is theirs.
  if(isVs(l.mode)){const {roster,vs}=matchOf(l),at=performance.now(),seed=1701+Math.floor(Math.random()*1e6);
   netSeats=new Map();netInputs=roster.slice(1).map((r,i)=>{if(r.bot)return null;netSeats.set(r.id??0,i);return {input:{},seq:0,fresh:false,at};});
   const muts=vsMutators();run={mode:'tdm',rules:l.mode,mission:mapId,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0,vs};launch({mode:'tdm',rules:l.mode,mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed,mutators:muts,...vs});
   for(const [,seat] of netSeats)LINK.hostSend({type:'start',mode:'tdm',rules:l.mode,mutators:muts,mission:mapId,difficulty:run.difficulty,seed,squad:vs.squad,names:vs.names,seat,limit:vs.limit,support:vs.support},roster[seat+1].id);return;}
  const crew=lobbySquad(l).filter(Boolean),mates=crew.map(c=>({loadout:c.loadout,bot:!!c.bot})),names=crewNames(crew),now=performance.now();
  netSeats=new Map();netInputs=crew.map((c,i)=>{if(c.bot)return null;netSeats.set(c.id??0,i);return {input:{},seq:0,fresh:false,at:now};});
  run={mode:l.mode,mission:mapId,difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};const seed=1701+Math.floor(Math.random()*1e6);
  launch({mode:l.mode,mission:mapId,difficulty:run.difficulty,loadout:Meta.loadout(save),seed,mates:mates.length?mates:undefined,names:mates.length?names:null});
  for(const [id,seat] of netSeats)LINK.hostSend({type:'start',mode:l.mode,mission:mapId,difficulty:run.difficulty,seed,mates,names,seat},crew[seat].id);}
 // ---------- squad netcode ----------
 // The host simulates; each guest sends input and draws what the host reports. Three things keep that playable beyond a LAN:
 //  - updates are small: numbers are rounded, a wall is only mentioned when it changes, and fields only the simulation
 //    needs are left out (about a fifth of the original size, before the relay compresses it);
 //  - between updates the guest keeps everything moving along its last reported velocity, so motion is smooth at any rate;
 //  - the guest moves its own operator at once from its own input, using the movement rule the host applies, and is then
 //    eased toward the host's answer. Inputs are numbered and each update says which one it includes, so the comparison
 //    is against where the guest was when it sent that input, not where it has got to since.
 const NET_ROUND=(k,v)=>typeof v==='number'&&v%1?Math.round(v*100)/100:v,SIM_ONLY=['lastX','lastY','side','clip','cooldown','burstT','burstAim','seen','woke','hunt','zone','spawned','cv','cvAt','fp','fa','fpAt','flankAt','flank','stuck','unstick','ua','sideAt','buildAt'],
  SNAP_KEYS=['player','mates','enemies','allies','recon','projectiles','grenades','zones','mines','hazards','spawnWarnings','pickups','decoy','director','goal','progress','stage','stats','dark','dead','completed','time','boss','tags','station','spotted','jammed','order','orderAt'];
 let wallsSent=new Map(),netSeq=0,netSendIn=0,netTaps={},netHist=[],pred={ready:false};
 // An operator as a guest needs it: the guns in hand only, and (team deathmatch) the parts of their own context the HUD and debrief read.
 const leanCtx=c=>c&&{perks:c.perks,support:c.support,stats:c.stats,mastery:c.mastery,combo:c.combo,flowTime:c.flowTime,recon:c.recon,decoy:c.decoy};
 const leanOp=op=>op&&{...op,ctx:leanCtx(op.ctx),ammo:Object.fromEntries(op.slots.map(k=>[k,op.ammo[k]])),reserve:Object.fromEntries(op.slots.map(k=>[k,op.reserve[k]]))};
 function buildSnapshot(s){const walls=[];
  // Both sides build the same map, so a wall is only sent once it differs from how it started, and then only when it changes again.
  for(const w of s.walls){const sig=(w.dead?'x':'')+(Number.isFinite(w.hp)?Math.round(w.hp):''),known=wallsSent.get(w.id);if(known===sig)continue;wallsSent.set(w.id,sig);
   if(known===undefined&&!w.deployed&&!w.dead&&!(w.hp<w.maxHp))continue;walls.push(known===undefined&&w.deployed?w:Number.isFinite(w.hp)?{id:w.id,dead:w.dead,hp:w.hp}:{id:w.id,dead:w.dead});}
  // One update goes to every guest, so it carries each seat's own "which of your inputs this includes" (acks).
  return {player:leanOp(s.player),mates:s.mates.map(leanOp),tdm:s.tdm&&{score:s.tdm.score,board:s.tdm.board,left:s.tdm.left,result:s.tdm.result,winner:s.tdm.winner,relays:s.tdm.relays,site:s.tdm.site,phase:s.tdm.phase,phaseLeft:s.tdm.phaseLeft,planted:s.tdm.planted,plant:s.tdm.plant,fuse:s.tdm.fuse,defuse:s.tdm.defuse,round:s.tdm.round,attack:s.tdm.attack,hunter:s.tdm.hunter,limit:s.tdm.limit},acks:Object.fromEntries(netInputs.flatMap((q,i)=>q?[[MATE_IDS[i],q.seq]]:[])),enemies:s.enemies.map(e=>{const o={...e};for(const k of SIM_ONLY)delete o[k];return o;}),walls,
   projectiles:s.projectiles.filter(b=>b.active).map(b=>({active:true,x:b.x,y:b.y,vx:b.vx,vy:b.vy,enemy:b.enemy,owner:b.owner,weapon:b.weapon,explosive:b.explosive})),
   allies:s.allies,recon:s.recon,grenades:s.grenades,zones:s.zones,mines:s.mines,hazards:s.hazards,spawnWarnings:s.spawnWarnings,pickups:s.pickups,decoy:s.decoy,director:s.director,goal:s.goal,progress:s.progress,stage:s.stage,stats:s.stats,dark:s.dark,dead:s.dead,completed:s.completed,time:s.time,boss:s.boss,tags:s.tags,station:s.station,spotted:s.spotted,jammed:s.jammed,order:s.order,orderAt:s.orderAt};}
 // Guest input arrives from another machine, so it is rebuilt field by field before the simulation ever sees it.
 // Single presses a guest sends: each counts once on the host, however many frames pass before the next input arrives.
 const TAPS=['swap','melee','reload','roll','slide','interact','gadget','grenade','tactical','support'],untap=q=>({...q,...Object.fromEntries(TAPS.map(k=>[k,false])),slot:undefined});
 function cleanInput(i){const n=v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0,on=k=>i[k]===true;
  return {roll:on('roll'),slide:on('slide'),interact:on('interact'),gadget:on('gadget'),grenade:on('grenade'),tactical:on('tactical'),support:on('support'),mx:n(i.mx),my:n(i.my),aimX:Number.isFinite(i.aimX)?i.aimX:undefined,aimY:Number.isFinite(i.aimY)?i.aimY:undefined,sprint:on('sprint'),fire:on('fire'),aiming:on('aiming'),melee:on('melee'),meleeDown:on('meleeDown'),reload:on('reload'),swap:on('swap'),interactDown:on('interactDown'),slot:i.slot===0||i.slot===1?i.slot:undefined};}
 // One guest frame: gather input (single presses are held until the next send so none are lost), send it thirty times
 // a second, then move everything on screen forward by one frame.
 function guestFrame(s,dt){const own=s.mates[netSeat],fi=input();for(const k of TAPS)if(fi[k])netTaps[k]=true;if(fi.slot!==undefined)netTaps.slot=fi.slot;
  netSendIn-=dt;if(netSendIn<=0){netSendIn=1/30;netSeq++;LINK?.guestSend({type:'input',seq:netSeq,input:{mx:fi.mx,my:fi.my,aimX:fi.aimX,aimY:fi.aimY,sprint:fi.sprint,fire:fi.fire,aiming:fi.aiming,meleeDown:fi.meleeDown,interactDown:fi.interactDown,...netTaps}});netTaps={};
   if(pred.ready){netHist.push({seq:netSeq,x:pred.x,y:pred.y});if(netHist.length>150)netHist.shift();}}
  s.time+=dt;for(const e of s.enemies){if(e.dead){e.deathAge=(e.deathAge||0)+dt;continue;}e.x+=e.vx*dt;e.y+=e.vy*dt;e.shotAge=(e.shotAge||0)+dt;if(e.attack>0)e.attackAge=Math.min(e.attack,e.attackAge+dt);}
  for(const b of s.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;}
  for(const mate of BPCore.ops(s)){if(mate===own||mate.dead)continue;mate.x+=mate.vx*dt;mate.y+=mate.vy*dt;mate.shotAge+=dt;if(['roll','dive','slide','vault','melee'].includes(mate.state))mate.age+=dt;}
  if(!own||own.dead){pred.ready=false;return;}
  // A roll, dive, slide or vault is the host's to move: follow what it reports until it is over.
  if(['roll','dive','slide','vault'].includes(own.state)){const body={x:own.x,y:own.y,radius:own.radius||16,state:own.state};BPCore.move(s,body,(own.vx||0)*dt,(own.vy||0)*dt);own.x=body.x;own.y=body.y;own.age+=dt;
   pred={ready:true,x:own.x,y:own.y,vx:own.vx||0,vy:own.vy||0,carry:0,angle:own.angle};netHist=[];if(Number.isFinite(fi.aimX))own.angle=Math.atan2(fi.aimY-own.y,fi.aimX-own.x);return;}
  // Own operator: the host's movement rule (see stepMate in core.js), run here on local input in the same fixed steps.
  if(!pred.ready)pred={ready:true,x:own.x,y:own.y,vx:own.vx||0,vy:own.vy||0,carry:0,angle:own.angle};
  const w=W[own.slots[own.slot]]||W.rifle,len=Math.hypot(fi.mx,fi.my),nx=len?fi.mx/len:0,ny=len?fi.my/len:0,push=fi.sprint&&len>0&&!own.winded&&!fi.fire&&!fi.aiming&&!(s.tdm&&own.heal>0),sprint=push&&own.stamina>0&&!own.reload,jog=!!s.tdm&&push&&own.reload>0,
   // The same speed rule the host applies: stepMate's in holdout, stepPlayer's (jogging reloads, stims, stuns) in team deathmatch.
   speed=(sprint?360:fi.aiming?175:jog?300:250)*(s.tdm&&own.stagger>0?.5:1)*w.mobility*(own.state==='melee'?.45:jog?1:!s.tdm&&own.heal>0?.45:own.reload?.7:s.tdm&&own.heal>0?.45:1),body={x:pred.x,y:pred.y,radius:16},step=BPCore.DT,ease=Math.min(1,step*(len?25:31));
  pred.carry=Math.min(pred.carry+dt,.1);while(pred.carry>=step){pred.carry-=step;pred.vx+=(nx*speed-pred.vx)*ease;pred.vy+=(ny*speed-pred.vy)*ease;BPCore.move(s,body,pred.vx*step,pred.vy*step);}
  pred.x=body.x;pred.y=body.y;if(Number.isFinite(fi.aimX))pred.angle=Math.atan2(fi.aimY-pred.y,fi.aimX-pred.x);
  Object.assign(own,{x:pred.x,y:pred.y,vx:pred.vx,vy:pred.vy,angle:pred.angle});own.shotAge+=dt;if(own.state!=='melee')own.state=sprint?'sprint':len?'run':'idle';if(Math.hypot(pred.vx,pred.vy)>8)own.moveAngle=Math.atan2(pred.vy,pred.vx);}
 // An update has arrived. Compare the host's position for our operator with where we were when we sent the input it
 // includes (about half a send interval later, since the host has been applying it for a little while). A small
 // difference is eased out over the next few updates; a large one - a revive, a blast - is simply accepted.
 function reconcile(payload){const g=Array.isArray(payload.mates)?payload.mates[netSeat]:null,ack=isThing(payload.acks)?payload.acks[MATE_IDS[netSeat]]:undefined;if(!g||typeof g!=='object'||!pred.ready||g.dead){pred.ready=false;netHist=[];return;}
  if(scene.sim.tdm&&['roll','dive','slide','vault'].includes(g.state)){Object.assign(pred,{x:g.x,y:g.y,vx:g.vx||0,vy:g.vy||0});netHist=[];return;}
  const at=netHist.findIndex(h=>h.seq===ack),snap=()=>{Object.assign(pred,{x:g.x,y:g.y,vx:g.vx||0,vy:g.vy||0});netHist=[];};
  if(at<0){if(Math.hypot(g.x-pred.x,g.y-pred.y)>90)snap();}
  else{const a=netHist[at],b=netHist[at+1]||pred,ex=g.x-(a.x+b.x)/2,ey=g.y-(a.y+b.y)/2;netHist.splice(0,at);
   if(Math.hypot(ex,ey)>90)snap();else{pred.x+=ex*.18;pred.y+=ey*.18;for(const h of netHist){h.x+=ex*.18;h.y+=ey*.18;}}}
  Object.assign(g,{x:pred.x,y:pred.y,vx:pred.vx,vy:pred.vy,angle:pred.angle});}
 function onGuestMsg(msg){const l=lobby;if(!l||l.role!=='guest'||!msg)return;l.heardAt=performance.now();
  // A failed or abandoned connection attempt also reports "hostClosed"; it only means something once we were linked.
  if(msg.type==='hostClosed'){if(l.phase!=='linked')return;const was=l.inRun;clearInterval(l.timer);l.timer=null;l.countdown=0;l.phase='joining';l.peer=null;l.squad=[];l.seat=0;l.ready=false;l.status=l.kicked||(was?'THE HOST DISCONNECTED / RUN ENDED':'THE HOST CLOSED THE LOBBY');l.kicked='';feed(l.status);if(was)showLobby();else renderLobby();return;}
  if(l.phase!=='linked'||linkPing(msg))return;
  switch(msg.type){
  case 'lobby':{const first=!l.peer,kind=MODES[msg.mode]?msg.mode:'holdout',map=HOLD.some(h=>h.id===msg.map)?msg.map:l.map,diff=DIFFS.includes(msg.difficulty)?msg.difficulty:l.difficulty;l.peer={...cleanProfile(msg.host),ready:true};
   // Holdout: the rest of the squad as the host has seated it (us included, at "seat"). Team deathmatch: all eight
   // seats, which one is ours ("you"), and the match rules.
   l.squad=(Array.isArray(msg.squad)?msg.squad:[]).slice(0,MATE_IDS.length).filter(isThing).map(q=>q.bot===true?{...cleanProfile(q),bot:true,ready:true,title:'AI TEAMMATE'}:cleanProfile(q));l.seat=Number.isInteger(msg.seat)&&msg.seat>=0&&msg.seat<MATE_IDS.length?msg.seat:0;
   l.seats8=Array.from({length:8},(_,n)=>{const q=Array.isArray(msg.seats)?msg.seats[n]:null;if(!isThing(q))return null;const c=cleanProfile(q),bot=q.bot===true,host=q.host===true;return {...c,bot,host,ready:bot||host||c.ready,title:bot?'AI OPERATOR':c.title};});
   l.mySeat=Number.isInteger(msg.you)&&msg.you>=0&&msg.you<8?msg.you:-1;l.limit=BPCore.TDM.limits.includes(msg.limit)?msg.limit:BPCore.TDM.limit;l.support=msg.support!==false;l.mutators=(Array.isArray(msg.mutators)?msg.mutators:[]).filter(k=>VS_MUTATORS.includes(k));
   if(first){feed('JOINED '+l.peer.name+"'S SQUAD");scene.audio.say('vo-squad',{rest:60});}else{if(kind!==l.mode)feed('MODE SET TO '+MODES[kind].label);if(map!==l.map)feed((isVs(kind)?'MAP':'KILLHOUSE')+' SET TO '+holdoutMap(map).title);if(diff!==l.difficulty)feed((isVs(kind)?'AI SKILL':'ENEMY PRESSURE')+' SET TO '+DL[diff].label.toUpperCase());}
   l.mode=kind;l.map=map;l.difficulty=diff;renderLobby();break;}
  // Sent just before the host drops us: its lobby has no seat for another player.
  case 'full':l.kicked=msg.reason==='mode'?'THE HOST SWITCHED TO A TWO-PLAYER MODE / NO SEAT LEFT IN THAT LOBBY':'THAT LOBBY IS FULL';break;
  case 'chat':lobbyHeard(msg);break;
  case 'countdown':if(!l.inRun&&mode==='lobby'){feed('THE HOST IS DEPLOYING THE SQUAD');startCountdown(Math.max(1,Math.min(10,Number(msg.seconds)||3)));}break;
  case 'countdownCancel':if(l.countdown){cancelCountdown();feed('DEPLOYMENT CANCELLED');}break;
  case 'paused':if(l.inRun&&['playing','paused'].includes(mode))toast(msg.on===true?'THE HOST HAS PAUSED THE MATCH':'THE MATCH IS BACK ON',msg.on===true?8:1.6);break;
  case 'start':beginGuestRun(msg);break;
  case 'snapshot':if(l.inRun&&scene.sim&&msg.payload&&typeof msg.payload==='object'){reconcile(msg.payload);applySnapshot(scene.sim,msg.payload);}break;
  case 'events':if(l.inRun&&Array.isArray(msg.list))for(const e of msg.list){if(!isThing(e)||foreign(e))continue;scene.renderer.event(e);scene.audio.event(e);onEvent(e,true);}break;}}
 // Only the parts of the world an update is supposed to carry are taken from it. Wall entries change a wall we already
 // have, or add one the host deployed during the run.
 // Each part also has to be the kind of thing the game draws every frame - a list of objects, a number, an operator
 // carrying real guns - or it is left as it was: an update from another machine is checked, not trusted.
 const isThing=v=>!!v&&typeof v==='object'&&!Array.isArray(v),isList=v=>Array.isArray(v)&&v.every(isThing),isPoint=v=>isThing(v)&&Number.isFinite(v.x)&&Number.isFinite(v.y),isFlag=v=>typeof v==='boolean',
  isOp=o=>isPoint(o)&&Array.isArray(o.slots)&&!!W[o.slots[0]]&&!!W[o.slots[1]]&&(o.slot===0||o.slot===1)&&isThing(o.ammo)&&isThing(o.reserve),
  SNAP_SHAPE={player:isOp,mates:v=>Array.isArray(v)&&v.every(isOp),enemies:v=>isList(v)&&v.every(e=>!!A[e.type]&&isPoint(e)),allies:isList,recon:Number.isFinite,projectiles:isList,grenades:isList,zones:isList,mines:isList,hazards:isList,spawnWarnings:isList,pickups:isList,decoy:v=>v==null||isThing(v),director:isThing,goal:isPoint,progress:Number.isFinite,stage:Number.isInteger,stats:isThing,dark:Number.isFinite,dead:isFlag,completed:isFlag,time:Number.isFinite,boss:v=>v==null||typeof v==='string'||typeof v==='number',tags:isList,station:v=>v==null||isPoint(v),spotted:Number.isFinite,jammed:isFlag,order:v=>['auto','follow','hold'].includes(v),orderAt:v=>v==null||isPoint(v)};
 function applySnapshot(sim,payload){if(Array.isArray(payload.walls)&&sim.walls){const byId=new Map(sim.walls.map(w=>[w.id,w]));for(const w of payload.walls){if(!isThing(w))continue;const existing=byId.get(w.id);if(existing){if(isFlag(w.dead))existing.dead=w.dead;if(Number.isFinite(w.hp))existing.hp=w.hp;}else if(w.deployed&&isPoint(w)&&Number.isFinite(w.w)&&Number.isFinite(w.h))sim.walls.push(w);}}
  // The squad never changes size mid-run, so a list of any other length is not this run's.
  for(const k of SNAP_KEYS)if(k in payload&&SNAP_SHAPE[k](payload[k])&&(k!=='mates'||payload[k].length===sim.mates.length))sim[k]=payload[k];sim.guest=sim.mates[0];
  const T=payload.tdm;if(sim.tdm&&isThing(T)&&Array.isArray(T.score)&&T.score.length===2&&T.score.every(Number.isFinite)&&isThing(T.board))Object.assign(sim.tdm,{score:[T.score[0],T.score[1]],board:T.board,left:Number.isFinite(T.left)?T.left:sim.tdm.left,result:['win','loss','draw'].includes(T.result)?T.result:null,winner:[-1,0,1].includes(T.winner)?T.winner:null});
  // The versus modes' objectives: relays, the breach site and its round, who is the hunter. Numbers and points only.
  if(sim.tdm&&isThing(T)){const n=v=>Number.isFinite(v)?v:0;if(Array.isArray(T.relays))sim.tdm.relays=T.relays.slice(0,3).filter(z=>isPoint(z)&&typeof z.id==='string').map(z=>({id:z.id.slice(0,1),x:z.x,y:z.y,r:n(z.r)||95,owner:[-1,0,1].includes(z.owner)?z.owner:-1,progress:Math.max(-1,Math.min(1,n(z.progress))),contested:!!z.contested}));
   if(isPoint(T.site))sim.tdm.site={x:T.site.x,y:T.site.y,r:n(T.site.r)||80};if(['setup','live','over'].includes(T.phase))sim.tdm.phase=T.phase;for(const k of ['phaseLeft','plant','fuse','defuse','round','limit'])if(Number.isFinite(T[k]))sim.tdm[k]=T[k];sim.tdm.planted=!!T.planted;if([0,1].includes(T.attack))sim.tdm.attack=T.attack;if(typeof T.hunter==='string')sim.tdm.hunter=T.hunter.slice(0,12);}
  // The roster is the same operators in the same order; each needs at least an empty context for the HUD to read.
  if(sim.tdm){sim.roster=[sim.player,...sim.mates];for(const o of sim.roster){const c=o.ctx=isThing(o.ctx)?o.ctx:{};for(const k of ['perks','stats','mastery'])if(!isThing(c[k]))c[k]={};if(!isThing(c.support))c.support=null;o.team=o.team===1?1:0;}}}
 function beginGuestRun(o){const l=lobby,kind=MODES[o.mode]?o.mode:'holdout',tdm=kind==='tdm';if(!l||!HOLD.some(h=>h.id===o.mission)||!DIFFS.includes(o.difficulty))return;
  // Team deathmatch: the whole roster as the host seated it, host first, and which operator on it is ours ("seat" counts
  // from the first after the host). Holdout: the squad after the host, and which of those seats is ours.
  const squad=tdm?(Array.isArray(o.squad)?o.squad:[]).slice(0,8).filter(isThing).map(m=>({team:m.team===1?1:0,loadout:cleanProfile(m).loadout,bot:m.bot===true})):null;if(tdm&&squad.length<2)return;
  const mates=tdm?squad.slice(1):(Array.isArray(o.mates)?o.mates:[]).slice(0,MATE_IDS.length).filter(isThing).map(m=>({loadout:cleanProfile(m).loadout,bot:m.bot===true}));if(!mates.length)mates.push({loadout:Meta.loadout(save)});
  const seat=Number.isInteger(o.seat)&&o.seat>=0&&o.seat<mates.length?o.seat:0,named=id=>BPSave.callsign(isThing(o.names)?o.names[id]:'')||'OPERATOR',names={player:tdm?named('player'):l.peer?.name||'HOST',self:MATE_IDS[seat]};mates.forEach((m,i)=>{names[MATE_IDS[i]]=i===seat?callsign():named(MATE_IDS[i]);});
  clearInterval(l.timer);l.timer=null;l.countdown=0;l.inRun=true;l.runId++;netRole='guest';netSeat=seat;netSeq=0;netSendIn=0;netTaps={};netHist=[];pred={ready:false};feedRows=[];
  for(const d of [$('picker'),$('settings'),$('challenges')])if(d.open)d.close();scene.audio.unlock();scene.audio.stopAmbient();for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];
  run={mode:kind,mission:o.mission,difficulty:o.difficulty,floor:o.difficulty,deaths:0};
  const rules=isVs(o.rules)?o.rules:'tdm',muts=(Array.isArray(o.mutators)?o.mutators:[]).filter(k=>VS_MUTATORS.includes(k));if(tdm)run.rules=rules;
  scene.sim=BPCore.create(tdm?{mode:'tdm',rules,mutators:muts,mission:o.mission,difficulty:o.difficulty,seed:o.seed||1701,squad,limit:o.limit,support:o.support!==false}:{mode:kind==='extract'?'holdout':kind,extraction:kind==='extract',mission:o.mission,difficulty:o.difficulty,loadout:l.peer?.loadout||Meta.loadout(save),seed:o.seed||1701,mates});scene.names=names;scene.selfId=MATE_IDS[seat];
  const hm=holdoutMap(o.mission),T=scene.sim.tdm;scene.renderer.build(scene.sim,me(scene.sim));scene.accumulator=0;timeScale=1;scene.audio.startAmbient(scene.sim.map.theme);padGadget=me(scene.sim).lethal||!me(scene.sim).tactical?'lethal':'tactical';
  $('training-equipment').hidden=true;$('chapter').textContent=(tdm?'TEAM DEATHMATCH':'HOLDOUT')+' / '+DL[o.difficulty].label;$('mission-title').textContent=hm.title;$('sector').textContent='SIMULATION / '+hm.sector;
  // The simulation lives on the host, so a guest can step away but cannot pause or restart it.
  $('pause-copy').textContent='The fight carries on without you. Only the host can pause or restart the run.';$('retry').hidden=true;$('hud-name').textContent=callsign();
  $('radio').hidden=true;radioUntil=0;$('banner').className='banner';setMode('playing');$('status').textContent='ROOK / SIGNAL ACTIVE';scene.scale.refresh();scene.game.canvas.focus();lastHud=0;hud();
  banner(tdm?'TEAM DEATHMATCH':'HOLDOUT',hm.title,tdm?'TEAM '+(me(scene.sim).team?'DELTA':'ALPHA')+' · FIRST TO '+T.limit+' KILLS':'SURVIVE AS LONG AS YOU CAN',3);scene.audio.say(tdm?'vo-move-out':'vo-mission',{cut:true,rest:25});tdmCalls={ahead:false,behind:false,close:false};}
 function startTraining(){run={mode:'training',mission:'range',difficulty:settings.difficulty,floor:settings.difficulty,deaths:0};launch({mode:'training',mission:'range',difficulty:settings.difficulty});}
 // Hosting a squad: restarting from the pause menu restarts for both players; after a finished run it leads back to the lobby.
 function retry(){if(!run)return;if(lobby?.role==='host'&&lobby.inRun){if(mode==='paused')beginHostedRun(run.mission);else showLobby();return;}if(lobby?.role==='guest'){showLobby();return;}if(run.mode==='training'){if(run.drill&&!save.drill)startDrill();else startTraining();}else if(run.challenge)startChallenge(run.challenge.kind);else if(['holdout','tdm','extract','trials'].includes(run.mode))startArena(run.rules||run.mode,run.mission,run.fill,run.vs);else startMission(run.mission,!!save.run);}
 // A host's pause holds the match for everyone in it, so they are told.
 // While other players are in a match this copy is hosting, looking away from the window must not stop it for them.
 const hosting=()=>netRole==='host'&&netConnected;
 function pause(){if(mode!=='playing')return;if(netRole==='guest'&&LINK){netSeq++;LINK.guestSend({type:'input',seq:netSeq,input:{}});}if(netRole==='host'&&netConnected)LINK.hostSend({type:'paused',on:true});setMode('paused');scene.audio.pause();$('resume').focus();}
 function resume(){if(mode!=='paused')return;if(netRole==='host'&&netConnected)LINK.hostSend({type:'paused',on:false});scene.audio.unlock();scene.audio.resume();scene.audio.startAmbient(scene.sim.map.theme);setMode('playing');scene.accumulator=0;scene.game.canvas.focus();}
 function menu(){drill=null;$('skip-drill').hidden=true;netLeave();scene?.audio.stopAmbient();scene?.audio.vitals(100,false);for(const t of debriefTimers)clearTimeout(t);debriefTimers=[];setMode('menu');updateContinue();$('continue').focus();}
 function payDifficulty(){return DIFFS[Math.min(DIFFS.indexOf(run.difficulty),DIFFS.indexOf(run.floor||run.difficulty))];}
 // Both teams' tables on a team deathmatch debrief, your own first: every operator's kills and deaths, best first.
 // The objective line and the scoreboard's caption for the versus modes other than team deathmatch.
 function versusHud(s,T,p,t){const obj=$('objective'),hint=$('objective-hint'),lim=$('score-limit'),down=p.dead&&Number.isFinite(p.respawn)?'Redeploying in '+Math.max(1,Math.ceil(p.respawn||0))+'s. ':'';
  if(T.rules==='arms'){const step=Math.min(p.arms||0,BPCore.ARMS_LADDER.length),last=step>=BPCore.ARMS_LADDER.length;lim.textContent='LADDER · '+T.limit+' STEPS';
   obj.textContent=p.dead?'You are down':'ARMS RACE · STEP '+(step+1)+' / '+T.limit+' · '+(last?'KNIFE KILL TO WIN':W[BPCore.ARMS_LADDER[step]].short);hint.textContent=down+(last?'One knife kill wins it for your team.':'Every kill moves you up a gun. A knife kill sets the victim back a step.');}
  else if(T.rules==='uplink'){lim.textContent='FIRST TO '+T.limit;const mark=z=>z.contested?'⚔':z.owner<0?'○':z.owner===t?'●':'◆';obj.textContent=(p.dead?'You are down · ':'')+'RELAYS  '+T.relays.map(z=>z.id+' '+mark(z)).join('   ');
   hint.textContent=down+'● yours · ◆ theirs · ○ nobody\'s · ⚔ contested. Stand in a relay with nobody from the other side to take it; each one held scores a point a second.';}
  else if(T.rules==='hunted'){const h=s.roster.find(o=>o.id===T.hunter),me2=p.id===T.hunter,squad=s.roster.filter(o=>o.team===0&&!o.dead&&!o.vanished).length;$('score-us-name').textContent=t?'HUNTER':'SQUAD';$('score-them-name').textContent=t?'SQUAD':'HUNTER';lim.textContent='SQUAD LEFT · HUNTER';
   obj.textContent=me2?'HUNT THE SQUAD · '+squad+' LEFT':p.dead?'You are down · '+squad+' of the squad left':'SURVIVE, OR KILL THE HUNTER';
   hint.textContent=me2?'You are cloaked until you fire, are hit or come close. Roll to blink. A sweep shows you to them every 20 s.':'The hunter is cloaked: watch for its shimmer and its muzzle flash. A sweep shows it every 20 s.'+(h&&!h.dead&&(h.revealed||0)>s.time?' Hunter at '+Math.round(h.health/h.maxHealth*100)+'%.':'');}
  else if(T.rules==='breach'){const att=p.team===T.attack,left=Math.max(0,Math.ceil(T.phaseLeft||0));$('score-time').textContent=formatTime(T.phase==='live'&&T.planted?Math.ceil(T.fuse):left);lim.textContent='ROUND '+T.round+' · FIRST TO '+T.limit;
   const pct=v=>Math.round(v*100)+'%';
   obj.textContent=T.phase==='setup'?(att?'ATTACKING · DEFENDERS ARE SETTING UP':'DEFENDING · SET UP AT THE SITE'):T.phase==='over'?'ROUND OVER':att?(T.planted?'CHARGE PLANTED · DEFEND IT':T.plant>0?'PLANTING · '+pct(T.plant/4):'PLANT THE CHARGE AT THE SITE'):(T.planted?(T.defuse>0?'DEFUSING · '+pct(T.defuse/5):'DEFUSE THE CHARGE'):'DEFEND THE SITE');
   hint.textContent=(p.dead?'You are down until the next round. ':'')+(att?'Hold interact at the site for 4 s to plant. Wipe the defenders out and the round is yours too.':'Hold interact on a planted charge for 5 s to defuse. Run the clock down or wipe the attackers out.');}}

 // ---------- flow-trial ghosts ----------
 // A run is recorded one simulation step at a time: movement, the aim as an angle from the operator, and the buttons.
 // Steps that repeat are counted, not stored twice. Because the simulation is deterministic, replaying the record in a
 // second copy of the same course redraws the run exactly; that copy is drawn beside the player as the ghost.
 const GHOST_KEYS=['sprint','roll','slide','fire','aiming','reload','melee','meleeDown','interact','interactDown','swap','gadget','grenade','tactical'];
 function ghostFrame(sim,i){const p=sim.player,a=Number.isFinite(i.aimX)?Math.round(Math.atan2(i.aimY-p.y,i.aimX-p.x)*50):'',bits=GHOST_KEYS.reduce((n,k,j)=>i[k]?n|1<<j:n,0);
  return [Math.round((i.mx||0)*1000),Math.round((i.my||0)*1000),a,bits.toString(36),i.slot===undefined?'':i.slot].join(',');}
 function packGhost(frames){const out=[];let last=null,n=0;for(const f of frames){if(f===last){n++;continue;}if(last!==null)out.push(n>1?n+'*'+last:last);last=f;n=1;}if(last!==null)out.push(n>1?n+'*'+last:last);return out.join('|');}
 function unpackGhost(text){const frames=[];for(const part of String(text).split('|')){const star=part.indexOf('*'),n=star>0?Number(part.slice(0,star)):1,f=star>0?part.slice(star+1):part;if(!(n>0&&n<1e5))return null;for(let k=0;k<n;k++)frames.push(f);if(frames.length>120*900)return null;}return frames;}
 function ghostInput(sim,f){const [mx,my,a,bits,slot]=f.split(','),p=sim.player,b=parseInt(bits||'0',36)||0,i={mx:Number(mx)/1000||0,my:Number(my)/1000||0};
  if(a!==''){const ang=Number(a)/50;i.aimX=p.x+Math.cos(ang)*300;i.aimY=p.y+Math.sin(ang)*300;}GHOST_KEYS.forEach((k,j)=>{if(b&1<<j)i[k]=true;});if(slot!=='')i.slot=Number(slot);return i;}
 // The ghost for a course, if a best run has been saved for it: a second simulation of the same course.
 function makeGhost(o){const text=save.ghosts?.[o.mission+':'+o.trial.seed],frames=text&&unpackGhost(text);if(!frames)return null;
  return {sim:BPCore.create({mission:o.mission,difficulty:'standard',loadout:o.loadout,owned:[...save.owned.weapons],profile:Meta.profile(save),seed:o.seed||1701,mode:'holdout',trial:o.trial}),frames,at:0};}
 function stepGhost(){const g=scene.ghost;if(!g||g.at>=g.frames.length||g.sim.completed)return;BPCore.step(g.sim,ghostInput(g.sim,g.frames[g.at++]));g.sim.events.length=0;}
 function scoreboard(s){const T=s.tdm,self=myId(),my=me(s).team,rows=t=>s.roster.filter(o=>o.team===t).map(o=>({o,b:T.board[o.id]||{k:0,d:0}})).sort((a,b)=>b.b.k-a.b.k||a.b.d-b.b.d)
   .map(({o,b})=>`<div class="${o.id===self?'self':''}"><span><b>${esc(scene.names?.[o.id]||'OPERATOR')}</b>${o.bot?'<em>AI</em>':''}</span><span><b>${b.k}</b></span><span><b>${b.d}</b></span></div>`).join('');
  $('scoreboard').hidden=false;$('scoreboard').className='scoreboard teams2';$('scoreboard').innerHTML=[my,1-my].map(t=>`<div class="head ${t===my?'us':'them'}"><span>TEAM ${t?'DELTA':'ALPHA'} · ${T.score[t]}</span><span title="Kills">K</span><span title="Deaths">D</span></div>`+rows(t)).join('');}
 // The kill feed: who got whom, and with what, for the last few kills. Your own name is amber, your team's blue, theirs red.
 let feedRows=[];const FEED_SOURCE={melee:'KNIFE',tknife:'KNIFE',grenade:'FRAG',cluster:'CLUSTER',c4:'C4',mine:'MINE',seeker:'SEEKER',incendiary:'FIRE',sentry:'SENTRY',k9:'K9',strike:'AIRSTRIKE',gunship:'GUNSHIP',blackout:'BLACKOUT'};
 function killFeed(e){const s=scene.sim,n=scene.names||{},my=me(s).team,cls=id=>id===myId()?'me':s.roster.find(o=>o.id===id)?.team===my?'us':'them';
  feedRows.push({until:performance.now()+5500,html:`<b class="${cls(e.by)}">${esc(n[e.by]||'OPERATOR')}</b><i>${esc(W[e.source]?.short||FEED_SOURCE[e.source]||'KILL')}</i><b class="${cls(e.victim)}">${esc(n[e.victim]||'OPERATOR')}</b>`});if(feedRows.length>5)feedRows.shift();}
 function end(e){const s=scene.sim;if(s.tdm&&e.tdm){if([-1,0,1].includes(e.winner))s.tdm.winner=e.winner;if(Array.isArray(e.score)&&e.score.length===2&&e.score.every(Number.isFinite))s.tdm.score=[e.score[0],e.score[1]];}
  scene.audio.say(e.type==='complete'&&(s.tdm?BPCore.verdict(s,myId()).result:e.result)!=='loss'?'vo-complete':'vo-failed',{cut:true,rest:6});scene.audio.stopAmbient();scene.audio.vitals(100,false);$('debrief').hidden=true;$('scoreboard').hidden=true;$('ending').classList.remove('tally');$('ending-next').hidden=true;$('ending-armory').hidden=run.mode==='training';
  // Extraction: out with the loot, or down without it.
  if(run.mode==='extract'){const X=s.extract,summary=Meta.summarize(s,{difficulty:payDifficulty()}),report=Meta.settle(save,summary,today());if(e.type!=='complete')save.stats.deaths++;persist();setMode(e.type==='complete'?'complete':'dead');
   $('ending-eyebrow').textContent='EXTRACTION / '+holdoutMap(run.mission).title+' / '+DL[run.difficulty].label;$('ending-title').innerHTML=e.type==='complete'?'WHEELS<br>UP.':'LOOT<br>LOST.';
   $('ending-copy').textContent=e.type==='complete'?(X.found?X.found+' of '+X.total+' caches out with you: '+fmt(X.loot)+' CR on top of your bounties.':'Out clean, empty-handed. The caches pay more the more you take.'):(X.loot?fmt(X.loot)+' CR of loot went down with you. Your bounties are paid; the caches are not.':'Down before the first cache. Your bounties are paid.');
   $('run-stats').innerHTML=`<span>CACHES<b>${X.found} / ${X.total}</b></span><span>LOOT<b>${fmt(X.loot)}</b></span><span>HOSTILES<b>${s.stats.kills}</b></span><span>TIME<b>${formatTime(s.time)}</b></span>`;
   $('ending-retry').textContent=lobby?'BACK TO THE LOBBY ↗':'GO AGAIN ↗';debrief(report);$('ending-retry').focus();return;}
  // Flow trials: the time, what it is made of, and whether it is a new best (whose inputs are kept as the ghost).
  if(run.mode==='trials'){const T=s.trial,key=run.mission+':'+run.trial.seed,before=save.trials?.[key]?.best,summary=Meta.summarize(s,{difficulty:'standard'}),report=Meta.settle(save,summary,today());
   const best=e.type==='complete'&&(before===undefined||T.score<before);if(best&&scene.record)save.ghosts[key]=packGhost(scene.record);persist();setMode(e.type==='complete'?'complete':'dead');
   $('ending-eyebrow').textContent='FLOW TRIALS / '+holdoutMap(run.mission).title+' / '+(run.trial.daily?"TODAY'S COURSE":"THIS MAP'S COURSE");$('ending-title').innerHTML=e.type!=='complete'?'COURSE<br>FAILED.':best?'NEW<br>BEST.':(T.score.toFixed(2)+'<br>SECONDS.');
   $('ending-copy').textContent=e.type!=='complete'?'Back to the start gate.':`${T.time.toFixed(2)} s on the clock, +${((T.targets.length-T.hit)*3).toFixed(0)} s for missed targets, −${(T.flows*.5).toFixed(1)} s for perfect flows.`+(best?' Your run is saved as the ghost to race next time.':before!==undefined?' Your best is '+before.toFixed(2)+' s.':'');
   $('run-stats').innerHTML=`<span>SCORE<b>${e.type==='complete'?T.score.toFixed(2):'—'}</b></span><span>TIME<b>${T.time.toFixed(2)}</b></span><span>TARGETS<b>${T.hit} / ${T.targets.length}</b></span><span>FLOWS<b>${T.flows}</b></span>`;
   $('ending-retry').textContent='RUN IT AGAIN ↗';debrief(report);$('ending-retry').focus();return;}
  if(e.type==='complete'&&run.mode==='campaign'){const meta=missionMeta(run.mission),summary=Meta.summarize(s,{rating:e.rating,score:e.score,deaths:run.deaths||0,difficulty:payDifficulty()}),report=Meta.settle(save,summary,today());save.run=null;persist();setMode('complete');
   $('ending-eyebrow').textContent='CHAPTER '+meta.n+' / '+meta.title+' / COMPLETE';$('ending-title').innerHTML=['NO ONE IS<br>COMING.','THE QUARTER<br>FALLS SILENT.','THE LOG<br>NAMES HIM.','UNDER THE<br>CORDON.','THE KEY<br>TURNS.','EVERY NAME<br>BURNS.','SHE IS<br>ALIVE.','THE WALLS<br>ARE DOWN.','LIGHTS<br>OUT.'][meta.n-1]||'COMPLETE.';$('ending-copy').textContent=meta.outro;
   // A rating short of S says what it would have taken: S needs a perfect flow on top of a clean, quick run.
   const ratingNote=e.rating==='S'?'':e.score>=9800&&!s.stats.flows?'S NEEDS A PERFECT FLOW · SLIDE INTO A VAULT':'S: TAKE LESS DAMAGE, BEAT PAR, CHAIN FLOWS';
   $('run-stats').innerHTML=`<span title="${ratingNote}">FIELD RATING<b>${e.rating}</b>${ratingNote?`<small class="rating-note">${ratingNote}</small>`:''}</span><span>HOSTILES<b>${s.stats.kills}</b></span><span>BEST COMBO<b>×${s.stats.bestCombo}</b></span><span>TIME<b>${formatTime(e.time)}</b></span>`;
   const next=MISSIONS[meta.n];$('ending-next').hidden=!next;if(next)$('ending-next').innerHTML=`NEXT · ${esc(next.title)} <b>↗</b>`;$('ending-retry').textContent='REPLAY '+meta.title+' ↗';debrief(report);(next?$('ending-next'):$('ending-retry')).focus();return;}
  // Team deathmatch always ends on a result, and every player is paid on their own machine: bounties for their own
  // kills and a bonus for how their team did. The AI skill multiplier only applies if there was AI on the other team.
  if(run.mode==='tdm'){const T=s.tdm,op=me(s),v=BPCore.verdict(s,op.id),mine=T.board[op.id]||{k:0,d:0},us=T.score[v.team],them=T.score[1-v.team],res=v.result,name=t=>t?'DELTA':'ALPHA';
   const summary={...Meta.summarize(s,{difficulty:v.ai?(netRole==='guest'?run.difficulty:payDifficulty()):'standard'}),stats:{...op.ctx.stats,match:v.match},mastery:{...op.ctx.mastery},result:res,ranked:v.ranked,score:[us,them]},report=Meta.settle(save,summary,today());persist();setMode('complete');
   const R=T.rules||'tdm',label=MODES[R]?.label||'TEAM DEATHMATCH',side=R==='hunted'?(v.team?'THE HUNTER':'THE SQUAD'):'TEAM '+name(v.team);
   $('ending-eyebrow').textContent=label+' / '+side+' / '+holdoutMap(run.mission).title;$('ending-title').innerHTML=res==='win'?'VICTORY.':res==='draw'?'DEAD<br>LEVEL.':'DEFEAT.';
   const how={arms:res==='win'?'Your team climbed the whole ladder and made the knife kill first.':res==='draw'?'Nobody reached the knife before the clock ran out.':'The other team made the knife kill first.',
    uplink:res==='win'?'Your team held the relays long enough to reach '+T.limit+'.':res==='draw'?'Level on points when the clock ran out.':'The other team held the relays longer.',
    hunted:v.team?(res==='win'?'The whole squad is down.':'The squad '+(s.roster.find(o=>o.id===T.hunter)?.dead?'brought you down.':'held out until the clock ran out.')):(res==='win'?(s.roster.find(o=>o.id===T.hunter)?.dead?'The squad brought the hunter down.':'The squad held out until the clock ran out.'):'The hunter took the whole squad.'),
    breach:(res==='win'?'Your team':'The other team')+' took '+Math.max(us,them)+' rounds of '+T.round+'.'}[R];
   $('ending-copy').textContent=(how||(res==='win'?'Team '+name(v.team)+' reached the mark first.':res==='draw'?'Nothing between the two teams when the clock ran out.':'Team '+name(1-v.team)+' got there first.'))+' Your bounties'+(v.match?' and the match bonus':'')+' are paid.'+(v.ranked?'':R==='tdm'?' A match to fewer than 20 kills, or against a smaller team, is not kept in your record.':' A match against a smaller team is not kept in your record.');
   $('run-stats').innerHTML=`<span>${R==='breach'?'ROUNDS':R==='arms'?'BEST STEP':R==='uplink'?'POINTS':R==='hunted'?'LEFT STANDING':'SCORE'}<b>${us} – ${them}</b></span><span>YOUR KILLS<b>${mine.k}</b></span><span>YOUR DEATHS<b>${mine.d}</b></span><span>TIME<b>${formatTime(s.time)}</b></span>`;
   scoreboard(s);$('ending-retry').textContent=lobby?'BACK TO THE LOBBY ↗':'PLAY AGAIN ↗';debrief(report);$('ending-retry').focus();return;}
  if(run.mode==='holdout'){const summary=Meta.summarize(s,{difficulty:payDifficulty(),challenge:!!run.challenge}),report=Meta.settle(save,summary,today());save.stats.deaths++;
   // A seeded challenge files its score (a practice run is scored, not recorded).
   const ch=run.challenge?Meta.recordChallenge(save,run.challenge,{...s.stats,time:s.time},run.runId,run.eligible):null;persist();setMode('dead');
   $('ending-eyebrow').textContent=(run.challenge?run.challenge.label+' / ':'HOLDOUT / ')+DL[run.difficulty].label;$('ending-title').innerHTML=`WAVE ${s.stats.wave}<br>SURVIVED.`;
   // What put you down, and how to beat it next time.
   const lesson=e.blame&&A[e.blame]&&TIPS[e.blame]?'Taken down by '+(/^[AEIOU]/.test(A[e.blame].name)?'an ':'a ')+A[e.blame].name.toLowerCase()+' on wave '+(e.wave||s.stats.wave+1)+'. '+TIPS[e.blame]:'';
   const chLine=ch?(ch.practice?'Practice run: score '+fmt(ch.score)+', not recorded.':ch.duplicate?'':'Challenge score '+fmt(ch.score)+(ch.newBest?' - a new best':'')+' · #'+ch.rank+' on this machine.'):'';
   $('ending-copy').textContent=[chLine,(!run.challenge&&report.newBest?'A new personal record. ':'')+(lesson||(report.newBest?'The killhouse resets — and so do you.':'Every wave you cleared paid out. Spend it, then come back for one more.'))].filter(Boolean).join('\n');
   // Accuracy counts the operator's own rounds (each pellet a round) that struck a hostile; shown once there is something to count.
   const acc=s.stats.fired>0?Math.min(100,Math.round(100*(s.stats.landed||0)/s.stats.fired)):null;
   $('run-stats').innerHTML=`<span>WAVES<b>${s.stats.wave}</b></span><span>HOSTILES<b>${s.stats.kills}</b></span><span>BEST COMBO<b>×${s.stats.bestCombo}</b></span>${acc!==null?`<span>ACCURACY<b>${acc}%</b></span>`:''}<span>TIME<b>${formatTime(s.time)}</b></span>${ch?`<span>SCORE<b>${fmt(ch.score)}</b></span>`:''}`;$('ending-retry').textContent=lobby?'BACK TO THE LOBBY ↗':'GO AGAIN ↗';debrief(report);$('ending-retry').focus();return;}
  setMode('dead');if(run.mode==='campaign'){run.deaths=(run.deaths||0)+1;if(save.run)save.run.deaths=run.deaths;save.stats.deaths++;persist();}
  const meta=missionMeta(run.mission);$('ending-eyebrow').textContent='ROOK / SIGNAL LOST';$('ending-title').innerHTML='STAY IN<br>THE FIGHT.';
  // What put you down and how to beat it, then a separate line on the difficulty: two thoughts, two lines.
  const killer=e.blame&&A[e.blame]&&TIPS[e.blame]?'Taken down by '+(/^[AEIOU]/.test(A[e.blame].name)?'an ':'a ')+A[e.blame].name.toLowerCase()+'. '+TIPS[e.blame]:'';
  $('ending-copy').textContent=s.training?'Live fire got the better of you. Reset the range and try a different approach.':[killer||'Watch the attack telegraphs and use cover.',s.difficulty==='insane'?'Insane punishes open ground: fight from corners and relocate before grenades land.':'Your last checkpoint is secure.'].join('\n');
  $('ending-retry').textContent=s.training?'RESET THE RANGE ↗':'RETRY CHECKPOINT ↗';$('run-stats').innerHTML=`<span>HOSTILES<b>${s.stats.kills}</b></span><span>TIME<b>${formatTime(s.time)}</b></span>${run.mode==='campaign'?`<span>CREDITS AT RISK<b>${fmt(s.stats.credits)}</b></span>`:''}`;$('ending-retry').focus();}
 // The tally counts each line up with a tick, then fills the XP bar and calls out rank-ups, medals, mastery and contracts.
 function debrief(report){const box=$('debrief-lines'),awards=$('debrief-awards');box.replaceChildren();awards.replaceChildren();$('debrief').hidden=false;$('ending').classList.add('tally');$('debrief-credits').textContent='0';
  $('debrief-contracts').innerHTML=Meta.refreshContracts(save,today()).map(x=>`<div class="contract${x.done?' done':''}"><span>${esc(x.text)}</span><b>${x.done?'PAID':x.progress+' / '+x.goal} · ${x.reward} CR</b><i style="--v:${(x.progress/x.goal).toFixed(2)}"></i></div>`).join('');const before=report.rankBefore,after=report.rankAfter||before;
  $('xp-rank').textContent='RANK '+before.rank+' · '+before.title;$('xp-fill').style.transition='none';$('xp-fill').style.width=(before.into/before.span*100)+'%';$('xp-note').textContent='+'+fmt(report.xp)+' XP';
  let total=0,t=350;const later=(fn,ms)=>debriefTimers.push(setTimeout(fn,ms));
  for(const l of report.lines){later(()=>{const row=document.createElement('div');row.className='dl';row.innerHTML=`<span>${esc(l.label)}${l.note?' <small>'+esc(l.note)+'</small>':''}</span><b>+0</b>`;box.append(row);const b=row.querySelector('b'),start=performance.now(),from=total;total+=l.value;const to=total;scene.audio.ui('tick');
    const step=()=>{const k=Math.min(1,(performance.now()-start)/320);b.textContent='+'+fmt(l.value*k);$('debrief-credits').textContent=fmt(from+(to-from)*k);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);box.scrollTop=box.scrollHeight;},t);t+=Math.max(140,420-report.lines.length*18);}
  later(()=>{$('debrief-credits').textContent=fmt(report.credits);scene.audio.ui('total');$('xp-fill').style.transition='width .9s cubic-bezier(.2,.8,.2,1)';$('xp-fill').style.width=(after.rank>before.rank?100:after.into/after.span*100)+'%';refreshWallet();},t+200);
  const award=(cls,eyebrow,title,sub,sound,art='')=>{const a=document.createElement('div');a.className='award '+cls;a.innerHTML=`${art?'<div class="award-art">'+art+'</div>':''}<small>${esc(eyebrow)}</small><b>${esc(title)}</b><span>${esc(sub)}</span>`;awards.append(a);scene.audio.ui(sound);};
  t+=1150;for(const r of report.rankUps){later(()=>{$('xp-rank').textContent='RANK '+r.rank+' · '+r.title;$('xp-fill').style.transition='none';$('xp-fill').style.width='0%';requestAnimationFrame(()=>{$('xp-fill').style.transition='width .7s ease';$('xp-fill').style.width=(after.rank===r.rank?after.into/after.span*100:100)+'%';});award('gold','RANK UP','RANK '+r.rank+' · '+r.title,'+'+r.bonus+' CR'+(r.tier?' · ARMORY TIER '+r.tier+' OPEN':''),'rank');},t);t+=700;}
  for(const m of report.medals){later(()=>award('medal','MEDAL',m.name,'+150 CR','medal'),t);t+=380;}
  for(const m of report.mastery){later(()=>award('mastery','WEAPON MASTERY',W[m.weapon].short+' '+'★'.repeat(m.level),m.perk.toUpperCase(),'medal',ICON('weapon',m.weapon)),t);t+=380;}
  for(const c of report.contracts.filter(c=>c.done)){later(()=>award('contract','CONTRACT',c.text,'PAID','medal'),t);t+=300;}
  for(const u of report.unlocks||[]){later(()=>award('gold','CHALLENGE COMPLETE',u.name,u.text.toUpperCase()+' · UNLOCKED','rank',ICON(u.kind,u.key)),t);t+=520;}
  if(report.newBest)later(()=>award('best','NEW PERSONAL BEST','RECORD','SAVED TO YOUR SERVICE RECORD','medal'),t);
  // One line under the tally naming what to aim for next.
  const g=report.goal,parts=[];if(g?.item)parts.push(fmt(g.item.need)+' CR TO THE '+g.item.name);else if(g?.afford)parts.push('YOU CAN AFFORD THE '+g.afford.name);
  if(g?.tier)parts.push(g.tier.ranks+(g.tier.ranks===1?' RANK':' RANKS')+' TO ARMORY TIER '+g.tier.tier);$('debrief-goal').textContent=parts.length?'NEXT · '+parts.join(' · '):'';}
 function onEvent(e,isGuest=false){const s=scene.sim;
  // A guest never owns save/run state (the host's save is authoritative for this pass), so it skips every
  // branch below that would persist() or settle() a run, and shows a plain message instead of a full ending.
  // What happens to one operator is that player's to be told about. (Outside team deathmatch these carry no name and are the host's.)
  if(e.who&&['flow','toast','nostamina','dodge','supportready','allygone','secondwind','bought','deny','equip'].includes(e.type)&&e.who!==myId())return;
  // A guest in team deathmatch gets the same debrief as the host, and is paid from it on their own machine.
  if(isGuest&&e.type==='complete'&&e.tdm){end(e);return;}
  if(isGuest&&(e.type==='death'||e.type==='complete')){const token=lobby?.runId,lost=e.type==='death'||e.result==='loss',score=Array.isArray(e.score)?' '+e.score.map(n=>Math.floor(Number(n)||0)).slice(0,2).join(' – '):'';
   toast(e.type==='death'?'SQUAD WIPED OUT / BACK TO THE LOBBY':e.tdm?(e.result==='win'?'VICTORY':e.result==='draw'?'DRAW':'DEFEAT')+score+' / BACK TO THE LOBBY':'RUN COMPLETE / BACK TO THE LOBBY',2.5);scene.audio.say(lost?'vo-failed':'vo-complete',{cut:true,rest:6});setTimeout(()=>{if(lobby?.inRun&&lobby.runId===token)showLobby();},2500);return;}
  if(isGuest&&!e.who&&['checkpoint','unlock','weaponfound','supportready','secondwind'].includes(e.type))return;
  switch(e.type){
  case 'radio':radio(e);break;case 'toast':toast(e.text);break;// Flows chained within four seconds of each other count up: the movement the game is built round, made visible.
  case 'flow':{const now=performance.now();flowChain=now-flowAt<4000?flowChain+1:1;flowAt=now;toast(flowChain>1?'PERFECT FLOW ×'+flowChain+' / CHAIN IT':'PERFECT FLOW / MOMENTUM RETAINED',1.5);if(!isGuest)scene.audio.say('vo-flow',{rest:120});scene.audio.flowChain(flowChain);break;}
  case 'checkpoint':if(run?.mode==='campaign'){save.run={...run,checkpoint:e.checkpoint};persist();}break;
  case 'unlock':for(const k of e.items){if(W[k]&&!save.owned.weapons.includes(k))save.owned.weapons.push(k);if(G[k]&&!save.owned.gear.includes(k))save.owned.gear.push(k);}persist();banner('SUPPLY CACHE','M870 + FRAG GRENADES','SHOTGUN ON THE GROUND · '+keyLabel('interact')+' TO SWAP IT IN',4,'gold',ICON('weapon','shotgun'));break;
  // A gun taken from the field is the operator's for this run only; the first find marks it down in the armory for good.
  case 'weaponfound':{const first=!save.found.includes(e.weapon)&&!save.owned.weapons.includes(e.weapon);if(first){save.found.push(e.weapon);persist();}
   banner(first?'FIELD FIND':'FIELD WEAPON',W[e.weapon].name,keyLabel('interact')+' TO CARRY IT AS YOUR '+(W[e.weapon].slot===0?'PRIMARY':'SECONDARY')+' THIS RUN'+(first?' · NOW 25% OFF IN THE ARMORY':''),3.8,'gold',ICON('weapon',e.weapon));break;}
  case 'pickup':if(e.kind!=='weapon'&&(e.who||'player')===myId())toast(e.kind==='health'?'HEALTH RESTORED':e.kind==='armor'?'ARMOR REINFORCED':e.kind==='supply'?'FIELD EQUIPMENT RESTORED':e.kind==='lethal'?'LETHAL RESUPPLIED':e.kind==='tactical'?'TACTICAL RESUPPLIED':e.kind==='intel'||e.kind==='cache'?'':'AMMUNITION RECOVERED',1.5);break;
  case 'intel':banner('CLASSIFIED','INTEL RECOVERED','+200 CR ON COMPLETION · MEDAL',3,'gold',ICON('pickup','intel'));break;case 'cache':toast('CREDIT CACHE / +120 CR',2);break;
  case 'objective':banner(e.partial?'OBJECTIVE':'OBJECTIVE COMPLETE',e.partial?e.name:e.name.toUpperCase(),'',2.4);break;
  case 'stage':if(e.stage>0){voice('stage',{rest:30});const st=s.map.stages[e.stage];setTimeout(()=>{if(mode==='playing')banner('NEW OBJECTIVE',st.name.toUpperCase(),st.hint,3);},2500);}break;
  case 'sighted':intelNote('sight',e);break;
  case 'escort':scene.names={...(scene.names||{}),[e.id]:e.name};break;
  case 'armsup':if(e.who===myId())toast('STEP '+(e.step+1)+' · '+W[e.weapon].name,1.6);break;
  case 'armsknife':if(e.who===myId())banner('ARMS RACE','KNIFE','ONE KNIFE KILL WINS IT',2,'gold');else if(s.roster?.find(o=>o.id===e.who)?.team!==me(s).team)toast('THE OTHER TEAM HAS SOMEONE ON THE KNIFE',2.2);break;
  case 'armsdown':if(e.who===myId())toast('KNIFED · BACK A STEP',1.6);break;
  case 'relay':toast('RELAY '+e.id+(e.team===me(s).team?' TAKEN':' LOST TO THE OTHER TEAM'),1.8);break;
  case 'sweep':toast(s.tdm&&me(s).id===s.tdm.hunter?'SWEEP · THEY CAN SEE YOU':'SWEEP · THE HUNTER IS SHOWN',2);break;
  case 'breachround':banner('ROUND '+e.round,me(s).team===e.attack?'ATTACK':'DEFEND',me(s).team===e.attack?'THE DEFENDERS ARE SETTING UP':'SET UP AT THE SITE · 20 SECONDS',2.4,me(s).team===e.attack?'danger':'');break;
  case 'breachlive':toast(me(s).team===s.tdm.attack?'GO · PLANT THE CHARGE':'THEY ARE COMING',1.8);break;
  case 'planted':banner('BREACH','CHARGE PLANTED',me(s).team===s.tdm.attack?'DEFEND IT FOR 30 SECONDS':'DEFUSE IT · HOLD INTERACT ON IT',2.2,'danger');break;
  case 'breachwon':banner(e.team===me(s).team?'ROUND WON':'ROUND LOST',e.why,e.score[me(s).team]+' – '+e.score[1-me(s).team],2.4,e.team===me(s).team?'gold':'danger');break;
  case 'kill':intelNote('kill',e);if(s.tdm)killFeed(e);if(!e.bot&&(!s.tdm||e.by===myId()))comboUntil=performance.now()+3500;if(!e.bot&&(e.by||'player')===myId())streakVoice(e);if(e.combo>=2&&(!s.tdm||e.by===myId())){const name={2:'DOUBLE KILL',3:'TRIPLE KILL',5:'RAMPAGE',8:'UNSTOPPABLE',12:'BLACKOUT'}[e.combo];if(name)banner('×'+e.combo+' COMBO',name,'',1.4,'combo');}
   if(e.boss){slowUntil=performance.now()+1100;banner('TARGET DOWN',A[e.enemy].name+' DESTROYED','',3,'gold');}break;
  // Holdout waves. A clean wave (little damage taken) pays a little extra; the wave before a red one says what is
  // coming and that the drop holds its answer. A red wave turns the screen's edges red (see hud) and names its boss.
  case 'waveclear':{voice('lull',{rest:45});const extra=[e.clean?(e.grade==='flawless'?'FLAWLESS':'CLEAN WAVE')+' +'+e.clean+' CR':'',e.modifier?BPCore.MODIFIERS[e.modifier]+' BONUS INCLUDED':''].filter(Boolean).join(' · ');
   if(e.next?.red)banner('WAVE '+e.wave+' CLEARED · +'+(e.bonus+(e.clean||0))+' CR','NEXT: RED WAVE',(e.next.bosses||[]).map(b=>A[b].name).join(' + ')+' INBOUND · A LEGENDARY CRATE IS IN THE DROP',4,'danger');
   else banner('WAVE '+e.wave+' CLEARED','+'+(e.bonus+(e.clean||0))+' CR',(extra?extra+' · ':'')+'SUPPLY DROP INBOUND',2.6,'gold');
   if(e.milestone&&run&&(save.holdout[run.difficulty]||0)<e.milestone)setTimeout(()=>{if(mode==='playing')banner('MILESTONE','WAVE '+e.milestone+' REACHED','FIRST TIME ON THIS PRESSURE · A BONUS IS WAITING ON YOUR DEBRIEF',3,'gold');},e.next?.red?4200:2800);
   slowUntil=performance.now()+700;break;}
  case 'wave':{const names=(e.bosses||[]).map(b=>A[b].name),rose=e.tier>BPCore.pressureFor(s,Math.max(1,e.wave-1)).tier;
   if(e.red){scene.audio.say(e.bosses[0]==='commander'?'vo-boss':'vo-hold',{cut:true,rest:30});banner('RED WAVE '+e.wave,names.join(' + ')+' INBOUND',TIPS[e.bosses[0]]||'',4.4,'danger');}
   else{if(e.wave>1)voice('wave',{rest:30});banner('HOLDOUT · THREAT '+THREAT[e.tier||0],'WAVE '+e.wave,e.modifier?MODIFIER_TEXT[e.modifier]:rose?'THREAT RISING · '+THREAT_TEXT[e.tier]:'',e.modifier||rose?3:2,e.modifier||rose?'danger':'');}
   // A hostile seen for the first time this run gets a card of its own, once the wave banner has had its moment.
   if(e.fresh?.length){const list=e.fresh.slice(0,2);setTimeout(()=>{if(mode==='playing')banner('NEW THREAT',list.map(t=>A[t].name).join(' + '),TIPS[list[0]]||'',4.4,'danger');},e.red?4600:e.modifier||rose?3200:2300);}break;}
  // The supply drop between holdout waves, paid for out of the credits earned so far in this run.
  case 'supplydrop':toast(e.legendary?'SUPPLY DROP / LEGENDARY CRATE: '+W[e.legendary].short+' · YOUR ANSWER TO THE '+A[e.boss].name:'SUPPLY DROP / '+keyLabel('interact')+' AT A CRATE TO SPEND THIS RUN\'S CREDITS',3.6);break;
  case 'bought':scene.audio.ui(e.legendary?'rank':'buy');toast(offerName(e)+' / −'+fmt(e.cost)+' CR',1.8);break;
  case 'laststand':toast((e.left===1?'LAST HOSTILE':'LAST '+e.left+' HOSTILES')+' / COMING FOR YOU · MARKED',2.4);break;
  case 'uplink':if(e.phase==='start')banner('SIDE OBJECTIVE','SUPPLY UPLINK','STAND BY IT TO SECURE IT · CREDITS, AMMUNITION AND ARMOUR · IT WILL NOT WAIT',3.2,'gold');else if(e.phase==='done')toast('UPLINK SECURED / +'+e.credits+' CR',2.4);else toast('UPLINK LOST',1.8);break;
  // An AI teammate's radio: what it has seen and what it is doing about it.
  case 'callout':toast((scene.names?.[e.who]||'PARTNER')+': '+e.text,2.2);break;
  case 'order':toast(ORDER_TEXT[e.order]||'',2);scene.audio.ui('select');break;
  case 'marked':if((e.who||'player')===myId())toast('YOU ARE MARKED / SHOOT DOWN THE SPOTTER DRONE',2.4);break;
  case 'shieldbreak':toast('THE '+A[e.enemy].name+'\'S BARRIER IS DOWN / POUR IT ON',2.2);break;
  case 'enemyrevive':if(performance.now()>reviveToast){reviveToast=performance.now()+20000;toast('A MEDIC IS BRINGING THEM BACK / KILL THE MEDIC',2.2);}break;
  case 'deny':scene.audio.ui('deny');break;
  // Stamina: run dry and the operator is winded; a roll asked for without the stamina flashes the bar.
  case 'winded':if((e.who||'player')===myId()){toast('WINDED / CATCH YOUR BREATH',1.6);scene.audio.noise(.5,{vol:.05,freq:650,q:.7,attack:.15});scene.audio.noise(.6,{vol:.04,freq:420,q:.6,attack:.05,delay:.55});}break;
  case 'nostamina':if((e.who||'player')===myId()){const v=$('stamina-bar').parentElement;v.classList.remove('refused');void v.offsetWidth;v.classList.add('refused');if(performance.now()-scene.audio.uiAt>250)scene.audio.ui('deny');}break;
  case 'dodge':if(!isGuest){slowUntil=performance.now()+260;toast('CLEAN DODGE / FLOW',1.2);if(drill)drill.dodged=true;}break;
  case 'armorbreak':toast('ARMOR BROKEN',1.4);break;case 'bossphase':toast('THE '+A[s.enemies.find(x=>x.id===e.id)?.type||'commander'].name+' IS ADAPTING',2);break;
  case 'flash':if((e.self&&(e.who||'player')===myId()||Array.isArray(e.blind)&&e.blind.includes(myId()))&&!settings.flash){$('flashout').style.transition='none';$('flashout').style.opacity='.85';requestAnimationFrame(()=>{$('flashout').style.transition='opacity 1.3s ease-out';$('flashout').style.opacity='0';});}break;
  // Squad play: one operator down is a setback, not the end. In holdout everyone is told who fell and what happens
  // next (tags, then the revive station); in team deathmatch only the operator it happened to hears about it.
  case 'down':case 'tags':case 'revive':case 'respawn':{const self=myId(),mine=e.who===self,other=BPCore.ops(s).find(o=>o.id!==self&&!o.vanished),mate=scene.names?.[mine?e.by||other?.id:e.who]||'YOUR SQUADMATE';
   if(e.tdm||e.type==='respawn'){if(mine&&e.type==='down')banner('OPERATOR DOWN',e.by&&e.by!==self?'KILLED BY '+(scene.names?.[e.by]||'THE ENEMY'):'YOU ARE DOWN','REDEPLOYING IN '+BPCore.TDM.respawn+' SECONDS',2.4,'danger');break;}
   if(e.type==='down')banner(mine?'OPERATOR DOWN':'SQUADMATE DOWN',mine?'YOU ARE DOWN':mate+' IS DOWN',mine?mate+' HAS TO CARRY YOUR DOG TAGS TO THE REVIVE STATION':'GRAB THEIR DOG TAGS / TAKE THEM TO THE REVIVE STATION',4.5,'danger');
   else if(e.type==='tags')toast(mine?mate+' HAS YOUR TAGS / HANG ON':'DOG TAGS RECOVERED / HOLD '+keyLabel('interact')+' AT THE REVIVE STATION',3);
   else{banner('REVIVED',mine?'BACK IN THE FIGHT':mate+' IS BACK IN THE FIGHT','',2.8,'gold');scene.audio.say('vo-on-your-feet',{rest:10});}
   if(e.type==='down'&&!mine)scene.audio.say('vo-mate-down',{cut:true,rest:20});break;}
  // Field support: the call that the meter is full, what has been called in, and its end.
  case 'supportready':if(SUP[e.key]){banner('FIELD SUPPORT',SUP[e.key].name+' READY',keyLabel('support')+' TO CALL IT IN',2.6,'gold',ICON('support',e.key));scene.audio.ui('rank');scene.audio.say('vo-support-ready',{rest:8});}break;
  // Your own call says what it did; in team deathmatch anyone else's is announced as friendly or enemy.
  case 'support':if(!SUP[e.key])break;if((e.who||'player')===myId())toast(SUP[e.key].name+({airstrike:' INBOUND / GET CLEAR',recon:' / EVERY HOSTILE MARKED',supply:' / AT YOUR FEET',reinforce:' AT YOUR SIDE',gunship:' ON STATION',blackout:' / EVERY HOSTILE BLINDED'}[e.key]||' DEPLOYED'),2.4);
   else if(s.tdm){const foe=s.roster.find(o=>o.id===e.who)?.team!==me(s).team;toast((foe?'ENEMY ':'FRIENDLY ')+SUP[e.key].name+(foe&&['airstrike','gunship','blackout','dog'].includes(e.key)?' / WATCH OUT':''),2.4);}break;
  case 'allygone':{const gone={turret:'SENTRY TURRET OFFLINE',dog:'K9 UNIT RECALLED',gunner:'REINFORCEMENT WITHDRAWN',gunship:'GUNSHIP OFF STATION',trophy:'TROPHY SYSTEM SPENT'}[e.kind];if(gone)toast(gone,1.6);break;}
  case 'secondwind':banner('SECOND WIND','STILL STANDING','THAT WAS YOUR ONE',2.4,'danger');if(!s.tdm)slowUntil=performance.now()+500;break;
  case 'death':case 'complete':end(e);break;}}
 // What happens to one operator - being hit, reloading, running dry - is seen and heard on that player's machine only.
 const OWN_ONLY=['damage','armorbreak','reload','reloadend','empty','swap','healstart','flow','nostamina','supportready','secondwind'],foreign=e=>OWN_ONLY.includes(e.type)&&(e.who||'player')!==myId();
 function drain(){if(!scene?.sim)return;const events=scene.sim.events.splice(0);
  // A run's last events are sent after one more world update, so every guest's debrief is drawn from the final state.
  if(netRole==='host'&&netConnected&&events.some(e=>e.type==='complete'||e.type==='death'))LINK.hostSend(JSON.stringify({type:'snapshot',payload:buildSnapshot(scene.sim)},NET_ROUND));
  if(netRole==='host'&&netConnected&&events.length)LINK.hostSend({type:'events',list:events});for(const e of events){if(foreign(e))continue;scene.renderer.event(e);scene.audio.event(e);onEvent(e);if(mode!=='playing'&&(e.type==='death'||e.type==='complete'))break;}}
 function formatTime(time){return Math.floor(time/60).toString().padStart(2,'0')+':'+Math.floor(time%60).toString().padStart(2,'0');}
 function minimap(s){const sx=148/s.map.width,sy=114/s.map.height;let svg='<svg viewBox="0 0 148 114" aria-label="Mission map">';for(const b of s.walls)if(!b.dead&&(b.kind==='building'||b.kind==='rock'))svg+=`<rect x="${b.x*sx}" y="${b.y*sy}" width="${b.w*sx}" height="${b.h*sy}" fill="${b.kind==='rock'?'#4f5a4c':'#68755e'}" opacity=".55"/>`;else if(!b.dead&&b.kind==='gate')svg+=`<rect x="${b.x*sx}" y="${b.y*sy}" width="${Math.max(1.5,b.w*sx)}" height="${Math.max(1.5,b.h*sy)}" fill="#d18c72"/>`;
  // In team deathmatch the map shows your own team, and an enemy only while they are firing, marked by recon or standing in your team's sensor ground.
  const own=me(s),mind=mineOf(s),seen=e=>s.tdm?e.shotAge<1.2||mind.recon>0||s.zones.some(z=>z.kind==='sensor'&&z.team===own.team&&BPCore.distance(z,e)<z.r):e.active&&BPCore.distance(e,own)<1000||s.recon>0||s.zones.some(z=>z.kind==='sensor'&&BPCore.distance(z,e)<z.r);
  for(const al of s.allies||[])if(!s.tdm||al.team===own.team)svg+=`<rect x="${al.x*sx-1.6}" y="${al.y*sy-1.6}" width="3.2" height="3.2" fill="#9fd08a"/>`;
  for(const e of foesOf(s))if(!e.dead&&!(e.gone>0)&&seen(e))svg+=`<circle cx="${e.x*sx}" cy="${e.y*sy}" r="${A[e.type].boss?2.6:1.4}" fill="#d18c72"/>`;if(!s.training&&!BPCore.arena(s))svg+=`<rect x="${s.goal.x*sx-2}" y="${s.goal.y*sy-2}" width="4" height="4" fill="none" stroke="#e2b074" stroke-width="1"/>`;
  if(s.station)svg+=`<path d="M${s.station.x*sx-3} ${s.station.y*sy}h6m-3-3v6" stroke="#9fd08a" stroke-width="1.4" fill="none"/>`;for(const q of s.tags||[])if(!q.carrier)svg+=`<circle cx="${q.x*sx}" cy="${q.y*sy}" r="2.2" fill="none" stroke="#e2b074" stroke-width="1.2"/>`;
  for(const mate of BPCore.ops(s))if(mate!==own&&!mate.dead&&!mate.vanished&&(!s.tdm||mate.team===own.team))svg+=`<circle cx="${mate.x*sx}" cy="${mate.y*sy}" r="2" fill="${mate.bot?'#9fb4bd':'#8fe3ff'}"/>`;svg+=`<circle cx="${own.x*sx}" cy="${own.y*sy}" r="2" fill="#e3e6c9"/></svg>`;return svg;}
 // Whose vitals and weapons the HUD shows: your own character, which for a guest is their seat in s.mates, not the host's s.player.
 function me(s){return netRole==='guest'&&s.mates[netSeat]||s.player;}
 // Team deathmatch: the operators on the other team from yours (everything that treats s.enemies as "the hostiles"
 // uses this instead), and your own context, where your score, combo, perks and field support are kept.
 const foesOf=s=>s.tdm?s.roster.filter(o=>o.team!==me(s).team):s.enemies,mineOf=s=>s.tdm&&me(s).ctx||s;
 // Who the camera follows: your own operator, or your squadmate while you are down and they are still fighting.
 function watch(s){const own=me(s);return own.dead&&BPCore.ops(s).find(o=>!o.dead&&!o.vanished&&(!s.tdm||o.team===own.team))||own;}
 // What X / E would do right now. Controller X reloads when this is empty.
 function context(){const s=scene.sim,p=s.tdm?me(s):s.player,st=BPCore.stageDef(s),own=me(s);
  // Co-op: standing on the revive station with a squadmate's tags turns interact into the revive hold.
  const carried=s.station&&(s.tags||[]).find(q=>q.carrier===own.id);if(carried&&!own.dead&&BPCore.distance(own,s.station)<=64)return {kind:'revive',label:'HOLD TO REVIVE '+(scene.names?.[carried.owner]||'SQUADMATE')};if(!s.training&&['clear','extract'].includes(st.kind)&&BPCore.distance(st,p)<90)return {kind:'interact',label:st.kind==='extract'?'EXTRACT':'INTERACT'};const offer=own===s.player?BPCore.nearbyOffer(s):null;if(offer)return {kind:'offer',label:'BUY '+offerName(offer)+' · '+fmt(offer.cost)+' CR'+(s.stats.credits<offer.cost?' / NEED '+fmt(offer.cost-s.stats.credits)+' MORE':''),weapon:offer.weapon||undefined};
  const gun=BPCore.nearbyWeapon(s);if(gun)return {kind:'weapon',label:'SWAP '+(W[gun.weapon].slot===0?'PRIMARY':'SECONDARY')+' FOR '+W[gun.weapon].short,weapon:gun.weapon};
  if(s.training&&s.pickups.some(o=>o.type==='supply'&&BPCore.distance(o,p)<100))return {kind:'interact',label:'RESUPPLY'};if(s.walls.some(b=>!b.dead&&b.low&&b.kind!=='underpass'&&BPCore.circleBox(p.x+Math.cos(p.angle)*48,p.y+Math.sin(p.angle)*48,35,b)||!b.dead&&b.low&&b.kind!=='underpass'&&BPCore.circleBox(p.x+p.vx*.2,p.y+p.vy*.2,35,b)))return {kind:'vault',label:'VAULT LOW COVER'};return null;}
 const MODIFIER_TEXT={blackout:'BLACKOUT · THE LIGHTS ARE OUT',armoured:'ARMOURED · EVERY HOSTILE IS PLATED',swarm:'SWARM · RUSHERS, AND A LOT OF THEM',marksmen:'MARKSMEN · STAY OUT OF THE OPEN'};
 const offerName=o=>o.item==='weapon'?W[o.weapon].short+(o.legendary?' · LEGENDARY':'')+' FOR THIS RUN':{ammo:'FULL AMMUNITION',armor:'+50 ARMOUR',health:'FULL HEALTH',stim:'ONE STIM',gadgets:'GADGET REFILL',sentry:'SENTRY TURRET',barricade:'FORTIFY / 3 BARRIERS',partner:'PARTNER KIT / REVIVE + REARM',hollow:'HOLLOW POINTS / +12% DAMAGE',charge:'FIELD SUPPORT CHARGE',repair:'REBUILD COVER',thermal:'THERMAL SCAN / NEXT WAVE'}[o.item]||'SUPPLIES';
 // Holdout: the threat level as a roman numeral and what each step up brings; and for every hostile, how to beat it -
 // shown when it first turns up in a run, under a red wave's banner, and on the debrief when it is what put you down.
 const THREAT=['I','II','III','IV','V','VI','VII'],THREAT_TEXT=['','THEY FIGHT FROM COVER NOW','FLANKERS, AND GRENADES FOR ANYONE WHO CAMPS','SUPPRESSING FIRE · THEY PUSH WHEN YOU RELOAD','THEY HUNT YOU DOWN · FLASHBANGS','SHARPER AIM, FASTER TRIGGERS','NO MERCY'];
 const TIPS={infantry:'Riflemen fight from cover in later waves. Flush them out with a grenade, or take the wall from the side.',rusher:'Rushers only hurt up close. Back off as you shoot, or meet them with a shotgun.',scout:'Scouts are quick and fragile. One good burst ends them.',breacher:'Breachers push in with a shotgun. Keep your distance.',drone:'Drones circle you. An EMP drops them all; so does a steady aim.',
  grenadier:'Grenadiers lob from behind cover. Watch the red rings and keep moving.',shield:'Shields stop rounds from the front. Flank them, or EMP the shield.',sniper:'Marksmen telegraph with a red line. Break line of sight before it fires.',medic:'Medics bring the fallen back. Kill the medic first.',bomber:'Bomb drones dive in and explode. Shoot them before they arrive.',
  gunner:'Machine gunners own a lane. Do not trade fire in the open: flank them, or use explosives.',mortar:'Mortar teams punish standing still. Keep moving, and hunt them down.',spotter:'A spotter drone marks you for everyone, walls or no walls. Shoot it down first.',heavy:'Juggernauts shrug off small arms and stagger. Use explosives, or keep moving and chip away.',elite:'Halcyon elites shoot fast and true. Fight them from cover.',
  engineer:'Engineers set up sentry guns. Stop them while they build.',rocketeer:'Rocketeers fire slow, heavy rockets. Sidestep, then punish the reload.',ghost:'Ghosts are near invisible until they strike. Keep your back covered.',jammer:'While a jammer lives your field support is offline. Find it and kill it.',turret:'Sentry guns cover a lane. Go round them, or EMP them.',
  commander:'The commander throws grenades and gets nastier as he bleeds. Explosives stagger him.',mech:'The Warden\'s barrier breaks under sustained fire: then pour it on. Rail slugs pass straight through it. Stay out of stomping range.',tank:'The tank\'s plating stops rifle rounds. Hit it from behind or with rockets, and get out of the line of its main gun when it glows.',wraith:'The Wraith blinks away after every shot. Watch for the red line and stay mobile.',apc:'The Bulwark is armoured: explosives, or an EMP for full damage.',
  raider:'Halcyon assault troopers lead their shots and wear plates. Break their aim with a flashbang, or come at them from two sides.',striker:'Pointmen push into your cover with SMGs. Hold a corner and meet them with a shotgun, or a knife out of a dive.',
  deadeye:'Sharpshooters laser before they fire. Smoke the lane, then close the distance: they cannot shoot on the move.',voss:'Voss hides behind a barrier fed by his generators. Break them, or EMP him, then keep moving when he starts to blink.'};
 const ORDER_TEXT={auto:'PARTNER / FREE TO ENGAGE',follow:'PARTNER / ON YOUR SHOULDER',hold:'PARTNER / HOLDING THIS POSITION'};let reviveToast=0;
 // Drawn over the battlefield every frame: an arrow at the screen edge for each hostile winding up an attack from
 // outside the view, and HUD panels that turn see-through while a hostile or the aim point is underneath them.
 const threatMarks=[],hudPanels={at:0,list:[]};let hintFor='',hintUntil=0;
 function overlay(){const s=scene.sim,cam=scene.cameras.main,v=cam.worldView,z=cam.zoom,cw=cam.width,ch=cam.height,own=watch(s),box=$('threats'),on=(x,y)=>({x:(x-v.x)*z,y:(y-v.y)*z}),c=on(own.x,own.y);let n=0;
  for(const e of s.enemies){if(n>=6)break;if(e.dead||!e.active||!(e.attack>0)||e.gone>0)continue;const q=on(e.x,e.y);if(q.x>=0&&q.x<=cw&&q.y>=0&&q.y<=ch)continue;
   let el=threatMarks[n];if(!el){el=threatMarks[n]=document.createElement('i');box.append(el);}n++;
   el.hidden=false;el.style.transform=`translate(${Math.max(34,Math.min(cw-34,q.x)).toFixed(0)}px,${Math.max(34,Math.min(ch-34,q.y)).toFixed(0)}px) rotate(${Math.atan2(q.y-c.y,q.x-c.x).toFixed(2)}rad)`;el.style.opacity=(.45+.55*Math.min(1,(e.attackAge||0)/e.attack)).toFixed(2);}
  for(let i=n;i<threatMarks.length;i++)threatMarks[i].hidden=true;
  const now=performance.now();if(now-hudPanels.at>500){hudPanels.at=now;hudPanels.list=[...document.querySelectorAll('#hud .hud-panel')].map(el=>({el,r:el.getBoundingClientRect()}));}
  const ptr=padActive?padPointer:scene.input.activePointer,pts=[{x:ptr.x,y:ptr.y},c];for(const e of s.enemies)if(!e.dead&&e.active&&!(e.gone>0))pts.push(on(e.x,e.y));
  for(const {el,r} of hudPanels.list)el.classList.toggle('seethrough',pts.some(q=>q.x>r.left-12&&q.x<r.right+12&&q.y>r.top-12&&q.y<r.bottom+12));}
 // Bootcamp: an optional walk through the basics - movement, shooting and gadgets - offered (never forced) from the
 // operations board the first time a save has no mission done and hasn't finished it yet (see renderOps). It launches
 // the training range with a step-by-step objective, can be left early from the pause menu, and is marked complete
 // only when every step is finished - leaving it early just means the board offers it again next time.
 const DRILL=[['MOVE',()=>'Use '+(padActive?'the left stick':[settings.bindings.up,settings.bindings.left,settings.bindings.down,settings.bindings.right].map(displayKey).join(' '))+' to move.',d=>d.moved>260],
  ['SPRINT',()=>'Hold '+keyLabel('sprint')+' while moving. Run the stamina bar dry and you are winded.',d=>d.sprint>.7],
  ['SLIDE',()=>'While sprinting, press '+keyLabel('slide')+'.',(d,p)=>p.state==='slide'],
  ['VAULT',()=>'Run at a low barricade and press '+keyLabel('interact')+'.',(d,p)=>p.state==='vault'],
  ['PERFECT FLOW',()=>'Sprint, slide, and vault the barricade while still sliding. A perfect flow refills stamina - and it is what an S rating asks for.',(d,p,s)=>s.stats.flows>d.flows],
  ['ROLL',()=>'Press '+keyLabel('roll')+' to roll. For a moment you cannot be hit.',(d,p)=>p.state==='roll'],
  ['DIVE',()=>'Sprint and press '+keyLabel('roll')+' to dive: further than a roll, and harder to recover from.',(d,p)=>p.state==='dive'],
  ['FIRE',()=>'Aim with '+(padActive?'the right stick':'the mouse')+' and shoot a target.',(d,p,s)=>s.stats.hits>d.hits],
  ['RELOAD',()=>'Press '+keyLabel('reload')+' to reload.',(d,p)=>p.reload>0],
  ['SWAP',()=>'Press '+keyLabel('swap')+' to switch to your sidearm.',(d,p)=>p.slot!==d.slot],
  ['KNIFE',()=>'Press '+keyLabel('melee')+' to knife; hold it for a heavy strike. A knife finishes anyone badly hurt.',(d,p)=>p.state==='melee'],
  ['DODGE',()=>'The marksman in LIVE FIRE warns with a red laser. When it lights, roll through the shot.',d=>d.dodged],
  ['GADGET',()=>'Press '+keyLabel('grenade')+' to throw a lethal gadget.',(d,p)=>p.grenades<d.grenades]];
 let drill=null;
 function startDrill(){if(!scene)return;run={mode:'training',mission:'range',difficulty:settings.difficulty,floor:settings.difficulty,deaths:0,drill:true};launch({mode:'training',mission:'range',difficulty:settings.difficulty,drill:true});
  const p=scene.sim.player;drill={step:0,moved:0,sprint:0,x:p.x,y:p.y,hits:0,slot:p.slot,grenades:p.grenades,flows:0,dodged:false,at:performance.now()};$('skip-drill').hidden=false;$('pause-copy').textContent='A quick bootcamp to learn the ropes. Skip it whenever you like.';
  $('mission-title').textContent='BOOTCAMP';$('chapter').textContent='FIELD TRAINING';$('retry').textContent='RESTART BOOTCAMP';
  banner('BEFORE YOU DEPLOY','BOOTCAMP',DRILL.length+' QUICK STEPS · '+(padActive?'START':'ESC')+' THEN SKIP TO LEAVE',3.4);}
 function drillHud(s,p){const d=drill,now=performance.now(),dt=Math.min(.25,(now-d.at)/1000);d.at=now;d.moved+=Math.hypot(p.x-d.x,p.y-d.y);d.x=p.x;d.y=p.y;if(p.state==='sprint')d.sprint+=dt;
  const [name,hint,done]=DRILL[d.step];$('objective').textContent='BOOTCAMP '+(d.step+1)+' / '+DRILL.length+' · '+name;$('objective-hint').textContent=hint();
  if(done(d,p,s)){scene.audio.ui('select');d.step++;d.hits=s.stats.hits;d.slot=p.slot;d.grenades=p.grenades;d.flows=s.stats.flows;d.dodged=false;d.moved=0;d.sprint=0;if(d.step>=DRILL.length)endDrill(true);else toast(name+' / DONE',1.2);}}
 function endDrill(finished){drill=null;$('skip-drill').hidden=true;const on=()=>{openOps();voiceAny('campaign');};
  if(!finished){scene.audio.resume();on();return;}save.drill=true;persist();banner('BOOTCAMP COMPLETE','READY TO DEPLOY','',2.2,'gold');debriefTimers.push(setTimeout(()=>{if(mode==='playing'&&run?.drill)on();},1900));}
 // An item's grade (1-5, or 0 for an empty slot) and its name: see Meta.rarity. Elements carry it as data-rar and the stylesheet colours them.
 const RAR=(kind,key)=>key?Meta.rarity(save,kind,key):0,RAR_TAG=(kind,key)=>`<i class="rar">${Meta.RARITY[RAR(kind,key)-1]||''}</i>`;
 const ICON=(kind,key)=>BPIcons.svg(kind,key),GEAR_SHORT={frag:'FRAG',incendiary:'INCENDIARY',mine:'PROX MINE',flash:'FLASHBANG',smoke:'SMOKE',emp:'EMP',decoy:'DECOY',cover:'COVER',knife:'KNIVES',cluster:'CLUSTER',c4:'C4',seeker:'SEEKER',grapple:'GRAPPLE',sensor:'SENSOR',gas:'TEAR GAS',trophy:'TROPHY',ammobox:'AMMO BOX'};
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
  if(st.kind==='extraction'){const X=s.extract,lz=X.called;$('objective').textContent=lz?'HOLD THE LANDING ZONE · '+Math.max(0,Math.ceil(X.need-X.hold))+'s':X.found<X.total?'CACHES '+X.found+' / '+X.total+' · LOOT '+fmt(X.loot)+' CR':'ALL CACHES TAKEN · GET TO THE LANDING ZONE';
   $('objective-hint').textContent=lz?'Stay in the zone until the bird arrives. Leaving stops the count. Loot on board: '+fmt(X.loot)+' CR.':'Each cache is worth more than the last. Reach the landing zone whenever you choose: die first and the loot is lost.';}
  if(st.kind==='trial'){const T=s.trial;$('objective').textContent=(T.started?'GATE '+Math.min(T.next,T.gates.length-1)+' / '+(T.gates.length-1)+' · ':'LEAVE THE START GATE · ')+T.time.toFixed(2)+'s';
   $('objective-hint').textContent='Targets '+T.hit+' / '+T.targets.length+' (+3 s each missed) · perfect flows '+T.flows+' (−0.5 s each)'+(scene.ghost?' · racing your best':'');}
  const prog=st.kind==='destroy'||st.kind==='survive'||st.kind==='endless'||st.kind==='extraction'||st.kind==='trial';$('objective-progress').hidden=!prog;if(prog)$('objective-fill').style.width=(st.kind==='endless'?(s.director.phase==='rest'?100:0):(s.progress||0)*100)+'%';if(st.kind==='survive')$('objective-hint').textContent=`${Math.max(0,Math.ceil(st.time-s.director.clock))}s remaining · ${st.hint}`;if(st.kind==='endless'){const d=s.director,resting=d.phase==='rest'&&d.wave>0,wait=Math.max(1,Math.ceil(d.timer||0)),u=d.uplink;
   $('objective').textContent=resting?((d.wave+1)%5===0?`Wave ${d.wave} cleared · RED WAVE in ${wait}s`:`Wave ${d.wave} cleared · next wave in ${wait}s`):d.wave?`${d.red?'RED WAVE':'Wave'} ${d.wave} · threat ${THREAT[d.tier||0]}${d.modifier?' · '+BPCore.MODIFIERS[d.modifier]:''} · ${s.enemies.filter(e=>!e.dead&&!e.built).length+s.spawnWarnings.length+(d.queue?.length||0)} hostiles`:'Get ready';
   if(resting)$('objective-hint').textContent='Supply drop: '+keyLabel('interact')+' at a crate to spend this run\'s credits.'+(s.mates.some(m=>m.bot)?' '+keyLabel('order')+' gives your partner orders.':'');
   else if(d.wave){const status=[s.jammed?'SIGNAL JAMMED · field support offline':'',s.spotted>0?'YOU ARE MARKED':'',u&&u.x!==undefined&&!u.done?'Uplink '+Math.round(u.progress*100)+'% · '+Math.max(0,Math.ceil(u.until-s.time))+'s':''].filter(Boolean);$('objective-hint').textContent=status.join(' · ')||(d.red?TIPS[d.bosses?.[0]]||'':'Hold out.');}}
  // A red wave: the edges of the screen pulse red until it is cleared.
  document.body.classList.toggle('red-wave',st.kind==='endless'&&!!s.director.red&&s.director.phase==='fight'&&!s.dead);
  // Team deathmatch: the score rides over the battlefield, and the objective line says how the match stands.
  const T=s.tdm;$('score').hidden=!T;$('killfeed').hidden=!T;$('hud').classList.toggle('versus',!!T);$('hud').classList.toggle('objective-mode',!!T&&!!T.rules&&T.rules!=='tdm');$('hud').classList.toggle('learning',!!s.training);if(T){const secs=Math.max(0,Math.ceil(T.left??T.time)),t=p.team?1:0,us=T.score[t],them=T.score[1-t],lead=us-them;$('score-us').textContent=us;$('score-them').textContent=them;$('score-us-name').textContent=t?'DELTA':'ALPHA';$('score-them-name').textContent=t?'ALPHA':'DELTA';
   feedRows=feedRows.filter(r=>r.until>now);setHtml($('killfeed'),feedRows.map(r=>'<p>'+r.html+'</p>').join(''));$('score-time').textContent=formatTime(secs);$('score-limit').textContent='FIRST TO '+T.limit;$('score').classList.toggle('late',secs<=30);
   if(!T.rules||T.rules==='tdm')tdmVoice(T,us,them);
   $('objective').textContent=p.dead?'You are down':!lead?'Level at '+us:lead>0?'Your team leads by '+lead:'Your team trails by '+(-lead);$('objective-hint').textContent=p.dead?'Redeploying in '+Math.max(1,Math.ceil(p.respawn||0))+'s.':'First team to '+T.limit+' kills wins. Everyone redeploys after going down.';
   if(T.rules&&T.rules!=='tdm')versusHud(s,T,p,t);}
  // Holdout with someone down: the objective line says what has to happen next, for whichever side of it you are on.
  const fallen=!T&&s.station&&!s.dead?(s.tags||[]).find(q=>p.dead?q.owner===p.id:true):null;
  if(fallen){const other=BPCore.ops(s).find(o=>o!==p&&!o.vanished),mate=scene.names?.[p.dead?fallen.carrier||other?.id:fallen.owner]||'Your squadmate',held=!!fallen.carrier;
   if(p.dead){$('objective').textContent='You are down';$('objective-hint').textContent=held?mate+' has your dog tags and is heading for the revive station.':mate+' has to pick up your dog tags and carry them to the revive station.';}
   else{$('objective').textContent=held?'Carry the tags to the revive station':'Recover '+mate+"'s dog tags";$('objective-hint').textContent=held?'Follow the green marker, then hold '+keyLabel('interact')+' on the pad for '+BPCore.REVIVE_TIME+' seconds.':'Follow the amber marker to where they fell.';}$('objective-progress').hidden=true;}
  // Commander call-outs for your own state, each on the moment it begins: health dropping into the red, and a gun running completely dry.
  const hurtNow=!p.dead&&p.health>0&&p.health<30,dryNow=!p.dead&&p.ammo[key]===0&&p.reserve[key]===0;if(hurtNow&&!voiceHurt)scene.audio.say('vo-low-health',{rest:45});if(dryNow&&!voiceDry)scene.audio.say('vo-dry',{rest:30});voiceHurt=hurtNow;voiceDry=dryNow;
  // The hint under the objective is shown for a few seconds whenever the objective changes, and for as long as it is
  // counting something down or the operator is down; otherwise the objective stands alone.
  {const line=$('objective').textContent;if(line!==hintFor){hintFor=line;hintUntil=now+7000;}$('hud').querySelector('.mission-hud').classList.toggle('quiet',now>hintUntil&&!drill&&!p.dead&&!fallen&&st.kind!=='survive'&&!(st.kind==='endless'&&s.director.phase==='rest'));}
  $('health-number').textContent=Math.ceil(p.health);$('health-bar').style.width=p.health+'%';$('health-bar').style.background=p.health<30?'#d18b70':'#d3ddbb';$('armor-bar').style.width=Math.min(100,p.armor/p.maxArmor*100)+'%';$('stamina-bar').style.width=p.stamina+'%';$('stamina-bar').parentElement.classList.toggle('winded',!!p.winded);$('armor').textContent=Math.ceil(p.armor);
  // Field support: its meter under the vitals, and the key that calls it in once it is full. Only the lobby leader carries one.
  const mind=mineOf(s),q=mind.support,sr=$('support-row');sr.hidden=!q||!T&&p!==s.player;if(!sr.hidden){$('support-name').textContent=SUP[q.key].short;$('support-bar').style.width=(q.ready?100:q.charge/q.cost*100).toFixed(1)+'%';sr.classList.toggle('ready',q.ready);$('support-key').textContent=q.ready?keyLabel('support'):Math.floor(q.charge/q.cost*100)+'%';}
  gearHud(s);
  weaponHud(s);
  $('state-label').textContent=p.dead?'DOWN':p.stagger>0?'STUNNED':p.heal>0?'HEALING':p.reload>0?'RELOADING':p.state==='idle'?'READY':p.state.toUpperCase();$('elapsed').textContent=formatTime(s.time);$('net-ping').hidden=!(lobby?.inRun&&lobby.ping!=null);if(lobby?.ping!=null)$('net-ping').textContent=lobby.quiet?'NO SIGNAL':'PING '+lobby.ping+' MS';$('flow').textContent=mind.flowTime>0?'PERFECT FLOW':'';$('minimap').innerHTML=minimap(s);
  $('run-credits').textContent=s.training?'RANGE':fmt(mind.stats.credits||0)+' CR';const combo=now<comboUntil&&mind.combo>=2;$('combo-mult').textContent=combo?'×'+mind.combo+' COMBO':'';$('combo').classList.toggle('hot',combo);
  const boss=s.boss&&s.enemies.find(e=>e.id===s.boss);$('boss').hidden=!boss;document.body.classList.toggle('boss-up',!!boss);if(boss){const t=A[boss.type];$('boss-name').textContent=t.name;$('boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';$('boss-note').textContent=t.barrier?(boss.barrierOff?'BARRIER DESTROYED':boss.shieldDown>0?'BARRIER DOWN · '+Math.ceil(boss.shieldDown)+'s':boss.shieldMax?'BARRIER '+Math.round(boss.shieldHp/boss.shieldMax*100)+'% · BREAK IT, EMP IT, OR RAIL IT':'BARRIER UP · BREAK A GENERATOR OR EMP IT'):t.rear?(boss.disabled>0?'SYSTEMS DOWN · FULL DAMAGE':'FRONT ARMOUR · HIT THE REAR OR USE ROCKETS'):t.armor?(boss.disabled>0?'SYSTEMS DOWN · FULL DAMAGE':'HEAVY ARMOUR · EXPLOSIVES'):t.blink?'RELOCATES AFTER EVERY SHOT':'';}
  const c=context();$('interact-prompt').hidden=!c;if(c){$('interact-prompt').querySelector('kbd').textContent=keyLabel('interact');$('interact-prompt').querySelector('span').textContent=c.label;}$('interact-prompt').classList.toggle('has-art',!!c?.weapon);setArt($('prompt-art'),'weapon',c?.weapon||null);
  if(s.time>radioUntil)$('radio').hidden=true;if(now>toastUntil)$('toast').style.opacity='0';pumpBanner();scene.audio.pressure(s.director.pressure);
  document.body.classList.toggle('downed',!!p.dead&&!s.dead);const hurt=mode==='playing'&&p.health<35&&!s.dead&&!p.dead?1-p.health/35:0,el=$('danger');el.style.opacity=hurt?(.35+.6*hurt).toFixed(2):p.heal>0?'0':'0';el.classList.toggle('pulse',!!hurt&&!settings.flash);el.style.setProperty('--beat',(.45+.7*(p.health/35)).toFixed(2)+'s');document.body.classList.toggle('healing',p.heal>0);scene.audio.vitals(p.health,mode==='playing'&&!s.dead&&!p.dead);if(drill)drillHud(s,p);
 }
 function bindButton(list,label,value,listening,prompt,pick){const button=document.createElement('button');button.type='button';button.innerHTML=`<span>${label}</span><b>${listening?prompt:value}</b>`;button.classList.toggle('listening',listening);button.addEventListener('click',pick);list.append(button);return button;}
 // The controls section of the settings has two tabs, each with a picture above its list of actions: the keyboard and
 // mouse, and the controller - drawn as an Xbox pad when one is plugged in, otherwise as a PlayStation pad (also for a
 // pad of unknown make, and when there is none). The list is how a binding is changed with a keyboard or a controller;
 // the picture shows where everything is, and with a mouse a key or button on it can be clicked instead. KEY_TAGS are
 // the short names that fit on a key cap.
 const KEY_TAGS={up:'UP',down:'DOWN',left:'LEFT',right:'RIGHT',sprint:'SPRINT',roll:'ROLL',slide:'SLIDE',interact:'USE',reload:'RELOAD',swap:'SWAP',gadget:'STIM',melee:'MELEE',grenade:'LETHAL',tactical:'TAC',support:'SUPPORT',slot1:'PRIMARY',slot2:'SECOND',order:'ORDER'};
 const padArt=()=>pad.brand==='xbox'?'xbox':'ps',actionOn=(table,value)=>Object.keys(table).find(k=>table[k]===value);
 let controlsTab='keys';
 function bindings(){const list=$('bindings'),padList=$('pad-bindings'),b=settings.bindings,pb=settings.padBindings,art=padArt(),glyph=BPGamepad.glyphs[art],held=document.activeElement?.dataset||{},keep=held.action?'#bindings [data-action="'+held.action+'"]':held.padAction?'#pad-bindings [data-pad-action="'+held.padAction+'"]':null;
  list.replaceChildren();padList.replaceChildren();
  for(const [key,label] of Object.entries(labels))bindButton(list,label,displayKey(b[key]),bindingTarget===key,'PRESS KEY',()=>{bindingTarget=key;padBindingTarget=null;bindings();}).dataset.action=key;
  for(const key of Object.keys(BPSave.padBindings))bindButton(padList,padActionLabel(key),glyph[pb[key]],padBindingTarget===key,'PRESS BUTTON',()=>{padBindingTarget=key;bindingTarget=null;bindings();}).dataset.padAction=key;
  $('keys-art').innerHTML=BPControls.keyboard({bound:Object.fromEntries(Object.entries(b).map(([action,code])=>[code,KEY_TAGS[action]||action.toUpperCase()])),fixed:{Escape:'PAUSE'},listening:bindingTarget?b[bindingTarget]:null,mouse:{left:'FIRE',right:'STEADY AIM',wheel:'SWAP WEAPON',move:'AIM'}});
  // On the controller the two sticks and the pause button keep their own jobs; a stick can also be pressed like a button.
  // The picture's call-outs are small: a few actions go by a shorter name there than in the list.
  const does=Object.fromEntries(Object.entries(pb).map(([action,name])=>[name,({order:'Order'}[action]||padActionLabel(action)).toUpperCase()]));
  $('pad-art').innerHTML=BPControls.pad(art,{labels:{...does,start:'PAUSE',ls:'MOVE'+(does.ls?' · PRESS: '+does.ls:''),rs:'AIM'+(does.rs?' · PRESS: '+does.rs:'')},glyphs:{...glyph,ls:'L STICK',rs:'R STICK'},bound:Object.keys(does),fixed:['start'],listening:padBindingTarget?pb[padBindingTarget]:null});
  $('pad-art-note').textContent=!pad.name?'NO CONTROLLER FOUND · SHOWING A PLAYSTATION PAD':pad.brand==='generic'?'UNKNOWN MAKE · SHOWING A PLAYSTATION PAD':'SHOWING YOUR '+(BPGamepad.brandName[pad.brand]||'CONTROLLER');
  $('keys-art').classList.toggle('picking',!!bindingTarget);$('pad-art').classList.toggle('picking',!!padBindingTarget);
  for(const tab of ['keys','pad']){$('tab-'+tab).setAttribute('aria-selected',String(controlsTab===tab));$('controls-'+tab).hidden=controlsTab!==tab;}
  if(keep)$('settings').querySelector(keep)?.focus({preventScroll:true});
  strip();menuHint();}
 // A new key or button for the action that is waiting for one. Whatever already had it takes the old one in exchange.
 function assignKey(code){const b=settings.bindings,old=b[bindingTarget],other=actionOn(b,code);if(other)b[other]=old;b[bindingTarget]=code;bindingTarget=null;bindings();persist();}
 function assignPad(name){if(!BPSave.padButtons.includes(name))return;const b=settings.padBindings,old=b[padBindingTarget],other=actionOn(b,name);if(other)b[other]=old;b[padBindingTarget]=name;padBindingTarget=null;bindings();persist();}
 function showSettings(){if(mode==='playing')pause();for(const id of ['difficulty','volume','shake','quality','textScale','palette','sprintMode','aimMode'])$(id).value=String(settings[id]);for(const id of ['music','voice','flash','gamepad','aimAssist'])$(id).checked=settings[id];controlsTab=settings.gamepad&&pad.name?'pad':'keys';padStatus();bindings();$('settings').showModal();$('settings').querySelector('button,select,input')?.focus({preventScroll:true});}
 function settingsChanged(){settings.difficulty=$('difficulty').value;settings.volume=Number($('volume').value);settings.shake=Number($('shake').value);settings.music=$('music').checked;settings.voice=$('voice').checked;settings.flash=$('flash').checked;settings.gamepad=$('gamepad').checked;settings.aimAssist=$('aimAssist').checked;settings.quality=$('quality').value;settings.textScale=Number($('textScale').value);settings.palette=$('palette').value;settings.sprintMode=$('sprintMode').value;settings.aimMode=$('aimMode').value;sprintLatch=aimLatch=false;applyAccess();padStatus();
  if(scene){scene.settings=settings;if(scene.sim&&['playing','paused'].includes(mode)&&run&&!run.challenge){scene.sim.difficulty=settings.difficulty;if(DIFFS.indexOf(settings.difficulty)<DIFFS.indexOf(run.floor||run.difficulty))run.floor=settings.difficulty;if(save.run&&run.mode==='campaign')save.run.floor=run.floor;}scene.audio.settings=settings;scene.audio.stopAmbient();if(mode==='playing')scene.audio.startAmbient(scene.sim.map.theme);score();backdrop();}if(mode==='ops')renderOps();if(mode==='lobby'&&lobby&&lobby.role!=='guest'&&lobby.difficulty!==settings.difficulty){lobby.difficulty=settings.difficulty;lobbyChanged();}persist();}
 // Picking a mode on the main menu gets a word from the commander about what you have just chosen.
 $('continue').addEventListener('click',()=>{openOps();voiceAny('campaign');});$('skip-drill').addEventListener('click',()=>endDrill(false));$('ops-bootcamp-start').addEventListener('click',()=>startDrill());
 if(!save.intelInit){Meta.intelBackfill(save);persist();}
 $('menu-notice').hidden=!save.notice;$('menu-notice-ok').addEventListener('click',()=>{save.notice='';persist();$('menu-notice').hidden=true;$('continue').focus();});$('training').addEventListener('click',()=>{startTraining();voiceAny('range');});$('holdout').addEventListener('click',()=>{openLobby('solo');voiceAny(lobby?.mode||'holdout');});$('armory-button').addEventListener('click',()=>openArmory('weapons',null,'menu'));
 $('deploy').addEventListener('click',()=>startMission(selected,false));$('resume-run').addEventListener('click',()=>startMission(selected,true));$('ops-armory').addEventListener('click',()=>openArmory('weapons',null,'ops'));$('ops-settings').addEventListener('click',showSettings);$('ops-back').addEventListener('click',menu);
 $('armory-back').addEventListener('click',armoryBack);for(const b of $('armory-tabs').children)b.addEventListener('click',()=>{armoryTab=b.dataset.tab;armoryItem=null;renderArmory();});
 $('picker-close').addEventListener('click',()=>$('picker').close());
 $('pause-button').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('retry').addEventListener('click',retry);$('exit').addEventListener('click',menu);$('ending-menu').addEventListener('click',menu);$('ending-retry').addEventListener('click',()=>{if(mode==='complete'&&run.mode==='campaign'){startMission(run.mission,false);}else retry();});
 $('ending-next').addEventListener('click',()=>{const meta=missionMeta(run.mission),next=MISSIONS[meta.n];if(next)openOps(next.id);});$('ending-armory').addEventListener('click',()=>openArmory('weapons',null,lobby?'lobby':'menu'));
 // Squad lobby controls. The callsign is cleaned as it is typed and announced to the squad once the field is left.
 $('lobby-go').addEventListener('click',lobbyGo);$('lobby-map').addEventListener('click',()=>{if(lobby&&lobby.role!=='guest')openHoldoutPicker('lobby');});$('teams').addEventListener('click',teamClick);$('lobby-records').addEventListener('click',teamClick);$('lobby-records').addEventListener('click',e=>{const c=e.target.closest('[data-course]');if(!c||!lobby||lobby.mode!=='trials')return;settings.trialDaily=c.dataset.course==='1';persist();scene.audio.ui('tick');renderLobby();});$('view-challenges').addEventListener('click',()=>{scene.audio.ui('select');openChallenges();});$('challenges-close').addEventListener('click',()=>closeChallenges());$('challenges').addEventListener('cancel',e=>{e.preventDefault();closeChallenges();});$('challenges').addEventListener('click',e=>{if(e.target===$('challenges')){closeChallenges();return;}const c=e.target.closest('[data-challenge]');if(c){scene.audio.ui('select');$('challenges').close();startChallenge(c.dataset.challenge);}});$('brief-extra').addEventListener('click',e=>{const b=e.target.closest('[data-mutator]');if(!b||b.disabled)return;const k=b.dataset.mutator;if(opsMutators.has(k))opsMutators.delete(k);else opsMutators.add(k);scene.audio.ui('select');renderOps();document.querySelector('[data-mutator="'+k+'"]')?.focus();});$('op-peer').addEventListener('click',e=>{if(e.target.closest('[data-fill]')){lobbyFill();return;}const b=e.target.closest('[data-link]');if(b&&lobby?.role==='solo'){scene.audio.ui('select');openLobby(b.dataset.role,lobby.map,b.dataset.link,lobby.mode);}});$('lobby-armory').addEventListener('click',()=>openArmory('weapons',null,'lobby'));$('lobby-settings').addEventListener('click',showSettings);$('lobby-leave').addEventListener('click',lobbyBack);
 $('lobby-copy').addEventListener('click',()=>{const b=$('lobby-copy'),done=ok=>{b.textContent=ok?'COPIED':'COPY FAILED';setTimeout(()=>{b.textContent='COPY';},1400);};try{navigator.clipboard.writeText(lobby.link==='online'?lobby.code:lobby.addresses[0]).then(()=>done(true),()=>done(false));}catch{done(false);}});
 const isEnter=e=>e.code==='Enter'||e.code==='NumpadEnter';
 $('lobby-connect').addEventListener('click',lobbyConnect);$('lobby-ip').addEventListener('keydown',e=>{if(isEnter(e))lobbyConnect();});$('lobby-send').addEventListener('click',lobbySay);$('lobby-chat').addEventListener('keydown',e=>{if(isEnter(e))lobbySay();});
 $('lobby-callsign').addEventListener('input',e=>{const el=e.target,at=el.selectionStart,clean=el.value.toUpperCase().replace(/[^A-Z0-9 _-]/g,'');if(clean!==el.value){el.value=clean;el.setSelectionRange(at,at);}});
 $('lobby-callsign').addEventListener('change',e=>{settings.callsign=BPSave.callsign(e.target.value)||callsign();e.target.value=settings.callsign;persist();renderLobby();lobbySync();});$('lobby-callsign').addEventListener('keydown',e=>{if(isEnter(e))e.target.blur();});
 // QUIT is only there in the desktop app. It asks twice: the first press arms it for a few seconds, the second closes the game.
 let quitTimer=0;
 function quitArmed(on){clearTimeout(quitTimer);const b=$('quit-button');b.classList.toggle('armed',on);b.textContent=on?'PRESS AGAIN TO QUIT':'QUIT';if(on)quitTimer=setTimeout(()=>quitArmed(false),4000);}
 $('quit-button').hidden=!DESKTOP;$('desktop-note').hidden=!DESKTOP;$('quit-button').addEventListener('click',()=>{if(!DESKTOP)return;if(!$('quit-button').classList.contains('armed')){quitArmed(true);return;}DESKTOP.quit();});
 $('settings-button').addEventListener('click',showSettings);$('pause-settings').addEventListener('click',showSettings);$('settings').addEventListener('close',()=>{bindingTarget=padBindingTarget=null;settingsChanged();});$('settings').addEventListener('cancel',()=>{bindingTarget=padBindingTarget=null;});for(const id of ['difficulty','volume','shake','quality','textScale','palette','sprintMode','aimMode','music','voice','flash','gamepad','aimAssist'])$(id).addEventListener('change',settingsChanged);
 for(const tab of ['keys','pad'])$('tab-'+tab).addEventListener('click',()=>{controlsTab=tab;bindingTarget=padBindingTarget=null;bindings();});
 // Clicking a key or a button on a picture: while an action is waiting, that is its new place; otherwise it picks the action that is there.
 $('keys-art').addEventListener('click',e=>{const cap=e.target.closest('[data-key]');if(!cap||cap.classList.contains('fixed'))return;if(bindingTarget){assignKey(cap.dataset.key);return;}const action=actionOn(settings.bindings,cap.dataset.key);if(action){bindingTarget=action;padBindingTarget=null;bindings();}});
 $('pad-art').addEventListener('click',e=>{const call=e.target.closest('[data-pad]');if(!call||call.classList.contains('fixed'))return;if(padBindingTarget){assignPad(call.dataset.pad);return;}const action=actionOn(settings.padBindings,call.dataset.pad);if(action){padBindingTarget=action;bindingTarget=null;bindings();}});
 // Pointing at an action in a list (or moving the controller's focus onto it) lights its place on the picture, and
 // pointing at a place on the picture lights its action in the list.
 for(const [listId,artId,isPad] of [['bindings','keys-art',false],['pad-bindings','pad-art',true]]){const table=()=>isPad?settings.padBindings:settings.bindings,place=value=>isPad?'[data-pad="'+value+'"]':'[data-key="'+value+'"]',entry=action=>isPad?'[data-pad-action="'+action+'"]':'[data-action="'+action+'"]';
  for(const [type,on] of [['mouseover',true],['mouseout',false],['focusin',true],['focusout',false]])$(listId).addEventListener(type,e=>{const button=e.target.closest('button'),value=button&&table()[isPad?button.dataset.padAction:button.dataset.action];if(value)for(const n of $(artId).querySelectorAll(place(value)))n.classList.toggle('hot',on);});
  for(const [type,on] of [['mouseover',true],['mouseout',false]])$(artId).addEventListener(type,e=>{const spot=e.target.closest(isPad?'[data-pad]':'[data-key]');if(!spot)return;const value=isPad?spot.dataset.pad:spot.dataset.key,action=actionOn(table(),value);for(const n of $(artId).querySelectorAll(place(value)))n.classList.toggle('hot',on);if(action)$(listId).querySelector(entry(action))?.classList.toggle('hot',on);});}
 $('reset-bindings').addEventListener('click',()=>{settings.bindings={...BPSave.bindings};settings.padBindings={...BPSave.padBindings};bindingTarget=padBindingTarget=null;bindings();persist();});$('sound').addEventListener('click',()=>{settings.muted=!settings.muted;$('sound').textContent=settings.muted?'SOUND OFF':'SOUND ON';persist();if(scene){scene.audio.unlock();scene.audio.stopAmbient();if(mode==='playing')scene.audio.startAmbient(scene.sim.map.theme);score();}});$('sound').textContent=settings.muted?'SOUND OFF':'SOUND ON';strip();menuHint();
 const option=(sel,value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;$(sel).append(o);};
 for(const [key,w] of Object.entries(W))option('range-weapon',key,w.name);for(const [key,g] of Object.entries(G))option(g.slot==='lethal'?'range-lethal':'range-tactical',key,g.name);
 $('range-weapon').addEventListener('change',()=>{if(!scene.sim?.training)return;const key=$('range-weapon').value,p=scene.sim.player;p.slots[W[key].slot]=key;p.slot=W[key].slot;p.reload=0;hud();});
 for(const kind of ['lethal','tactical'])$('range-'+kind).addEventListener('change',()=>{if(!scene.sim?.training)return;scene.sim.player[kind]=$('range-'+kind).value;hud();});
 window.addEventListener('keydown',e=>{if(padActive)setPadActive(false);if(padBindingTarget&&e.code==='Escape'){e.preventDefault();padBindingTarget=null;bindings();return;}if(bindingTarget){e.preventDefault();if(e.code==='Escape'){bindingTarget=null;bindings();return;}if(!e.repeat)assignKey(e.code);return;}if($('settings').open||$('picker').open||$('challenges').open)return;
  if(mode==='lobby'&&e.target instanceof HTMLInputElement){if(e.code==='Escape')e.target.blur();return;}
  if(e.code==='Escape'){e.preventDefault();if(mode==='playing')pause();else if(mode==='paused')resume();else if(mode==='ops'||mode==='lobby'){scene.audio.ui('back');if(mode==='lobby')lobbyBack();else menu();}else if(mode==='armory'){scene.audio.ui('back');armoryBack();}else if(mode==='dead'||mode==='complete'){scene.audio.ui('back');menu();}return;}if(mode!=='playing')return;if(Object.values(settings.bindings).includes(e.code)){e.preventDefault();if(!held.has(e.code))pressed.add(e.code);held.add(e.code);}}, {passive:false});
 window.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',()=>{clearInput();if(!hosting())pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(!hosting())pause();}});window.addEventListener('pagehide',()=>{if(scene){scene.audio.destroy();scene.game.destroy(true);}});
 window.addEventListener('wheel',e=>{if(mode==='playing'&&Math.abs(e.deltaY)>4)wheelSwap=true;},{passive:true});
 window.addEventListener('pointermove',e=>{if(padActive&&Math.hypot(e.movementX,e.movementY)>3)setPadActive(false);});window.addEventListener('pointerdown',()=>{if(padActive)setPadActive(false);});
 window.addEventListener('gamepadconnected',()=>{padStatus();if($('settings').open)bindings();if(settings.gamepad&&mode==='playing')toast((BPGamepad.brandName[pad.brand]||'CONTROLLER')+' CONNECTED');});window.addEventListener('gamepaddisconnected',()=>{padStatus();if($('settings').open)bindings();if(padActive&&mode==='playing')pause();});
 function menuRoot(){return $('picker').open?$('picker'):$('challenges').open?$('challenges'):$(mode==='paused'?'pause':['dead','complete'].includes(mode)?'ending':mode);}
 // Picks whichever other button actually sits in the pressed direction on screen (by its bounding box), not just the
 // next one in markup order - so a real 2D layout like the main menu's mode cards steers the way it looks, instead of
 // down behaving exactly like right. Candidates behind the press, or too far off to the side of it, are ignored;
 // among what is left, the closest one wins. Returns null if nothing qualifies, so callers can fall back.
 function focusDirection(buttons,dirX,dirY){const cur=document.activeElement;if(!buttons.includes(cur))return null;
  const a=cur.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,bestScore=Infinity;
  for(const b of buttons){if(b===cur)continue;const r=b.getBoundingClientRect(),dx=r.left+r.width/2-ax,dy=r.top+r.height/2-ay,primary=dx*dirX+dy*dirY;if(primary<=1)continue;
   const perp=Math.abs(dx*dirY-dy*dirX);if(perp>primary*1.5+40)continue;const score=primary+perp*2;if(score<bestScore){bestScore=score;best=b;}}
  return best;}
 function padMenu(state){const root=menuRoot(),header=$('picker').open||$('challenges').open?[]:[$('sound'),$('settings-button'),$('quit-button')],buttons=[...root.querySelectorAll('button,input[type="text"]'),...header].filter(b=>b&&b.offsetParent!==null&&!b.disabled),at=buttons.indexOf(document.activeElement),flickY=Math.abs(state.move.y)>.6?Math.sign(state.move.y):0,flickX=Math.abs(state.move.x)>.6?Math.sign(state.move.x):0;
  let vdir=Number(state.tap.has('down'))-Number(state.tap.has('up'));if(flickY!==padMenuStick){padMenuStick=flickY;vdir=vdir||flickY;}
  let hdir=Number(state.tap.has('right'))-Number(state.tap.has('left'));if(flickX!==padMenuStickX){padMenuStickX=flickX;hdir=hdir||flickX;}
  if(mode==='armory'&&!$('picker').open&&(state.tap.has('lb')||state.tap.has('rb'))){const tabs=[...$('armory-tabs').children].map(b=>b.dataset.tab);armoryTab=tabs[(tabs.indexOf(armoryTab)+(state.tap.has('rb')?1:tabs.length-1))%tabs.length];armoryItem=null;renderArmory();$('armory-list').querySelector('button')?.focus();return;}
  // ...and the triggers step through the gun categories, or between lethal and tactical gadgets.
  if(mode==='armory'&&armoryTab==='intel'&&!$('picker').open&&(state.tap.has('lt')||state.tap.has('rt'))){const ids=['all','1','2','3','4','5'];armoryIntel=ids[(ids.indexOf(armoryIntel)+(state.tap.has('rt')?1:ids.length-1))%ids.length];armoryItem=null;scene.audio.ui('tick');renderArmory();$('armory-list').querySelector('button')?.focus();return;}
  if(mode==='armory'&&['weapons','gear'].includes(armoryTab)&&!$('picker').open&&(state.tap.has('lt')||state.tap.has('rt'))){const gearTab=armoryTab==='gear',ids=['all',...(gearTab?GEAR_CATS:CATS).map(c=>c.id)],next=ids[(ids.indexOf(gearTab?armoryGear:armoryCat)+(state.tap.has('rt')?1:ids.length-1))%ids.length];if(gearTab)armoryGear=next;else armoryCat=next;armoryItem=null;scene.audio.ui('tick');renderArmory();$('armory-list').querySelector('button')?.focus();return;}
  if(state.tap.has('b')){if($('picker').open||$('challenges').open||['paused','ops','lobby','armory','dead','complete'].includes(mode))scene.audio.ui('back');if($('picker').open)$('picker').close();else if($('challenges').open)closeChallenges();else if(mode==='paused')resume();else if(mode==='lobby')lobbyBack();else if(mode==='ops')menu();else if(mode==='armory')armoryBack();else if(mode==='dead'||mode==='complete')menu();return;}
  if(at<0){if(vdir||hdir||state.tap.has('a'))buttons[0]?.focus();return;}
  // The armory is a list with the chosen item's buttons beside it: right goes from an item to its own BUY / EQUIP,
  // up and down step between those buttons, and left comes back to the item. Left to the general rule, right found
  // a tab instead, and leaving the buttons landed on (and so selected) whichever item happened to be level with them.
  if(mode==='armory'&&!$('picker').open&&(hdir||vdir)){const cur=document.activeElement,acts=[...$('armory-detail').querySelectorAll('.ad-actions button')],inActs=acts.includes(cur),
    // Up and down step through the item's actions even when they sit side by side (then in reading order); right moves along a row of them, left goes back to the list.
    step=d=>acts[Math.max(0,Math.min(acts.length-1,acts.indexOf(cur)+d))],to=inActs?(vdir?focusDirection(acts,0,vdir)||(step(vdir)!==cur?step(vdir):null):hdir<0?(focusDirection(acts,-1,0)||$('armory-list').querySelector('.active')):focusDirection(acts,1,0)):hdir>0&&!vdir&&cur.closest('#armory-list')?acts[0]:null;
   if(to){to.focus();to.scrollIntoView({block:'nearest'});}if(to||inActs){if(state.tap.has('a'))cur.click();return;}}
  if(vdir||hdir){
   // A geometric neighbor in the pressed direction wins when there is one; otherwise this steps through markup order
   // (wrapping at the ends), which is the only thing that still matters for the plain single-column lists most
   // other screens use, and is exactly how this already behaved before direction-aware navigation existed.
   const next=(vdir&&focusDirection(buttons,0,vdir))||(hdir&&focusDirection(buttons,hdir,0))||buttons[(at+(vdir||hdir)+buttons.length)%buttons.length];
   next.focus();next.scrollIntoView({block:'nearest'});
  }
  if(state.tap.has('a'))buttons[at].click();}
 // Full controller navigation for the settings dialog: up/down moves between every control (buttons, selects,
 // checkboxes, ranges); left/right adjusts the focused control's value when it has one, otherwise also navigates.
 function padSettings(state){
  if(padBindingTarget){if(state.tap.has('start')){padBindingTarget=null;bindings();return;}
   const name=[...state.tap].find(n=>n!=='start');if(name)assignPad(name);
   return;}
  if(bindingTarget)return;
  if(state.tap.has('b')||state.tap.has('start')){$('settings').close();return;}
  const fields=[...$('settings').querySelectorAll('button,select,input')].filter(el=>el.offsetParent!==null&&!el.disabled),at=fields.indexOf(document.activeElement);
  const flick=Math.abs(state.move.y)>.6?Math.sign(state.move.y):0,flickX=Math.abs(state.move.x)>.6?Math.sign(state.move.x):0;
  let vdir=Number(state.tap.has('down'))-Number(state.tap.has('up'));if(flick!==padMenuStick){padMenuStick=flick;vdir=vdir||flick;}
  let hdir=Number(state.tap.has('right'))-Number(state.tap.has('left'));if(flickX!==padMenuStickX){padMenuStickX=flickX;hdir=hdir||flickX;}
  if(at<0){if(vdir||hdir||state.tap.has('a'))fields[0]?.focus();return;}
  // The controller cannot switch itself off: that would leave a player holding only a controller with no way to switch it
  // back on. The Controller setting is changed with the mouse or keyboard, and says so.
  const field=fields[at],own=field.id==='gamepad',adjustable=!own&&(field.tagName==='SELECT'||field.type==='range'||field.type==='checkbox');
  if(own&&(hdir||state.tap.has('a'))){scene?.audio.ui('deny');$('gamepad-status').textContent='USE THE MOUSE OR KEYBOARD TO TURN THE CONTROLLER OFF';return;}
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
  if(mode!=='playing'){if(!window.BPIntro?.active)padMenu(state);return;}
  padState=state;const pb=settings.padBindings,p=me(scene.sim),aimHeld=state.down.has(pb.aim),stick=state.aim.len?Math.atan2(state.aim.y,state.aim.x):null;for(const [action,name] of Object.entries(pb))if(state.tap.has(name))padTaps.add(action);
  // Aim assist: pressing steady aim locks onto the best target the gun is roughly facing; pulling the stick away switches target or releases.
  if(!aimHeld||!settings.aimAssist)padLock=null;else if(state.tap.has(pb.aim))padLock=assistTarget(padAngle);
  if(padLock){padLockLost=BPCore.lineOfSight(scene.sim,p,padLock)?0:padLockLost+dt;if(padLock.dead||padLock.gone>0||padLockLost>.35)padLock=null;else if(stick!==null&&Math.abs(wrapAngle(stick-Math.atan2(padLock.y-p.y,padLock.x-p.x)))>ASSIST_BREAK)padLock=assistTarget(stick);}
  if(padLock){padTarget=Math.atan2(padLock.y-p.y,padLock.x-p.x);padAimIdle=0;}else if(stick!==null){padTarget=stick;padAimIdle=0;}else{padAimIdle+=dt;if(padAimIdle>.8&&state.move.len&&!state.down.has(pb.fire)&&!aimHeld)padTarget=Math.atan2(state.move.y,state.move.x);}
  padAngle+=wrapAngle(padTarget-padAngle)*(1-Math.exp(-dt*(padLock?ASSIST_TURN:PAD_TURN)));padReach+=((padLock?Math.max(60,BPCore.distance(p,padLock)):PAD_REACH)-padReach)*(1-Math.exp(-dt*18));}
 function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
 function assistTarget(angle){const s=scene.sim,p=me(s),view=scene.cameras.main.worldView;let best=null,bestScore=Infinity;padLockLost=0;
  for(const e of foesOf(s)){if(e.dead||e.gone>0||!view.contains(e.x,e.y)||!BPCore.lineOfSight(s,p,e))continue;const off=Math.abs(wrapAngle(Math.atan2(e.y-p.y,e.x-p.x)-angle)),score=off+BPCore.distance(p,e)/3000;if(off<ASSIST_CONE&&score<bestScore){best=e;bestScore=score;}}
  return best;}
 const padPointer={get x(){const cam=scene.cameras.main,p=me(scene.sim);return p.x+Math.cos(p.angle)*padReach-cam.midPoint.x+cam.width/2;},get y(){const cam=scene.cameras.main,p=me(scene.sim);return p.y+Math.sin(p.angle)*padReach-cam.midPoint.y+cam.height/2;}};
 function input(){const b=settings.bindings,pb=settings.padBindings,g=padState,down=key=>held.has(b[key])||!!g&&g.down.has(pb[key]),tap=key=>pressed.has(b[key])||padTaps.has(key);
  let mx=Number(down('right'))-Number(down('left')),my=Number(down('down'))-Number(down('up')),aimX,aimY;if(g&&g.move.len&&!mx&&!my){mx=g.move.x;my=g.move.y;}
  if(padActive){const p=me(scene.sim);aimX=p.x+Math.cos(padAngle)*padReach;aimY=p.y+Math.sin(padAngle)*padReach;}else{const pointer=scene.input.activePointer,world=scene.cameras.main.getWorldPoint(pointer.x,pointer.y);aimX=world.x;aimY=world.y;}
  let interact=tap('interact'),reload=tap('reload');if(padTaps.has('interact')&&!pressed.has(b.interact)&&!context()){interact=false;reload=true;}
  const swap=tap('swap')||wheelSwap;wheelSwap=false;const pl=me(scene.sim);
  if(padTaps.has('cycle')){const next=padGadget==='lethal'?'tactical':'lethal';if(pl[next]){padGadget=next;scene.audio.ui('select');toast('GADGET · '+GEAR_SHORT[pl[next]],1);}else toast(next==='lethal'?'NO LETHAL EQUIPPED':'NO TACTICAL EQUIPPED',1.2);}
  const deploy=padTaps.has('grenade')&&!pressed.has(b.grenade),grenade=pressed.has(b.grenade)||deploy&&padGadget==='lethal',tactical=pressed.has(b.tactical)||deploy&&padGadget==='tactical',other=padGadget==='lethal'?pl.tactical&&pl.tacticals:pl.lethal&&pl.grenades,hint=deploy&&other?' / '+keyLabel('cycle')+' SWITCHES GADGET':'';
  if(grenade&&!(pl.lethal&&pl.grenades)&&!(pl.lethal==='c4'&&scene.sim.mines.some(m=>m.remote)))toast((pl.lethal?'NO '+GEAR_SHORT[pl.lethal]+' LEFT':'NO LETHAL EQUIPPED')+hint,1.6);if(tactical&&!(pl.tactical&&pl.tacticals))toast((pl.tactical?'NO '+GEAR_SHORT[pl.tactical]+' LEFT':'NO TACTICAL EQUIPPED')+hint,1.6);if(tap('gadget')&&!pl.stims)toast('NO STIMS LEFT / FIND A MEDKIT',1.4);
  // Sprint and steady aim can be toggles (settings): a press latches them, and a sprint latch lets go when the operator
  // stops moving; a steady-aim latch when it is pressed again.
  const moving=Math.hypot(mx,my)>.2;if(settings.sprintMode==='toggle'){if(tap('sprint'))sprintLatch=!sprintLatch;if(!moving)sprintLatch=false;}
  const aimHeld=mouseAim||!!g&&g.down.has(pb.aim);if(settings.aimMode==='toggle'){if(aimHeld&&!aimWas)aimLatch=!aimLatch;}aimWas=aimHeld;
  return {mx,my,support:tap('support'),sprint:settings.sprintMode==='toggle'?sprintLatch:down('sprint'),roll:tap('roll'),slide:tap('slide'),interact,reload,swap,gadget:tap('gadget'),melee:tap('melee'),meleeDown:down('melee'),interactDown:down('interact'),grenade,tactical,fire:mouseFire||!!g&&g.down.has(pb.fire),aiming:settings.aimMode==='toggle'?aimLatch:mouseAim||!!g&&g.down.has(pb.aim),aimX,aimY,slot:tap('slot1')?0:tap('slot2')?1:undefined,order:tap('order')};}
 // An error inside a frame must not escape it: Phaser only asks for the next frame once this one has returned, so a
 // single bad frame would otherwise freeze the game for good. The error is reported (the desktop app keeps console
 // errors in its log), and a run that fails three frames running is given up for the main menu with a message.
 let faults=0,faultAt=0,faultsShown=0;
 function fault(err){if(faultsShown++<20)console.error(err);const now=performance.now();faults=now-faultAt<1000?faults+1:1;faultAt=now;if(faults<3||!['playing','paused'].includes(mode))return;faults=0;const wasGuest=netRole==='guest';
  try{menu();}catch(e){console.error(e);netRole='solo';lobby=null;LINK=null;setMode('menu');}
  toast(wasGuest?'THE HOST SENT DATA THIS COPY COULD NOT USE / RETURNED TO THE MAIN MENU':'SOMETHING WENT WRONG IN THAT RUN / RETURNED TO THE MAIN MENU',7);}
 class FieldScene extends Phaser.Scene {
  constructor(){super('field');}
  preload(){this.load.on('progress',v=>{$('load-bar').style.width=Math.round(v*100)+'%';window.BPIntro?.progress(v);});this.load.on('loaderror',file=>{if(this.loadFailed)return;this.loadFailed=true;window.BPIntro?.abort();$('load-text').textContent=location.protocol==='file:'?'CANNOT RUN FROM A LOCAL FILE / RUN "NPM RUN SERVE" THEN OPEN HTTP://127.0.0.1:8127/BLACKOUT-PROTOCOL.HTML':'ASSET LOAD FAILED: '+file.key+' / REFRESH TO RETRY';});BPRender.preload(this);BPAudio.preload(this);}
  create(){scene=this;this.settings=settings;this.renderer=new BPRender(this);applyAccess();this.audio=new BPAudio(this,settings);this.accumulator=0;this.cameras.main.setZoom(1.03);this.game.canvas.tabIndex=0;this.game.canvas.setAttribute('aria-label','Top-down battlefield. Use WASD to move, mouse to aim, and left click to fire, or a controller: left stick to move, right stick to aim, right trigger to fire, Y to swap weapons.');this.input.mouse.disableContextMenu();this.input.on('pointerdown',pointer=>{if(mode!=='playing')return;this.audio.unlock();if(pointer.button===0)mouseFire=true;if(pointer.button===2)mouseAim=true;});this.input.on('pointerup',pointer=>{if(pointer.button===0)mouseFire=false;if(pointer.button===2)mouseAim=false;});this.game.canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('pointerup',e=>{if(e.button===0)mouseFire=false;if(e.button===2)mouseAim=false;});if(!this.loadFailed)$('loading').hidden=true;updateContinue();document.body.dataset.phase='menu';
   // Behind the opening nothing is drawn: the game sleeps and the menu's backdrop stays still until the hand-over.
   const covered=!!window.BPIntro?.active;if(covered)this.game.loop.sleep();else backdrop();window.BPIntro?.loaded();(window.BPIntro||{then:fn=>fn()}).then(()=>{if(covered){this.game.loop.wake();backdrop();}this.audio.unlock();score();greet();});
   const inspect=()=>({mode,camera:{scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY,zoom:this.cameras.main.zoom,width:this.cameras.main.width,height:this.cameras.main.height,originX:this.cameras.main.originX,originY:this.cameras.main.originY},world:JSON.parse(JSON.stringify({map:this.sim.map,walls:this.sim.walls,player:this.sim.player,guest:this.sim.guest,mates:this.sim.mates,tdm:this.sim.tdm,allies:this.sim.allies,support:this.sim.support,perks:this.sim.perks,recon:this.sim.recon,tags:this.sim.tags,station:this.sim.station,enemies:this.sim.enemies,stage:this.sim.stage,goal:this.sim.goal,time:this.sim.time,completed:this.sim.completed,dead:this.sim.dead,stats:this.sim.stats,hazards:this.sim.hazards,grenades:this.sim.grenades,pickups:this.sim.pickups,difficulty:this.sim.difficulty,spawnWarnings:this.sim.spawnWarnings,zones:this.sim.zones,director:this.sim.director,progress:this.sim.progress,mission:this.sim.mission,training:this.sim.training}))});
   if(new URLSearchParams(location.search).has('qa'))window.BPQA={sim:()=>this.sim,camera:()=>this.cameras.main,end:e=>end(e),settle:()=>Meta,save};
   const lobbyInfo=()=>lobby&&{mode:lobby.mode,fill:lobby.fill,seat:lobby.seat,players:lobby.role==='host'?lobby.peers.length+1:lobby.role==='guest'?lobby.squad.filter(q=>!q.bot).length+1:1,squad:isVs(lobby.mode)?seatsView(lobby):lobby.role==='guest'?lobby.squad:lobbySquad(lobby),limit:lobby.limit,support:lobby.support,mySeat:lobby.role==='guest'?lobby.mySeat:lobby.seats?.indexOf('host'),link:lobby.link,code:lobby.code,ping:lobby.ping,role:lobby.role,phase:lobby.phase,map:lobby.map,difficulty:lobby.difficulty,ready:lobby.ready,peer:lobby.peer,counting:lobby.countdown>0,inRun:lobby.inRun};
   window.BPApp={inspect,snapshot:()=>this.sim?{mode,lobby:lobbyInfo(),training:this.sim.training,mission:this.sim.mission,time:this.sim.time,stage:this.sim.stage,health:this.sim.player.health,armor:this.sim.player.armor,stamina:this.sim.player.stamina,x:this.sim.player.x,y:this.sim.player.y,state:this.sim.player.state,weapon:this.sim.player.slots[this.sim.player.slot],slots:[...this.sim.player.slots],ammo:this.sim.player.ammo[this.sim.player.slots[this.sim.player.slot]],reload:this.sim.player.reload,stims:this.sim.player.stims,grenades:this.sim.player.grenades,tacticals:this.sim.player.tacticals,kills:this.sim.stats.kills,flows:this.sim.stats.flows,credits:this.sim.stats.credits,activeEnemies:this.sim.enemies.filter(e=>!e.dead&&e.active).length,projectiles:this.sim.projectiles.filter(p=>p.active).length,particles:this.renderer.particles.filter(p=>p.active).length,danger:Number($('danger').style.opacity||0),iconTextures:this.textures.getTextureKeys().filter(k=>/^[wgp]:/.test(k)).length,audioUnlocked:this.audio.unlocked,audioContext:this.sound.context?.state,averageFps:this.game.loop.actualFps,save:JSON.parse(JSON.stringify(save))}:{mode,lobby:lobbyInfo(),save:JSON.parse(JSON.stringify(save))}};
  }
  update(time,delta){try{this.tick(time,delta);}catch(err){fault(err);}}
  tick(time,delta){let dt=Math.min(delta/1000,.05);pollPad(dt);if(mode!=='playing'||!this.sim)return;
   if(netRole==='guest'){guestFrame(this.sim,dt);
    this.renderer.update(this.sim,dt,padActive?padPointer:this.input.activePointer,watch(this.sim));if(scene.ghost)this.renderer.drawGhost(scene.ghost.sim,dt);overlay();
    if(time-lastHud>70){lastHud=time;hud();}return;}
   const now=performance.now();timeScale+=((now<slowUntil?.32:1)-timeScale)*Math.min(1,dt*(now<slowUntil?14:5));dt*=timeScale;this.accumulator+=dt;
   let frameInput=input();if(netRole==='host'){
    // A guest whose input stops arriving (paused, or a stalled connection) stands still instead of running on with its last order.
    // Single presses count once, on the step after they arrive, however many frames pass before the next input does.
    const now=performance.now();frameInput={...frameInput,mates:netInputs.map(q=>{if(!q)return null;if(now-q.at>800)q.input={...q.input,mx:0,my:0,sprint:false,fire:false,meleeDown:false,interactDown:false};
     const held=q.fresh?q.input:untap(q.input);q.fresh=false;return held;})};}
   let steps=0;while(this.accumulator>=BPCore.DT&&steps<7&&mode==='playing'){if(scene.record&&run?.mode==='trials'&&!this.sim.completed)scene.record.push(ghostFrame(this.sim,frameInput));BPCore.step(this.sim,frameInput);if(scene.ghost)stepGhost();this.accumulator-=BPCore.DT;steps++;pressed.clear();padTaps.clear();
    frameInput={...frameInput,support:false,roll:false,slide:false,interact:false,reload:false,swap:false,gadget:false,melee:false,grenade:false,tactical:false,slot:undefined,
      mates:frameInput.mates&&frameInput.mates.map(q=>q&&untap(q))};}
   drain();
   if(netRole==='host'&&netConnected){netBroadcastAt-=dt;if(netBroadcastAt<=0){netBroadcastAt=lobby?.link==='online'?1/20:1/30;LINK.hostSend(JSON.stringify({type:'snapshot',payload:buildSnapshot(this.sim)},NET_ROUND));}}
   if(mode==='playing'||mode==='dead')this.renderer.update(this.sim,dt,padActive?padPointer:this.input.activePointer,watch(this.sim));if(mode==='playing')overlay();if(time-lastHud>70&&mode==='playing'){lastHud=time;hud();}}
 }
 function renderType(){const choice=new URLSearchParams(location.search).get('renderer');if(choice==='canvas')return Phaser.CANVAS;if(choice==='webgl')return Phaser.WEBGL;
  try{const testCanvas=document.createElement('canvas'),gl=testCanvas.getContext('webgl',{failIfMajorPerformanceCaveat:true});if(!gl)return Phaser.CANVAS;const ext=gl.getExtension('WEBGL_debug_renderer_info'),name=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'';const software=/swiftshader|llvmpipe|software/i.test(name);gl.getExtension('WEBGL_lose_context')?.loseContext();return software?Phaser.CANVAS:Phaser.AUTO;}catch{return Phaser.CANVAS;}}
 // The opening (intro.js) says when loading may begin, so that it never competes with the film's busiest shots.
 const startGame=()=>{try{new Phaser.Game({type:renderType(),parent:'game',backgroundColor:'#252d24',scene:FieldScene,scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},render:{antialias:true,pixelArt:false,roundPixels:false,powerPreference:'high-performance'},fps:{target:60,forceSetTimeOut:false},audio:{disableWebAudio:false},input:{keyboard:false}});}catch(err){window.BPIntro?.abort();$('load-text').textContent='COULD NOT INITIALIZE THE GAME. PLEASE REFRESH.';console.error(err);}};
 (window.BPIntro||{boot:fn=>fn()}).boot(startGame);
})();

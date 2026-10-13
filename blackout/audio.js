(function(root){'use strict';
 const files=['footstep-concrete-0.ogg','footstep-concrete-1.ogg','footstep-wood.ogg','footstep-snow-0.ogg','footstep-snow-1.ogg','metal.ogg','body.ogg','wood.ogg','glass.ogg','explosion.ogg','rumble.ogg','boom.ogg','radio.ogg','reload-rifle.wav','reload-pistol.wav','reload-shotgun.wav','pistol.ogg','rifle.ogg','shotgun.ogg','smg.ogg','laser.ogg','laser-large.ogg','forcefield.ogg','door.ogg','bell.ogg','plate.ogg','punch.ogg','points.ogg','healthpack.ogg','empty.ogg','pickup.ogg','heal.ogg','flow.ogg','wind.ogg','ambience.ogg','vo-welcome.ogg','vo-mission.ogg','vo-stay-sharp.ogg','vo-watch-six.ogg','vo-move-out.ogg',
  // Generated in the same voice (see blackout/tools/voice/): orders, direction between fights, and the quiet moments.
  'vo-hostiles.ogg','vo-contact.ogg','vo-boss.ogg','vo-hold.ogg','vo-low-health.ogg','vo-dry.ogg','vo-mate-down.ogg','vo-on-your-feet.ogg','vo-objective.ogg','vo-failed.ogg','vo-squad.ogg','vo-range.ogg','vo-area-clear.ogg','vo-quiet.ogg','vo-complete.ogg','vo-armory.ogg','vo-mode-holdout.ogg','vo-mode-campaign.ogg',
  // More ways of announcing each mode, and the commander's word on every gun (vo-w-<weapon>) and gadget (vo-g-<gadget>) as it is bought or equipped.
  'vo-mode-holdout-2.ogg','vo-mode-holdout-3.ogg','vo-mode-holdout-4.ogg','vo-mode-campaign-2.ogg','vo-mode-campaign-3.ogg','vo-mode-campaign-4.ogg','vo-range-2.ogg','vo-range-3.ogg',
  'vo-w-rifle.ogg','vo-w-shotgun.ogg','vo-w-pistol.ogg','vo-w-smg.ogg','vo-w-marksman.ogg','vo-w-battle.ogg','vo-w-precision.ogg','vo-w-lmg.ogg','vo-w-autoshotgun.ogg','vo-w-launcher.ogg','vo-w-pulse.ogg','vo-w-rail.ogg','vo-w-machinepistol.ogg','vo-w-magnum.ogg','vo-w-sawedoff.ogg','vo-w-thumper.ogg','vo-w-rocket.ogg',
  'vo-g-frag.ogg','vo-g-incendiary.ogg','vo-g-mine.ogg','vo-g-flash.ogg','vo-g-smoke.ogg','vo-g-emp.ogg','vo-g-decoy.ogg','vo-g-cover.ogg',
  // Team deathmatch on the lobby's mode switch, and the commander's word on each map (vo-map-<map>) as it is picked there.
  'vo-mode-tdm.ogg','vo-mode-tdm-2.ogg','vo-map-killhouse.ogg','vo-map-crash.ogg','vo-map-ruins.ogg','vo-map-kestrel.ogg','vo-map-underground.ogg','vo-map-convoy.ogg','vo-map-meridian.ogg',
  // Field support: the call that the meter is full, and the commander's word on each ability (vo-s-<id>) and perk (vo-p-<id>) as it is bought or equipped.
  'vo-support-ready.ogg','vo-s-recon.ogg','vo-s-turret.ogg','vo-s-dog.ogg','vo-s-airstrike.ogg','vo-p-regen.ogg','vo-p-flak.ogg','vo-p-secondwind.ogg','vo-p-scrounger.ogg','vo-p-ambusher.ogg','vo-p-executioner.ogg','vo-p-lowprofile.ogg','vo-p-flowstate.ogg','vo-p-hardline.ogg',
  // Call-outs for what the player has just done (kill streaks, a knife kill, a perfect flow, a boss down) and for how a team deathmatch stands.
  'vo-streak-double.ogg','vo-streak-double-2.ogg','vo-streak-triple.ogg','vo-streak-heat.ogg','vo-streak-unstoppable.ogg','vo-streak-blackout.ogg','vo-knife.ogg','vo-flow.ogg','vo-boss-down.ogg','vo-tdm-lead.ogg','vo-tdm-behind.ogg','vo-tdm-close.ogg',
  // The second wave of the armory: five guns, nine gadgets and four more field support calls.
  'vo-w-burst.ogg','vo-w-ricochet.ogg','vo-w-flamer.ogg','vo-w-minigun.ogg','vo-w-arc.ogg','vo-g-knife.ogg','vo-g-cluster.ogg','vo-g-c4.ogg','vo-g-seeker.ogg','vo-g-grapple.ogg','vo-g-sensor.ogg','vo-g-gas.ogg','vo-g-trophy.ogg','vo-g-ammobox.ogg','vo-s-supply.ogg','vo-s-reinforce.ogg','vo-s-gunship.ogg','vo-s-blackout.ogg'];
 // Per-theme ambience bed (sample, volume, rate) layered under the drone score.
 const BEDS={city:[['wind',.035,.7],['ambience',.055,.7]],ruins:[['wind',.05,.55],['ambience',.05,.6]],snow:[['wind',.09,.45]],subway:[['ambience',.07,.45],['wind',.02,1.3]],desert:[['wind',.07,.85]],facility:[['ambience',.06,.9],['wind',.02,1.6]],range:[['wind',.035,.7],['ambience',.055,.7]]};
 const MUSIC='blackout/assets/audio/menu-music.mp3',MUSIC_VOLUME=.5;
 // How each gun sounds from far off on the title screen: [recording, loudness, pitch]. A heavier gun is louder and deeper.
 const FAR={rifle:['rifle',1,.92],battle:['rifle',1.2,.72],marksman:['rifle',1.35,.6],precision:['rifle',1.4,.54],lmg:['rifle',.95,.8],smg:['smg',.9,1],machinepistol:['smg',.8,1.14],
  pistol:['pistol',.95,.92],magnum:['pistol',1.3,.66],shotgun:['shotgun',1.45,.82],sawedoff:['shotgun',1.5,.72],autoshotgun:['shotgun',1.3,.92],pulse:['laser',.7,.9]};
 class Audio {
  constructor(scene,settings){this.scene=scene;this.settings=settings;this.pools=new Map();this.step=0;this.ambience=[];this.nodes=[];this.unlocked=false;this.beatAt=0;this.breathAt=0;this.vitalsOn=false;this.lastWhiz=0;this.uiAt=0;this.voice=null;this.voices=new Map();this.rested={};this.duckUntil=0;
   // Menu score state. Browsers refuse to start sound before the first click or key press, so a refused start is retried on the next one.
   this.track=null;this.musicOn=false;this.musicBlocked=false;this.fadeTimer=0;
   // It also goes quiet whenever the window is hidden or another window has focus, like the rest of the game's sound.
   this.onGesture=()=>{if(this.musicBlocked){this.musicBlocked=false;this.music(this.musicOn);}};this.onVisibility=()=>{if(this.away)this.track?.pause();else this.music(this.musicOn);};
   window.addEventListener('pointerdown',this.onGesture);window.addEventListener('keydown',this.onGesture);document.addEventListener('visibilitychange',this.onVisibility);window.addEventListener('blur',this.onVisibility);window.addEventListener('focus',this.onVisibility);}
  get away(){return document.hidden||!document.hasFocus();}
  static preload(scene){for(const file of files)scene.load.audio(file.split('.')[0],'blackout/assets/audio/'+file);}
  unlock(){if(this.scene.sound.context?.state==='suspended')this.scene.sound.context.resume().catch(()=>{});this.scene.sound.unlock();this.unlocked=true;}
  get live(){return this.unlocked&&!this.settings.muted&&this.settings.volume>0;}
  play(key,volume=.5,rate=1,x=null,y=null){if(!this.live||!this.scene.cache.audio.exists(key))return;
   let pool=this.pools.get(key);if(!pool){pool=Array.from({length:['rifle','pistol','smg','laser'].includes(key)?6:3},()=>this.scene.sound.add(key));this.pools.set(key,pool);}const voice=pool.find(v=>!v.isPlaying);if(!voice)return;
   const p=this.scene.sim?.player;let attenuation=1,pan=0;if(p&&x!==null){const d=Math.hypot(x-p.x,y-p.y);attenuation=Math.max(0,1-d/1100);pan=Math.max(-1,Math.min(1,(x-p.x)/500));}
   if(attenuation<.02)return;voice.play({volume:Math.min(1,volume*this.settings.volume*attenuation),rate,pan});
  }
  // The title screen's battle, heard from a few streets away: the game's own gunfire and explosions, quiet, pitched
  // down and through a low-pass filter. Each kind of gun has a voice of its own (FAR: which recording, how loud, how
  // deep), so a mixed firefight sounds like one. Every explosion is heard but not every shot (about three in four),
  // and never two from the same kind of gun close together, so it is a texture behind the score and not a rhythm; it
  // drops further while the commander is speaking. Like the rest of the sound it needs the effects volume up, sound
  // on and the window in front.
  distant(e){const ctx=this.scene.sound.context,now=performance.now(),boom=e.type==='explosion';if(e.type!=='shot'&&!boom)return false;
   if(!this.live||this.away||!ctx||ctx.state!=='running'||typeof ctx.createBufferSource!=='function'||(this.farLive||0)>=7)return false;
   const voice=boom?['explosion',1.7,.78]:FAR[e.weapon]||FAR.rifle,key=voice[0],at=this.farAt||(this.farAt={});
   if(!boom){if(now<(at[e.weapon]||0)||Math.random()<.25)return false;at[e.weapon]=now+90+Math.random()*130;}
   const buf=this.scene.cache.audio.get(key);
   if(!buf||typeof buf.getChannelData!=='function')return false;
   const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),t=ctx.currentTime,level=.1*voice[1]*this.settings.volume*(now<this.duckUntil?.35:1)*(.8+Math.random()*.4);
   src.buffer=buf;src.playbackRate.value=voice[2]*(.96+Math.random()*.08);f.type='lowpass';f.frequency.value=boom?480:700+Math.random()*450;f.Q.value=.4;g.gain.value=level;
   // A little to one side or the other, as a street away would be.
   let out=g;if(typeof ctx.createStereoPanner==='function'){out=ctx.createStereoPanner();out.pan.value=Math.random()*1.2-.6;g.connect(out);}
   src.connect(f).connect(g);out.connect(ctx.destination);this.farLive=(this.farLive||0)+1;src.onended=()=>{this.farLive--;src.disconnect();f.disconnect();g.disconnect();if(out!==g)out.disconnect();};src.start(t);return true;}
  // Small Web Audio synth for interface feedback, heartbeat and breathing. Silent when the sound manager has no Web Audio context.
  tone(freq,dur=.12,{type='sine',vol=.08,to=null,attack=.004,delay=0}={}){const ctx=this.scene.sound.context;if(!this.live||!ctx||ctx.state!=='running')return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*this.settings.volume,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur+.02);}
  noise(dur=.3,{vol=.05,freq=900,q=1,type='bandpass',attack=.02,delay=0,sweep=null}={}){const ctx=this.scene.sound.context;if(!this.live||!ctx||ctx.state!=='running')return;const t=ctx.currentTime+delay,len=Math.ceil(ctx.sampleRate*dur),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
   const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buf;f.type=type;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+dur);f.Q.value=q;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*this.settings.volume,t+attack);g.gain.linearRampToValueAtTime(0,t+dur);src.connect(f).connect(g).connect(ctx.destination);src.start(t);src.stop(t+dur+.02);}
  // Menu navigation adds hover (landing on a control), back and launch. uiAt lets it tell that a control has just made
  // its own sound, so the two never double up (see the navigation sounds in game.js).
  ui(kind){this.uiAt=performance.now();switch(kind){
   case 'hover':this.tone(1250,.04,{type:'triangle',vol:.022});break;case 'back':this.tone(540,.1,{type:'triangle',vol:.04,to:350});break;
   case 'launch':this.tone(392,.16,{type:'triangle',vol:.05});this.tone(587,.2,{type:'triangle',vol:.05,delay:.07});this.tone(784,.3,{type:'triangle',vol:.045,delay:.14});break;
   case 'tick':this.tone(1400,.05,{type:'square',vol:.025});break;case 'total':this.tone(523,.18,{type:'triangle',vol:.07});this.tone(784,.32,{type:'triangle',vol:.07,delay:.09});break;
   case 'rank':[523,659,784,1046].forEach((f,i)=>this.tone(f,.42,{type:'triangle',vol:.08,delay:i*.11}));this.play('bell',.4,1.2);break;case 'medal':this.tone(880,.25,{type:'triangle',vol:.06});this.tone(1320,.35,{type:'sine',vol:.05,delay:.07});break;
   case 'buy':this.play('points',.5,1);this.tone(660,.12,{type:'square',vol:.03});this.tone(990,.2,{type:'square',vol:.03,delay:.08});break;case 'deny':this.tone(180,.18,{type:'square',vol:.04,to:120});break;case 'select':this.tone(740,.06,{type:'triangle',vol:.04});break;}}
  // Low health: heartbeat whose tempo rises as health falls, and laboured breathing, until a heal or pickup lifts health back up.
  vitals(health,active){const ctx=this.scene.sound.context;if(!active||health>=35||!ctx){this.vitalsOn=false;return;}const now=ctx.currentTime,k=Math.max(0,Math.min(1,health/35));if(!this.vitalsOn){this.vitalsOn=true;this.beatAt=now;this.breathAt=now+.2;}
   if(now>=this.beatAt){this.tone(62,.16,{vol:.22-.08*k,to:38,attack:.006});this.tone(55,.14,{vol:.14-.05*k,to:34,attack:.006,delay:.16});this.beatAt=now+.48+.55*k;}
   if(now>=this.breathAt){const len=1+.6*k;this.noise(len*.42,{vol:.045,freq:700,q:.7,attack:len*.3});this.noise(len*.55,{vol:.035,freq:420,q:.6,attack:.05,delay:len*.5});this.breathAt=now+len*1.15;}}
  event(e){switch(e.type){
   case 'shot':{const kind=e.weapon,sounds={precision:['rifle',.8,.7],marksman:['rifle',.7,.78],battle:['rifle',.62,.82],lmg:['rifle',.5,.9],rocket:['boom',.7,.9],launcher:['shotgun',.7,.75],thumper:['shotgun',.7,.7],magnum:['pistol',.75,.7],machinepistol:['smg',.43,1.15],sawedoff:['shotgun',.95,.86],autoshotgun:['shotgun',.75,1.08],pulse:['laser',.32,1],rail:['laser-large',.7,.85],burst:['rifle',.45,1.12],ricochet:['rifle',.5,.92],flamer:['wind',.2,1.7],minigun:['rifle',.34,1.28],arc:['laser-large',.5,1.3]};
     const [key,vol,rate]=sounds[kind]||[kind,kind==='shotgun'?.85:.43,1];this.play(key,e.enemy?.18:vol,rate,e.x,e.y);if((kind==='shotgun'||kind==='sawedoff')&&!e.enemy)this.play('metal',.28,1.5);if(kind==='rail'&&!e.enemy)this.play('rumble',.45,1.4);if(kind==='rocket'&&e.enemy)this.tone(400,.4,{type:'sawtooth',vol:.02,to:120});break;}
   case 'footstep':{this.step++;const snow=e.surface==='snow';this.play(snow?(this.step%2?'footstep-snow-0':'footstep-snow-1'):this.step%2?'footstep-concrete-0':'footstep-concrete-1',.13,1+(this.step%3)*.035,e.x,e.y);break;}
   case 'reload':this.play('reload-'+(['shotgun','autoshotgun','sawedoff','launcher','thumper'].includes(e.weapon)?'shotgun':BPWorld.weapons[e.weapon]?.sprite==='handgun'?'pistol':'rifle'),.44);break;
   case 'empty':this.play('empty',.3);break;
   case 'swap':case 'equip':this.play('metal',.15,1.9);break;
   case 'action':this.play(e.action==='slide'?'wood':'body',.3,e.action==='vault'?.75:1.2,e.x,e.y);break;
   case 'meleeswing':this.play('wind',.16,e.heavy?2:3);break;
   case 'meleeimpact':this.play('body',.8,.75,e.x,e.y);this.play(e.finish?'punch':'metal',e.finish?.5:.25,1.3,e.x,e.y);break;
   case 'hit':this.play('body',.3,1.3,e.x,e.y);if(e.player&&(e.by||'player')===(this.scene.selfId||'player'))this.tone(2300,.03,{type:'square',vol:.018});break;
   case 'kill':if(e.credits&&(e.by||'player')===(this.scene.selfId||'player')){this.tone(1180,.07,{type:'triangle',vol:.05});this.tone(1760+Math.min(8,e.combo)*90,.12,{type:'triangle',vol:.045,delay:.05});}if(e.boss){this.play('rumble',.8,.7);this.play('bell',.5,.8);}break;
   case 'armorhit':this.play('plate',.35,1.4,e.x,e.y);break;case 'shieldhit':this.play('forcefield',.28,1.6,e.x,e.y);break;
   case 'explosion':this.play('explosion',.9,.9,e.x,e.y);this.play('rumble',.6,1,e.x,e.y);{const p=this.scene.sim?.player;if(p&&Math.hypot(p.x-e.x,p.y-e.y)<200&&e.radius>60)this.tone(3600,1.1,{vol:.02,attack:.05});}break;
   case 'destroy':this.play(e.kind==='glass'?'glass':e.kind==='crate'?'wood':'metal',.6,.9,e.x,e.y);if(e.kind==='jammer'||e.kind==='generator')this.play('forcefield',.6,.6,e.x,e.y);break;
   case 'pickup':this.play(e.kind==='health'?'healthpack':e.kind==='health'?'heal':'pickup',.4,1.1);break;
   case 'weaponfound':[392,523,659,784].forEach((f,i)=>this.tone(f,.3,{type:'triangle',vol:.06,delay:i*.07}));this.play('pickup',.5,.8);break;
   case 'intel':case 'cache':this.play('points',.5,1.1);this.tone(988,.2,{type:'triangle',vol:.05});break;
   case 'objective':this.play('bell',.32,e.partial?1.4:1);this.tone(659,.25,{type:'triangle',vol:.05,delay:.05});break;
   case 'flow':this.play('flow',.3,1.2);break;
   case 'checkpoint':case 'unlock':this.play('pickup',.55,.8);break;
   case 'healstart':this.play('reload-pistol',.3,1.3);this.noise(.5,{vol:.03,freq:3000,type:'highpass'});break;
   case 'radio':this.play('radio',.16,1.1);break;
   // Field support: a radio click for any call, the whistle of shells for an airstrike, and the hound's bite.
   case 'support':this.play('radio',.3,.9);if(e.key==='airstrike')this.tone(1500,1.3,{type:'sine',vol:.045,to:320});else if(e.key==='recon')this.tone(880,.5,{type:'sine',vol:.04,to:1760});else this.play('metal',.4,.8,e.x,e.y);break;
   case 'arc':this.play('forcefield',.3,1.8,e.x2,e.y2);break;case 'strafe':this.play('rifle',.2,1.3,e.x,e.y);break;case 'intercept':this.play('forcefield',.4,2,e.x,e.y);break;
   case 'ricochet':this.play('metal',.2,2.2,e.x,e.y);break;case 'grapple':this.play('wind',.4,1.2);break;case 'sensor':this.tone(1320,.25,{type:'sine',vol:.035});break;
   case 'bite':this.play('body',.55,1.5,e.x,e.y);break;case 'allygone':this.play('metal',.25,.6,e.x,e.y);break;
   case 'damage':this.play('body',.5,.7);break;case 'armorbreak':this.play('glass',.5,.7);this.play('plate',.5,.8);break;
   case 'throw':case 'plant':this.play('metal',.2,1.8);break;
   case 'whiz':{const now=this.scene.sound.context?.currentTime||0;if(now-this.lastWhiz>.09){this.lastWhiz=now;this.noise(.16,{vol:.05,freq:3200,sweep:900,q:3});}break;}
   case 'telegraph':if(e.enemy==='sniper'||e.enemy==='wraith'||e.enemy==='rocketeer')this.tone(e.enemy==='rocketeer'?520:1250,.5,{type:'sine',vol:.025,to:e.enemy==='rocketeer'?1040:1300},e.x,e.y);else if(e.enemy==='bomber')this.tone(1600,.07,{type:'square',vol:.04});break;
   case 'flash':this.play('explosion',.6,1.8,e.x,e.y);if(e.self)this.tone(3400,1.6,{vol:.035,attack:.02});break;
   case 'smoke':this.noise(1.1,{vol:.06,freq:1200,q:.5,attack:.05});break;
   case 'emp':this.tone(900,.8,{type:'sawtooth',vol:.04,to:50});this.play('forcefield',.7,.7,e.x,e.y);break;
   case 'decoy':case 'deploy':this.play('door',.4,1.4,e.x,e.y);break;case 'gate':this.play('door',.6,.8,e.x,e.y);break;
   case 'zap':this.tone(140,.25,{type:'sawtooth',vol:.06,to:90});this.play('forcefield',.4,2);break;
   case 'stomp':this.play('punch',.8,.6,e.x,e.y);this.play('rumble',.7,.8,e.x,e.y);break;
   case 'blink':case 'blinkin':this.play('forcefield',.3,2.2,e.x,e.y);break;
   case 'wave':this.tone(110,.7,{type:'sawtooth',vol:.04});this.tone(165,.7,{type:'sawtooth',vol:.03,delay:.05});break;
   case 'waveclear':case 'stage':this.play('bell',.3,1.1);break;
   case 'death':this.tone(220,1.4,{type:'sine',vol:.08,to:55});this.vitalsOn=false;break;
   case 'down':this.tone(196,.9,{type:'sine',vol:.07,to:62});this.play('body',.6,.6,e.x,e.y);this.vitalsOn=false;break;
   case 'reviving':this.tone(294,.6,{type:'sine',vol:.045,to:587});break;
   case 'tags':this.play('pickup',.5,1.3);this.tone(1320,.12,{type:'triangle',vol:.04});break;
   case 'revive':[392,523,659,880].forEach((f,i)=>this.tone(f,.35,{type:'triangle',vol:.06,delay:i*.08}));break;
   case 'complete':[392,494,587,784].forEach((f,i)=>this.tone(f,.6,{type:'triangle',vol:.06,delay:i*.14}));break;
  }}
  startAmbient(theme='city'){this.stopAmbient();if(!this.unlocked||this.settings.muted)return;for(const [key,vol,rate] of BEDS[theme]||BEDS.city){if(!this.scene.cache.audio.exists(key))continue;const voice=this.scene.sound.add(key,{loop:true,volume:vol*this.settings.volume,rate});voice.play();this.ambience.push(voice);}if(!this.settings.music)return;
   const ctx=this.scene.sound.context;if(!ctx)return;const gain=ctx.createGain();gain.gain.value=.012*this.settings.volume;gain.connect(ctx.destination);this.nodes.push(gain);
   const root={city:55,ruins:51.9,snow:49,subway:46.2,desert:58.3,facility:61.7,range:55}[theme]||55;for(const f of [root,root*1.4983,root*2,root*2.9966]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=f;osc.connect(gain);osc.start();this.nodes.push(osc);}this.musicGain=gain;
  }
  pressure(value){if(this.musicGain){const ctx=this.scene.sound.context;this.musicGain.gain.setTargetAtTime((.009+.016*value)*this.settings.volume,ctx.currentTime,.5);}}
  stopAmbient(){for(const a of this.ambience)a.destroy();this.ambience=[];for(const n of this.nodes){if(n.stop)try{n.stop();}catch{}n.disconnect();}this.nodes=[];this.musicGain=null;}
  // Menu and lobby score: one looping track for every screen outside a mission, where the per-theme ambience and drone take
  // over. It plays through a plain media element, so it is not decoded during the loading bar, and it is fetched whole
  // first so that looping does not depend on the server answering range requests. Follows the same switches as the drone.
  music(on){this.musicOn=on;const want=on&&!this.away&&!this.settings.muted&&this.settings.music&&this.settings.volume>0,ducked=performance.now()<this.duckUntil,target=want?Math.min(1,MUSIC_VOLUME*this.settings.volume*(ducked?.3:1)):0;
   if(!this.track){if(!want)return;const track=this.track=document.createElement('audio');track.loop=true;track.volume=0;
    fetch(MUSIC).then(r=>r.ok?r.blob():Promise.reject(new Error('missing'))).then(b=>{track.src=URL.createObjectURL(new Blob([b],{type:'audio/mpeg'}));if(this.track===track)this.music(this.musicOn);}).catch(()=>{});return;}
   const track=this.track;if(!track.src)return;
   if(want&&track.paused)track.play()?.catch(()=>{this.musicBlocked=true;});
   clearInterval(this.fadeTimer);const from=track.volume,start=performance.now(),ms=!want?350:ducked?180:900;
   this.fadeTimer=setInterval(()=>{const k=Math.min(1,(performance.now()-start)/ms);track.volume=from+(target-from)*k;if(k>=1){clearInterval(this.fadeTimer);if(!want)track.pause();}},40);}
  // Commander voice-over. One line speaks at a time: a new line is dropped while another is playing unless it is one
  // that should cut in (the order that opens a run). Each line then rests for a while, so call-outs tied to frequent
  // events - every wave, every objective - never turn into a loop. The menu score dips under the voice. Returns whether
  // the line was actually spoken.
  say(key,{cut=false,rest=45}={}){const ctx=this.scene.sound.context,now=performance.now();if(!this.live||this.settings.voice===false||!ctx||ctx.state!=='running'||!this.scene.cache.audio.exists(key))return false;
   if(now<(this.rested[key]||0))return false;if(this.voice&&this.voice.isPlaying){if(!cut)return false;this.voice.stop();}
   let line=this.voices.get(key);if(!line){line=this.scene.sound.add(key);this.voices.set(key,line);}this.voice=line;this.rested[key]=now+rest*1000;line.play({volume:Math.min(1,this.settings.volume*1.25)});
   const length=(line.duration||2)*1000;this.duckUntil=now+length+150;this.music(this.musicOn);setTimeout(()=>this.music(this.musicOn),length+200);return true;}
  pause(){this.scene.sound.pauseAll();if(this.musicGain)this.musicGain.gain.value=0;this.vitalsOn=false;}
  resume(){this.scene.sound.resumeAll();this.pressure(0);}
  destroy(){window.removeEventListener('pointerdown',this.onGesture);window.removeEventListener('keydown',this.onGesture);document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('blur',this.onVisibility);window.removeEventListener('focus',this.onVisibility);clearInterval(this.fadeTimer);if(this.track){this.track.pause();if(this.track.src)URL.revokeObjectURL(this.track.src);this.track=null;}this.stopAmbient();for(const pool of this.pools.values())for(const a of pool)a.destroy();this.pools.clear();for(const line of this.voices.values())line.destroy();this.voices.clear();}
 }
 root.BPAudio=Audio;
})(globalThis);

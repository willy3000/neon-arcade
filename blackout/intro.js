(function(root){'use strict';
 // The opening, played in place of the loading screen. A short film that shows very little and says nothing: rain in
 // the dark, a city and then a helicopter caught for a moment by lightning, explosions heard in the black with only
 // their light, and one more strike on what is left of the helicopter - then the emblem and the name, which hold on a
 // slow heartbeat until a key or button is pressed. What happened in between is for the game to tell. Any press
 // before the hold skips to it.
 //
 // It has to play the same on every start, so nothing in the film waits on this page's main thread, which the game
 // keeps busy while it loads:
 //  - Every picture is laid out once at the start and moved only by CSS animations of transform and opacity, which
 //    the browser runs on its compositor (style.css, "Opening"). The few things made here (the two bitmaps of the
 //    city as lightning shows it, and the rain) are made before the first frame.
 //  - The film does not start until the page's scripts (the engine and the game, about a megabyte and a half) have
 //    been run, which is when the browser says the document is ready; until then the screen is simply black.
 //  - Every sound is scheduled ahead on the audio clock, from the moment the first frame is shown. The synthesised
 //    layers need nothing loaded; each sample joins in as soon as it is decoded.
 //  - The game itself is held back (BPIntro.boot) until the film goes dark for the explosions, or until the film is
 //    skipped. It is still loading under the film, but not under the lightning. Once loaded it stays asleep behind the film (see create() in game.js) until the hand-over.
 //
 // game.js reports to it through BPIntro: boot(fn) to be told when to start loading, progress(0-1) and loaded() from
 // the loader, abort() if loading fails (the loading screen behind then shows why), and then(fn) for whatever the
 // menu should only do once it is on screen.
 // It does not play under automation (navigator.webdriver, or ?qa / ?nointro in the address), so tests reach the menu
 // as soon as loading ends; ?intro plays it regardless.
 const el=document.getElementById('intro'),q=new URLSearchParams(location.search);
 const api=root.BPIntro={active:false,boot(fn){fn();},progress(){},loaded(){},abort(){},then(fn){fn();}};
 if(!el||q.has('nointro')||(navigator.webdriver||q.has('qa'))&&!q.has('intro'))return;
 let settings={};try{settings=JSON.parse(localStorage.getItem('blackout-protocol-progress')||'{}').settings||{};}catch{/* a first launch has no save */}
 // "Reduced flash" and the system's reduced-motion setting leave out the film and the pulse: the emblem simply fades in.
 const calm=!!settings.flash||matchMedia('(prefers-reduced-motion:reduce)').matches;
 // Moments of the film, in seconds from its first frame. They match the delays in style.css.
 const STRIKES=[1.4,3,4.4],DARK=5.6,RISE=8,WRECK=9.2,LOGO=10.8,NAME=12.1,HOLD=13.3,BEAT=2.8;
 const waiting=[];let T0=0,rolling=false,hold=false,ready=false,gone=false,beat=0,holdTimer=0,bootTimer=0,start=null,booted=false;
 const clock=()=>(performance.now()-T0)/1000;
 // Lets the game start loading: once, at the blackout or at a skip, whichever comes first.
 function boot(){if(booted||!start)return;booted=true;clearTimeout(bootTimer);start();}

 // ---- pictures made once, before the first frame ----
 let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 // The city as lightning shows it: the menu's painting, bleached and cold, drawn into two fixed-size bitmaps so the
 // film moves small textures and never repaints a filtered vector image. The painting has a wreck of its own in the
 // middle, so only its clear top-left corner is used: mirrored four ways (so that the joins are streets meeting, not
 // edges) it is the ground under the flight, and once more it lies under the film's own wreck. Each piece is
 // [from x, y, w, h, to x, y, w, h, flip x, flip y].
 {const art=new Image(),lit=(cv,w,h,pieces)=>{if(!cv)return;cv.width=w;cv.height=h;const g=cv.getContext('2d'),kx=art.naturalWidth/1600,ky=art.naturalHeight/1000;g.filter='grayscale(1) brightness(2.5) contrast(1.5)';
    for(const [sx,sy,sw,sh,dx,dy,dw,dh,fx,fy] of pieces){g.save();g.translate(dx+(fx?dw:0),dy+(fy?dh:0));g.scale(fx?-1:1,fy?-1:1);g.drawImage(art,sx*kx,sy*ky,sw*kx,sh*ky,0,0,dw,dh);g.restore();}
    g.filter='none';g.globalCompositeOperation='multiply';g.fillStyle='#9dbdf2';g.fillRect(0,0,w,h);};
  const NW=[0,0,620,560];
  art.onload=()=>{lit(el.querySelector('.in-city'),1600,1000,[[...NW,0,0,800,500,0,0],[...NW,800,0,800,500,1,0],[...NW,0,500,800,500,0,1],[...NW,800,500,800,500,1,1]]);lit(el.querySelector('.in-scar'),960,540,[[90,60,780,439,0,0,960,540,0,0]]);};art.src='blackout/assets/cover.svg';}
 // Rain: one strip of streaks, drawn twice over so that it can slide down by half its height for ever.
 {const cv=el.querySelector('.in-rain');if(cv){const w=cv.width=960,g=cv.getContext('2d');cv.height=1080;g.strokeStyle='rgba(200,220,235,.3)';g.lineWidth=1;g.beginPath();
   for(let half=0;half<2;half++){seed=11;for(let i=0;i<150;i++){const x=rnd()*w*1.1,y=rnd()*540+half*540,len=26+rnd()*40;g.moveTo(x,y);g.lineTo(x-len*.2,y+len);}}g.stroke();}}

 // ---- embers in the hold: the only drawing done while it plays, and it does not set the pace ----
 const cv=el.querySelector('.in-fx'),pen=cv&&cv.getContext('2d'),embers=[];let drawing=false,last=0,emberAt=0;
 const fit=()=>{if(cv){cv.width=Math.round(innerWidth/2);cv.height=Math.round(innerHeight/2);}};fit();addEventListener('resize',fit);
 function draw(now){if(!api.active||gone||!pen){drawing=false;return;}const dt=Math.min(.05,(now-last)/1000),w=cv.width,h=cv.height,u=h/100;last=now;pen.clearRect(0,0,w,h);let busy=false;
  if(hold){busy=true;emberAt-=dt;if(emberAt<=0&&embers.length<70){emberAt=.09+Math.random()*.12;embers.push({x:Math.random()*w,y:h+2*u,v:(2.5+Math.random()*5)*u,r:(.12+Math.random()*.24)*u,p:Math.random()*6.283});}
   for(let i=embers.length-1;i>=0;i--){const e=embers[i];e.y-=e.v*dt;e.p+=dt*1.3;e.x+=Math.sin(e.p)*u*2.2*dt;const life=Math.min(1,e.y/(h*.55));if(e.y<h*.12){embers.splice(i,1);continue;}
    pen.fillStyle=`rgba(240,170,90,${(.5*life*(.6+.4*Math.sin(e.p*3))).toFixed(2)})`;pen.beginPath();pen.arc(e.x,e.y,e.r,0,6.283);pen.fill();}}
  if(busy)requestAnimationFrame(draw);else drawing=false;}
 const animate=()=>{if(!drawing&&pen){drawing=true;last=performance.now();requestAnimationFrame(draw);}};

 // ---- sound: the game's own samples under synthesised layers, through a little reverb ----
 const volume=settings.muted?0:Number.isFinite(settings.volume)?settings.volume:.65;let ctx=null,seq=null,live=null,grain=null,drone=null;const clips={},cues=[];
  // The storm, the helicopter and the low drone under everything are recordings made for this (see ASSET_MANIFEST.md);
 // the rest are the game's own samples.
 const CLIPS=['intro-drone','intro-rain','intro-thunder','intro-chopper','explosion','boom','metal','glass','rumble','forcefield','bell'];
 function tone(to,t,from,until,dur,gain,type='sine'){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(from,t);if(until!==from)o.frequency.exponentialRampToValueAtTime(until,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(to);o.start(t);o.stop(t+dur+.05);}
 // Filtered noise: a burst that dies away, one that grows to its end (swell), or one held level (flat); the filter can sweep from freq to sweep.
 function noise(to,t,dur,gain,kind,freq,{swell=false,sweep=0,flat=false}={}){const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=grain;n.loop=true;f.type=kind;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+dur);
  if(swell){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+dur);}else if(flat){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+.08);g.gain.setValueAtTime(gain,Math.max(t+.09,t+dur-.08));g.gain.linearRampToValueAtTime(.0001,t+dur);}
  else{g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);}
  n.connect(f).connect(g).connect(to);n.start(t);n.stop(t+dur+.05);}
 // A sample: at a gain and a speed, looped or not, faded in over "fade" and (given a length) out over "tail"; "bend" slides its speed to that by its end.
 function clip(to,name,t,{gain=1,rate=1,from=0,dur=0,loop=false,fade=.05,tail=.15,bend=0}={}){const buffer=clips[name];if(!buffer)return;const n=ctx.createBufferSource(),g=ctx.createGain();n.buffer=buffer;n.loop=loop;n.playbackRate.setValueAtTime(rate,t);if(bend&&dur)n.playbackRate.exponentialRampToValueAtTime(bend,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+fade);if(dur){g.gain.setValueAtTime(gain,t+Math.max(fade,dur-tail));g.gain.linearRampToValueAtTime(.0001,t+dur);}
  n.connect(g).connect(to);n.start(t,from%buffer.duration);if(dur)n.stop(t+dur+.05);}
 const hit=(to,t,deep=1)=>{tone(to,t,58*deep,34*deep,1.4,.75);noise(to,t,.7,.3,'lowpass',900);clip(to,'boom',t,{gain:.55,rate:.7*deep});};
 const thump=t=>{tone(live,t,52,33,.24,.5);tone(live,t+.34,47,31,.24,.3);};
 // The film's sounds: each is a moment (s), how long it lasts if it is a bed that may be joined late (span), the sample
 // it needs if any (needs), and what to play at audio time t for dur seconds. Nothing in it is spoken or spelt out.
 const cue=(s,play,{span=0,needs=''}={})=>cues.push({s,span,needs,play,done:false});
 // Under everything, from the first frame and on through the hold: a low drone. With it, rain until the emblem.
 cue(0,(t,d)=>clip(live,'intro-drone',t,{gain:.55,loop:true,fade:2.5}),{span:600,needs:'intro-drone'});
 cue(0,(t,d)=>clip(seq,'intro-rain',t,{gain:.5,loop:true,dur:d,fade:1.5,tail:1.6}),{span:LOGO+.6,needs:'intro-rain'});
 // Lightning: thunder after each strike, later and lower the further off it is. The third is close.
 STRIKES.forEach((s,i)=>cue(s+[.3,.18,.08][i],t=>clip(seq,'intro-thunder',t,{gain:[.5,.62,.8][i],rate:[.68,.84,1][i]}),{needs:'intro-thunder'}));
 // The helicopter: heard before it is seen, loudest as lightning finds it close, and cut short in the dark.
 cue(1.7,(t,d)=>clip(seq,'intro-chopper',t,{gain:.85,loop:true,dur:d,fade:Math.min(2.4,d*.7),tail:.06}),{span:DARK-1.7,needs:'intro-chopper'});
 // In the dark: three explosions, the rotor winding down under the first, then things landing.
 cue(DARK,t=>{tone(seq,t,95,26,1.7,.85);noise(seq,t,1.2,.5,'lowpass',600);});cue(DARK,t=>clip(seq,'explosion',t,{gain:1}),{needs:'explosion'});
 cue(DARK,t=>clip(seq,'intro-chopper',t,{gain:.6,loop:true,dur:1.3,fade:.02,tail:1,bend:.3}),{needs:'intro-chopper'});cue(DARK+.2,t=>clip(seq,'glass',t,{gain:.45}),{needs:'glass'});
 cue(DARK+.65,t=>{tone(seq,t,70,28,1.3,.65);noise(seq,t,.9,.32,'lowpass',480);});cue(DARK+.65,t=>clip(seq,'boom',t,{gain:.9,rate:.6}),{needs:'boom'});
 cue(DARK+1.15,t=>{tone(seq,t,60,26,1.2,.5);});cue(DARK+1.15,t=>clip(seq,'explosion',t,{gain:.55,rate:.78}),{needs:'explosion'});
 cue(DARK+1.5,t=>clip(seq,'metal',t,{gain:.7,rate:.6}),{needs:'metal'});cue(DARK+1.8,t=>{tone(seq,t,48,27,.9,.45);noise(seq,t,.5,.18,'lowpass',300);});cue(DARK+1.8,t=>clip(seq,'rumble',t,{gain:.5,rate:.5,dur:2,fade:.05,tail:1.4}),{needs:'rumble'});
 // A swell out of the quiet, and the fourth strike lands on top of it.
 cue(RISE,t=>{const d=WRECK-RISE;noise(seq,t,d,.2,'bandpass',180,{swell:true,sweep:2600});const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(38,t);o.frequency.exponentialRampToValueAtTime(76,t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+d);g.gain.linearRampToValueAtTime(.0001,t+d+.06);o.connect(g).connect(seq);o.start(t);o.stop(t+d+.1);});
 cue(WRECK,t=>{noise(seq,t,.22,.5,'highpass',1800);hit(seq,t,.9);});cue(WRECK+.03,t=>clip(seq,'intro-thunder',t,{gain:1,rate:1.06}),{needs:'intro-thunder'});
 // The emblem lights, and the name lands with a toll.
 cue(LOGO,t=>{tone(seq,t,55,165,1.25,.1);noise(seq,t,1.2,.1,'bandpass',400,{swell:true,sweep:2400});});cue(LOGO,t=>clip(seq,'forcefield',t,{gain:.3,rate:.7}),{needs:'forcefield'});
 cue(NAME,t=>hit(seq,t,.85));cue(NAME+.02,t=>clip(seq,'bell',t,{gain:.22,rate:.42}),{needs:'bell'});
 // Schedules whatever can be scheduled now. Called when the film starts, when the audio starts running and as each
 // sample arrives: a cue whose moment has gone by is dropped (a bed is joined part way through), one whose sample is
 // not there yet waits for it.
 function flush(){if(!ctx||!rolling||ctx.state!=='running')return;const late=clock(),now=ctx.currentTime;
  for(const c of cues){if(c.done||c.needs&&!clips[c.needs])continue;c.done=true;if((hold||calm)&&c.span<600)continue;if(c.span){const left=c.s+c.span-Math.max(c.s,late);if(left>.4)c.play(now+Math.max(0,c.s-late),left);}else if(c.s>=late-.04)c.play(now+Math.max(0,c.s-late));}}
 function sound(){if(!volume)return;try{ctx=new (root.AudioContext||root.webkitAudioContext)();}catch{return;}
  const master=ctx.createGain(),squash=ctx.createDynamicsCompressor(),room=ctx.createConvolver(),send=ctx.createGain(),len=Math.floor(ctx.sampleRate*2.4),tail=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=tail.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4);}
  room.buffer=tail;send.gain.value=.28;master.gain.value=volume;squash.connect(master).connect(ctx.destination);room.connect(squash);send.connect(room);
  seq=ctx.createGain();live=ctx.createGain();for(const bus of [seq,live]){bus.connect(squash);bus.connect(send);}
  grain=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=grain.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  ctx.addEventListener('statechange',flush);if(ctx.state!=='running')ctx.resume().catch(()=>{/* a browser tab waits for the first key press */});
  // The samples are a few hundred kilobytes in all, fetched before the game asks for anything.
  for(const name of CLIPS)fetch('blackout/assets/audio/'+name+'.ogg').then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>ctx.decodeAudioData(b)).then(b=>{clips[name]=b;flush();}).catch(()=>{/* the film plays without it */});}
 // The hold's own bed, over the drone: a low fifth that swells and falls very slowly.
 function bed(){if(!ctx||drone)return;const t=ctx.currentTime,f=ctx.createBiquadFilter(),lfo=ctx.createOscillator(),depth=ctx.createGain();drone=ctx.createGain();f.type='lowpass';f.frequency.value=260;drone.gain.setValueAtTime(.0001,t);drone.gain.linearRampToValueAtTime(.06,t+3);
  lfo.frequency.value=.09;depth.gain.value=.03;lfo.connect(depth).connect(drone.gain);lfo.start(t);for(const [hz,type] of [[55,'sine'],[55.5,'sine'],[82.4,'sine'],[110.2,'triangle']]){const o=ctx.createOscillator();o.type=type;o.frequency.value=hz;o.connect(f);o.start(t);}f.connect(drone).connect(live);}

 // ---- the hold: emblem and name on a slow heartbeat, waiting for loading and then for a press ----
 function toHold(skipped){if(hold||gone)return;hold=true;clearTimeout(holdTimer);el.classList.add('hold');if(skipped)el.classList.add('skipped');boot();animate();
  if(ctx){if(skipped){seq.gain.setTargetAtTime(0,ctx.currentTime,.03);if(!calm&&ctx.state==='running')hit(live,ctx.currentTime+.02,.85);}
   const pulse=()=>{if(gone||ctx.state!=='running')return;bed();if(!calm&&!beat){const thud=()=>{if(ctx.state==='running')thump(ctx.currentTime+.02);};thud();beat=setInterval(thud,BEAT*1000);}};
   pulse();ctx.addEventListener('statechange',pulse);}}
 // ---- the hand-over: the name travels to where the menu's title is, the rest fades, and the menu is live ----
 function close(){el.remove();document.body.classList.remove('intro-on','intro-cover');api.active=false;removeEventListener('keydown',key,true);removeEventListener('resize',fit);if(ctx)ctx.close().catch(()=>{});}
 function leave(){if(gone)return;gone=true;clearInterval(beat);document.body.classList.remove('intro-cover');el.classList.add('out');if(ctx)live.gain.setTargetAtTime(0,ctx.currentTime,.25);
  const name=el.querySelector('.in-title'),title=document.querySelector('.menu-content h1');
  if(name&&title&&title.offsetParent){const a=name.getBoundingClientRect(),b=title.getBoundingClientRect(),k=b.width/a.width;name.style.transform=`translate(${(b.left-a.left).toFixed(1)}px,${(b.top-a.top).toFixed(1)}px) scale(${k.toFixed(4)})`;}
  else if(name)name.style.opacity='0';
  // Waking the game and starting the menu's music take the main thread for a moment: they wait until the fade and
  // the glide have begun, so the hand-over itself starts on the press.
  setTimeout(()=>{for(const fn of waiting.splice(0))fn();},90);
  setTimeout(close,950);}
 function press(){if(gone)return;if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});if(!hold){toHold(true);return;}if(ready)leave();}
 // Every key belongs to the opening while it is up, so none of them reaches the menu underneath.
 function key(e){if(!api.active)return;e.stopImmediatePropagation();if(e.key==='F11'||e.altKey||e.ctrlKey||e.metaKey)return;e.preventDefault();if(!e.repeat)press();}
 addEventListener('keydown',key,true);el.addEventListener('pointerdown',e=>{e.preventDefault();press();});
 // A controller: any button newly pressed. Whatever is already held when the game opens does not count.
 let held=null;function poll(){if(!api.active||gone)return;let pads=[];try{pads=[...(navigator.getGamepads?.()||[])].filter(p=>p&&p.connected);}catch{/* no controller support */}
  const down=pads.some(p=>p.buttons.some(b=>b.pressed));if(held===false&&down)press();held=down;setTimeout(poll,50);}

 Object.assign(api,{active:true,
  boot(fn){start=fn;if(hold||gone)boot();},
  progress(v){const bar=document.getElementById('intro-bar');if(bar)bar.style.width=Math.round(Math.max(0,Math.min(1,v))*100)+'%';},
  loaded(){ready=true;el.classList.add('ready');},
  abort(){if(gone)return;gone=true;clearTimeout(holdTimer);clearTimeout(bootTimer);clearInterval(beat);close();},
  then(fn){if(!api.active||gone)fn();else waiting.push(fn);},
  // For blackout/qa/intro-check.cjs: seconds into the film (-1 before its first frame), and how much of its sound is scheduled.
  clock:()=>rolling?clock():-1,
  heard:()=>({audio:ctx?ctx.state:'none',samples:Object.keys(clips).length,cues:cues.length,played:cues.filter(c=>c.done).length})});
 document.body.classList.add('intro-on','intro-cover');el.classList.toggle('calm',calm);el.classList.add('wait');el.hidden=false;sound();poll();
 // The film's clock starts with its first frame, which is when its animations start: the page's other scripts run
 // before that frame is drawn, and the sound has to follow the picture, not the moment this script ran.
 function roll(at){if(rolling||gone)return;T0=at;rolling=true;flush();if(hold)return;const left=s=>Math.max(0,(s-clock())*1000);
  holdTimer=setTimeout(()=>toHold(false),left(HOLD));clearTimeout(bootTimer);bootTimer=setTimeout(boot,left(DARK));}
 if(calm)toHold(true);
 const open=()=>{if(gone)return;el.classList.remove('wait');requestAnimationFrame(()=>{const first=el.getAnimations({subtree:true})[0],go=()=>roll(typeof first?.startTime==='number'?first.startTime:performance.now());if(first)first.ready.then(go,go);else go();});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open,{once:true});else open();
 // If no frame is ever drawn (the window is hidden as the game opens), the game must still load.
 bootTimer=setTimeout(boot,9000);
})(globalThis);

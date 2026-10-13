(function(root){'use strict';
 // Animated layer over the title-screen cover painting (assets/cover.svg): fire, embers and smoke on the crashed
 // helicopter, and a live skirmish around it. The soldiers are not an imitation of the game: they are the game's own
 // simulation (core.js) running a small private battle on an invisible map that matches the painted streets, drawn with
 // the same character sprites, tints, animation rules and effects render.js uses in a mission. Only the two operators
 // are faked - they are steered by a simple bot instead of a player. Everything is positioned in the painting's own
 // street-aligned coordinates (the rotated group the cover uses): the wreck is at about (840,555), the avenue runs
 // along x 600-1040 and the cross street along y 240-550. style.css keeps each layer on its own compositor layer, so
 // the painting underneath is never repainted.
 const SVG='http://www.w3.org/2000/svg',TILT=-29*Math.PI/180;
 // The simulation works in positive coordinates, so the battle map is the painting shifted by (OX,OY). The four city
 // blocks are solid out to the map edge, which leaves the two streets as the only ways in; hostiles spawn at the
 // street ends, all outside the picture, and walk in.
 const OX=240,OY=440,MAP_W=2280,MAP_H=1960;
 const POSTS=[{x:958,y:432},{x:688,y:646}];
 const SPAWNS=[[1900,360],[1900,450],[780,1440],[890,1440],[780,-360],[890,-360]];
  // The cast is mixed on purpose, so the street sounds like a battle and not one gun repeated: riflemen (some with the
 // heavier battle rifle), scouts with submachine guns, shields with pistols, breachers with sawed-off shotguns and a
 // machine gunner, against Rook's assault rifle and his squadmate's marksman rifle.
 const WAVES=[[0,0,'infantry:0','infantry:1'],[7,3,'rusher:2','breacher:3'],[15,3,'scout:4','infantry:5','rusher:0'],[25,3,'shield:1','gunner:2','scout:4'],[36,3,'infantry:4','breacher:3','infantry:0'],[47,4,'scout:5','infantry:1','shield:2']];
 function battleMap(){const M=root.BPMissions,wall=(id,x,y,w,h,...rest)=>M.box(id,x+OX,y+OY,w,h,...rest),at=([x,y])=>({x:x+OX,y:y+OY}),start=at([POSTS[0].x,POSTS[0].y]);
  const stages=[{kind:'hold',zone:0,x:start.x,y:start.y,name:'Hold the wreck',hint:'',spawn:start,
   waves:WAVES.map(([after,max,...who])=>({after,max:max||undefined,entries:who.map(q=>{const [type,spot]=q.split(':');return {type,at:+spot};})}))}];
  return {id:'backdrop',theme:'city',width:MAP_W,height:MAP_H,start,threat:1,stages,objectives:stages,checkpointSpawns:[start],spawnPoints:SPAWNS.map(at),enemies:[],pickups:[],hazards:[],areas:[],fires:[],lights:[],perches:[],floors:[],
   guns:{infantry:'rifle',scout:'smg',shield:'pistol',breacher:'sawedoff',gunner:'lmg'},
   walls:[wall('block-nw',-240,-440,840,678),wall('block-ne',1040,-440,1000,697),wall('block-sw',-240,547,840,973),wall('block-se',1050,550,990,970),
    // The helicopter is solid cover; the kerbside crates and the two in the roadway are low cover, as painted.
    wall('wreck-nose',858,452,62,66),wall('wreck-body',792,500,92,96),wall('wreck-aft',742,596,66,74),wall('wreck-tail',690,684,44,70),
    wall('crate-east',1045,370,55,25,'barrier',Infinity,true),wall('crate-south',700,780,48,100,'barrier',Infinity,true),wall('crate-nw',600,85,20,55,'barrier',Infinity,true),wall('crate-sw',600,690,12,170,'barrier',Infinity,true)]};}
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 // The private battle: one real simulation, stepped at the game's own rate, with a bot on each operator's controls.
 class Skirmish {
  constructor(seed=1){this.seed=seed;this.events=[];if(!root.BPMissions.builders.backdrop)root.BPMissions.builders.backdrop=battleMap;this.reset();}
  // Seeded like the simulation itself, so a given battle always plays out the same way.
  rnd(lo=0,hi=1){this.roll=(Math.imul(this.roll,1664525)+1013904223)>>>0;return lo+(hi-lo)*this.roll/4294967296;}
  reset(){const Core=root.BPCore;this.roll=this.seed*7919;this.sim=Core.create({mission:'backdrop',difficulty:'standard',seed:1701+this.seed++,loadout:{primary:'rifle',secondary:'pistol'},guest:{loadout:{primary:'marksman',secondary:'magnum'}}});this.sim.events.length=0;this.carry=0;
   this.bots=POSTS.map((post,i)=>({post:{x:post.x+OX,y:post.y+OY},goal:{x:post.x+OX,y:post.y+OY},wait:0,aim:i?2.2:-.2,burst:0,rest:0,side:i?1:-1,dodge:-1,swing:0,foe:null,react:0,sway:i*2}));
   this.crew().forEach((op,i)=>{op.x=this.bots[i].post.x;op.y=this.bots[i].post.y;op.angle=this.bots[i].aim;});}
  crew(){return [this.sim.player,this.sim.guest];}
  // What a player would do on this operator's controls: hold a post, shoot whoever is in view in controlled bursts,
  // give ground when rushed, knife anything in reach, reload in the lulls. "taps" are single presses (roll, melee, reload).
  // It is deliberately human: it takes a moment to pick up a new target, its aim wanders a little, and it only opens
  // fire at about the range the hostiles do, so both sides get to fight.
  pilot(op,bot,dt,taps){const s=this.sim,Core=root.BPCore,gun=root.BPWorld.weapons[op.slots[op.slot]];let foe=null,best=Infinity;
   for(const e of s.enemies){if(e.dead||e.gone>0)continue;const d=gap(op,e);if(d>780)continue;const score=d+(Core.lineOfSight(s,op,e)?0:500);if(score<best){best=score;foe=e;}}
   const d=foe?gap(op,foe):Infinity,clear=!!foe&&Core.lineOfSight(s,op,foe),want=foe?Math.atan2(foe.y+foe.vy*.07-op.y,foe.x+foe.vx*.07-op.x):Math.hypot(op.vx,op.vy)>60?Math.atan2(op.vy,op.vx):bot.aim;
   if(foe!==bot.foe){bot.foe=foe;bot.react=this.rnd(.45,.95);}bot.react-=dt;bot.sway+=dt;const held=want+Math.sin(bot.sway*2.3)*.055+Math.sin(bot.sway*5.1)*.03;
   bot.aim+=Math.max(-7*dt,Math.min(7*dt,wrap(held-bot.aim)));
   const input={aimX:op.x+Math.cos(bot.aim)*240,aimY:op.y+Math.sin(bot.aim)*240};
   bot.burst-=dt;if(bot.burst<-bot.rest){bot.burst=this.rnd(.22,.55);bot.rest=this.rnd(.35,.9);}
   input.fire=clear&&d<540&&bot.react<=0&&bot.burst>0&&Math.abs(wrap(held-bot.aim))<.12;
   bot.swing-=dt;if(taps&&foe&&d<62&&bot.swing<=0){input.melee=true;bot.swing=.5;}
   if(taps&&!op.reload&&(op.ammo[op.slots[op.slot]]===0||!foe&&op.ammo[op.slots[op.slot]]<gun.capacity*.6))input.reload=true;
   // Movement: drift between spots around the post, back off at an angle from anyone closing in, and never stray far.
   bot.wait-=dt;if(bot.wait<=0||gap(op,bot.goal)<14){bot.wait=this.rnd(1.6,3.6);for(let i=0;i<6;i++){const g={x:bot.post.x+this.rnd(-80,80),y:bot.post.y+this.rnd(-70,70)};if(Core.clearAt(s,g.x,g.y,22)){bot.goal=g;break;}}}
   let mx=bot.goal.x-op.x,my=bot.goal.y-op.y,far=Math.hypot(mx,my);const home=gap(op,bot.post);
   if(foe&&d<200&&home<150){const away=Math.atan2(op.y-foe.y,op.x-foe.x)+bot.side*.7;mx=Math.cos(away);my=Math.sin(away);far=60;}
   else if(home>150){mx=bot.post.x-op.x;my=bot.post.y-op.y;far=home;}
   if(far<12){mx=0;my=0;}else{mx/=far;my/=far;}
   // A wind-up aimed this way sometimes gets a sidestep roll, a beat late, the way a player reacts to the telegraph.
   if(bot.dodge>=0){bot.dodge-=dt;if(bot.dodge<0&&taps&&op===s.player&&op.stamina>=30&&foe&&home<150){const across=Math.atan2(foe.y-op.y,foe.x-op.x)+Math.PI/2,dir=Math.cos(across)*(bot.post.x-op.x)+Math.sin(across)*(bot.post.y-op.y)<0?-1:1;mx=Math.cos(across)*dir;my=Math.sin(across)*dir;input.roll=true;}}
   input.mx=mx;input.my=my;input.sprint=far>170&&!input.fire;return input;}
  update(dt){const s=this.sim,Core=root.BPCore,[rook,mate]=this.crew();this.carry=Math.min(this.carry+dt,7*Core.DT);let taps=true;
   while(this.carry>=Core.DT){this.carry-=Core.DT;const input=this.pilot(rook,this.bots[0],Core.DT,taps);input.guest=this.pilot(mate,this.bots[1],Core.DT,taps);taps=false;Core.step(s,input);
    for(const e of s.events.splice(0)){if(e.type==='telegraph')this.crew().forEach((op,i)=>{if(gap(op,e)<620&&this.bots[i].dodge<0&&this.rnd()<.3)this.bots[i].dodge=this.rnd(.1,.24);});this.events.push(e);}}
   // Stage management, kept off screen: the operators are patched up and resupplied rather than allowed to lose, and
   // bodies are cleared after a while. The wave script restarts by itself whenever the street is clear.
   for(const op of this.crew()){if(op.dead){op.dead=false;op.state='idle';op.health=0;s.tags.length=0;}if(op.health<45){op.health=100;op.armor=Math.max(op.armor,25);}const key=op.slots[op.slot];if(op.reserve[key]<60)op.reserve[key]=150;}
   // About half the riflemen carry the battle rifle instead: the same soldier, a deeper report.
   for(const e of s.enemies)if(e.type==='infantry'&&!e.armed){e.armed=true;if(this.rnd()<.5)e.gun='battle';}
   s.enemies=s.enemies.filter(e=>!(e.dead&&e.deathAge>14));if(s.dead||s.completed||s.cinematic>0)this.reset();
   return this.events.splice(0);}
 }
 const make=(tag,attrs={},parent=null)=>{const n=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.append(n);return n;};
 const f=n=>+n.toFixed(1),move=(x,y,more='')=>`translate(${f(x)}px,${f(y)}px)${more}`,css=(hex,alpha=1)=>`rgba(${hex>>16&255},${hex>>8&255},${hex&255},${alpha})`;
 // The same per-archetype sprite tints and palette render.js uses.
 const TINTS={infantry:0xb2a797,rusher:0xb8a58e,sniper:0x8dafa1,shield:0xaaa58e,commander:0xc9aa89,scout:0x9fb08a,breacher:0x8e8d84,gunner:0x9a8c7a},ROOK=0xc4cfad,CORPSE=0x747761,C={shadow:0x111b15,amber:0xe2b074,red:0xd3846c};
 const DUST={spark:0xddb170,cloth:0x987c62,dust:0xa7a087,casing:0xad9b64,smoke:0x596457};
 class MenuScene {
  constructor(host,{still=false,front=null,onEvent=null}={}){this.onEvent=onEvent;this.anims=[];this.playing=false;this.ready=false;this.low=false;this.host=host;this.front=front||host;if(!host||still||typeof host.animate!=='function')return;
   // The scatter of embers and smoke is seeded, so the fire looks the same on every launch.
   let seed=7;this.rnd=(lo,hi)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return lo+(hi-lo)*seed/4294967296;};
   // The backdrop is decoration: if anything about it fails, the title screen simply keeps its still painting.
   try{const fire=this.layer(),canvas=this.canvas=document.createElement('canvas'),haze=this.layer();this.fire(fire);this.haze(haze);host.append(fire.ownerSVGElement);this.front.append(canvas,haze.ownerSVGElement);for(const a of this.anims)a.pause();this.ready=true;this.troops();}
   catch(err){for(const a of this.anims)a.cancel();this.anims=[];host.replaceChildren();this.front.replaceChildren();console.warn('Menu backdrop disabled',err);}}
  // One SVG layer in the painting's coordinates; returns its street-aligned group.
  layer(){const svg=make('svg',{viewBox:'0 0 1600 1000',preserveAspectRatio:'none','aria-hidden':'true',focusable:'false'}),defs=make('defs',{},svg);
   const grad=(id,stops)=>{const g=make('radialGradient',{id},defs);for(const [offset,color,opacity] of stops)make('stop',{offset,'stop-color':color,'stop-opacity':opacity},g);};
   if(!this.painted){this.painted=true;grad('ms-glow',[[0,'#ffe2a0',.7],[.25,'#e9933f',.42],[.6,'#a4572a',.16],[1,'#7a4a26',0]]);grad('ms-smoke',[[0,'#0b140f',.62],[.55,'#0e1813',.3],[1,'#101c16',0]]);}
   return make('g',{transform:'rotate(-29 900 500)'},svg);}
  run(node,frames,ms,delay=0){const a=node.animate(frames,{duration:ms,iterations:Infinity,delay,fill:'both'});this.anims.push(a);return a;}
  fire(world){const rnd=this.rnd;
   // Firelight breathing over the whole wreck, then two burning patches where the painting already shows flames and a third on the tail.
   const glow=make('ellipse',{cx:832,cy:572,rx:215,ry:168,fill:'url(#ms-glow)'},world);glow.style.transformBox='fill-box';glow.style.transformOrigin='50% 50%';
   this.run(glow,[[.42,1],[.8,1.05],[.5,.98],[.95,1.07],[.38,.97],[.7,1.03],[.42,1]].map(([o,s])=>({opacity:o,transform:`scale(${s})`})),2600);
   for(const [x,y,size] of [[760,494,.78],[930,607,.9],[792,642,.55]]){const patch=make('g',{transform:`translate(${x} ${y}) scale(${size})`},world);
    make('ellipse',{cx:0,cy:2,rx:27,ry:13,fill:'#e9a850',opacity:.85},patch);
    for(const [d,fill,ms] of [['M-24 0Q-28-24-9-42Q-11-27 0-62Q7-36 15-47Q28-22 24 0Q0 9-24 0Z','#d97f33',900],['M-15 0Q-18-17-5-30Q-6-18 2-44Q7-25 11-31Q19-14 15 0Q0 6-15 0Z','#f0ad4f',640],['M-7 0Q-9-10-2-17Q-2-10 2-26Q5-14 8 0Q0 4-7 0Z','#fbe3a4',470]]){
     const tongue=make('path',{d,fill},patch);tongue.style.transformBox='fill-box';tongue.style.transformOrigin='50% 100%';
     this.run(tongue,[[1,1,0],[.9,1.2,-7],[1.08,.88,5],[.95,1.14,-3],[1.05,.94,6],[1,1,0]].map(([sx,sy,skew])=>({transform:`scale(${sx},${sy}) skewX(${skew}deg)`})),ms*rnd(.9,1.15),-rnd(0,ms));}}
   // Embers lifting off the fire and drifting downwind, the way the painted smoke already leans.
   const embers=make('g',{class:'fx-extra',fill:'#ffd58a'},world);
   for(let i=0;i<14;i++){const x=rnd(740,950),y=rnd(480,640),dx=rnd(150,330),dy=-rnd(80,190),ms=rnd(2600,5200),ember=make('circle',{r:f(rnd(1.6,3.2))},embers);
    this.run(ember,[{opacity:0,transform:move(x,y)},{opacity:1,transform:move(x+dx*.2,y+dy*.25+rnd(-12,12)),offset:.15},{opacity:.8,transform:move(x+dx*.6,y+dy*.6+rnd(-18,18)),offset:.6},{opacity:0,transform:move(x+dx,y+dy)}],ms,-rnd(0,ms));}}
  // Smoke rolling off the wreck, on the top layer so the soldiers pass underneath it.
  haze(world){const rnd=this.rnd;
   for(let i=0;i<7;i++){const ms=rnd(10000,14500),x=rnd(815,885),y=rnd(440,500),puff=make('ellipse',{rx:62,ry:46,fill:'url(#ms-smoke)',class:i%2?'fx-extra':''},world);
    this.run(puff,[{opacity:0,transform:move(x,y,' scale(.55)')},{opacity:.9,transform:move(x+70,y-45,' scale(1)'),offset:.18},{opacity:.65,transform:move(x+240,y-150,' scale(1.9)'),offset:.6},{opacity:0,transform:move(x+430,y-265,' scale(2.8)')}],ms,-ms*i/7);}}
  // The soldiers need the simulation and the character atlas. Until both are in, the fire simply burns on its own.
  troops(){if(!root.BPCore||!root.BPWorld||!root.BPMissions)return;this.actors=new Map();this.parts=[];this.flashes=[];this.scratch=document.createElement('canvas');this.scratch.width=this.scratch.height=112;this.tinted=new Map();
   const sheet=new Image();sheet.src='blackout/assets/characters.png';
   Promise.all([sheet.decode(),fetch('blackout/assets/characters.json').then(r=>r.json())]).then(([,atlas])=>{this.sheet=sheet;this.frames=atlas.frames;this.battle=new Skirmish();if(this.playing)this.loop();}).catch(err=>console.warn('Menu skirmish disabled',err));}
  // A frame of the atlas multiplied by a tint, which is exactly what a tinted sprite is in a mission. Tinted frames are
  // kept only while the scene is running.
  sprite(name,tint){const key=tint+name;let img=this.tinted.get(key);if(img)return img;const cell=this.frames[name]?.frame;if(!cell)return null;img=document.createElement('canvas');img.width=cell.w;img.height=cell.h;const g=img.getContext('2d');
   g.drawImage(this.sheet,cell.x,cell.y,cell.w,cell.h,0,0,cell.w,cell.h);g.globalCompositeOperation='multiply';g.fillStyle=css(tint);g.fillRect(0,0,cell.w,cell.h);g.globalCompositeOperation='destination-in';g.drawImage(this.sheet,cell.x,cell.y,cell.w,cell.h,0,0,cell.w,cell.h);this.tinted.set(key,img);return img;}
  stamp(g,name,tint,x,y,turn,sx=1,sy=1,alpha=1){const img=this.sprite(name,tint);if(!img)return;g.save();g.translate(x,y);g.rotate(turn);g.scale(sx,sy);g.globalAlpha=alpha;g.drawImage(img,-img.width/2,-img.height/2);g.restore();}
  emit(x,y,count,kind='spark',angle=null){const n=this.low?Math.ceil(count/2):count;for(let i=0;i<n&&this.parts.length<260;i++){const a=angle===null?Math.random()*Math.PI*2:angle+(Math.random()-.5)*1.8,speed=kind==='smoke'?15+Math.random()*35:70+Math.random()*190;
    this.parts.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:kind==='smoke'?1.4+Math.random()*1.4:.2+Math.random()*.6,kind,size:kind==='smoke'?7+Math.random()*14:1+Math.random()*4});}}
  // The same reactions render.js has to simulation events: muzzle flash and casing, cloth off a hit, sparks off a wall.
  react(e){switch(e.type){
   case 'shot':this.emit(e.x,e.y,4,'spark',e.angle);this.emit(e.x,e.y,2,'smoke',e.angle);this.emit(e.x-Math.cos(e.angle)*16,e.y-Math.sin(e.angle)*16,1,'casing',e.angle+Math.PI/2);this.flashes.push({x:e.x,y:e.y,angle:e.angle,life:.055,big:e.weapon==='magnum'});break;
   case 'hit':{this.emit(e.x,e.y,5,'cloth',e.angle);const a=this.actors.get(e.id);if(a)a.hit=.14;break;}
   case 'bulletimpact':this.emit(e.x,e.y,5,'spark');break;case 'meleeimpact':this.emit(e.x,e.y,12,'dust');break;case 'action':if(['slide','roll','dive','vault'].includes(e.action))this.emit(e.x,e.y,7,'dust');break;}}
  actor(id){let a=this.actors.get(id);if(!a){a={phase:0,hit:0};this.actors.set(id,a);}a.seen=this.stampTime;return a;}
  // One soldier, following drawActor in render.js step for step: which animation plays, at what frame, how the body
  // twists and squashes through a roll, the recoil kick, the shoulder stripe and (for a shield trooper) the plate.
  soldier(g,e,s,dt,op,pass){const A=root.BPWorld.archetypes,W=root.BPWorld.weapons,a=this.actor(e.id||(e===s.player?'rook':'mate')),meta=A[e.type],w=op?W[e.slots[e.slot]]:W[e.gun]||W.rifle,melee=meta?.melee,face=e.angle||0,tint=op?ROOK:TINTS[e.type]||TINTS.infantry;
   if(e.dead){if(pass===0)this.stamp(g,(melee?'knife':w.sprite)+'/idle/8',CORPSE,e.x+6,e.y,face+.6,.86,.55,.65*Math.min(1,(14-e.deathAge)/2));return;}
   const speed=Math.hypot(e.vx,e.vy),state=e.state||'idle';if(pass===1)a.phase+=speed*dt/95;let feetSeq='idle',seq='idle',bodyTime=s.time*10,footTime=a.phase*20,angle=face,scaleX=1,scaleY=1,lift=0,count=20,group=melee?'knife':w.sprite;
   if(speed>8){feetSeq=state==='sprint'?'run':'walk';seq='move';bodyTime=a.phase*20;const going=op?e.moveAngle:Math.atan2(e.vy,e.vx),rel=wrap(going-face);if(Math.abs(rel)>.6&&Math.abs(rel)<2.5)feetSeq=rel>0?'strafe_right':'strafe_left';if(Math.abs(rel)>2.5)footTime=-a.phase*20;}
   if(op&&e.reload>0){seq='reload';count=group==='handgun'?15:20;bodyTime=(1-e.reload/e.reloadTotal)*count;}
   else if(state==='melee'||melee&&e.attack>0){group='knife';seq='meleeattack';const t=state==='melee'?e.age/e.duration:e.attackAge/e.attack;bodyTime=t*15;count=15;angle+=Math.sin(t*Math.PI)*.18;}
   else if(e.shotAge<.12&&!melee){seq='shoot';count=3;bodyTime=e.shotAge/.12*3;}
   if(state==='roll'){feetSeq='run';footTime=e.age*75;seq='move';bodyTime=e.age*60;const t=e.age/e.duration;angle=e.actionDir+Math.sin(t*Math.PI)*1.45;scaleY=.5+.5*Math.abs(Math.cos(t*Math.PI));scaleX=.82;lift=Math.sin(t*Math.PI)*8;}
   if(pass===1&&a.hit>0)a.hit=Math.max(0,a.hit-dt);if(a.hit>0){angle+=Math.sin(a.hit/.14*Math.PI)*.18;scaleX*=1-a.hit*.7;}
   if(pass===1){g.save();g.translate(e.x+5,e.y+9);g.scale(1-lift/55,1-lift/55);g.fillStyle=css(C.shadow,.5);g.beginPath();g.ellipse(0,0,20,12,0,0,Math.PI*2);g.fill();g.restore();return;}
   const frame=group+'/'+seq+'/'+Math.max(0,Math.min(count-1,Math.floor(((bodyTime%count)+count)%count))),feet='feet/'+feetSeq+'/'+(feetSeq==='idle'?0:Math.floor(((footTime%20)+20)%20));
   const recoil=e.shotAge<.12?(1-e.shotAge/.12)*2:0,big=e.type==='scout'?.94:1;
   this.stamp(g,feet,tint,e.x,e.y-lift*.45,face,1,state==='roll'?.72:1);this.stamp(g,frame,tint,e.x-Math.cos(face)*recoil,e.y-lift-Math.sin(face)*recoil,angle,scaleX*big,scaleY*big);
   g.save();g.translate(e.x,e.y-lift);g.rotate(angle);g.lineCap='butt';const line=(x1,y1,x2,y2,width,color,alpha)=>{g.strokeStyle=css(color,alpha);g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();};
   if(op){line(-8,-15,-2,-13,4,0xd1b170,.95);line(-11,-18,-9,-7,2,0x272e21,.7);g.fillStyle=css(0xa89c76,.7);g.fillRect(-14,-8,4,6);}else line(-8,-15,-2,-13,4,0x9a705b,.9);
   if(e.type==='shield'){g.fillStyle=css(0x677064,.95);g.strokeStyle=css(0xa8ad90,.7);g.lineWidth=2;g.beginPath();g.roundRect(20,-28,10,56,3);g.fill();g.stroke();line(21,-7,28,-7,3,0xe0b572,.6);}
   if(e.type==='scout')line(-10,-12,-10,12,2,0xb9c48d,.7);
   g.restore();}
  draw(dt){const g=this.pen,s=this.battle.sim,box=this.canvas,k=box.width/1600,A=root.BPWorld.archetypes,[rook,mate]=this.battle.crew();this.stampTime=(this.stampTime||0)+1;
   g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,box.width,box.height);g.setTransform(k,0,0,box.height/1000,0,0);g.translate(900,500);g.rotate(TILT);g.translate(-900-OX,-500-OY);
   const cast=[[rook,true],[mate,true],...s.enemies.map(e=>[e,false])].sort((a,b)=>a[0].y-b[0].y);
   for(const pass of [0,1,2])for(const [e,op] of cast)if(pass===0?e.dead:!e.dead)this.soldier(g,e,s,dt,op,pass);
   for(const [id,a] of this.actors)if(a.seen!==this.stampTime)this.actors.delete(id);
   g.lineCap='butt';
   // A hostile winding up shows the same tell as in a mission: a red ring, and a thin amber line along its aim.
   for(const e of s.enemies){if(e.dead||!e.active||!(e.attack>0))continue;const meta=A[e.type],t=Math.min(1,e.attackAge/e.attack),reach=Math.min(meta.range||950,Math.min(gap(e,rook),gap(e,mate))+40);
    if(!meta.melee){g.strokeStyle=css(C.amber,.2+.6*t);g.lineWidth=1;g.beginPath();g.moveTo(e.x,e.y);g.lineTo(e.x+Math.cos(e.aim)*reach,e.y+Math.sin(e.aim)*reach);g.stroke();}
    g.strokeStyle=css(C.red,.8);g.lineWidth=2;g.beginPath();g.arc(e.x,e.y,(meta.radius||17)+7+4*t,0,Math.PI*2);g.stroke();}
   for(const op of [rook,mate])if(op.state==='melee'){const t=op.age/op.duration;g.strokeStyle=css(0xd6d3ac,.35);g.lineWidth=op.heavy?5:3;g.beginPath();g.arc(op.x,op.y,op.heavy?68:52,op.angle-1+t*2,op.angle-.3+t*2);g.stroke();}
   // Bullets in flight are short streaks, paler for the operators' rounds and rust for hostile fire.
   g.lineWidth=2;for(const b of s.projectiles){if(!b.active)continue;g.strokeStyle=css(b.enemy?0xd5a385:0xe0caa0,.9);g.beginPath();g.moveTo(b.x,b.y);g.lineTo(b.x-b.vx*.013,b.y-b.vy*.013);g.stroke();}
   this.parts=this.parts.filter(p=>{p.life-=dt;if(p.life<=0)return false;p.x+=p.vx*dt;p.y+=p.vy*dt;const fade=Math.min(1,p.life/(p.kind==='smoke'?.9:.3));
    if(p.kind==='smoke'){p.size+=dt*8;p.vx*=Math.exp(-dt);p.vy-=dt*6;g.fillStyle=css(DUST.smoke,.24*fade);g.beginPath();g.arc(p.x,p.y,p.size,0,Math.PI*2);g.fill();}
    else{p.vx*=Math.exp(-dt*4);p.vy*=Math.exp(-dt*4);g.fillStyle=css(DUST[p.kind],fade);g.fillRect(p.x,p.y,p.size,p.kind==='casing'?2:p.size);}return true;});
   this.flashes=this.flashes.filter(q=>{q.life-=dt;if(q.life<=0)return false;const size=q.big?24:14;g.fillStyle=css(0xedbe78,.9);g.beginPath();g.moveTo(q.x+Math.cos(q.angle)*size,q.y+Math.sin(q.angle)*size);g.lineTo(q.x+Math.cos(q.angle+1.5)*5,q.y+Math.sin(q.angle+1.5)*5);g.lineTo(q.x+Math.cos(q.angle-1.5)*5,q.y+Math.sin(q.angle-1.5)*5);g.fill();return true;});}
  // The drawing surface follows the painting's on-screen size, capped so a very large window does not cost more.
  fit(){const box=this.front.getBoundingClientRect(),scale=Math.min(root.devicePixelRatio||1,1920/Math.max(1,box.width)),w=Math.max(1,Math.round(box.width*scale)),h=Math.max(1,Math.round(box.height*scale));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.pen=this.pen||this.canvas.getContext('2d');}
  loop(){if(this.ticking||!this.battle)return;this.ticking=true;let last=performance.now();
   const frame=now=>{if(!this.playing){this.ticking=false;return;}const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    try{this.fit();for(const e of this.battle.update(dt)){this.react(e);this.heard(e);}this.draw(dt);}catch(err){this.battle=null;this.ticking=false;this.canvas.remove();console.warn('Menu skirmish disabled',err);return;}
    requestAnimationFrame(frame);};requestAnimationFrame(frame);}
  // Whoever made the scene can listen in on the battle (the game plays it as far-off gunfire). A fault there is theirs, not the scene's.
  heard(e){if(!this.onEvent)return;try{this.onEvent(e);}catch(err){this.onEvent=null;console.warn('Menu skirmish sound disabled',err);}}
  // Runs only while asked to. Pausing freezes the battle where it stands and releases the tinted sprite frames.
  play(on){on=!!on&&this.ready;if(on===this.playing)return;this.playing=on;for(const a of this.anims)on?a.play():a.pause();if(on)this.loop();else this.tinted?.clear();}
  // Low visual detail keeps the fire and the fight but drops the embers, half the smoke and half the sparks.
  lite(on){this.low=!!on;for(const box of [this.host,this.front])for(const svg of box?.querySelectorAll('svg')||[])svg.classList.toggle('lite',this.low);}
 }
 MenuScene.Skirmish=Skirmish;root.BPMenuScene=MenuScene;
})(globalThis);

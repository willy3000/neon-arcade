(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPCore=api;})(globalThis,function(World){
  'use strict';
  const DT=1/120, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  function event(s,type,data={}){if(s.events.length<256)s.events.push({type,...data});}
  function circleBox(x,y,r,b){const nx=clamp(x,b.x,b.x+b.w),ny=clamp(y,b.y,b.y+b.h);return (x-nx)**2+(y-ny)**2<r*r;}
  function segmentBox(x1,y1,x2,y2,b,pad=0){let lo=0,hi=1;const dx=x2-x1,dy=y2-y1;for(const [p,q] of [[-dx,x1-b.x+pad],[dx,b.x+b.w+pad-x1],[-dy,y1-b.y+pad],[dy,b.y+b.h+pad-y1]]){if(Math.abs(p)<1e-9){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return lo;}
  function segmentCircle(x1,y1,x2,y2,c,r){const dx=x2-x1,dy=y2-y1,fx=x1-c.x,fy=y1-c.y,a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=b*b-4*a*cc;if(cc<=0)return 0;if(a<1e-9||disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
  function lineOfSight(s,a,b){return !s.walls.some(w=>!w.dead&&w.kind!=='glass'&&segmentBox(a.x,a.y,b.x,b.y,w)!==null);}
  function clearAt(s,x,y,r=16,ignore=null){return !s.walls.some(w=>!w.dead&&w.id!==ignore&&circleBox(x,y,r,w));}
  function makeEnemy(s,e){const t=World.archetypes[e.type];return {...e,hp:t.hp,maxHp:t.hp,radius:e.type==='commander'?25:17,vx:0,vy:0,angle:0,dead:false,active:false,stagger:0,cooldown:.6+rand(s),attack:0,attackAge:0,aim:0,seen:0,lastX:e.x,lastY:e.y,phase:1,clip:0,reload:0,moveTime:0,side:rand(s)>.5?1:-1};}
  function create(options={}){
    const training=options.training===true,map=training?World.training():World.campaign(),stage=training?0:clamp(options.checkpoint?.stage||0,0,3);
    const spawn=map.checkpointSpawns[stage];const s={map,training,stage,time:options.checkpoint?.time||0,seed:options.seed||1701,tick:0,events:[],walls:map.walls.map(w=>({...w})),enemies:[],projectiles:Array.from({length:192},()=>({active:false})),grenades:[],pickups:map.pickups.map(p=>({...p,taken:false})),spawnWarnings:[],director:{clock:0,wave:0,rest:0,pressure:0},stats:{kills:options.checkpoint?.kills||0,shots:0,hits:0,damage:options.checkpoint?.damage||0,flows:options.checkpoint?.flows||0},mastery:{},difficulty:options.difficulty||'standard',completed:false,dead:false,cinematic:0,hitstop:0,lastFlow:-10,flowTime:0,checkpoint:null,endingStarted:false};
    s.player={x:spawn.x,y:spawn.y,vx:0,vy:0,angle:0,moveAngle:0,radius:16,health:100,armor:25,stamina:100,state:'idle',age:0,duration:0,actionDir:0,reload:0,cooldown:0,recoil:0,shotAge:10,meleeIndex:0,meleeAt:-10,meleeHit:false,meleeHold:0,heavyTriggered:false,heavy:false,heal:0,iframes:0,stepDistance:0,grenades:training?9:stage>=2?3:0,stims:training?5:2,slot:0,slots:['rifle','shotgun','pistol'],unlocks:training?Object.keys(World.weapons):stage>=2?['rifle','shotgun','pistol']:['rifle','pistol'],ammo:{},reserve:{}};
    for(const [k,w] of Object.entries(World.weapons)){s.player.ammo[k]=w.capacity;s.player.reserve[k]=w.reserve;}
    s.enemies=map.enemies.filter(e=>training||e.zone>=Math.min(stage,2)).map(e=>makeEnemy(s,e));
    if(stage>=2){const glass=s.walls.find(w=>w.id==='glass');if(glass)glass.dead=true;}
    if(stage===3)s.enemies=[];
    event(s,'radio',{speaker:'ROOK',text:training?'Live fire range. Chain a sprint into a slide, then vault the low barricade. Resupply by the southern locker.':stage===0?'Mayday. This is Rook. Bird is down. No survivors on comms. I need a radio.':'Rook, stay off the main streets. Your last position is compromised.',duration:7});
    return s;
  }
  function move(s,a,dx,dy,ignore=null){const r=a.radius,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let i=0;i<steps;i++){const ox=a.x,oy=a.y;a.x=clamp(a.x+dx/steps,r+40,s.map.width-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||a.type==='drone'&&b.low)continue;if(circleBox(a.x,a.y,r,b))a.x=ox;}a.y=clamp(a.y+dy/steps,r+40,s.map.height-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||a.type==='drone'&&b.low)continue;if(circleBox(a.x,a.y,r,b))a.y=oy;}}}
  function begin(s,state,duration,angle,cost=0){const p=s.player;if(p.stamina<cost)return false;p.stamina-=cost;p.state=state;p.age=0;p.duration=duration;p.actionDir=angle;p.heal=0;if(state!=='reload')p.reload=0;event(s,'action',{action:state,x:p.x,y:p.y});return true;}
  function flow(s){s.stats.flows++;s.flowTime=1.3;s.lastFlow=s.time;s.player.stamina=Math.min(100,s.player.stamina+12);event(s,'flow',{x:s.player.x,y:s.player.y});}
  function vault(s,input){const p=s.player,dx=input.mx||Math.cos(p.angle),dy=input.my||Math.sin(p.angle),len=Math.hypot(dx,dy),nx=dx/len,ny=dy/len;
    const candidates=s.walls.filter(b=>!b.dead&&b.low&&b.kind!=='underpass'&&circleBox(p.x+nx*52,p.y+ny*52,40,b)).sort((a,b)=>distance(p,{x:a.x+a.w/2,y:a.y+a.h/2})-distance(p,{x:b.x+b.w/2,y:b.y+b.h/2}));
    for(const b of candidates){let tx=p.x,ty=p.y;if(b.w>b.h){ty=ny>=0?b.y+b.h+23:b.y-23;tx=clamp(p.x,b.x-16,b.x+b.w+16);}else{tx=nx>=0?b.x+b.w+23:b.x-23;ty=clamp(p.y,b.y-16,b.y+b.h+16);}
      if(distance(p,{x:tx,y:ty})>180||!clearAt(s,tx,ty,17,b.id))continue;
      const perfect=p.state==='slide'&&p.age>.07&&p.age<.44;if(!begin(s,'vault',perfect?.26:.37,Math.atan2(ty-p.y,tx-p.x),perfect?8:15))return false;
      p.vault={sx:p.x,sy:p.y,tx,ty,ignore:b.id};if(perfect)flow(s);return true;
    }return false;
  }
  function shoot(s,actor,weapon,angle,enemy=false){const w=World.weapons[weapon],p=s.player;
    const base=angle+(enemy?0:p.recoil*Math.sin(p.ammo[weapon]*2.1));let reach=w.sprite==='handgun'?41:w.sprite==='shotgun'?57:54;
    const endX=actor.x+Math.cos(angle)*reach,endY=actor.y+Math.sin(angle)*reach;
    for(const wall of s.walls){if(wall.dead)continue;const t=segmentBox(actor.x,actor.y,endX,endY,wall);if(t!==null)reach=Math.min(reach,Math.max(0,t*(w.sprite==='handgun'?41:w.sprite==='shotgun'?57:54)-.1));}
    const ax=actor.x+Math.cos(angle)*reach,ay=actor.y+Math.sin(angle)*reach;
    for(let i=0;i<w.pellets;i++){const bullet=s.projectiles.find(b=>!b.active);if(!bullet)break;const spread=enemy?.035:w.spread*(p.aiming?.45:1)*(Math.hypot(p.vx,p.vy)>210?1.5:1);const a=base+(rand(s)-.5)*2*spread;
      Object.assign(bullet,{active:true,x:ax,y:ay,px:ax,py:ay,vx:Math.cos(a)*(enemy?620:w.speed),vy:Math.sin(a)*(enemy?620:w.speed),remaining:enemy?1100:w.range,damage:enemy?World.archetypes[actor.type].damage:w.damage,enemy,weapon,pierce:w.pierce||0,explosive:enemy?0:w.explosive||0,stagger:w.stagger,hitIds:[]});}
    actor.shotAge=0;event(s,'shot',{x:ax,y:ay,angle,weapon,enemy});if(!enemy){p.ammo[weapon]--;p.cooldown=w.rate;p.recoil=Math.min(.19,p.recoil+w.recoil);s.stats.shots++;move(s,p,-Math.cos(angle)*(weapon==='shotgun'?5:1.3),-Math.sin(angle)*(weapon==='shotgun'?5:1.3));}
  }
  function damagePlayer(s,amount,x,y){const p=s.player;if(s.dead||s.cinematic>0||p.iframes>0||p.state==='roll'&&p.age>=.055&&p.age<=.25||p.state==='dive'&&p.age>=.07&&p.age<=.28||p.state==='vault'&&p.age<.24)return false;
    const scale=s.difficulty==='story'?.55:s.difficulty==='intense'?1.22:1;amount*=scale;const armor=Math.min(p.armor,amount*.65);p.armor-=armor;p.health=Math.max(0,p.health-amount+armor);s.stats.damage+=amount-armor;p.iframes=.32;p.heal=0;s.director.rest=1.3;event(s,'damage',{x:p.x,y:p.y,amount,fromX:x,fromY:y});if(p.health<=0){s.dead=true;p.state='death';p.age=0;event(s,'death');}return true;
  }
  function damageEnemy(s,e,amount,angle=0,stagger=.15,source='rifle',bypass=false){if(e.dead)return;
    if(e.type==='shield'&&!bypass&&Math.abs(wrap(angle+Math.PI-e.angle))<.85){amount*=.15;event(s,'armorhit',{x:e.x,y:e.y});}
    e.hp-=amount;const resistant=e.type==='commander'&&source!=='melee'&&source!=='grenade';e.stagger=Math.max(e.stagger,resistant?Math.min(.025,stagger):stagger);if(!resistant){e.attack=0;e.attackAge=0;}move(s,e,Math.cos(angle)*Math.min(e.type==='commander'?3:14,amount*.18),Math.sin(angle)*Math.min(e.type==='commander'?3:14,amount*.18));event(s,'hit',{id:e.id,x:e.x,y:e.y,angle,amount});s.stats.hits++;if(source==='melee')s.hitstop=Math.max(s.hitstop,.025);
    if(e.hp<=0){e.dead=true;e.deathAge=0;s.stats.kills++;s.mastery[source]=(s.mastery[source]||0)+1;event(s,'kill',{x:e.x,y:e.y,enemy:e.type});if(rand(s)<.55||s.player.health<40)s.pickups.push({id:'drop'+s.tick+e.id,x:e.x,y:e.y,type:s.player.health<50?'health':'ammo',taken:false});}
  }
  function damageProp(s,b,damage){if(b.dead||!Number.isFinite(b.hp))return;b.hp-=damage;event(s,'impact',{x:b.x+b.w/2,y:b.y+b.h/2,kind:b.kind});if(b.hp<=0){b.dead=true;event(s,'destroy',{x:b.x+b.w/2,y:b.y+b.h/2,kind:b.kind,w:b.w,h:b.h});if(b.kind==='barrel'||b.kind==='vehicle')explode(s,b.x+b.w/2,b.y+b.h/2,b.kind==='vehicle'?190:140,b.kind==='vehicle'?130:105);if(b.kind==='console'){for(const e of s.enemies)if(!e.dead&&distance(e,{x:b.x,y:b.y})<380){e.stagger=3;e.attack=0;}event(s,'toast',{text:'POWER GRID DISRUPTED'});}}}
  function explode(s,x,y,radius=150,damage=110,enemy=false){event(s,'explosion',{x,y,radius});for(const b of s.walls){if(b.dead||!Number.isFinite(b.hp))continue;const d=Math.hypot(clamp(x,b.x,b.x+b.w)-x,clamp(y,b.y,b.y+b.h)-y);if(d<radius)damageProp(s,b,damage*(1-d/radius));}
    for(const e of s.enemies){const d=distance(e,{x,y});if(!e.dead&&d<radius)damageEnemy(s,e,damage*(1-.55*d/radius),Math.atan2(e.y-y,e.x-x),.65,'grenade',true);}
    const d=distance(s.player,{x,y});if(d<radius)damagePlayer(s,damage*(enemy?.6:.45)*(1-d/radius),x,y);
  }
  function stepProjectiles(s,dt){for(const b of s.projectiles){if(!b.active)continue;const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;b.px=b.x;b.py=b.y;let target=null,t=2;
      for(const w of s.walls){if(w.dead)continue;const u=segmentBox(b.x,b.y,nx,ny,w);if(u!==null&&u<t){t=u;target={kind:'wall',a:w};}}
      const list=b.enemy?[s.player]:s.enemies;
      for(const e of list){if(e.dead||b.hitIds.includes(e.id))continue;const u=segmentCircle(b.x,b.y,nx,ny,e,e.radius+(b.explosive?4:2));if(u!==null&&u<t){t=u;target={kind:b.enemy?'player':'enemy',a:e};}}
      if(target){b.x+=(nx-b.x)*t;b.y+=(ny-b.y)*t;const angle=Math.atan2(b.vy,b.vx);
        if(b.explosive)explode(s,b.x,b.y,b.explosive,b.damage);
        else if(target.kind==='wall')damageProp(s,target.a,b.damage);
        else if(target.kind==='enemy')damageEnemy(s,target.a,b.damage,angle,b.stagger,b.weapon);
        else damagePlayer(s,b.damage,b.px,b.py);
        event(s,'bulletimpact',{x:b.x,y:b.y,enemy:b.enemy});
        if(target.kind==='enemy'&&b.pierce>0&&!b.explosive){b.pierce--;b.hitIds.push(target.a.id);b.x=nx;b.y=ny;}else b.active=false;
      }else{b.x=nx;b.y=ny;}
      b.remaining-=Math.hypot(b.vx,b.vy)*dt;if(b.remaining<=0&&b.active){b.active=false;if(b.explosive)explode(s,b.x,b.y,b.explosive,b.damage);}
    }
  }
  function melee(s,heavy=false){const p=s.player;if(['roll','dive','vault','melee'].includes(p.state)||p.heal>0)return false;const wasSlide=p.state==='slide',index=s.time-p.meleeAt<.95?(p.meleeIndex+1)%3:0;p.meleeIndex=index;p.meleeAt=s.time;p.meleeHit=false;p.heavy=heavy;
    if(!begin(s,'melee',heavy?.62:.34,p.angle,heavy?12:3))return false;if(wasSlide){flow(s);move(s,p,Math.cos(p.angle)*15,Math.sin(p.angle)*15);}event(s,'meleeswing',{x:p.x,y:p.y,heavy});return true;
  }
  function interact(s,input){const p=s.player,obj=s.map.objectives[Math.min(s.stage,s.map.objectives.length-1)];
    if(!s.training&&distance(p,obj)<90){const enemies=s.enemies.filter(e=>!e.dead&&e.zone===Math.min(s.stage,2));
      if(s.stage<3&&enemies.length){event(s,'toast',{text:'CLEAR THE HOSTILES BEFORE INTERACTING'});return;}
      if(s.stage===0){s.stage=1;checkpoint(s);event(s,'radio',{speaker:'CONTROL / UNKNOWN',text:'Rook. You weren’t supposed to survive. Get off this frequency. There’s a supply cache in the south alley.',duration:7});}
      else if(s.stage===1){s.stage=2;p.unlocks.push('shotgun');p.grenades=3;p.health=Math.max(85,p.health);p.armor=45;p.stims=Math.max(2,p.stims);for(const k of p.slots)p.reserve[k]=World.weapons[k].reserve;checkpoint(s);event(s,'unlock',{items:['shotgun','frag']});event(s,'radio',{speaker:'ROOK',text:'Breaching shotgun. Frags. Someone left this for me. Control, I’m moving to the courtyard.',duration:6});}
      else if(s.stage===2){s.stage=3;s.director.clock=0;s.director.wave=0;checkpoint(s);event(s,'radio',{speaker:'OVERWATCH',text:'Beacon received. Two minutes out. Multiple contacts closing on your position. Hold that courtyard.',duration:6});}
      else if(s.stage===4){s.cinematic=.001;s.endingStarted=true;event(s,'radio',{speaker:'OVERWATCH',text:'Rook, we have you. Wait… that launch signature is ours. They fired on us. ROOK, MOVE!',duration:7});event(s,'cinematic');}
      return;
    }
    if(s.training){const kit=s.pickups.find(pick=>pick.type==='supply'&&distance(p,pick)<100);if(kit){resupply(s);return;}}
    if(!vault(s,input))event(s,'toast',{text:'VAULT LOW COVER IN YOUR MOVEMENT DIRECTION'});
  }
  function checkpoint(s){s.checkpoint={stage:Math.min(s.stage,3),time:s.time,kills:s.stats.kills,damage:s.stats.damage,flows:s.stats.flows};event(s,'checkpoint',{checkpoint:{...s.checkpoint}});event(s,'toast',{text:'CHECKPOINT SECURED'});s.player.health=Math.max(s.player.health,70);s.player.stamina=100;}
  function resupply(s){const p=s.player;p.health=100;p.armor=50;p.stims=5;p.grenades=9;p.stamina=100;for(const [k,w] of Object.entries(World.weapons)){p.ammo[k]=w.capacity;p.reserve[k]=w.reserve;}event(s,'pickup',{kind:'supply',x:p.x,y:p.y});event(s,'toast',{text:'FIELD EQUIPMENT REPLENISHED'});}
  function stepPlayer(s,input,dt){const p=s.player,w=World.weapons[p.slots[p.slot]],busy=['slide','roll','dive','vault','melee'].includes(p.state);p.age+=dt;p.shotAge+=dt;p.cooldown=Math.max(0,p.cooldown-dt);p.iframes=Math.max(0,p.iframes-dt);p.recoil=Math.max(0,p.recoil-dt*.18);p.aiming=!!input.aiming;
    const mx=input.mx||0,my=input.my||0,len=Math.hypot(mx,my),nx=len?mx/len:0,ny=len?my/len:0;
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))p.angle=Math.atan2(input.aimY-p.y,input.aimX-p.x);
    if(input.slot!==undefined&&input.slot!==p.slot){const key=p.slots[input.slot];if(p.unlocks.includes(key)){p.slot=input.slot;p.reload=0;p.cooldown=.15;event(s,'swap');}else event(s,'toast',{text:'SHOTGUN LOCKED / FIND THE SUPPLY CACHE'});}
    if(input.roll&&p.stamina>=30&&!['roll','dive','vault'].includes(p.state)){const dive=input.sprint&&len>0;const chain=p.state==='melee'&&p.age>.19;if(begin(s,dive?'dive':'roll',dive?.63:.4,len?Math.atan2(ny,nx):p.angle,dive?40:30)&&chain)flow(s);}
    if(input.slide&&len>0&&Math.hypot(p.vx,p.vy)>265&&!busy){if(begin(s,'slide',.7,Math.atan2(p.vy,p.vx),24)){p.slideSpeed=Math.max(490,Math.hypot(p.vx,p.vy)*1.38);}}
    if(input.interact&&!['vault','roll','dive'].includes(p.state))interact(s,{...input,mx:nx,my:ny});
    if(input.melee){p.meleeHold=0;p.heavyTriggered=false;melee(s,false);}if(input.meleeDown){p.meleeHold+=dt;if(p.meleeHold>.43&&!p.heavyTriggered&&p.state!=='melee'){p.heavyTriggered=true;melee(s,true);}}
    if(input.gadget&&p.stims>0&&p.health<100&&!['roll','dive','vault'].includes(p.state)){p.heal=.85;p.healTotal=.85;event(s,'healstart');}
    if(p.heal>0){p.heal-=dt;if(p.heal<=0){p.stims--;p.health=Math.min(100,p.health+50);p.iframes=.25;event(s,'pickup',{kind:'health',x:p.x,y:p.y});}}
    if(input.grenade&&p.grenades>0&&!['vault','roll','dive'].includes(p.state)){p.grenades--;const d=Math.min(380,Math.hypot((input.aimX??p.x+300)-p.x,(input.aimY??p.y)-p.y));s.grenades.push({x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(p.angle)*d,ty:p.y+Math.sin(p.angle)*d,age:0,duration:.58,fuse:1.15,enemy:false});event(s,'throw',{x:p.x,y:p.y});}
    if(input.reload&&!p.reload&&p.ammo[p.slots[p.slot]]<w.capacity&&p.reserve[p.slots[p.slot]]>0&&!busy){p.reload=w.reload;p.reloadTotal=w.reload;event(s,'reload',{weapon:p.slots[p.slot]});}
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){const key=p.slots[p.slot],def=World.weapons[key],amount=Math.min(def.capacity-p.ammo[key],p.reserve[key]);p.ammo[key]+=amount;p.reserve[key]-=amount;event(s,'reloadend');}}
    if(input.fire&&p.cooldown<=0&&p.reload<=0&&p.heal<=0&&!['roll','dive','vault','melee'].includes(p.state)){const key=p.slots[p.slot];if(p.ammo[key]>0)shoot(s,p,key,p.angle);else{p.cooldown=.35;event(s,'empty');event(s,'toast',{text:'MAGAZINE EMPTY / RELOAD'});}}
    const oldX=p.x,oldY=p.y;
    if(p.state==='vault'){const v=p.vault,t=clamp(p.age/p.duration,0,1),ease=t*t*(3-2*t);const tx=v.sx+(v.tx-v.sx)*ease,ty=v.sy+(v.ty-v.sy)*ease;move(s,p,tx-p.x,ty-p.y,v.ignore);p.vx=Math.cos(p.actionDir)*320;p.vy=Math.sin(p.actionDir)*320;}
    else if(['slide','roll','dive'].includes(p.state)){let speed=p.state==='slide'?p.slideSpeed*Math.exp(-2.6*p.age):p.state==='roll'?550*(1-.55*clamp(p.age/p.duration,0,1)):690*(1-.7*clamp(p.age/p.duration,0,1));p.radius=p.state==='slide'?10:16;p.vx=Math.cos(p.actionDir)*speed;p.vy=Math.sin(p.actionDir)*speed;move(s,p,p.vx*dt,p.vy*dt);}
    else{p.radius=16;const sprint=input.sprint&&len>0&&p.stamina>4&&!input.fire&&!input.aiming&&!p.reload&&!p.heal;const speed=(sprint?360:input.aiming?175:250)*World.weapons[p.slots[p.slot]].mobility*(p.state==='melee'?.45:p.reload?.7:p.heal?.45:1);const response=Math.min(1,dt*(len?25:31));p.vx+=(nx*speed-p.vx)*response;p.vy+=(ny*speed-p.vy)*response;move(s,p,p.vx*dt,p.vy*dt);
      if(p.state!=='melee'){p.state=sprint?'sprint':len?'run':'idle';}if(sprint)p.stamina=Math.max(0,p.stamina-dt*13);}
    if(p.state==='melee'&&!p.meleeHit&&p.age>=(p.heavy?.24:.12)){p.meleeHit=true;const reach=p.heavy?90:73,damage=p.heavy?95:[45,55,80][p.meleeIndex];for(const e of s.enemies){if(e.dead||distance(p,e)>reach||Math.abs(wrap(Math.atan2(e.y-p.y,e.x-p.x)-p.angle))>1.25||!lineOfSight(s,p,e))continue;const finish=e.hp<35;damageEnemy(s,e,finish?200:damage,p.angle,p.heavy?.9:.45,'melee',p.heavy||finish);event(s,'meleeimpact',{x:e.x,y:e.y,finish});}for(const b of s.walls)if(!b.dead&&Number.isFinite(b.hp)&&circleBox(p.x+Math.cos(p.angle)*45,p.y+Math.sin(p.angle)*45,32,b))damageProp(s,b,damage);}
    if(['vault','roll','dive','slide','melee'].includes(p.state)&&p.age>=p.duration){p.state=len?'run':'idle';p.age=0;p.radius=16;}
    if(!['sprint','roll','dive','slide','vault','melee'].includes(p.state))p.stamina=Math.min(100,p.stamina+dt*26);
    const travel=Math.hypot(p.x-oldX,p.y-oldY);if(travel>.05)p.moveAngle=Math.atan2(p.y-oldY,p.x-oldX);p.stepDistance+=travel;if(p.stepDistance>=(p.state==='sprint'?62:51)&&!['slide','roll','dive','vault'].includes(p.state)){p.stepDistance=0;event(s,'footstep',{x:p.x,y:p.y,surface:s.training?'metal':'concrete'});}
  }
  function enemyMovement(s,e,tx,ty,speed,dt){const dx=tx-e.x,dy=ty-e.y,len=Math.hypot(dx,dy);if(len<12)return;const ox=e.x,oy=e.y;move(s,e,dx/len*speed*dt,dy/len*speed*dt);if(Math.hypot(e.x-ox,e.y-oy)<.1){const angle=Math.atan2(dy,dx)+e.side*Math.PI*.5;move(s,e,Math.cos(angle)*speed*dt,Math.sin(angle)*speed*dt);}e.vx=(e.x-ox)/dt;e.vy=(e.y-oy)/dt;e.moveTime+=Math.hypot(e.vx,e.vy)*dt/80;}
  function stepEnemies(s,dt){const p=s.player;for(const e of s.enemies){if(e.dead){e.deathAge=(e.deathAge||0)+dt;continue;}e.vx=0;e.vy=0;e.shotAge=(e.shotAge||0)+dt;e.cooldown-=dt;e.stagger=Math.max(0,e.stagger-dt);e.reload=Math.max(0,e.reload-dt);if(e.stagger>0||e.reload>0)continue;
      const type=World.archetypes[e.type],dist=distance(p,e),canSee=dist<(e.type==='sniper'?1000:740)&&lineOfSight(s,e,p),eligible=s.training||e.zone<=Math.min(s.stage,2);
      if(canSee&&eligible){e.active=true;e.seen=4;e.lastX=p.x;e.lastY=p.y;}else e.seen=Math.max(0,e.seen-dt);
      if(!e.active||!eligible)continue;
      if(e.type==='commander'){const phase=e.hp<e.maxHp*.33?3:e.hp<e.maxHp*.66?2:1;if(phase>e.phase){e.phase=phase;e.stagger=.15;e.cooldown=0;if(phase===2){s.grenades.push({x:e.x,y:e.y,sx:e.x,sy:e.y,tx:e.lastX,ty:e.lastY,age:0,duration:.65,fuse:1.65,enemy:true});event(s,'enemygrenade',{x:e.lastX,y:e.lastY});}event(s,'radio',{speaker:'HOSTILE COMMANDER',text:phase===2?'He’s alone. Flush him out.':'Cut off every exit. He does not leave this city.',duration:4});} }
      if(e.seen<=0){enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);continue;}
      const aim=Math.atan2(e.lastY-e.y,e.lastX-e.x);e.angle=aim;
      if(e.attack>0){e.attackAge+=dt;if(e.attackAge>=e.attack){if(e.type==='rusher'){if(dist<70&&canSee)damagePlayer(s,type.damage,e.x,e.y);}
          else if(e.type==='commander'&&e.phase>=2&&e.clip%3===2){s.grenades.push({x:e.x,y:e.y,sx:e.x,sy:e.y,tx:e.targetX,ty:e.targetY,age:0,duration:.65,fuse:1.65,enemy:true});event(s,'enemygrenade',{x:e.targetX,y:e.targetY});}
          else{const a=e.type==='sniper'?e.aim:aim;shoot(s,e,'rifle',a,true);if(e.type==='commander'&&e.phase===3){shoot(s,e,'rifle',a+.14,true);shoot(s,e,'rifle',a-.14,true);}}
          e.attack=0;e.cooldown=type.rate*(s.difficulty==='intense'?.8:s.difficulty==='story'?1.2:1);e.clip++;if(e.clip>=5){e.clip=0;e.reload=1.65;event(s,'enemyreload',{x:e.x,y:e.y});}}
        continue;
      }
      if(canSee&&dist<type.range&&e.cooldown<=0){e.attack=type.windup;e.attackAge=0;e.aim=aim;e.targetX=p.x;e.targetY=p.y;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type});continue;}
      if(e.type==='rusher'){enemyMovement(s,e,e.lastX,e.lastY,type.speed,dt);}
      else if(e.type==='drone'){enemyMovement(s,e,p.x-Math.cos(aim)*300-Math.sin(aim)*e.side*140,p.y-Math.sin(aim)*300+Math.cos(aim)*e.side*140,type.speed,dt);}
      else if(e.type==='shield'){if(dist>270)enemyMovement(s,e,e.lastX,e.lastY,type.speed,dt);}
      else if(e.type==='sniper'){if(dist<280)enemyMovement(s,e,e.x-Math.cos(aim)*150,e.y-Math.sin(aim)*150,type.speed,dt);else if(!canSee)enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);}
      else{const cover=s.walls.filter(b=>!b.dead&&b.low&&distance(e,{x:b.x+b.w/2,y:b.y+b.h/2})<250).sort((a,b)=>distance(e,{x:a.x,y:a.y})-distance(e,{x:b.x,y:b.y}))[0];
        if(e.hp<e.maxHp*.4&&cover){const tx=cover.x+cover.w/2-Math.cos(aim)*65,ty=cover.y+cover.h/2-Math.sin(aim)*65;enemyMovement(s,e,tx,ty,type.speed,dt);}
        else if(!canSee||dist>type.range*.85)enemyMovement(s,e,e.lastX-Math.cos(aim)*260-Math.sin(aim)*e.side*130,e.lastY-Math.sin(aim)*260+Math.cos(aim)*e.side*130,type.speed,dt);
        else if(e.cooldown>.4)enemyMovement(s,e,e.x-Math.sin(aim)*e.side*45,e.y+Math.cos(aim)*e.side*45,type.speed*.6,dt);
      }
    }}
  function warnSpawn(s,entries){for(const e of entries){let pos=e;if(distance(s.player,e)<340){pos=[{x:2250,y:1150},{x:1660,y:1640},{x:2270,y:1680},{x:1490,y:1450}].find(a=>distance(s.player,a)>=340&&clearAt(s,a.x,a.y,25));}if(!pos)continue;const warning={...e,x:pos.x,y:pos.y,delay:2.3};s.spawnWarnings.push(warning);event(s,'spawnwarning',{x:warning.x,y:warning.y});}event(s,'toast',{text:'HOSTILE REINFORCEMENTS / WATCH THE APPROACHES'});}
  function director(s,dt){const d=s.director,p=s.player;d.clock+=dt;d.rest=Math.max(0,d.rest-dt);d.pressure=clamp(s.enemies.filter(e=>e.active&&!e.dead).length/7+(100-p.health)/200,0,1);
    d.supplyCooldown=Math.max(0,(d.supplyCooldown||0)-dt);const equipped=p.slots[p.slot];
    if(!s.training&&d.supplyCooldown===0&&p.reserve[equipped]<BPWeaponCapacity(equipped)&&s.pickups.filter(a=>!a.taken&&a.type==='ammo').length<2){const x=p.x-Math.cos(p.angle)*80,y=p.y-Math.sin(p.angle)*80;if(clearAt(s,x,y,12)){s.pickups.push({id:'support'+s.tick,x,y,type:'ammo',taken:false});d.supplyCooldown=18;}}
    for(const warning of s.spawnWarnings){warning.delay-=dt;if(warning.delay<=0&&!warning.spawned){warning.spawned=true;const e=makeEnemy(s,warning);e.active=true;e.seen=4;e.lastX=p.x;e.lastY=p.y;const existing=s.enemies.find(a=>a.id===e.id);if(existing)Object.assign(existing,e);else s.enemies.push(e);}}
    s.spawnWarnings=s.spawnWarnings.filter(w=>!w.spawned);
    if(s.training){if(d.clock>9){d.clock=0;const returning=s.enemies.filter(e=>e.dead&&e.deathAge>4&&distance(e,p)>340).map(e=>s.map.enemies.find(a=>a.id===e.id));if(returning.length)warnSpawn(s,returning);if(p.health<25){p.health=65;event(s,'toast',{text:'TRAINING SAFETY / HEALTH RESTORED'});}}return;}
    if(s.stage!==3)return;
    if(d.wave===0){d.wave=1;warnSpawn(s,[{id:'w1',type:'rusher',x:1670,y:1640,zone:2},{id:'w2',type:'infantry',x:2250,y:1240,zone:2}]);}
    if(d.wave===1&&d.clock>9&&d.rest===0&&s.enemies.filter(e=>!e.dead).length<4){d.wave=2;warnSpawn(s,[{id:'boss',type:'commander',x:2250,y:1150,zone:2},{id:'w3',type:s.difficulty==='story'?'infantry':'shield',x:1460,y:1560,zone:2}]);if(p.health<50)s.pickups.push({id:'director-med',x:1900,y:1740,type:'health',taken:false});}
    if(d.wave===2&&s.enemies.every(e=>e.dead)&&s.spawnWarnings.length===0){s.stage=4;event(s,'radio',{speaker:'OVERWATCH',text:'Perimeter clear. Signal the beacon. We’re coming down to you now.',duration:5});event(s,'toast',{text:'EXTRACTION AVAILABLE'});}
  }
  function rating(s){const score=Math.max(0,Math.round(10000+s.stats.kills*150+s.stats.flows*250-s.stats.damage*15-s.time*8));return {time:s.time,score,rating:score>=10500?'S':score>=8500?'A':score>=6000?'B':'C'};}
  function BPWeaponCapacity(key){return World.weapons[key].capacity;}
  function step(s,input={},dt=DT){if(s.completed||s.dead)return;
    if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);s.buffered=s.buffered||{};for(const key of ['roll','slide','interact','reload','gadget','melee','grenade'])if(input[key])s.buffered[key]=true;if(input.slot!==undefined)s.buffered.slot=input.slot;return;}
    if(s.buffered){input={...input,...s.buffered};s.buffered=null;}
    s.tick++;s.time+=dt;s.flowTime=Math.max(0,s.flowTime-dt);
    if(s.cinematic>0){s.cinematic+=dt;if(s.cinematic>2.1&&!s.impactCinematic){s.impactCinematic=true;explode(s,s.player.x+130,s.player.y-170,180,0);event(s,'radio',{speaker:'ROOK',text:'They knew our callsigns. Our route. Our extraction. This wasn’t a crash. This was a cleanup.',duration:7});}if(s.cinematic>6){s.completed=true;event(s,'complete',{...rating(s)});}return;}
    stepPlayer(s,input,dt);if(s.dead)return;stepEnemies(s,dt);stepProjectiles(s,dt);
    for(const g of s.grenades){g.age+=dt;if(g.age<g.duration){const t=clamp(g.age/g.duration,0,1);const nx=g.sx+(g.tx-g.sx)*t,ny=g.sy+(g.ty-g.sy)*t;if(!g.blocked){if(clearAt(s,nx,ny,4)){g.x=nx;g.y=ny;}else g.blocked=true;}}if(g.age>=g.fuse&&!g.exploded){g.exploded=true;explode(s,g.x,g.y,155,g.enemy?85:135,g.enemy);}}
    s.grenades=s.grenades.filter(g=>!g.exploded);
    for(const pick of s.pickups){if(pick.taken||pick.type==='supply'||distance(pick,s.player)>35)continue;const p=s.player;if(pick.type==='health'){if(p.health>=100)continue;p.health=Math.min(100,p.health+30);}if(pick.type==='armor')p.armor=Math.min(80,p.armor+30);if(pick.type==='ammo')for(const k of p.slots)p.reserve[k]=Math.min(World.weapons[k].reserve*2,p.reserve[k]+(k==='shotgun'?12:45));pick.taken=true;event(s,'pickup',{kind:pick.type,x:pick.x,y:pick.y});}
    director(s,dt);
  }
  return {DT,create,step,move,clearAt,lineOfSight,circleBox,segmentBox,segmentCircle,distance,shoot,damagePlayer,damageEnemy,damageProp,explode,vault,interact,melee,checkpoint,resupply,rating};
});

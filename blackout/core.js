(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPCore=api;})(globalThis,function(World){
  'use strict';
  const DT=1/120,CELL=40,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),W=World.weapons,A=World.archetypes,G=World.gear,ORDER=World.order;
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],FUSE={frag:1.15,incendiary:.62,flash:.9,smoke:.7,emp:.95,decoy:.6};
  const diff=s=>World.difficulties[s.difficulty]||World.difficulties.standard,atLeast=(s,level)=>ORDER.indexOf(s.difficulty)>=ORDER.indexOf(level);
  function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  function event(s,type,data={}){if(s.events.length<256)s.events.push({type,...data});}
  function circleBox(x,y,r,b){const nx=clamp(x,b.x,b.x+b.w),ny=clamp(y,b.y,b.y+b.h);return (x-nx)**2+(y-ny)**2<r*r;}
  function segmentBox(x1,y1,x2,y2,b,pad=0){let lo=0,hi=1;const dx=x2-x1,dy=y2-y1;for(const [p,q] of [[-dx,x1-b.x+pad],[dx,b.x+b.w+pad-x1],[-dy,y1-b.y+pad],[dy,b.y+b.h+pad-y1]]){if(Math.abs(p)<1e-9){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return lo;}
  function segmentCircle(x1,y1,x2,y2,c,r){const dx=x2-x1,dy=y2-y1,fx=x1-c.x,fy=y1-c.y,a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=b*b-4*a*cc;if(cc<=0)return 0;if(a<1e-9||disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
  function lineOfSight(s,a,b){return !s.walls.some(w=>!w.dead&&!w.pass&&w.kind!=='glass'&&segmentBox(a.x,a.y,b.x,b.y,w)!==null);}
  // Enemy perception also respects smoke.
  function sees(s,a,b){return lineOfSight(s,a,b)&&!s.zones.some(z=>z.kind==='smoke'&&segmentCircle(a.x,a.y,b.x,b.y,z,z.r)!==null);}
  function clearAt(s,x,y,r=16,ignore=null){return !s.walls.some(w=>!w.dead&&w.id!==ignore&&circleBox(x,y,r,w));}
  const reserveOf=(s,k)=>Math.round(W[k].reserve*s.mods.reserve*(s.mods.mastery[k]>=1?1.1:1)),reloadOf=(s,k)=>W[k].reload*s.mods.reload*(s.mods.mastery[k]>=2?.92:1),damageOf=(s,k)=>W[k].damage*(s.mods.mastery[k]>=3?1.06:1);
  function makeEnemy(s,e){const t=A[e.type]||A.infantry,gun=e.gun||s.map.guns?.[e.type]||t.gun||null;return {...e,gun,hp:t.hp,maxHp:t.hp,radius:t.radius||17,vx:0,vy:0,angle:e.angle||0,dead:false,active:false,stagger:0,cooldown:.6+rand(s),attack:0,attackAge:0,aim:0,seen:0,lastX:e.x,lastY:e.y,phase:1,clip:0,reload:0,moveTime:0,side:rand(s)>.5?1:-1,burst:0,burstT:0,shieldDown:0,disabled:0,gone:0,flashed:0,woke:false};}
  const stageDef=s=>s.map.stages[Math.min(s.stage,s.map.stages.length-1)],liveZone=s=>stageDef(s).zone;
  const eligible=(s,e)=>s.training||e.zone<=liveZone(s)||e.woke||e.spawned;
  function create(options={}){
    const training=options.training===true,id=training?'range':options.mission||'crash',map=World.mission(id),last=map.stages.length-1,cp=training?null:options.checkpoint||null;
    let stage=cp?clamp(Math.floor(cp.stage)||0,0,last):0;while(stage>0&&!map.stages[stage].spawn)stage--;
    const st=map.stages[stage],up=options.profile?.upgrades||{},lvl=k=>clamp(Math.floor(up[k]||0),0,3);
    const s={map,mission:id,training,stage,time:cp?.time||0,seed:options.seed||1701,tick:0,events:[],walls:map.walls.map(w=>({...w})),enemies:[],projectiles:Array.from({length:192},()=>({active:false})),grenades:[],zones:[],mines:[],decoy:null,hazards:map.hazards.map(h=>({...h})),pickups:map.pickups.map(p=>({...p,taken:false,base:true})),spawnWarnings:[],
      director:{clock:0,wave:0,rest:0,pressure:0,fired:{}},stats:{kills:cp?.kills||0,shots:0,hits:0,damage:cp?.damage||0,flows:cp?.flows||0,credits:cp?.credits||0,intel:cp?.intel||0,bestCombo:0,wave:0},mastery:{},difficulty:options.difficulty||'standard',
      owned:[...(options.owned||(training?Object.keys(W):['rifle','pistol']))],completed:false,dead:false,cinematic:0,hitstop:0,lastFlow:-10,flowTime:0,checkpoint:null,endingStarted:false,combo:0,comboAt:-10,squad:{nade:3},camp:{x:0,y:0,t:0},killed:Array.isArray(cp?.killed)?[...cp.killed]:[],goal:{x:st.x,y:st.y},progress:0,dark:map.dark||0,boss:null};
    s.mods={reserve:1+.2*lvl('pouch'),reload:1-.08*lvl('reflex'),regen:1+.15*lvl('conditioning'),drain:1-.1*lvl('conditioning'),armor:25+20*lvl('plating'),maxArmor:80+15*lvl('plating'),stims:2+lvl('medic'),charges:lvl('bandolier'),mastery:{}};
    for(const k of Object.keys(W))s.mods.mastery[k]=clamp(Math.floor(options.profile?.mastery?.[k]||0),0,3);
    for(let j=0;j<=stage;j++){const q=map.stages[j];for(const wid of q.restoreDead||[]){const w=s.walls.find(b=>b.id===wid);if(w)w.dead=true;}for(const n of q.enter?.opens||[])for(const w of s.walls)if(w.gate===n)w.dead=true;if(q.dark!==undefined)s.dark=q.dark;}
    for(const wid of Array.isArray(cp?.dead)?cp.dead:[]){const w=s.walls.find(b=>b.id===wid);if(w)w.dead=true;}
    if(cp?.intel>0)for(const q of s.pickups)if(q.type==='intel')q.taken=true;
    const lo=training?{primary:'rifle',secondary:'pistol',lethal:'frag',tactical:'flash'}:{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,...(options.loadout||{})};
    const okSlots=a=>Array.isArray(a)&&a.length===2&&W[a[0]]&&W[a[1]]&&W[a[0]].slot===0&&W[a[1]].slot===1,okGear=(k,slot)=>k&&G[k]&&G[k].slot===slot?k:null;
    const slots=okSlots(cp?.slots)?[...cp.slots]:okSlots([lo.primary,lo.secondary])?[lo.primary,lo.secondary]:['rifle','pistol'];
    let lethal=okGear(cp&&cp.lethal!==undefined?cp.lethal:lo.lethal,'lethal');const tactical=okGear(cp&&cp.tactical!==undefined?cp.tactical:lo.tactical,'tactical');
    for(let j=1;j<=stage;j++){const g=map.stages[j].enter?.grants;if(g?.lethal&&!lethal)lethal=g.lethal;}
    const spawn=cp&&Number.isFinite(cp.x)&&Number.isFinite(cp.y)&&clearAt(s,cp.x,cp.y,17)?{x:cp.x,y:cp.y}:st.spawn||map.start;
    s.player={x:spawn.x,y:spawn.y,vx:0,vy:0,angle:0,moveAngle:0,radius:16,health:100,armor:s.mods.armor,maxArmor:s.mods.maxArmor,stamina:100,state:'idle',age:0,duration:0,actionDir:0,reload:0,cooldown:0,recoil:0,shotAge:10,meleeIndex:0,meleeAt:-10,meleeHit:false,meleeHold:0,heavyTriggered:false,heavy:false,heal:0,iframes:0,stepDistance:0,
      slot:0,slots,lethal,tactical,grenades:training?9:lethal?G[lethal].count+s.mods.charges:0,tacticals:training?9:tactical?G[tactical].count+s.mods.charges:0,stims:training?5:s.mods.stims,ammo:{},reserve:{}};
    for(const [k,w] of Object.entries(W)){s.player.ammo[k]=w.capacity;s.player.reserve[k]=reserveOf(s,k);}
    s.camp={x:spawn.x,y:spawn.y,t:0};
    const cleared=new Set();for(let j=0;j<stage;j++){const q=map.stages[j];if(['clear','hold','boss'].includes(q.kind))cleared.add(q.zone);}
    s.enemies=map.enemies.filter(e=>training||!cleared.has(e.zone)&&!s.killed.includes(e.id)).map(e=>makeEnemy(s,e));
    reinforce(s,spawn);
    event(s,'radio',stage===0?{...map.intro}:{...(map.resume||map.intro)});
    return s;
  }
  // Higher difficulties add soldiers beside the authored ones (same room, deterministic) rather than inflating health.
  function reinforce(s,spawn){const D=diff(s),pool=s.map.insane||[];if(!D.extra||s.training)return;const extra=[];
    for(const e of s.enemies){const t=A[e.type];if(t.boss||t.static||rand(s)>D.extra)continue;const id=e.id+'x';if(s.killed.includes(id))continue;
      for(let i=0;i<14;i++){const a=rand(s)*Math.PI*2,d=55+rand(s)*95,x=e.x+Math.cos(a)*d,y=e.y+Math.sin(a)*d;
        if(x<60||y<60||x>s.map.width-60||y>s.map.height-60||distance({x,y},spawn)<420||!clearAt(s,x,y,21)||!lineOfSight(s,e,{x,y}))continue;
        const swap=pool.length&&(t.locked||rand(s)<.4);extra.push(makeEnemy(s,{id,type:swap?pool[Math.floor(rand(s)*pool.length)]:e.type,x,y,zone:e.zone}));break;}}
    s.enemies.push(...extra);}
  function move(s,a,dx,dy,ignore=null){const r=a.radius,fly=A[a.type]?.flying,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let i=0;i<steps;i++){const ox=a.x,oy=a.y;a.x=clamp(a.x+dx/steps,r+40,s.map.width-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||fly&&(b.low||b.pass))continue;if(circleBox(a.x,a.y,r,b))a.x=ox;}a.y=clamp(a.y+dy/steps,r+40,s.map.height-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||fly&&(b.low||b.pass))continue;if(circleBox(a.x,a.y,r,b))a.y=oy;}}}
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
  function muzzle(s,actor,angle,sprite){const full=sprite==='handgun'?41:sprite==='shotgun'?57:54;let reach=full;const endX=actor.x+Math.cos(angle)*reach,endY=actor.y+Math.sin(angle)*reach;
    for(const wall of s.walls){if(wall.dead||wall.pass)continue;const t=segmentBox(actor.x,actor.y,endX,endY,wall);if(t!==null)reach=Math.min(reach,Math.max(0,t*full-.1));}
    return {x:actor.x+Math.cos(angle)*reach,y:actor.y+Math.sin(angle)*reach};}
  function shoot(s,actor,weapon,angle,enemy=false){if(enemy)return enemyFire(s,actor,angle);const w=W[weapon],p=s.player,base=angle+p.recoil*Math.sin(p.ammo[weapon]*2.1),m=muzzle(s,actor,angle,w.sprite);
    for(let i=0;i<w.pellets;i++){const bullet=s.projectiles.find(b=>!b.active);if(!bullet)break;const spread=w.spread*(p.aiming?.45:1)*(Math.hypot(p.vx,p.vy)>210?1.5:1);const a=base+(rand(s)-.5)*2*spread;
      Object.assign(bullet,{active:true,x:m.x,y:m.y,px:m.x,py:m.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,remaining:w.range,damage:damageOf(s,weapon),enemy:false,weapon,pierce:w.pierce||0,explosive:w.explosive||0,stagger:w.stagger,breach:!!w.breach,hitIds:[],whiz:false});}
    actor.shotAge=0;event(s,'shot',{x:m.x,y:m.y,angle,weapon,enemy:false});p.ammo[weapon]--;p.cooldown=w.rate;p.recoil=Math.min(.19,p.recoil+w.recoil);s.stats.shots++;move(s,p,-Math.cos(angle)*(w.cls==='shotgun'?5:1.3),-Math.sin(angle)*(w.cls==='shotgun'?5:1.3));
  }
  function enemyFire(s,e,angle,opts={}){const t=A[e.type]||A.infantry,D=diff(s),gun=W[e.gun]||W.rifle,m=muzzle(s,e,angle,gun.sprite),rocket=opts.rocket||t.rocket||0;
    for(let i=0;i<(t.pellets||1);i++){const bullet=s.projectiles.find(b=>!b.active);if(!bullet)break;const a=angle+(rand(s)-.5)*2*(t.spread??.035)*D.spread,speed=(opts.speed||t.bullet||620)*D.bullet;
      Object.assign(bullet,{active:true,x:m.x,y:m.y,px:m.x,py:m.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,remaining:t.reach||1100,damage:(opts.damage||t.damage)*(s.map.threat||1),enemy:true,weapon:e.gun||'rifle',pierce:0,explosive:rocket,stagger:0,breach:false,hitIds:[],whiz:false});}
    e.shotAge=0;event(s,'shot',{x:m.x,y:m.y,angle,weapon:rocket?'rocket':e.gun||'rifle',enemy:true});}
  function damagePlayer(s,amount,x,y,src=''){const p=s.player;if(s.dead||s.cinematic>0||p.iframes>0||p.state==='roll'&&p.age>=.055&&p.age<=.25||p.state==='dive'&&p.age>=.07&&p.age<=.28||p.state==='vault'&&p.age<.24)return false;
    const D=diff(s);amount*=D.dmg;const hadArmor=p.armor>0,armor=Math.min(p.armor,amount*.65);p.armor-=armor;p.health=Math.max(0,p.health-amount+armor);s.stats.damage+=amount-armor;p.iframes=D.iframes;p.heal=0;s.director.rest=1.3;event(s,'damage',{x:p.x,y:p.y,amount,fromX:x,fromY:y,src});
    if(hadArmor&&p.armor<.5){p.armor=0;event(s,'armorbreak');}if(p.health<=0){s.dead=true;p.state='death';p.age=0;event(s,'death');}return true;
  }
  function damageEnemy(s,e,amount,angle=0,stagger=.15,source='rifle',bypass=false,blast=false){if(e.dead||e.gone>0)return;const t=A[e.type]||A.infantry;
    if(t.front&&!bypass&&!(e.shieldDown>0)&&!(e.disabled>0)&&Math.abs(wrap(angle+Math.PI-e.angle))<.85){amount*=t.front;event(s,'armorhit',{x:e.x,y:e.y});}
    if(t.armor&&!blast&&!bypass&&!(e.disabled>0)){amount*=t.armor;event(s,'armorhit',{x:e.x,y:e.y});}
    if(t.barrier&&!(e.shieldDown>0)&&!e.barrierOff){amount*=t.barrier;event(s,'shieldhit',{x:e.x,y:e.y});}
    e.hp-=amount;const resistant=t.boss&&source!=='melee'&&!blast;e.stagger=t.static?0:Math.max(e.stagger,resistant?Math.min(.025,stagger):stagger);if(!resistant){e.attack=0;e.attackAge=0;e.burst=0;}
    if(!t.static)move(s,e,Math.cos(angle)*Math.min(t.boss?3:14,amount*.18),Math.sin(angle)*Math.min(t.boss?3:14,amount*.18));
    if(source!=='enemy'&&!e.active){e.active=true;e.woke=true;e.seen=Math.max(e.seen,2.5);e.lastX=s.player.x;e.lastY=s.player.y;}else if(source!=='enemy')e.woke=true;
    event(s,'hit',{id:e.id,x:e.x,y:e.y,angle,amount,player:source!=='enemy'});s.stats.hits++;if(source==='melee')s.hitstop=Math.max(s.hitstop,.025);
    if(e.hp<=0){e.dead=true;e.deathAge=0;s.stats.kills++;let credits=0;
      if(source!=='enemy'){s.mastery[source]=(s.mastery[source]||0)+1;s.combo=s.time-s.comboAt<3.5?s.combo+1:1;s.comboAt=s.time;s.stats.bestCombo=Math.max(s.stats.bestCombo,s.combo);credits=Math.round((t.bounty||15)*(1+.25*Math.min(s.combo-1,8))*(source==='melee'?1.5:1));s.stats.credits+=credits;}
      event(s,'kill',{x:e.x,y:e.y,enemy:e.type,id:e.id,credits,combo:s.combo,boss:!!t.boss,source});drops(s,e,t);
      if(t.kamikaze&&!e.detonated)explode(s,e.x,e.y,70,30,false,source);}
  }
  function drops(s,e,t){const p=s.player,D=diff(s),drop=(type,dx=0,dy=0,extra={})=>s.pickups.push({id:'drop'+s.tick+e.id+type,x:e.x+dx,y:e.y+dy,type,taken:false,...extra});
    if(!s.training&&e.gun&&W[e.gun]&&!s.owned.includes(e.gun)&&!s.pickups.some(q=>!q.taken&&q.type==='weapon'&&q.weapon===e.gun)){drop('weapon',0,0,{weapon:e.gun,ttl:0});event(s,'gundrop',{weapon:e.gun,x:e.x,y:e.y});}
    if(rand(s)<.55*D.drops||p.health<40&&(D.med||rand(s)<.35))drop(p.health<50?'health':'ammo',8,6);
    if(t.drop&&rand(s)<.45)drop(t.drop,-14,-10);
    if(t.boss&&!s.training){drop('cache',-20,18);drop('health',22,-14);}
  }
  function damageProp(s,b,damage){if(b.dead||!Number.isFinite(b.hp))return;b.hp-=damage;event(s,'impact',{x:b.x+b.w/2,y:b.y+b.h/2,kind:b.kind});if(b.hp<=0){b.dead=true;const cx=b.x+b.w/2,cy=b.y+b.h/2;event(s,'destroy',{x:cx,y:cy,kind:b.kind,w:b.w,h:b.h,id:b.id});
    if(b.kind==='barrel'||b.kind==='vehicle'||b.kind==='fuel')explode(s,cx,cy,b.kind==='fuel'?230:b.kind==='vehicle'?190:140,b.kind==='fuel'?160:b.kind==='vehicle'?130:105);
    if(b.kind==='console'){for(const e of s.enemies)if(!e.dead&&distance(e,{x:b.x,y:b.y})<380){e.stagger=3;e.attack=0;}event(s,'toast',{text:'POWER GRID DISRUPTED'});}
    if(b.kind==='generator'){const left=s.walls.filter(w=>w.kind==='generator'&&!w.dead).length;for(const e of s.enemies)if(!e.dead&&A[e.type]?.barrier){e.shieldDown=Math.max(e.shieldDown,9);if(!left)e.barrierOff=true;}event(s,'toast',{text:left?'GENERATOR DOWN / BARRIER OFFLINE 9 SECONDS':'ALL GENERATORS DOWN / BARRIER DESTROYED'});}}}
  function explode(s,x,y,radius=150,damage=110,enemy=false,source='grenade'){event(s,'explosion',{x,y,radius});for(const b of s.walls){if(b.dead||!Number.isFinite(b.hp))continue;const d=Math.hypot(clamp(x,b.x,b.x+b.w)-x,clamp(y,b.y,b.y+b.h)-y);if(d<radius)damageProp(s,b,damage*(1-d/radius));}
    for(const e of s.enemies){const d=distance(e,{x,y});if(!e.dead&&!(e.gone>0)&&d<radius)damageEnemy(s,e,damage*(1-.55*d/radius)*(enemy?.5:1),Math.atan2(e.y-y,e.x-x),.65,enemy?'enemy':source,true,true);}
    const d=distance(s.player,{x,y});if(d<radius)damagePlayer(s,damage*(enemy?.6:.45)*(1-d/radius),x,y,'blast');
  }
  function stepProjectiles(s,dt){const p=s.player;for(const b of s.projectiles){if(!b.active)continue;const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;b.px=b.x;b.py=b.y;let target=null,t=2;
      for(const w of s.walls){if(w.dead||w.pass||b.hitIds.includes(w.id))continue;const u=segmentBox(b.x,b.y,nx,ny,w);if(u!==null&&u<t){t=u;target={kind:'wall',a:w};}}
      const list=b.enemy?[p]:s.enemies;
      for(const e of list){if(e.dead||e.gone>0||b.hitIds.includes(e.id))continue;const u=segmentCircle(b.x,b.y,nx,ny,e,e.radius+(b.explosive?4:2));if(u!==null&&u<t){t=u;target={kind:b.enemy?'player':'enemy',a:e};}}
      if(target){b.x+=(nx-b.x)*t;b.y+=(ny-b.y)*t;const angle=Math.atan2(b.vy,b.vx);let through=false;
        if(b.explosive)explode(s,b.x,b.y,b.explosive,b.damage,b.enemy,b.weapon);
        else if(target.kind==='wall'){damageProp(s,target.a,b.damage);if(b.breach&&Number.isFinite(target.a.hp)){b.hitIds.push(target.a.id);through=true;}}
        else if(target.kind==='enemy')damageEnemy(s,target.a,b.damage,angle,b.stagger,b.weapon,b.breach);
        else damagePlayer(s,b.damage,b.px,b.py,b.weapon);
        event(s,'bulletimpact',{x:b.x,y:b.y,enemy:b.enemy});
        if(target.kind==='enemy'&&b.pierce>0&&!b.explosive){b.pierce--;b.hitIds.push(target.a.id);b.x=nx;b.y=ny;}else if(through){b.x=nx;b.y=ny;}else b.active=false;
      }else{b.x=nx;b.y=ny;}
      if(b.enemy&&b.active&&!b.whiz){const sx=b.x-b.px,sy=b.y-b.py,l2=sx*sx+sy*sy||1,u=clamp(((p.x-b.px)*sx+(p.y-b.py)*sy)/l2,0,1);if(Math.hypot(b.px+sx*u-p.x,b.py+sy*u-p.y)<44){b.whiz=true;event(s,'whiz',{x:b.x,y:b.y});}}
      b.remaining-=Math.hypot(b.vx,b.vy)*dt;if(b.remaining<=0&&b.active){b.active=false;if(b.explosive)explode(s,b.x,b.y,b.explosive,b.damage,b.enemy,b.weapon);}
    }
  }
  function melee(s,heavy=false){const p=s.player;if(['roll','dive','vault','melee'].includes(p.state)||p.heal>0)return false;const wasSlide=p.state==='slide',index=s.time-p.meleeAt<.95?(p.meleeIndex+1)%3:0;p.meleeIndex=index;p.meleeAt=s.time;p.meleeHit=false;p.heavy=heavy;
    if(!begin(s,'melee',heavy?.62:.34,p.angle,heavy?12:3))return false;if(wasSlide){flow(s);move(s,p,Math.cos(p.angle)*15,Math.sin(p.angle)*15);}event(s,'meleeswing',{x:p.x,y:p.y,heavy});return true;
  }
  const zoneAlive=(s,z)=>s.enemies.some(e=>!e.dead&&e.zone===z)||s.spawnWarnings.some(w=>w.zone===z);
  const nearbyWeapon=s=>s.pickups.find(q=>!q.taken&&q.type==='weapon'&&s.owned.includes(q.weapon)&&!s.player.slots.includes(q.weapon)&&distance(q,s.player)<70);
  function equip(s,q){const p=s.player,k=q.weapon,slot=W[k].slot;p.slots[slot]=k;p.slot=slot;p.ammo[k]=W[k].capacity;p.reload=0;p.cooldown=.2;q.taken=true;event(s,'equip',{weapon:k});event(s,'toast',{text:W[k].name+' EQUIPPED'});}
  function interact(s,input){const p=s.player,st=stageDef(s);
    if(!s.training&&(st.kind==='clear'||st.kind==='extract'||st.kind==='hold')&&distance(p,st)<90){
      if(st.kind==='clear'){if(zoneAlive(s,st.zone)){event(s,'toast',{text:'CLEAR THE HOSTILES BEFORE INTERACTING'});return;}advance(s);}
      else if(st.kind==='extract'&&!s.endingStarted){s.cinematic=.001;s.endingStarted=true;if(st.start)event(s,'radio',{...st.start});event(s,'cinematic');}
      return;
    }
    const gun=nearbyWeapon(s);if(gun){equip(s,gun);return;}
    if(s.training){const kit=s.pickups.find(pick=>pick.type==='supply'&&distance(p,pick)<100);if(kit){resupply(s);return;}}
    if(!vault(s,input))event(s,'toast',{text:'VAULT LOW COVER IN YOUR MOVEMENT DIRECTION'});
  }
  function grant(s,g){const p=s.player;
    for(const k of g.weapons||[]){if(!s.owned.includes(k))s.owned.push(k);if(!p.slots.includes(k)){const x=p.x+(clearAt(s,p.x+46,p.y,12)?46:0),y=p.y+(clearAt(s,p.x+46,p.y,12)?0:40);s.pickups.push({id:'grant'+k,x,y,type:'weapon',weapon:k,taken:false,ttl:0,owned:true});}}
    if(g.lethal&&!p.lethal)p.lethal=g.lethal;if(p.lethal)p.grenades=Math.max(p.grenades,(p.lethal===g.lethal&&g.lethalCount||G[p.lethal].count)+s.mods.charges);if(p.tactical)p.tacticals=Math.max(p.tacticals,G[p.tactical].count+s.mods.charges);
    if(g.health)p.health=Math.max(g.health,p.health);if(g.armor)p.armor=Math.max(p.armor,g.armor);if(g.stims)p.stims=Math.max(g.stims,p.stims);if(g.refill)for(const k of p.slots)p.reserve[k]=reserveOf(s,k);}
  function enterStage(s,index){const d=s.director;s.stage=index;const st=stageDef(s),en=st.enter||{};d.clock=0;d.wave=0;d.left=undefined;d.fired={};s.progress=0;s.boss=null;
    if(st.dark!==undefined)s.dark=st.dark;
    for(const n of en.opens||[])for(const w of s.walls)if(w.gate===n&&!w.dead){w.dead=true;event(s,'gate',{x:w.x+w.w/2,y:w.y+w.h/2});}
    if(en.grants)grant(s,en.grants);if(en.checkpoint)checkpoint(s);if(en.unlock)event(s,'unlock',{items:[...en.unlock]});if(en.radio)event(s,'radio',{...en.radio});if(en.toast)event(s,'toast',{text:en.toast});
    event(s,'stage',{stage:index,name:st.name});}
  function advance(s){const st=stageDef(s);if(st.leave?.radio)event(s,'radio',{...st.leave.radio});if(st.leave?.toast)event(s,'toast',{text:st.leave.toast});event(s,'objective',{name:st.name});enterStage(s,Math.min(s.stage+1,s.map.stages.length-1));}
  function checkpoint(s,pos=null){const p=s.player;if(s.training)return;let stage=s.stage;while(stage>0&&!s.map.stages[stage].spawn)stage--;
    s.checkpoint={stage,time:s.time,kills:s.stats.kills,damage:s.stats.damage,flows:s.stats.flows,credits:s.stats.credits,intel:s.stats.intel,killed:s.enemies.filter(e=>e.dead&&!e.spawned).map(e=>e.id).slice(0,160),dead:s.walls.filter(w=>w.dead&&['jammer','fuel','generator'].includes(w.kind)).map(w=>w.id),slots:[...p.slots],lethal:p.lethal,tactical:p.tactical};
    if(pos&&stage===s.stage&&clearAt(s,pos.x,pos.y,17)){s.checkpoint.x=pos.x;s.checkpoint.y=pos.y;}
    event(s,'checkpoint',{checkpoint:{...s.checkpoint,killed:[...s.checkpoint.killed],dead:[...s.checkpoint.dead],slots:[...p.slots]}});event(s,'toast',{text:'CHECKPOINT SECURED'});p.health=Math.max(p.health,diff(s).heal);p.stamina=100;}
  function resupply(s){const p=s.player;p.health=100;p.armor=50;p.stims=5;p.grenades=9;p.tacticals=9;p.stamina=100;for(const [k,w] of Object.entries(W)){p.ammo[k]=w.capacity;p.reserve[k]=w.reserve;}event(s,'pickup',{kind:'supply',x:p.x,y:p.y});event(s,'toast',{text:'FIELD EQUIPMENT REPLENISHED'});}
  function throwItem(s,kind,input){const p=s.player,d=Math.min(380,Math.hypot((input.aimX??p.x+300)-p.x,(input.aimY??p.y)-p.y));s.grenades.push({kind,x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(p.angle)*d,ty:p.y+Math.sin(p.angle)*d,age:0,duration:.58,fuse:FUSE[kind]||1.15,enemy:false});event(s,'throw',{x:p.x,y:p.y,kind});}
  function lob(s,e,tx,ty,o={}){s.grenades.push({kind:'frag',x:e.x,y:e.y,sx:e.x,sy:e.y,tx,ty,age:0,duration:o.duration||.65,fuse:o.fuse||1.65,enemy:true,radius:o.radius,damage:o.damage});event(s,'enemygrenade',{x:tx,y:ty});}
  function deployCover(s){const p=s.player,cx=p.x+Math.cos(p.angle)*64,cy=p.y+Math.sin(p.angle)*64,horiz=Math.abs(Math.sin(p.angle))>Math.abs(Math.cos(p.angle)),w=horiz?120:30,h=horiz?30:120;
    const b={id:'dc'+s.tick,x:cx-w/2,y:cy-h/2,w,h,kind:'barrier',hp:280,maxHp:280,low:true,dead:false,deployed:true},overlap=o=>o.x<b.x+b.w&&o.x+o.w>b.x&&o.y<b.y+b.h&&o.y+o.h>b.y;
    if(cx<60||cy<60||cx>s.map.width-60||cy>s.map.height-60||s.walls.some(o=>!o.dead&&overlap(o))||s.enemies.some(e=>!e.dead&&circleBox(e.x,e.y,e.radius,b))||circleBox(p.x,p.y,p.radius,b)){event(s,'toast',{text:'NO ROOM TO DEPLOY COVER'});return false;}
    const old=s.walls.filter(o=>o.deployed&&!o.dead);if(old.length>=4)old[0].dead=true;s.walls.push(b);event(s,'deploy',{x:cx,y:cy});return true;}
  function detonate(s,g){const kind=g.kind||'frag';
    if(kind==='frag')explode(s,g.x,g.y,g.radius||155,g.damage||(g.enemy?85:135),g.enemy);
    else if(kind==='incendiary'){explode(s,g.x,g.y,70,35);s.zones.push({kind:'fire',x:g.x,y:g.y,r:95,life:6,tick:0});}
    else if(kind==='smoke'){s.zones.push({kind:'smoke',x:g.x,y:g.y,r:170,life:10.5});event(s,'smoke',{x:g.x,y:g.y});}
    else if(kind==='decoy'){s.decoy={id:'decoy',x:g.x,y:g.y,radius:16,life:7.5,vx:0,vy:0};event(s,'decoy',{x:g.x,y:g.y});}
    else if(kind==='flash'){const self=distance(s.player,g)<260&&lineOfSight(s,s.player,g);event(s,'flash',{x:g.x,y:g.y,self});
      for(const e of s.enemies){const t=A[e.type];if(e.dead||t.machine||distance(e,g)>300||!lineOfSight(s,e,g))continue;const time=t.boss?.7:3.2;e.stagger=Math.max(e.stagger,time);e.flashed=time;e.attack=0;e.burst=0;e.active=true;}}
    else if(kind==='emp'){event(s,'emp',{x:g.x,y:g.y});for(const h of s.hazards)if(distance(g,{x:h.x+h.w/2,y:h.y+h.h/2})<380)h.off=9;
      for(const e of s.enemies){const t=A[e.type];if(e.dead||distance(e,g)>320)continue;if(t.flying&&t.machine){e.detonated=true;damageEnemy(s,e,999,0,.1,'emp',true,true);}
        else if(t.machine){e.disabled=e.type==='mech'?3.5:e.type==='apc'?5:9;e.shieldDown=Math.max(e.shieldDown,8);e.attack=0;e.burst=0;}else if(t.front){e.shieldDown=9;e.stagger=Math.max(e.stagger,1.2);}else e.stagger=Math.max(e.stagger,.5);}}}
  function stepPlayer(s,input,dt){const p=s.player,w=W[p.slots[p.slot]],busy=['slide','roll','dive','vault','melee'].includes(p.state);p.age+=dt;p.shotAge+=dt;p.cooldown=Math.max(0,p.cooldown-dt);p.iframes=Math.max(0,p.iframes-dt);p.recoil=Math.max(0,p.recoil-dt*.18);p.aiming=!!input.aiming;
    const mx=input.mx||0,my=input.my||0,len=Math.hypot(mx,my),nx=len?mx/len:0,ny=len?my/len:0;
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))p.angle=Math.atan2(input.aimY-p.y,input.aimX-p.x);
    const want=input.swap?1-p.slot:input.slot;if(want!==undefined&&want!==p.slot&&p.slots[want]){p.slot=want;p.reload=0;p.cooldown=.15;event(s,'swap',{weapon:p.slots[want]});}
    if(input.roll&&p.stamina>=30&&!['roll','dive','vault'].includes(p.state)){const dive=input.sprint&&len>0;const chain=p.state==='melee'&&p.age>.19;if(begin(s,dive?'dive':'roll',dive?.63:.4,len?Math.atan2(ny,nx):p.angle,dive?40:30)&&chain)flow(s);}
    if(input.slide&&len>0&&Math.hypot(p.vx,p.vy)>265&&!busy){if(begin(s,'slide',.7,Math.atan2(p.vy,p.vx),24)){p.slideSpeed=Math.max(490,Math.hypot(p.vx,p.vy)*1.38);}}
    if(input.interact&&!['vault','roll','dive'].includes(p.state))interact(s,{...input,mx:nx,my:ny});
    if(input.melee){p.meleeHold=0;p.heavyTriggered=false;melee(s,false);}if(input.meleeDown){p.meleeHold+=dt;if(p.meleeHold>.43&&!p.heavyTriggered&&p.state!=='melee'){p.heavyTriggered=true;melee(s,true);}}
    if(input.gadget&&p.stims>0&&p.health<100&&!['roll','dive','vault'].includes(p.state)){p.heal=.85;p.healTotal=.85;event(s,'healstart');}
    // Timers settle at exactly zero: a negative remainder used to read as "still reloading/healing" and blocked sprint until an action reset it.
    if(p.heal>0){p.heal-=dt;if(p.heal<=0){p.heal=0;p.stims--;p.health=Math.min(100,p.health+50);p.iframes=.25;event(s,'pickup',{kind:'health',x:p.x,y:p.y});}}
    const free=!['vault','roll','dive'].includes(p.state);
    if(input.grenade&&p.grenades>0&&p.lethal&&free){p.grenades--;if(p.lethal==='mine'){s.mines.push({id:'mine'+s.tick,x:p.x,y:p.y,arm:.8});if(s.mines.length>6)s.mines.shift();event(s,'plant',{x:p.x,y:p.y});}else throwItem(s,p.lethal,input);}
    if(input.tactical&&p.tacticals>0&&p.tactical&&free){if(p.tactical==='cover'){if(deployCover(s))p.tacticals--;}else{p.tacticals--;throwItem(s,p.tactical,input);}}
    const key=p.slots[p.slot];
    if(input.reload&&!p.reload&&p.ammo[key]<w.capacity&&p.reserve[key]>0&&!busy){p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key});}
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){p.reload=0;const k=p.slots[p.slot],def=W[k],amount=Math.min(def.capacity-p.ammo[k],p.reserve[k]);p.ammo[k]+=amount;p.reserve[k]-=amount;event(s,'reloadend');}}
    if(input.fire&&p.cooldown<=0&&p.reload<=0&&p.heal<=0&&!['roll','dive','vault','melee'].includes(p.state)){if(p.ammo[key]>0)shoot(s,p,key,p.angle);else if(p.reserve[key]>0&&!busy){p.cooldown=.2;event(s,'empty');p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key});}else{p.cooldown=.35;event(s,'empty');event(s,'toast',{text:'OUT OF AMMUNITION / SWAP WEAPONS'});}}
    const oldX=p.x,oldY=p.y;
    if(p.state==='vault'){const v=p.vault,t=clamp(p.age/p.duration,0,1),ease=t*t*(3-2*t);const tx=v.sx+(v.tx-v.sx)*ease,ty=v.sy+(v.ty-v.sy)*ease;move(s,p,tx-p.x,ty-p.y,v.ignore);p.vx=Math.cos(p.actionDir)*320;p.vy=Math.sin(p.actionDir)*320;}
    else if(['slide','roll','dive'].includes(p.state)){let speed=p.state==='slide'?p.slideSpeed*Math.exp(-2.6*p.age):p.state==='roll'?550*(1-.55*clamp(p.age/p.duration,0,1)):690*(1-.7*clamp(p.age/p.duration,0,1));p.radius=p.state==='slide'?10:16;p.vx=Math.cos(p.actionDir)*speed;p.vy=Math.sin(p.actionDir)*speed;move(s,p,p.vx*dt,p.vy*dt);}
    else{p.radius=16;const sprint=input.sprint&&len>0&&p.stamina>4&&!input.fire&&!input.aiming&&!p.reload&&!p.heal;const speed=(sprint?360:input.aiming?175:250)*W[p.slots[p.slot]].mobility*(p.state==='melee'?.45:p.reload?.7:p.heal?.45:1);const response=Math.min(1,dt*(len?25:31));p.vx+=(nx*speed-p.vx)*response;p.vy+=(ny*speed-p.vy)*response;move(s,p,p.vx*dt,p.vy*dt);
      if(p.state!=='melee'){p.state=sprint?'sprint':len?'run':'idle';}if(sprint)p.stamina=Math.max(0,p.stamina-dt*13*s.mods.drain);}
    if(p.state==='melee'&&!p.meleeHit&&p.age>=(p.heavy?.24:.12)){p.meleeHit=true;const reach=p.heavy?90:73,damage=p.heavy?95:[45,55,80][p.meleeIndex];for(const e of s.enemies){if(e.dead||e.gone>0||distance(p,e)>reach+(e.radius-17)||Math.abs(wrap(Math.atan2(e.y-p.y,e.x-p.x)-p.angle))>1.25||!lineOfSight(s,p,e))continue;const finish=e.hp<35;damageEnemy(s,e,finish?200:damage,p.angle,p.heavy?.9:.45,'melee',p.heavy||finish);event(s,'meleeimpact',{x:e.x,y:e.y,finish});}for(const b of s.walls)if(!b.dead&&Number.isFinite(b.hp)&&circleBox(p.x+Math.cos(p.angle)*45,p.y+Math.sin(p.angle)*45,32,b))damageProp(s,b,damage);}
    if(['vault','roll','dive','slide','melee'].includes(p.state)&&p.age>=p.duration){p.state=len?'run':'idle';p.age=0;p.radius=16;}
    if(!['sprint','roll','dive','slide','vault','melee'].includes(p.state))p.stamina=Math.min(100,p.stamina+dt*26*s.mods.regen);
    const travel=Math.hypot(p.x-oldX,p.y-oldY);if(travel>.05)p.moveAngle=Math.atan2(p.y-oldY,p.x-oldX);p.stepDistance+=travel;if(p.stepDistance>=(p.state==='sprint'?62:51)&&!['slide','roll','dive','vault'].includes(p.state)){p.stepDistance=0;event(s,'footstep',{x:p.x,y:p.y,surface:s.training?'metal':s.map.theme==='snow'?'snow':'concrete'});}
    if(distance(p,s.camp)>110){s.camp.x=p.x;s.camp.y=p.y;s.camp.t=0;}else s.camp.t+=dt;
  }
  function enemyMovement(s,e,tx,ty,speed,dt){const dx=tx-e.x,dy=ty-e.y,len=Math.hypot(dx,dy);if(len<12)return;const ox=e.x,oy=e.y;move(s,e,dx/len*speed*dt,dy/len*speed*dt);if(Math.hypot(e.x-ox,e.y-oy)<.1){const angle=Math.atan2(dy,dx)+e.side*Math.PI*.5;move(s,e,Math.cos(angle)*speed*dt,Math.sin(angle)*speed*dt);}e.vx=(e.x-ox)/dt;e.vy=(e.y-oy)/dt;e.moveTime+=Math.hypot(e.vx,e.vy)*dt/80;}
  // Breadth-first distance field to the player on the 40px grid. Hunters follow it around buildings instead of stalling at a last-seen corner.
  function navField(s){const w=Math.ceil(s.map.width/CELL),h=Math.ceil(s.map.height/CELL),sig=s.walls.length*1000+s.walls.filter(b=>b.dead).length;let n=s.nav;
    if(!n||n.sig!==sig){const blocked=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)blocked[y*w+x]=clearAt(s,x*CELL+20,y*CELL+20,15)?0:1;n=s.nav={sig,w,h,blocked,dist:new Int16Array(w*h),cell:-1,at:-9};}
    const pc=clamp(Math.floor(s.player.y/CELL),0,h-1)*w+clamp(Math.floor(s.player.x/CELL),0,w-1);
    if(n.cell!==pc||s.time-n.at>1.5){n.cell=pc;n.at=s.time;n.dist.fill(-1);const queue=new Int32Array(w*h);let head=0,tail=0;n.dist[pc]=0;queue[tail++]=pc;
      while(head<tail){const id=queue[head++],cx=id%w,cy=(id-cx)/w;for(const [dx,dy] of DIRS){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=w||y>=h)continue;const nid=y*w+x;if(n.dist[nid]>=0||n.blocked[nid]||dx&&dy&&(n.blocked[cy*w+x]||n.blocked[y*w+cx]))continue;n.dist[nid]=n.dist[id]+1;queue[tail++]=nid;}}}
    return n;}
  function chase(s,e,speed,dt){const n=navField(s),cx=Math.floor(e.x/CELL),cy=Math.floor(e.y/CELL),here=n.dist[cy*n.w+cx];let best=null,bd=here<0?32767:here;
    if(here>=0&&here<=1){enemyMovement(s,e,s.player.x,s.player.y,speed,dt);return;}
    for(const [dx,dy] of DIRS){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=n.w||y>=n.h)continue;const d=n.dist[y*n.w+x];if(d<0||d>=bd)continue;if(dx&&dy&&(n.blocked[cy*n.w+x]||n.blocked[y*n.w+cx]))continue;bd=d;best={x:x*CELL+20,y:y*CELL+20};}
    enemyMovement(s,e,best?best.x:e.lastX,best?best.y:e.lastY,speed,dt);}
  function leadAim(s,e,t,tgt){const D=diff(s),speed=(t.bullet||620)*D.bullet,tt=distance(e,tgt)/speed;return Math.atan2(e.lastY+(tgt.vy||0)*tt*D.lead-e.y,e.lastX+(tgt.vx||0)*tt*D.lead-e.x);}
  function finishAttack(s,e,t){const D=diff(s);e.cooldown=t.rate*D.rate*(t.boss&&e.phase===3&&e.type!=='commander'?.7:1);e.clip++;if(e.clip>=(t.clip||5)){e.clip=0;e.reload=1.65;event(s,'enemyreload',{x:e.x,y:e.y});}}
  function release(s,e,t,tgt,dist,canSee,aim){const p=s.player,mode=e.mode;e.mode=null;
    if(t.melee){if(dist<t.range+24&&canSee&&tgt===p)damagePlayer(s,t.damage*(s.map.threat||1),e.x,e.y,'melee');event(s,'strike',{x:e.x,y:e.y});}
    else if(t.kamikaze){if(dist<95){e.detonated=true;explode(s,e.x,e.y,95,t.damage,true);e.hp=0;e.dead=true;e.deathAge=0;}}
    else if(e.type==='commander'&&e.phase>=2&&e.clip%3===2)lob(s,e,e.targetX,e.targetY);
    else if(t.lob)lob(s,e,e.targetX,e.targetY,{duration:.9,fuse:1.25,radius:130,damage:t.damage});
    else if(mode==='mortar'){for(const [dx,dy] of [[0,0],[110,-60],[-100,70]])lob(s,e,e.targetX+dx,e.targetY+dy,{duration:1,fuse:1.55,radius:120,damage:42});}
    else if(mode==='stomp'){event(s,'explosion',{x:e.x,y:e.y,radius:130});event(s,'stomp',{x:e.x,y:e.y});if(distance(e,p)<135&&damagePlayer(s,38*(s.map.threat||1),e.x,e.y,'stomp'))move(s,p,Math.cos(aim)*40,Math.sin(aim)*40);}
    else{const a=t.static?e.angle:t.locked?e.aim:leadAim(s,e,t,tgt);enemyFire(s,e,a);if(e.type==='commander'&&e.phase===3){enemyFire(s,e,a+.14);enemyFire(s,e,a-.14);}
      if(e.type==='mech'&&e.phase>=2&&e.clip%3===2){enemyFire(s,e,a+.25,{rocket:110,speed:560,damage:50});enemyFire(s,e,a-.25,{rocket:110,speed:560,damage:50});}
      const burst=(t.burst||1)+((t.burst||1)===1&&!t.locked&&!t.rocket&&!t.boss?diff(s).burst||0:0);if(burst>1){e.burst=burst-1;e.burstT=t.gap||.1;e.burstAim=a;}
      if(t.blink)e.blinkAt=.55;}
  }
  function blink(s,e){const p=s.player,list=(s.map.perches||[]).filter(q=>distance(q,p)>360&&distance(q,e)>200);if(list.length){const pick=list[Math.floor(rand(s)*list.length)];e.x=pick.x;e.y=pick.y;}e.cooldown=.5+rand(s)*.5;e.attack=0;e.seen=4;e.lastX=p.x;e.lastY=p.y;event(s,'blinkin',{x:e.x,y:e.y});}
  function stepEnemies(s,dt){const p=s.player,D=diff(s);s.squad.nade=Math.max(0,s.squad.nade-dt);for(const e of s.enemies){if(e.dead){e.deathAge=(e.deathAge||0)+dt;continue;}const type=A[e.type]||A.infantry;
      e.vx=0;e.vy=0;e.shotAge=(e.shotAge||0)+dt;e.cooldown-=dt;e.stagger=Math.max(0,e.stagger-dt);e.reload=Math.max(0,e.reload-dt);e.shieldDown=Math.max(0,(e.shieldDown||0)-dt);e.disabled=Math.max(0,(e.disabled||0)-dt);e.flashed=Math.max(0,(e.flashed||0)-dt);
      if(e.gone>0){e.gone-=dt;if(e.gone<=0)blink(s,e);continue;}
      if(e.blinkAt>0){e.blinkAt-=dt;if(e.blinkAt<=0){e.gone=.9;e.burst=0;e.attack=0;event(s,'blink',{x:e.x,y:e.y});continue;}}
      if(e.stagger>0||e.reload>0||e.disabled>0){if(e.stagger>0||e.disabled>0)e.burst=0;continue;}
      const decoy=s.decoy&&distance(e,s.decoy)<720&&lineOfSight(s,e,s.decoy)&&distance(e,p)>150?s.decoy:null,tgt=decoy||p;
      const dist=distance(tgt,e),canSee=dist<(type.sight||740)&&sees(s,e,tgt),ok=eligible(s,e),hunter=e.hunt||D.hunt;
      if(canSee&&ok){e.active=true;e.seen=4;e.lastX=tgt.x;e.lastY=tgt.y;}else e.seen=Math.max(0,e.seen-dt);
      if(!e.active||!ok)continue;
      if(e.type==='commander'){const phase=e.hp<e.maxHp*.33?3:e.hp<e.maxHp*.66?2:1;if(phase>e.phase){e.phase=phase;e.stagger=.15;e.cooldown=0;if(phase===2)lob(s,e,e.lastX,e.lastY);event(s,'radio',{speaker:'HOSTILE COMMANDER',text:phase===2?'He’s alone. Flush him out.':'Cut off every exit. He does not leave this city.',duration:4});} }
      else if(type.boss){const phase=e.hp<e.maxHp*.33?3:e.hp<e.maxHp*.66?2:1;if(phase>e.phase){e.phase=phase;e.cooldown=Math.min(e.cooldown,.3);event(s,'bossphase',{id:e.id,phase});}}
      let aim=Math.atan2(e.lastY-e.y,e.lastX-e.x);if(type.static){e.angle+=clamp(wrap(aim-e.angle),-type.turn*dt,type.turn*dt);}else e.angle=aim;
      if(e.burst>0){e.burstT-=dt;if(e.burstT<=0){e.burst--;e.burstT=type.gap||.08;const want=type.static?e.angle:leadAim(s,e,type,tgt);e.burstAim+=clamp(wrap(want-e.burstAim),-3*(type.gap||.08),3*(type.gap||.08));enemyFire(s,e,e.burstAim);if(e.burst===0)finishAttack(s,e,type);}continue;}
      if(e.attack>0){e.attackAge+=dt;if(e.attackAge>=e.attack){release(s,e,type,tgt,dist,canSee,aim);e.attack=0;if(!(e.burst>0))finishAttack(s,e,type);}continue;}
      if(type.kamikaze){if(canSee&&dist<70&&e.cooldown<=0){e.attack=type.windup;e.attackAge=0;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type});continue;}chase(s,e,type.speed,dt);continue;}
      if(e.seen<=0||!canSee&&hunter&&e.seen<3.4){if(type.static)continue;if(hunter)chase(s,e,type.speed*.85,dt);else enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);
        if(D.suppress&&e.seen>1.2&&!type.melee&&!type.lob&&!type.rocket&&e.cooldown<=0&&distance(e,{x:e.lastX,y:e.lastY})<type.range){enemyFire(s,e,Math.atan2(e.lastY-e.y,e.lastX-e.x));e.cooldown=type.rate*D.rate*1.6;}
        continue;}
      e.angle=type.static?e.angle:aim;
      if(D.camp&&type.cover&&!type.lob&&s.camp.t>D.camp&&s.squad.nade<=0&&e.seen>0&&dist>150&&dist<480&&tgt===p){s.squad.nade=D.nadeCd;s.camp.t=D.camp*.4;lob(s,e,p.x,p.y,{duration:.75,fuse:1.6});e.cooldown=Math.max(e.cooldown,.8);continue;}
      const facing=!type.static||Math.abs(wrap(aim-e.angle))<.3;
      if(canSee&&e.cooldown<=0&&facing&&!(type.minRange&&dist<type.minRange)){
        const mode=type.stomp&&dist<150?'stomp':type.mortar&&(e.clip%2===1||e.phase>=2&&e.clip%3!==0)?'mortar':null;
        if(dist<type.range||mode){e.mode=mode;e.attack=(mode==='stomp'?.6:mode==='mortar'?1:type.windup)*D.windup;e.attackAge=0;e.aim=aim;e.targetX=tgt.x;e.targetY=tgt.y;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type,mode});continue;}}
      if(type.static)continue;
      if(type.melee){if(hunter&&!canSee)chase(s,e,type.speed,dt);else enemyMovement(s,e,e.lastX,e.lastY,type.speed,dt);}
      else if(type.orbit){enemyMovement(s,e,tgt.x-Math.cos(aim)*300-Math.sin(aim)*e.side*140,tgt.y-Math.sin(aim)*300+Math.cos(aim)*e.side*140,type.speed,dt);}
      else if(e.type==='shield'||type.push){if(dist>(type.push?110:270))enemyMovement(s,e,e.lastX,e.lastY,type.speed,dt);}
      else if(e.type==='sniper'||type.blink){if(dist<280)enemyMovement(s,e,e.x-Math.cos(aim)*150,e.y-Math.sin(aim)*150,type.speed,dt);else if(!canSee)enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);}
      else if(type.minRange&&dist<type.minRange+40){enemyMovement(s,e,e.x-Math.cos(aim)*120,e.y-Math.sin(aim)*120,type.speed,dt);}
      else{const cover=s.walls.filter(b=>!b.dead&&b.low&&distance(e,{x:b.x+b.w/2,y:b.y+b.h/2})<250).sort((a,b)=>distance(e,{x:a.x,y:a.y})-distance(e,{x:b.x,y:b.y}))[0];
        if(e.hp<e.maxHp*.4&&cover&&!type.boss){const tx=cover.x+cover.w/2-Math.cos(aim)*65,ty=cover.y+cover.h/2-Math.sin(aim)*65;enemyMovement(s,e,tx,ty,type.speed,dt);}
        else if(!canSee||dist>type.range*.85){if(hunter&&!canSee)chase(s,e,type.speed,dt);else enemyMovement(s,e,e.lastX-Math.cos(aim)*260-Math.sin(aim)*e.side*130,e.lastY-Math.sin(aim)*260+Math.cos(aim)*e.side*130,type.speed,dt);}
        else if(e.cooldown>.4)enemyMovement(s,e,e.x-Math.sin(aim)*e.side*45,e.y+Math.cos(aim)*e.side*45,type.speed*.6,dt);
      }
    }}
  function warnSpawn(s,entries,quiet=false){const pts=s.map.spawnPoints||[];for(const e of entries){let pos=e;if(distance(s.player,e)<340){pos=pts.find(a=>distance(s.player,a)>=340&&clearAt(s,a.x,a.y,25));}if(!pos)continue;const warning={...e,x:pos.x,y:pos.y,delay:2.3};s.spawnWarnings.push(warning);event(s,'spawnwarning',{x:warning.x,y:warning.y});}if(!quiet)event(s,'toast',{text:'HOSTILE REINFORCEMENTS / WATCH THE APPROACHES'});}
  function entriesFor(s,entries,st){const D=diff(s),pts=s.map.spawnPoints||[],out=[];
    entries.forEach((e,i)=>{if(e.min&&!atLeast(s,e.min))return;const type=s.difficulty==='story'&&e.story?e.story:e.type,p=e.at!==undefined?pts[e.at%pts.length]:e;if(!p)return;out.push({id:e.id||'s'+s.tick+'_'+i,type,x:p.x,y:p.y,zone:st.zone});
      if(D.waveExtra&&!A[type].boss&&pts.length&&rand(s)<D.waveExtra){const q=pts[Math.floor(rand(s)*pts.length)];out.push({id:'s'+s.tick+'_'+i+'x',type,x:q.x,y:q.y,zone:st.zone});}});
    return out;}
  function runWaves(s,st,d){const list=st.waves||[];const w=list[d.wave];if(!w||w.hp!==undefined)return;if(d.clock<(w.after||0))return;if(d.wave>0&&st.kind==='hold'&&d.rest>0)return;if(w.max!==undefined&&s.enemies.filter(e=>!e.dead).length>=w.max)return;
    d.wave++;warnSpawn(s,entriesFor(s,w.entries,st));if(w.med&&diff(s).med&&s.player.health<50)s.pickups.push({id:'director-med'+d.wave,x:w.med.x,y:w.med.y,type:'health',taken:false});if(w.radio)event(s,'radio',{...w.radio});}
  const HORDE=[['infantry',1,1],['rusher',1,1],['scout',1.3,2],['breacher',1.8,3],['drone',1.2,3],['shield',2,4],['grenadier',2.2,5],['sniper',2,5],['bomber',1,6],['gunner',3.5,7],['elite',3,9],['rocketeer',3,10]];
  function composeWave(s,n){const pts=s.map.spawnPoints,avail=HORDE.filter(q=>q[2]<=n),out=[];let budget=(4+n*1.8)*[.8,1,1.15,1.4][Math.max(0,ORDER.indexOf(s.difficulty))];
    if(n%5===0)out.push({type:'commander'});while(budget>0){const q=avail[Math.floor(rand(s)*avail.length)];budget-=q[1];out.push({type:q[0]});}
    return out.map((e,i)=>{const p=pts[Math.floor(rand(s)*pts.length)];return {...e,id:'h'+n+'_'+i,x:p.x,y:p.y,zone:0};});}
  function holdout(s,dt,d){const alive=s.enemies.filter(e=>!e.dead).length+s.spawnWarnings.length;d.queue=d.queue||[];
    if(d.queue.length&&alive<10)warnSpawn(s,d.queue.splice(0,Math.min(4,10-alive)),true);
    if(d.wave===0||d.phase==='rest'){d.timer=(d.timer??3)-dt;s.progress=0;if(d.timer<=0){d.wave++;d.phase='fight';d.queue=composeWave(s,d.wave);event(s,'wave',{wave:d.wave});event(s,'toast',{text:'WAVE '+d.wave+(d.wave%5===0?' / COMMANDER INBOUND':'')});}}
    else if(!d.queue.length&&alive===0){d.phase='rest';d.timer=6;s.stats.wave=d.wave;const bonus=60+d.wave*25;s.stats.credits+=bonus;event(s,'waveclear',{wave:d.wave,bonus});
      s.pickups=s.pickups.filter(q=>!q.taken||q.base);for(const q of s.pickups)if(q.base)q.taken=false;}}
  function director(s,dt){const d=s.director,p=s.player;d.clock+=dt;d.rest=Math.max(0,d.rest-dt);d.pressure=clamp(s.enemies.filter(e=>e.active&&!e.dead).length/7+(100-p.health)/200,0,1);
    d.supplyCooldown=Math.max(0,(d.supplyCooldown||0)-dt);const equipped=p.slots[p.slot];
    if(!s.training&&d.supplyCooldown===0&&p.reserve[equipped]<W[equipped].capacity&&s.pickups.filter(a=>!a.taken&&a.type==='ammo').length<2){const x=p.x-Math.cos(p.angle)*80,y=p.y-Math.sin(p.angle)*80;if(clearAt(s,x,y,12)){s.pickups.push({id:'support'+s.tick,x,y,type:'ammo',taken:false});d.supplyCooldown=18;}}
    for(const warning of s.spawnWarnings){warning.delay-=dt;if(warning.delay<=0&&!warning.spawned){warning.spawned=true;const e=makeEnemy(s,warning);e.active=true;e.seen=4;e.lastX=p.x;e.lastY=p.y;e.spawned=true;e.hunt=true;const existing=s.enemies.find(a=>a.id===e.id);if(existing)Object.assign(existing,e);else s.enemies.push(e);}}
    s.spawnWarnings=s.spawnWarnings.filter(w=>!w.spawned);
    if(s.training){if(d.clock>9){d.clock=0;const returning=s.enemies.filter(e=>e.dead&&e.deathAge>4&&distance(e,p)>340).map(e=>s.map.enemies.find(a=>a.id===e.id));if(returning.length)warnSpawn(s,returning);if(p.health<25){p.health=65;event(s,'toast',{text:'TRAINING SAFETY / HEALTH RESTORED'});}}return;}
    const st=stageDef(s);s.goal={x:st.x,y:st.y};
    if(st.kind==='reach'){if(distance(p,st)<(st.radius||110))advance(s);}
    else if(st.kind==='destroy'){const left=s.walls.filter(w=>w.kind===st.targets&&!w.dead),total=s.walls.filter(w=>w.kind===st.targets).length;s.progress=total?1-left.length/total:1;
      if(d.left!==undefined&&left.length<d.left){event(s,'objective',{name:(total-left.length)+' / '+total+' DESTROYED',partial:true});if(left.length)checkpoint(s,{x:p.x,y:p.y});}d.left=left.length;
      if(!left.length)advance(s);else{const near=left.sort((a,b)=>distance(p,{x:a.x+a.w/2,y:a.y+a.h/2})-distance(p,{x:b.x+b.w/2,y:b.y+b.h/2}))[0];s.goal={x:near.x+near.w/2,y:near.y+near.h/2};}}
    else if(st.kind==='hold'){runWaves(s,st,d);if(d.wave>=st.waves.length&&!s.enemies.some(e=>!e.dead&&(e.zone<=st.zone||e.spawned))&&s.spawnWarnings.length===0)advance(s);}
    else if(st.kind==='survive'){runWaves(s,st,d);s.progress=clamp(d.clock/st.time,0,1);if(d.clock>=st.time){event(s,'toast',{text:'HOLD COMPLETE'});rout(s);advance(s);}}
    else if(st.kind==='boss'){if(d.wave===0){d.wave=1;warnSpawn(s,[{...st.boss,zone:st.zone}],true);event(s,'toast',{text:A[st.boss.type].name+' INBOUND'});}
      const boss=s.enemies.find(e=>e.id===st.boss.id);s.boss=boss&&!boss.dead?boss.id:null;
      if(boss){d.fired=d.fired||{};(st.waves||[]).forEach((w,i)=>{if(!d.fired[i]&&boss.hp<boss.maxHp*w.hp){d.fired[i]=true;warnSpawn(s,entriesFor(s,w.entries,st));}});if(boss.dead&&s.spawnWarnings.every(w=>w.id!==boss.id)){event(s,'toast',{text:A[boss.type].name+' DESTROYED'});rout(s);advance(s);}}}
    else if(st.kind==='endless')holdout(s,dt,d);
  }
  // Ending a defence or killing a boss sends that fight's reinforcements running, so extraction reads as a win rather than a mop-up.
  function rout(s){let n=0;for(const e of s.enemies)if(!e.dead&&e.spawned){e.dead=true;e.vanished=true;e.deathAge=0;n++;}s.spawnWarnings=[];if(n)event(s,'toast',{text:'REMAINING HOSTILES ARE RETREATING'});}
  function rating(s){const par=World.missions.find(m=>m.id===s.mission)?.par||240,score=Math.max(0,Math.round(10000+s.stats.flows*200-s.stats.damage*14-Math.max(0,s.time-par)*10));return {time:s.time,score,rating:score>=9600?'S':score>=8200?'A':score>=6500?'B':'C'};}
  function stepThrown(s,dt){for(const g of s.grenades){g.age+=dt;if(g.age<g.duration){const t=clamp(g.age/g.duration,0,1);const nx=g.sx+(g.tx-g.sx)*t,ny=g.sy+(g.ty-g.sy)*t;if(!g.blocked){if(!s.walls.some(w=>!w.dead&&!w.low&&!w.pass&&circleBox(nx,ny,4,w))){g.x=nx;g.y=ny;}else g.blocked=true;}}if(g.age>=g.fuse&&!g.exploded){g.exploded=true;detonate(s,g);}}
    s.grenades=s.grenades.filter(g=>!g.exploded);
    for(const z of s.zones){z.life-=dt;if(z.kind==='fire'){z.tick-=dt;if(z.tick<=0){z.tick=.25;for(const e of s.enemies)if(!e.dead&&!A[e.type].flying&&distance(e,z)<z.r)damageEnemy(s,e,9.5,Math.atan2(e.y-z.y,e.x-z.x),.05,'incendiary');if(distance(s.player,z)<z.r)damagePlayer(s,5,z.x,z.y,'fire');}}}
    s.zones=s.zones.filter(z=>z.life>0);if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=0)s.decoy=null;}
    for(const m of s.mines){m.arm-=dt;if(m.arm<=0&&!m.done&&s.enemies.some(e=>!e.dead&&!(e.gone>0)&&!A[e.type].flying&&distance(e,m)<78+e.radius-17)){m.done=true;explode(s,m.x,m.y,150,160,false,'mine');}}
    s.mines=s.mines.filter(m=>!m.done);
    const p=s.player;p.zap=Math.max(0,(p.zap||0)-dt);for(const h of s.hazards){h.off=Math.max(0,h.off-dt);h.on=h.off<=0&&((s.time+h.phase)%h.period)<h.period*h.duty;if(h.on&&!p.zap&&circleBox(p.x,p.y,p.radius-3,h)&&damagePlayer(s,22,h.x+h.w/2,h.y+h.h/2,'laser')){p.zap=.7;event(s,'zap',{x:p.x,y:p.y});}}}
  function stepPickups(s,dt){const p=s.player;for(const pick of s.pickups){if(pick.taken||pick.type==='supply')continue;const d=distance(pick,p);
      if(pick.type==='weapon'){if(!pick.owned&&s.owned.includes(pick.weapon))pick.owned=true;if(d<=35&&!pick.owned){s.owned.push(pick.weapon);pick.owned=true;event(s,'weaponfound',{weapon:pick.weapon,x:pick.x,y:pick.y});}if(pick.owned){pick.ttl+=dt;if(pick.ttl>45)pick.taken=true;}continue;}
      if(d>35)continue;
      if(pick.type==='health'){if(p.health>=100)continue;p.health=Math.min(100,p.health+30);}
      if(pick.type==='armor')p.armor=Math.min(p.maxArmor,p.armor+30);
      if(pick.type==='ammo')for(const k of p.slots)p.reserve[k]=Math.min(reserveOf(s,k)*2,p.reserve[k]+Math.ceil(W[k].reserve/3));
      if(pick.type==='lethal'){if(!p.lethal)continue;p.grenades=Math.min(G[p.lethal].count+s.mods.charges+2,p.grenades+1);}
      if(pick.type==='tactical'){if(!p.tactical)continue;p.tacticals=Math.min(G[p.tactical].count+s.mods.charges+2,p.tacticals+1);}
      if(pick.type==='intel'){s.stats.intel++;event(s,'intel',{x:pick.x,y:pick.y});}
      if(pick.type==='cache'){s.stats.credits+=120;event(s,'cache',{x:pick.x,y:pick.y,credits:120});}
      pick.taken=true;event(s,'pickup',{kind:pick.type,x:pick.x,y:pick.y});}
    if(s.tick%600===0&&s.pickups.length>40)s.pickups=s.pickups.filter(q=>!q.taken||q.base);}
  function step(s,input={},dt=DT){if(s.completed||s.dead)return;
    if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);s.buffered=s.buffered||{};for(const key of ['roll','slide','interact','reload','gadget','melee','grenade','tactical','swap'])if(input[key])s.buffered[key]=true;if(input.slot!==undefined)s.buffered.slot=input.slot;return;}
    if(s.buffered){input={...input,...s.buffered};s.buffered=null;}
    s.tick++;s.time+=dt;s.flowTime=Math.max(0,s.flowTime-dt);
    if(s.cinematic>0){s.cinematic+=dt;const cin=stageDef(s).cinematic||{duration:2.5,beats:[]};s.beats=s.beats||{};cin.beats.forEach((b,i)=>{if(s.cinematic>b.at&&!s.beats[i]){s.beats[i]=true;if(b.explode)explode(s,s.player.x+b.explode[0],s.player.y+b.explode[1],b.explode[2],0);if(b.radio)event(s,'radio',{...b.radio});}});if(s.cinematic>cin.duration){s.completed=true;event(s,'complete',{...rating(s)});}return;}
    stepPlayer(s,input,dt);if(s.dead)return;stepEnemies(s,dt);stepProjectiles(s,dt);stepThrown(s,dt);if(s.dead)return;stepPickups(s,dt);director(s,dt);
  }
  return {DT,CELL,create,step,move,clearAt,lineOfSight,sees,circleBox,segmentBox,segmentCircle,distance,shoot,damagePlayer,damageEnemy,damageProp,explode,vault,interact,melee,checkpoint,resupply,rating,stageDef,advance,enterStage,eligible,navField,nearbyWeapon,reserveOf,diff};
});

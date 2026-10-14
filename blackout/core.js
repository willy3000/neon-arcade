(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPCore=api;})(globalThis,function(World){
  'use strict';
  const DT=1/120,CELL=40,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),W=World.weapons,A=World.archetypes,G=World.gear,ORDER=World.order;
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],FUSE={frag:1.15,incendiary:.62,flash:.9,smoke:.7,emp:.95,decoy:.6,cluster:1,sensor:.62,gas:.7};
  // In team deathmatch "enemy pressure" is how good the AI operators are (TDM.skill), not a change to the rules.
  // In holdout the rules tighten as the run goes on: s.waveD is the chosen pressure with this wave's threat level
  // folded in (see pressureFor), so everything that asks diff() fights a little smarter each few waves.
  const diff=s=>s.tdm?World.difficulties.standard:s.waveD||World.difficulties[s.difficulty]||World.difficulties.standard,atLeast=(s,level)=>ORDER.indexOf(s.difficulty)>=ORDER.indexOf(level);
  function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  // An event raised during an operator's turn in team deathmatch (see act) is theirs unless it says whose it is.
  function event(s,type,data={}){if(s.events.length<256)s.events.push(s.acting&&data.who===undefined?{type,...data,who:s.acting}:{type,...data});}
  function circleBox(x,y,r,b){const nx=clamp(x,b.x,b.x+b.w),ny=clamp(y,b.y,b.y+b.h);return (x-nx)**2+(y-ny)**2<r*r;}
  function segmentBox(x1,y1,x2,y2,b,pad=0){let lo=0,hi=1;const dx=x2-x1,dy=y2-y1;for(const [p,q] of [[-dx,x1-b.x+pad],[dx,b.x+b.w+pad-x1],[-dy,y1-b.y+pad],[dy,b.y+b.h+pad-y1]]){if(Math.abs(p)<1e-9){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return lo;}
  function segmentCircle(x1,y1,x2,y2,c,r){const dx=x2-x1,dy=y2-y1,fx=x1-c.x,fy=y1-c.y,a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=b*b-4*a*cc;if(cc<=0)return 0;if(a<1e-9||disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
  function lineOfSight(s,a,b){return !s.walls.some(w=>!w.dead&&!w.pass&&w.kind!=='glass'&&segmentBox(a.x,a.y,b.x,b.y,w)!==null);}
  // Enemy perception also respects smoke.
  function sees(s,a,b){return lineOfSight(s,a,b)&&!s.zones.some(z=>z.kind==='smoke'&&segmentCircle(a.x,a.y,b.x,b.y,z,z.r)!==null);}
  function clearAt(s,x,y,r=16,ignore=null){return !s.walls.some(w=>!w.dead&&w.id!==ignore&&circleBox(x,y,r,w));}
  const reserveOf=(s,k)=>Math.round(W[k].reserve*s.mods.reserve*(s.mods.mastery[k]>=1?1.1:1)),reloadOf=(s,k)=>W[k].reload*s.mods.reload*(s.mods.mastery[k]>=2?.92:1)*(s.mods.kit[k]>=2?.9:1),damageOf=(s,k)=>W[k].damage*(s.mods.mastery[k]>=3?1.06:1)*(s.mods.kit[k]>=3?1.08:1);
  function makeEnemy(s,e){const t=A[e.type]||A.infantry,gun=e.gun||s.map.guns?.[e.type]||t.gun||null;const hp=t.hp*(e.plated?1.5:1)*(e.tough||1);return {...e,gun,hp,maxHp:hp,hull:e.angle||0,radius:t.radius||17,vx:0,vy:0,angle:e.angle||0,dead:false,active:false,stagger:0,cooldown:.6+rand(s),attack:0,attackAge:0,aim:0,seen:0,lastX:e.x,lastY:e.y,phase:1,clip:0,reload:0,moveTime:0,side:rand(s)>.5?1:-1,burst:0,burstT:0,shieldDown:0,disabled:0,gone:0,flashed:0,woke:false};}
  const stageDef=s=>s.map.stages[Math.min(s.stage,s.map.stages.length-1)],liveZone=s=>stageDef(s).zone;
  // The two lobby modes are fought over open ground with no objective marker: holdout's endless waves and team deathmatch.
  const arena=s=>{const k=stageDef(s).kind;return k==='endless'||k==='tdm';};
  // Co-op: an operator at zero health goes down instead of ending the run, and drops dog tags. The squadmate brings
  // them back by carrying those tags to the revive station and holding interact there for REVIVE_TIME seconds; the
  // run only ends once both are down. "lead" is whoever the
  // hostiles should be hunting and pathing towards: Rook, or the squadmate while Rook is down.
  const lead=s=>s.player.dead&&s.mates.find(o=>!o.dead)||s.player,REVIVE_TIME=5;
  // The squad: Rook plus up to three more operators (s.mates). Each mate is driven by a LAN player's input or, when
  // "bot" is set, by botInput below. s.guest stays as the name for the first of them, as two-player co-op knows it.
  const ops=s=>s.mates.length?[s.player,...s.mates]:[s.player],MATE_IDS=['guest','m2','m3'];
  function nearestOp(s,e){let best=null,bd=Infinity;for(const o of ops(s)){if(o.dead)continue;const d=distance(o,e);if(d<bd){bd=d;best=o;}}return best;}
  const eligible=(s,e)=>s.training||e.zone<=liveZone(s)||e.woke||e.spawned;
  // Team deathmatch: two teams, Alpha and Delta, of up to four operators each - players or AI in any mix - on a
  // killhouse map. Everyone has the whole kit and comes back a few seconds after going down. A kill is a point for the
  // killer's team; first to the limit wins, or whoever is ahead when the clock runs out (see muster for its length).
  // "dmg" scales a hit on an operator, "stun" caps how long one can be stunned, and "skill" is how good the AI is at
  // each pressure: the share of a player's damage it does, and how much slower or quicker than a regular it reacts.
  // hear: how recently and how near a shot has to be for an AI operator to know where it came from.
  const TDM={limit:30,limits:[5,10,15,20,30,50,75],respawn:6,safe:520,bounty:.5,pay:{win:300,draw:150,loss:100},dmg:.7,stun:2.2,hear:{time:1.5,range:700},
    skill:{story:{dmg:.4,react:1.6},standard:{dmg:.6,react:1.15},intense:{dmg:.8,react:.9},insane:{dmg:1,react:.7}}};
  const MATE_ALL=['guest','m2','m3','m4','m5','m6','m7'],skill=s=>TDM.skill[s.difficulty]||TDM.skill.standard;
  // What an operator's permanent upgrades, weapon mastery and kit parts are worth in a run. Team deathmatch passes
  // none: every operator starts level, whatever they have bought.
  function modsFor(profile){const up=profile?.upgrades||{},lvl=k=>clamp(Math.floor(up[k]||0),0,3),m={reserve:1+.2*lvl('pouch'),reload:1-.08*lvl('reflex'),regen:1+.15*lvl('conditioning'),drain:1-.1*lvl('conditioning'),delay:1-.1*lvl('conditioning'),kit:{},armor:25+20*lvl('plating'),maxArmor:80+15*lvl('plating'),stims:2+lvl('medic'),charges:lvl('bandolier'),mastery:{}};
    for(const k of Object.keys(W)){m.mastery[k]=clamp(Math.floor(profile?.mastery?.[k]||0),0,3);m.kit[k]=clamp(Math.floor(profile?.kit?.[k]||0),0,3);}return m;}
  // The roster. options.squad lists every operator, the host first: {team, loadout, bot}. Each is a whole operator
  // with a context of its own (op.ctx: everything the simulation keeps per player, see act). With no squad given it
  // is the host against one AI operator.
  const CTX=['perks','support','flowBoost','flowTime','windUsed','mods','stats','mastery','combo','comboAt','camp','owned','decoy','recon'];
  function muster(s,options){const T=s.tdm,host=s.player,squad=(Array.isArray(options.squad)&&options.squad.length?options.squad:[{team:0,loadout:options.loadout},{team:1,bot:true}]).slice(0,8);s.mates=[];s.roster=[];
    squad.forEach((c,i)=>{const lo=c&&c.loadout||{},bot=!!(c&&c.bot);let op=host;
      if(i){const slots=W[lo.primary]?.slot===0&&W[lo.secondary]?.slot===1?[lo.primary,lo.secondary]:['rifle','pistol'],lethal=G[lo.lethal]?.slot==='lethal'?lo.lethal:bot?'frag':null,tactical=G[lo.tactical]?.slot==='tactical'?lo.tactical:null;
        op={...host,id:MATE_ALL[i-1],buffer:{slide:0,interact:0},slots,slot:0,lethal,tactical,grenades:lethal?G[lethal].count:0,tacticals:tactical?G[tactical].count:0,stims:s.mods.stims,ammo:{...host.ammo},reserve:{...host.reserve}};s.mates.push(op);}
      const perks={};(Array.isArray(lo.perks)?lo.perks:[]).forEach((k,n)=>{if(World.perks[k]&&World.perks[k].slot===n)perks[k]=true;});
      Object.assign(op,{team:c&&c.team===1?1:0,bot,type:'operator',hp:100,maxHp:100,stagger:0,respawn:0,dead:false,x:-9e4,y:-9e4});
      op.ctx={perks,support:T.support&&World.support[lo.support]?{key:lo.support,cost:World.support[lo.support].cost,charge:0,ready:false,uses:0}:null,flowBoost:0,flowTime:0,windUsed:false,mods:s.mods,
        stats:{kills:0,shots:0,hits:0,damage:0,flows:0,credits:0,intel:0,bestCombo:0,wave:0,spent:0},mastery:{},combo:0,comboAt:-10,camp:{x:0,y:0,t:0},owned:Object.keys(W),decoy:null,recon:0};
      s.roster.push(op);T.board[op.id]={k:0,d:0,cr:0,team:op.team};});
    if(s.mates.length)s.guest=s.mates[0];
    // The clock allows longer per kill the fewer operators there are to find one another.
    // ...and longer again on a bigger map, where operators have further to go to find one another.
    const area=clamp(s.map.width*s.map.height/(1760*1280),1,2.2);T.time=clamp(T.limit*(squad.length<=2?26:squad.length<=4?18:14)*Math.sqrt(area),180,1200);
    for(const op of s.roster){const at=spawnSpot(s,op.team,op),to=T.bases[1-op.team];op.x=at.x;op.y=at.y;op.angle=Math.atan2(to.y-at.y,to.x-at.x);}}
  function create(options={}){
    // In team deathmatch the host is the first operator on the roster, and that entry carries their loadout.
    if(options.mode==='tdm'&&!options.loadout&&Array.isArray(options.squad)&&options.squad[0]&&options.squad[0].loadout)options={...options,loadout:options.squad[0].loadout};
    const training=options.training===true,id=training?'range':options.mission||'crash',tdm=!training&&options.mode==='tdm',last0=World.mission(id),cp=training||tdm?null:options.checkpoint||null;
    // Team deathmatch borrows a killhouse's ground and swaps its waves for the match.
    const limit=TDM.limits.includes(options.limit)?options.limit:TDM.limit;
    const map=tdm?{...last0,enemies:[],intro:{speaker:'LARK',text:'Team deathmatch. Alpha against Delta, first to '+limit+'.',duration:5},
      stages:[{kind:'tdm',zone:0,x:last0.start.x,y:last0.start.y,name:'Team deathmatch',hint:'First team to '+limit+' kills wins. Everyone redeploys a few seconds after going down.',spawn:{x:last0.start.x,y:last0.start.y}}]}:last0,last=map.stages.length-1;
    if(tdm)map.objectives=map.stages;
    let stage=cp?clamp(Math.floor(cp.stage)||0,0,last):0;while(stage>0&&!map.stages[stage].spawn)stage--;
    const st=map.stages[stage],up=options.profile?.upgrades||{},lvl=k=>clamp(Math.floor(up[k]||0),0,3);
    const s={map,mission:id,training,stage,time:cp?.time||0,seed:options.seed||1701,tick:0,events:[],walls:map.walls.map(w=>({...w,maxHp:w.maxHp??w.hp})),enemies:[],projectiles:Array.from({length:192},()=>({active:false})),grenades:[],zones:[],mines:[],decoy:null,hazards:map.hazards.map(h=>({...h})),pickups:map.pickups.map(p=>({...p,taken:false,base:true})),spawnWarnings:[],
      director:{clock:0,wave:0,rest:0,pressure:0,fired:{}},stats:{kills:cp?.kills||0,shots:0,hits:0,damage:cp?.damage||0,flows:cp?.flows||0,credits:cp?.credits||0,intel:cp?.intel||0,bestCombo:0,wave:0,spent:0},mastery:{},difficulty:options.difficulty||'standard',
      owned:[...(options.owned||(training?Object.keys(W):['rifle','pistol']))],completed:false,dead:false,cinematic:0,hitstop:0,lastFlow:-10,flowTime:0,checkpoint:null,endingStarted:false,combo:0,comboAt:-10,squad:{nade:3},camp:{x:0,y:0,t:0},killed:Array.isArray(cp?.killed)?[...cp.killed]:[],goal:{x:st.x,y:st.y},progress:0,dark:map.dark||0,boss:null};
    s.mods=modsFor(tdm?null:options.profile);
    for(let j=0;j<=stage;j++){const q=map.stages[j];for(const wid of q.restoreDead||[]){const w=s.walls.find(b=>b.id===wid);if(w)w.dead=true;}for(const n of q.enter?.opens||[])for(const w of s.walls)if(w.gate===n)w.dead=true;if(q.dark!==undefined)s.dark=q.dark;}
    for(const wid of Array.isArray(cp?.dead)?cp.dead:[]){const w=s.walls.find(b=>b.id===wid);if(w)w.dead=true;}
    if(cp?.intel>0)for(const q of s.pickups)if(q.type==='intel')q.taken=true;
    const lo=training?{primary:'rifle',secondary:'pistol',lethal:'frag',tactical:'flash'}:{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,...(options.loadout||{})};
    // Rook's perks (one per slot) and the field support he carries: its meter, and whatever it has put in the field.
    s.perks={};(Array.isArray(lo.perks)?lo.perks:[]).forEach((k,i)=>{if(World.perks[k]&&World.perks[k].slot===i)s.perks[k]=true;});
    s.support=World.support[lo.support]?{key:lo.support,cost:World.support[lo.support].cost,charge:0,ready:false,uses:0}:null;s.allies=[];s.recon=0;s.flowBoost=0;s.windUsed=false;
    const okSlots=a=>Array.isArray(a)&&a.length===2&&W[a[0]]&&W[a[1]]&&W[a[0]].slot===0&&W[a[1]].slot===1,okGear=(k,slot)=>k&&G[k]&&G[k].slot===slot?k:null;
    const slots=okSlots(cp?.slots)?[...cp.slots]:okSlots([lo.primary,lo.secondary])?[lo.primary,lo.secondary]:['rifle','pistol'];
    let lethal=okGear(cp&&cp.lethal!==undefined?cp.lethal:lo.lethal,'lethal');const tactical=okGear(cp&&cp.tactical!==undefined?cp.tactical:lo.tactical,'tactical');
    for(let j=1;j<=stage;j++){const g=map.stages[j].enter?.grants;if(g?.lethal&&!lethal)lethal=g.lethal;}
    s.mates=[];s.ai={};s.by='player';s.tdm=tdm?{limit,time:clamp(limit*14,180,900),score:[0,0],board:{},result:null,winner:null,support:options.support!==false,...bases(s)}:null;
    const spawn=tdm?s.tdm.bases[0]:cp&&Number.isFinite(cp.x)&&Number.isFinite(cp.y)&&clearAt(s,cp.x,cp.y,17)?{x:cp.x,y:cp.y}:st.spawn||map.start;
    s.player={id:'player',x:spawn.x,y:spawn.y,vx:0,vy:0,angle:0,moveAngle:0,radius:16,health:100,armor:s.mods.armor,maxArmor:s.mods.maxArmor,stamina:100,staminaRegenAt:0,winded:false,chained:false,diveEnd:-10,buffer:{slide:0,interact:0},state:'idle',age:0,duration:0,actionDir:0,reload:0,cooldown:0,recoil:0,shotAge:10,meleeIndex:0,meleeAt:-10,meleeHit:false,meleeHold:0,heavyTriggered:false,heavy:false,heal:0,iframes:0,stepDistance:0,
      slot:0,slots,lethal,tactical,grenades:training?9:lethal?G[lethal].count+s.mods.charges:0,tacticals:training?9:tactical?G[tactical].count+s.mods.charges:0,stims:training?5:s.mods.stims,ammo:{},reserve:{}};
    for(const [k,w] of Object.entries(W)){s.player.ammo[k]=w.capacity;s.player.reserve[k]=reserveOf(s,k);}
    // Mutators (World.mutators), for an operation replayed or a seeded challenge. Not in team deathmatch.
    s.mut={};if(!tdm&&!training)for(const k of Array.isArray(options.mutators)?options.mutators:[])if(World.mutators[k])s.mut[k]=true;
    if(s.mut.sidearms){const side=s.player.slots[1];s.player.slots=[side,side];}
    if(s.mut.scarcity)for(const k of Object.keys(W))s.player.reserve[k]=Math.floor(s.player.reserve[k]/2);
    // Veterans in an operation: its soldiers play by the rules holdout's later threat levels bring (cover, flanking,
    // grenades for campers, suppression, pressing a reload). Holdout raises its own threat level by one instead.
    if(s.mut.veterans&&!arena(s))s.waveD=pressureFor(s,10).D;
    // Squadmates: leaner characters (no slide/roll/dive/vault/gadgets - see stepMate) carrying a weapon pair of their
    // own, each worked by a LAN player or by the AI. options.guest is the two-player way of asking for one; options.mates
    // lists up to three. Absent unless one of those is passed, so solo/campaign play is untouched.
    const crew=(Array.isArray(options.mates)?options.mates:options.guest?[options.guest]:[]).slice(0,MATE_IDS.length),taken=[];
    crew.forEach((c,i)=>{
      const glo=(c&&c.loadout)||{},gslots=okSlots([glo.primary,glo.secondary])?[glo.primary,glo.secondary]:['rifle','pistol'],
        at=[[40,0],[-40,0],[0,40],[0,-40],[40,40],[-40,40],[40,-40],[-40,-40],[80,0],[-80,0]].map(([dx,dy])=>({x:spawn.x+dx,y:spawn.y+dy})).find(q=>clearAt(s,q.x,q.y,17)&&!taken.some(t=>t.x===q.x&&t.y===q.y))||{x:spawn.x,y:spawn.y};taken.push(at);
      const m={id:MATE_IDS[i],bot:!!(c&&c.bot),x:at.x,y:at.y,vx:0,vy:0,angle:0,moveAngle:0,radius:16,health:100,armor:s.mods.armor,maxArmor:s.mods.maxArmor,stamina:100,staminaRegenAt:0,winded:false,chained:false,diveEnd:-10,buffer:{slide:0,interact:0},state:'idle',age:0,duration:0,actionDir:0,reload:0,cooldown:0,recoil:0,shotAge:10,meleeIndex:0,meleeAt:-10,meleeHit:false,meleeHold:0,heavyTriggered:false,heavy:false,heal:0,iframes:0,stepDistance:0,
        slot:0,slots:gslots,lethal:null,tactical:null,grenades:0,tacticals:0,stims:0,ammo:{},reserve:{},dead:false};
      // An AI teammate carries a kit of its own: stims, a frag and a flashbang, topped up between waves (see holdout).
      if(m.bot)Object.assign(m,{lethal:'frag',tactical:'flash',grenades:BOT.kit.frag,tacticals:BOT.kit.flash,stims:s.mods.stims});
      for(const [k,w] of Object.entries(W)){m.ammo[k]=w.capacity;m.reserve[k]=reserveOf(s,k);}
      s.mates.push(m);});
    if(s.mates.length)s.guest=s.mates[0];
    if(tdm)muster(s,options);
    s.tags=[];s.station=s.mates.length&&!tdm?placeStation(s,spawn):null;s.order='auto';s.orderAt=null;s.spotted=0;s.jammed=false;s.boost=0;
    s.camp={x:spawn.x,y:spawn.y,t:0};
    const cleared=new Set();for(let j=0;j<stage;j++){const q=map.stages[j];if(['clear','hold','boss'].includes(q.kind))cleared.add(q.zone);}
    s.enemies=map.enemies.filter(e=>training||!cleared.has(e.zone)&&!s.killed.includes(e.id)).map(e=>makeEnemy(s,e));
    reinforce(s,spawn);
    event(s,'radio',stage===0?{...map.intro}:{...(map.resume||map.intro)});
    return s;
  }
  // Where a downed squadmate is brought back. Chosen once per run: an open, reachable spot a short run from the start,
  // as far from the enemy spawn points as that allows.
  function placeStation(s,spawn){const n=navField(s),pts=s.map.spawnPoints||[];let best=null,score=-Infinity;
    for(let cy=2;cy<n.h-2;cy++)for(let cx=2;cx<n.w-2;cx++){const d=n.dist[cy*n.w+cx];if(d<7||d>16)continue;const x=cx*CELL+20,y=cy*CELL+20;if(!clearAt(s,x,y,46))continue;
      const far=pts.length?Math.min(...pts.map(q=>distance(q,{x,y}))):400,v=Math.min(far,520)-Math.abs(d-11)*18;if(v>score){score=v;best={x,y};}}
    return best||{x:spawn.x,y:spawn.y};}
  // Higher difficulties add soldiers beside the authored ones (same room, deterministic) rather than inflating health.
  function reinforce(s,spawn){const D=diff(s),pool=s.map.insane||[];if(!D.extra||s.training)return;const extra=[];
    for(const e of s.enemies){const t=A[e.type];if(t.boss||t.static||rand(s)>D.extra)continue;const id=e.id+'x';if(s.killed.includes(id))continue;
      for(let i=0;i<14;i++){const a=rand(s)*Math.PI*2,d=55+rand(s)*95,x=e.x+Math.cos(a)*d,y=e.y+Math.sin(a)*d;
        if(x<60||y<60||x>s.map.width-60||y>s.map.height-60||distance({x,y},spawn)<420||!clearAt(s,x,y,21)||!lineOfSight(s,e,{x,y}))continue;
        const swap=pool.length&&(t.locked||rand(s)<.4);extra.push(makeEnemy(s,{id,type:swap?pool[Math.floor(rand(s)*pool.length)]:e.type,x,y,zone:e.zone}));break;}}
    s.enemies.push(...extra);}
  function move(s,a,dx,dy,ignore=null){const r=a.radius,fly=A[a.type]?.flying,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/7));for(let i=0;i<steps;i++){const ox=a.x,oy=a.y;a.x=clamp(a.x+dx/steps,r+40,s.map.width-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||fly&&(b.low||b.pass))continue;if(circleBox(a.x,a.y,r,b))a.x=ox;}a.y=clamp(a.y+dy/steps,r+40,s.map.height-r-40);for(const b of s.walls){if(b.dead||b.id===ignore||a.state==='slide'&&b.kind==='underpass'||fly&&(b.low||b.pass))continue;if(circleBox(a.x,a.y,r,b))a.y=oy;}}}
  // Stamina refills after a pause, not at once: a short one after any use, a long one after the bar is run dry. Running
  // it dry also leaves the operator winded - no sprinting until a quarter of the bar is back.
  const STAMINA_SHORT=1,STAMINA_LONG=3,WINDED_UNTIL=25,BUFFER=.12;
  function rest(s,p,seconds){p.staminaRegenAt=Math.max(p.staminaRegenAt||0,s.time+seconds*s.mods.delay);}
  function drain(s,p,amount){p.stamina=Math.max(0,p.stamina-amount);if(p.stamina<=0&&!p.winded){p.winded=true;rest(s,p,STAMINA_LONG);event(s,'winded',{guest:p!==s.player,who:p.id});}else rest(s,p,STAMINA_SHORT);}
  function recover(s,p,amount){if(s.time<(p.staminaRegenAt||0))return;p.stamina=Math.min(100,p.stamina+amount);if(p.winded&&p.stamina>=WINDED_UNTIL)p.winded=false;}
  function begin(s,state,duration,angle,cost=0,owner){const p=owner||s.player;if(p.stamina<cost)return false;p.stamina-=cost;if(cost>=8)rest(s,p,STAMINA_SHORT);p.chained=false;p.state=state;p.age=0;p.duration=duration;p.actionDir=angle;p.heal=0;if(state!=='reload')p.reload=0;event(s,'action',{action:state,x:p.x,y:p.y});return true;}
  function flow(s){s.stats.flows++;s.flowTime=1.3;s.lastFlow=s.time;s.player.stamina=Math.min(100,s.player.stamina+12);if(s.player.stamina>=WINDED_UNTIL)s.player.winded=false;if(s.perks.flowstate)s.flowBoost=s.time+3;charge(s,25);event(s,'flow',{x:s.player.x,y:s.player.y});}
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
  // (In team deathmatch, opening fire gives up whatever protection a redeploy left.)
  function shoot(s,actor,weapon,angle,enemy=false,owner){if(enemy)return enemyFire(s,actor,angle);if(s.tdm)(owner||s.player).iframes=0;const w=W[weapon],p=owner||s.player,base=angle+p.recoil*Math.sin(p.ammo[weapon]*2.1),m=muzzle(s,actor,angle,w.sprite);
    for(let i=0;i<w.pellets;i++){const bullet=s.projectiles.find(b=>!b.active);if(!bullet)break;const spread=w.spread*(s.mods.kit[weapon]>=1?.8:1)*(p.aiming?.45:1)*(Math.hypot(p.vx,p.vy)>210&&!w.steady?1.5:1);const a=base+(rand(s)-.5)*2*spread;
      Object.assign(bullet,{active:true,x:m.x,y:m.y,px:m.x,py:m.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,remaining:w.range,damage:damageOf(s,weapon)*(p.bot?botDmg(s):1)*(p===s.player&&s.time<s.flowBoost?1.3:1)*(p===s.player&&s.boost?1+.12*s.boost:1)*(w.steady&&(p.state==='slide'||p===s.player&&s.time-s.lastFlow<.8)?1.25:1),enemy:false,owner:p.id,weapon,pierce:w.pierce||0,explosive:w.explosive||0,stagger:w.stagger,breach:!!w.breach,hitIds:[],whiz:false,bounce:w.bounce||0,chain:w.chain||0,flame:!!w.flame,knife:false});}
    actor.shotAge=0;event(s,'shot',{x:m.x,y:m.y,angle,weapon,enemy:false});if(p===s.player)s.stats.fired=(s.stats.fired||0)+w.pellets;p.ammo[weapon]--;p.cooldown=w.rate;p.recoil=Math.min(.19,p.recoil+w.recoil);s.stats.shots++;move(s,p,-Math.cos(angle)*(w.cls==='shotgun'?5:1.3),-Math.sin(angle)*(w.cls==='shotgun'?5:1.3));
  }
  function enemyFire(s,e,angle,opts={}){const t=A[e.type]||A.infantry,D=diff(s),gun=W[e.gun]||W.rifle,m=muzzle(s,e,angle,gun.sprite),rocket=opts.rocket||t.rocket||0;
    for(let i=0;i<(t.pellets||1);i++){const bullet=s.projectiles.find(b=>!b.active);if(!bullet)break;const a=angle+(rand(s)-.5)*2*(t.spread??.035)*D.spread*(e.suppressed>0?1.8:1),speed=(opts.speed||t.bullet||620)*D.bullet;
      Object.assign(bullet,{active:true,x:m.x,y:m.y,px:m.x,py:m.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,remaining:t.reach||1100,damage:(opts.damage||t.damage)*(s.map.threat||1)*(e.vet?1.2:1),enemy:true,from:e.type,weapon:e.gun||'rifle',pierce:0,explosive:rocket,stagger:0,breach:false,hitIds:[],whiz:false,bounce:0,chain:0,flame:false,knife:false});}
    e.shotAge=0;event(s,'shot',{x:m.x,y:m.y,angle,weapon:rocket?'rocket':e.gun||'rifle',enemy:true});}
  function damagePlayer(s,amount,x,y,src=''){const p=s.player;if(s.dead||p.dead||s.cinematic>0||p.iframes>0||p.state==='vault'&&p.age<.24)return false;
    // A roll or dive that carries the operator through an attack is a flow chain, once per dodge.
    if(p.state==='roll'&&p.age>=.055&&p.age<=.25||p.state==='dive'&&p.age>=.07&&p.age<=.28){if(!p.chained&&amount>0&&!['','fire','laser'].includes(src)){p.chained=true;flow(s);event(s,'dodge',{x:p.x,y:p.y});}return false;}
    const D=diff(s);amount*=D.dmg*(s.perks.flak&&(src==='blast'||src==='fire')?.6:1);p.hurtAt=s.time;const hadArmor=p.armor>0,armor=Math.min(p.armor,amount*.65);p.armor-=armor;p.health=Math.max(0,p.health-amount+armor);s.stats.damage+=amount-armor;p.iframes=D.iframes;p.heal=0;s.director.rest=1.3;event(s,'damage',{x:p.x,y:p.y,amount,fromX:x,fromY:y,src,who:p.id});
    if(hadArmor&&p.armor<.5){p.armor=0;event(s,'armorbreak');}if(p.health<=0&&s.perks.secondwind&&!s.windUsed){s.windUsed=true;p.health=30;p.iframes=1.5;event(s,'secondwind',{x:p.x,y:p.y});}
    if(p.health<=0){if(s.tdm)fallen(s,p);else if(s.mates.some(o=>!o.dead))down(s,p);else{s.dead=true;p.state='death';p.age=0;event(s,'death',{blame:s.blame||null,wave:s.director.wave});}}return true;
  }
  function down(s,op){const who=op.id;Object.assign(op,{dead:true,state:'death',age:0,health:0,vx:0,vy:0,reload:0,heal:0});s.tags.push({owner:who,x:op.x,y:op.y,carrier:null,progress:0});event(s,'down',{who,x:op.x,y:op.y});}
  // Team deathmatch has no tags and no station: a fallen operator costs the squad a point and is back in a few seconds.
  function fallen(s,op,by){const T=s.tdm;Object.assign(op,{dead:true,state:'death',age:0,health:0,hp:0,vx:0,vy:0,reload:0,heal:0,burst:0,zip:0,stagger:0,respawn:TDM.respawn});T.score[1-op.team]++;if(T.board[op.id])T.board[op.id].d++;event(s,'down',{who:op.id,by,x:op.x,y:op.y,tdm:true});}
  // Back at their own team's base, whole, with full magazines and gadgets and a moment of protection. It runs in that
  // operator's own turn (see act), so the counts are theirs.
  function redeploy(s,op){const at=spawnSpot(s,op.team,op);Object.assign(op,{dead:false,x:at.x,y:at.y,vx:0,vy:0,health:100,hp:100,armor:s.mods.armor,stamina:100,winded:false,state:'idle',age:0,iframes:2.5,reload:0,heal:0,cooldown:.3,recoil:0,respawn:0,radius:16});
    for(const k of op.slots){op.ammo[k]=W[k].capacity;op.reserve[k]=reserveOf(s,k);}
    s.windUsed=false;op.stims=s.mods.stims;if(op.lethal)op.grenades=Math.max(op.grenades,G[op.lethal].count);if(op.tactical)op.tacticals=Math.max(op.tacticals,G[op.tactical].count);
    event(s,'respawn',{who:op.id,x:at.x,y:at.y});}
  // Tags are picked up by walking over them. Reviving means standing on the station with them and holding interact:
  // progress builds over REVIVE_TIME, and drains twice as fast whenever the carrier lets go or steps off the pad. The
  // revived operator stands up beside the station with part of their health and a moment of protection.
  // "inputs" holds this step's controls for every operator, by id. Tags whose carrier goes down are left where they fell.
  function stepRevive(s,inputs,dt){if(!s.mates.length||!s.tags.length)return;const all=ops(s),find=id=>all.find(o=>o.id===id);
    for(const t of s.tags){const op=find(t.owner);
      if(!t.carrier){const mate=all.find(o=>o!==op&&!o.dead&&distance(o,t)<38);if(mate){t.carrier=mate.id;event(s,'tags',{who:t.owner,by:mate.id,x:t.x,y:t.y});}continue;}
      const mate=find(t.carrier),by=t.carrier;if(!mate||mate.dead){t.carrier=null;t.progress=0;continue;}
      t.x=mate.x;t.y=mate.y;const held=!!(inputs[by]&&inputs[by].interactDown);
      if(!held||distance(mate,s.station)>64){t.progress=Math.max(0,t.progress-dt/REVIVE_TIME*2);continue;}
      if(t.progress<=0)event(s,'reviving',{who:t.owner,by,x:s.station.x,y:s.station.y});t.progress+=dt/REVIVE_TIME;if(t.progress<1)continue;
      const spot=[[0,0],[44,0],[-44,0],[0,44],[0,-44]].map(([dx,dy])=>({x:s.station.x+dx,y:s.station.y+dy})).find(q=>clearAt(s,q.x,q.y,17)&&distance(q,mate)>30)||s.station;
      Object.assign(op,{dead:false,x:spot.x,y:spot.y,vx:0,vy:0,health:60,stamina:100,state:'idle',age:0,iframes:2,reload:0,heal:0});t.done=true;event(s,'revive',{who:t.owner,by,x:spot.x,y:spot.y});}
    s.tags=s.tags.filter(t=>!t.done);}
  // Mirrors damagePlayer for a squadmate. A downed mate never ends the run by itself; losing every operator does.
  function damageMate(s,p,amount,x,y,src=''){if(!p||p.dead||s.cinematic>0||p.iframes>0)return false;
    // The middle of a roll or a dive carries a squadmate through an attack, as it does the player.
    if(p.state==='roll'&&p.age>=.055&&p.age<=.25||p.state==='dive'&&p.age>=.07&&p.age<=.28)return false;
    const D=diff(s);amount*=D.dmg;const hadArmor=p.armor>0,armor=Math.min(p.armor,amount*.65);p.armor-=armor;p.health=Math.max(0,p.health-amount+armor);p.iframes=D.iframes;event(s,'damage',{x:p.x,y:p.y,amount,fromX:x,fromY:y,src,guest:true,who:p.id});
    if(hadArmor&&p.armor<.5)p.armor=0;if(p.health<=0){if(s.tdm)fallen(s,p);else{down(s,p);if(!ops(s).some(o=>!o.dead)){s.dead=true;event(s,'death',{blame:s.blame||null,wave:s.director.wave});}}}return true;
  }
  const hurt=(s,op,amount,x,y,src)=>op===s.player?damagePlayer(s,amount,x,y,src):damageMate(s,op,amount,x,y,src);
  function damageEnemy(s,e,amount,angle=0,stagger=.15,source='rifle',bypass=false,blast=false){if(e.dead||e.gone>0)return;if(e.ctx)return strike(s,e,amount,angle,source,blast);const t=A[e.type]||A.infantry;
    // What the round itself brings (world.js): "ap" gets that share of the way through armour and shield fronts,
    // "overload" (the XR-9) burns through barriers and shield fronts, "counter" hits harder on a hostile winding up an
    // attack, and "suppress" rattles whoever it hits (slower to fire, wider shots) for that long.
    const gun=W[source]||{},ap=gun.ap||0,through=(mult,share)=>mult+(1-mult)*share;
    if(t.front&&!bypass&&!(e.shieldDown>0)&&!(e.disabled>0)&&Math.abs(wrap(angle+Math.PI-e.angle))<.85){amount*=through(t.front,Math.max(ap,gun.overload?.6:0));event(s,'armorhit',{x:e.x,y:e.y});}
    if(gun.counter&&e.attack>0&&!blast&&!t.boss){amount*=gun.counter;event(s,'countershot',{x:e.x,y:e.y});}
    if(gun.suppress&&!t.machine)e.suppressed=Math.max(e.suppressed||0,gun.suppress);
    // A round travelling the way a tank's hull faces has come from behind it: past the plating, and into the engine.
    const rear=t.rear&&!blast&&Math.abs(wrap(angle-(e.hull||0)))<.95;
    if(rear){amount*=t.rear;event(s,'rearhit',{x:e.x,y:e.y});}
    else if(t.armor&&!blast&&!bypass&&!(e.disabled>0)){amount*=through(t.armor,ap);event(s,'armorhit',{x:e.x,y:e.y});}
    // A rail slug goes through a barrier. In holdout the barrier soaks a set amount (shieldMax, blasts count double)
    // and then fails for a few seconds; in the campaign it holds until its generators go down.
    if(t.barrier&&!(e.shieldDown>0)&&!e.barrierOff&&!W[source]?.breach){
      if(e.shieldMax){e.shieldHp-=amount*(blast||gun.overload?2:1);if(e.shieldHp<=0){e.shieldHp=0;e.shieldDown=SHIELD_DOWN;e.attack=0;e.burst=0;e.stagger=Math.max(e.stagger,.6);event(s,'shieldbreak',{id:e.id,x:e.x,y:e.y,enemy:e.type});}}
      amount*=gun.overload?Math.max(t.barrier,.25):t.barrier;event(s,'shieldhit',{x:e.x,y:e.y});}
    // Ambusher: more damage to a hostile that has not noticed you - or cannot fight back (flashed, suppressed or stunned).
    if(s.perks.ambusher&&source!=='enemy'&&s.by==='player'&&(!e.active||e.flashed>0||e.suppressed>0||e.stagger>.5))amount*=1.35;
    e.hp-=amount;const resistant=(t.boss||t.heavy)&&source!=='melee'&&!blast;e.stagger=t.static?0:Math.max(e.stagger,resistant?Math.min(.025,stagger):stagger);if(!resistant){e.attack=0;e.attackAge=0;e.burst=0;}
    if(!t.static){const push=t.boss||t.heavy?3:14;move(s,e,Math.cos(angle)*Math.min(push,amount*.18),Math.sin(angle)*Math.min(push,amount*.18));}
    if(source!=='enemy'&&!e.active){e.active=true;e.woke=true;e.seen=Math.max(e.seen,2.5);e.lastX=lead(s).x;e.lastY=lead(s).y;}else if(source!=='enemy')e.woke=true;
    const ours=source!=='enemy',by=ours?s.by:undefined;
    event(s,'hit',{id:e.id,x:e.x,y:e.y,angle,amount,player:ours,by});s.stats.hits++;if(source==='melee'&&by==='player')s.hitstop=Math.max(s.hitstop,.025);
    if(e.hp<=0){const bot=ours&&by!=='player'&&!!s.mates.find(o=>o.id===by)?.bot,endless=stageDef(s).kind==='endless';e.dead=true;e.deathAge=0;if(!bot)s.stats.kills++;let credits=0;const bounty=(t.bounty||15)*(e.pay||1)*(e.vet?1.3:1)*(e.revived?.5:1);if(s.ai[e.id])delete s.ai[e.id];
      if(ours&&!bot){s.mastery[source]=(s.mastery[source]||0)+1;s.combo=s.time-s.comboAt<3.5?s.combo+1:1;s.comboAt=s.time;s.stats.bestCombo=Math.max(s.stats.bestCombo,s.combo);const pl=s.player,sliding=pl.state==='slide'&&!pl.dead&&by==='player';
        // Holdout pays less per hostile than the campaign: there are far more of them and the chain rarely breaks.
        credits=Math.round(bounty*(1+.1*Math.min(s.combo-1,8))*(source==='melee'?1.5:1)*(sliding?1.25:1)*(endless?.6:s.tdm?TDM.bounty:1));s.stats.credits+=credits;
        // Two more flow chains: a kill made mid-slide, and a knife kill straight out of a dive.
        if(by==='player'&&!pl.chained&&(sliding||source==='melee'&&s.time-pl.diveEnd<.7)){pl.chained=true;flow(s);}
        if(by==='player')credit(s,source,t);}
      // An AI teammate's kill is not yours: it never touches your combo, mastery or kill count. In holdout it pays half
      // a bounty towards the run; in team deathmatch it is a point for the squad and nothing more.
      else if(bot&&!s.tdm){credits=Math.round(bounty*.5*(endless?.6:1));const mind=s.ai[by];if(mind)mind.support=(mind.support||0)+bounty;s.stats.credits+=credits;}
      if(s.tdm&&ours){s.tdm.score[0]++;const row=s.tdm.board[by];if(row){row.k++;row.cr+=credits;}}
      event(s,'kill',{x:e.x,y:e.y,enemy:e.type,id:e.id,credits,combo:bot?0:s.combo,boss:!!t.boss,source,by,bot});drops(s,e,t);
      if(t.kamikaze&&!e.detonated)explode(s,e.x,e.y,70,30,false,source);}
  }
  // What a dead hostile leaves behind. Supplies are scarce on purpose: most kills leave nothing, so rounds and
  // gadgets have to be spent with care.
  //  - Ammunition is likelier the emptier the squad's guns are (DROPS.ammo: the chance with reserves gone, and with a
  //    full standard reserve), so a careful shot keeps what he has and a wasteful one runs low before the field helps.
  //  - Nothing is dropped while enough of the same kind already lies unclaimed (DROPS.field), and the second of a
  //    kind is half as likely as the first.
  //  - A gadget or armour plate is only dropped for an operator who can use it and is short of it.
  //  - Whatever is dropped is gone after DROPS.life seconds, so a long run does not litter the field. A hostile's
  //    own gun and a commander's cache and medkit are prizes, not supplies, and keep their own rules.
  // The director's emergency ammunition (stepDirector) is still there for an operator who has run completely dry.
  const DROPS={ammo:[.34,.05],health:.45,gadget:.3,field:{ammo:2,health:2,armor:1,lethal:1,tactical:1},life:25};
  const loose=(s,type)=>s.pickups.reduce((n,q)=>n+(!q.taken&&q.until&&q.type===type?1:0),0);
  // How full the emptiest gun of the emptiest operator is, against its standard reserve (0 to 1). AI operators do not count.
  const stocked=s=>Math.min(1,...[s.player,...s.mates.filter(o=>!o.bot)].filter(o=>!o.dead&&o.slots).flatMap(o=>o.slots.map(k=>{const full=reserveOf(s,k);return full>0&&Number.isFinite(full)?Math.min(1,(o.reserve[k]||0)/full):1;})));
  function drops(s,e,t){const p=s.player,D=diff(s),drop=(type,dx=0,dy=0,extra={})=>s.pickups.push({id:'drop'+s.tick+e.id+type,x:e.x+dx,y:e.y+dy,type,taken:false,until:s.time+DROPS.life,...extra});
    const room=type=>{const n=loose(s,type),max=DROPS.field[type]||1;return n>=max?0:n?.5:1;};
    if(!s.training&&!e.revived&&e.gun&&W[e.gun]&&!s.owned.includes(e.gun)&&!s.pickups.some(q=>!q.taken&&q.type==='weapon'&&q.weapon===e.gun)){drop('weapon',0,0,{weapon:e.gun,ttl:0,until:0});event(s,'gundrop',{weapon:e.gun,x:e.x,y:e.y});}
    // One roll for the supply and one for the gadget, whatever is decided, so the run's other dice fall as they did.
    const roll=rand(s),second=t.drop?rand(s):1;
    const lean=s.mut?.scarcity?.5:1;
    if(p.health<50){if(room('health')&&(p.health<40&&D.med&&!lean||roll<DROPS.health*D.drops*lean*room('health')))drop('health',8,6);}
    else{const [empty,full]=DROPS.ammo,k=stocked(s);if(roll<(empty+(full-empty)*k)*D.drops*lean*room('ammo'))drop('ammo',8,6);}
    const wanted=t.drop==='lethal'?p.lethal&&p.grenades<G[p.lethal].count+s.mods.charges:t.drop==='tactical'?p.tactical&&p.tacticals<G[p.tactical].count+s.mods.charges:t.drop==='armor'?p.armor<p.maxArmor:!!t.drop;
    if(wanted&&second<DROPS.gadget*room(t.drop))drop(t.drop,-14,-10);
    if(t.boss&&!s.training){drop('cache',-20,18,{until:0});drop('health',22,-14,{until:0});}
  }
  function damageProp(s,b,damage){if(b.dead||!Number.isFinite(b.hp))return;b.hp-=damage;event(s,'impact',{x:b.x+b.w/2,y:b.y+b.h/2,kind:b.kind});if(b.hp<=0){b.dead=true;const cx=b.x+b.w/2,cy=b.y+b.h/2;event(s,'destroy',{x:cx,y:cy,kind:b.kind,w:b.w,h:b.h,id:b.id});
    if(b.kind==='barrel'||b.kind==='vehicle'||b.kind==='fuel')explode(s,cx,cy,b.kind==='fuel'?230:b.kind==='vehicle'?190:140,b.kind==='fuel'?160:b.kind==='vehicle'?130:105);
    if(b.kind==='console'){for(const e of s.enemies)if(!e.dead&&distance(e,{x:b.x,y:b.y})<380){e.stagger=3;e.attack=0;}event(s,'toast',{text:'POWER GRID DISRUPTED'});}
    if(b.kind==='generator'){const left=s.walls.filter(w=>w.kind==='generator'&&!w.dead).length;for(const e of s.enemies)if(!e.dead&&A[e.type]?.barrier){e.shieldDown=Math.max(e.shieldDown,9);if(!left)e.barrierOff=true;}event(s,'toast',{text:left?'GENERATOR DOWN / BARRIER OFFLINE 9 SECONDS':'ALL GENERATORS DOWN / BARRIER DESTROYED'});}}}
  function explode(s,x,y,radius=150,damage=110,enemy=false,source='grenade'){event(s,'explosion',{x,y,radius});for(const b of s.walls){if(b.dead||!Number.isFinite(b.hp))continue;const d=Math.hypot(clamp(x,b.x,b.x+b.w)-x,clamp(y,b.y,b.y+b.h)-y);if(d<radius)damageProp(s,b,damage*(1-d/radius));}
    for(const e of s.enemies){const d=distance(e,{x,y});if(!e.dead&&!(e.gone>0)&&d<radius)damageEnemy(s,e,damage*(1-.55*d/radius)*(enemy?.5:1),Math.atan2(e.y-y,e.x-x),.65,enemy?'enemy':source,true,true);}
    const d=distance(s.player,{x,y});if(d<radius)damagePlayer(s,damage*(enemy?.6:.45)*(1-d/radius),x,y,'blast');
    for(const m of s.mates){if(m.dead)continue;const dg=distance(m,{x,y});if(dg<radius)damageMate(s,m,damage*(enemy?.6:.45)*(1-dg/radius),x,y,'blast');}
  }
  // An arc caster's bolt jumps from the hostile it hit to the nearest others in view, for 60% each, and stalls machines.
  function arc(s,from,b){let at=from;const hit=[from.id];
    for(let i=0;i<b.chain;i++){let next=null,bd=210;for(const e of s.enemies){if(e.dead||e.gone>0||hit.includes(e.id))continue;const d=distance(at,e);if(d<bd&&lineOfSight(s,at,e)){bd=d;next=e;}}
      if(!next)break;event(s,'arc',{x:at.x,y:at.y,x2:next.x,y2:next.y});damageEnemy(s,next,b.damage*.6,Math.atan2(next.y-at.y,next.x-at.x),.4,b.weapon);if(A[next.type].machine&&!next.dead)next.disabled=Math.max(next.disabled||0,1.2);hit.push(next.id);at=next;}}
  // s.by names the operator whose bullet or blade is landing, so a kill can be credited to them.
  function stepProjectiles(s,dt,only){const p=s.player;for(const b of s.projectiles){if(!b.active||only&&b.owner!==only)continue;const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;b.px=b.x;b.py=b.y;let target=null,t=2;
      for(const w of s.walls){if(w.dead||w.pass||b.hitIds.includes(w.id))continue;const u=segmentBox(b.x,b.y,nx,ny,w);if(u!==null&&u<t){t=u;target={kind:'wall',a:w};}}
      const list=b.enemy?ops(s):s.enemies;
      for(const e of list){if(e.dead||e.gone>0||!b.enemy&&b.hitIds.includes(e.id))continue;const u=segmentCircle(b.x,b.y,nx,ny,e,e.radius+(b.explosive?4:2));if(u!==null&&u<t){t=u;target={kind:b.enemy?'op':'enemy',a:e};}}
      if(target){b.x+=(nx-b.x)*t;b.y+=(ny-b.y)*t;const angle=Math.atan2(b.vy,b.vx);let through=false,bounced=false;if(!b.enemy)s.by=b.owner||'player';
        if(b.enemy)s.blame=b.from||s.blame;
        if(b.explosive)explode(s,b.x,b.y,b.explosive,b.damage,b.enemy,b.weapon);
        else if(target.kind==='wall'){damageProp(s,target.a,b.damage);if(b.breach&&Number.isFinite(target.a.hp)){b.hitIds.push(target.a.id);through=true;}
          // A ricochet round comes back off the face it struck: a floor or ceiling of the box turns it over, a side turns it round.
          else if(b.bounce>0&&!b.enemy&&!target.a.dead){b.bounce--;bounced=true;const w=target.a;if(b.x>w.x+.5&&b.x<w.x+w.w-.5)b.vy=-b.vy;else b.vx=-b.vx;event(s,'ricochet',{x:b.x,y:b.y});}}
        else if(target.kind==='enemy'){if(b.owner===s.player.id)s.stats.landed=(s.stats.landed||0)+1;damageEnemy(s,target.a,b.damage,angle,b.stagger,b.weapon,b.breach);if(b.chain&&!b.enemy)arc(s,target.a,b);}
        else hurt(s,target.a,b.damage,b.px,b.py,b.weapon);
        s.by='player';event(s,'bulletimpact',{x:b.x,y:b.y,enemy:b.enemy});
        if(target.kind==='enemy'&&b.pierce>0&&!b.explosive){b.pierce--;b.hitIds.push(target.a.id);b.x=nx;b.y=ny;}else if(through){b.x=nx;b.y=ny;}else if(bounced){b.x+=b.vx*.0008;b.y+=b.vy*.0008;}else b.active=false;
      }else{b.x=nx;b.y=ny;}
      if(b.enemy&&b.active&&!b.whiz){const sx=b.x-b.px,sy=b.y-b.py,l2=sx*sx+sy*sy||1,u=clamp(((p.x-b.px)*sx+(p.y-b.py)*sy)/l2,0,1);if(Math.hypot(b.px+sx*u-p.x,b.py+sy*u-p.y)<44){b.whiz=true;event(s,'whiz',{x:b.x,y:b.y});}}
      b.remaining-=Math.hypot(b.vx,b.vy)*dt;if(b.remaining<=0&&b.active){b.active=false;if(b.explosive){if(!b.enemy)s.by=b.owner||'player';else s.blame=b.from||s.blame;explode(s,b.x,b.y,b.explosive,b.damage,b.enemy,b.weapon);s.by='player';}}
      // Where it ends up: a thrown knife lies there to be picked up again, and every fourth round of a flamethrower leaves the ground burning.
      if(!b.active&&!b.enemy&&(b.knife||b.flame)){if(b.knife)s.pickups.push({id:'knife'+s.tick+'_'+s.pickups.length,x:clamp(b.x,60,s.map.width-60),y:clamp(b.y,60,s.map.height-60),type:'lethal',taken:false});
        else if((s.flameN=(s.flameN||0)+1)%4===0&&s.zones.length<14)s.zones.push({kind:'fire',x:b.x,y:b.y,r:46,life:2.2,tick:0});b.knife=b.flame=false;}
    }
  }
  function melee(s,heavy=false,owner){const p=owner||s.player;if(['roll','dive','vault','melee'].includes(p.state)||p.heal>0)return false;const wasSlide=p.state==='slide',index=s.time-p.meleeAt<.95?(p.meleeIndex+1)%3:0;p.meleeIndex=index;p.meleeAt=s.time;p.meleeHit=false;p.heavy=heavy;
    if(!begin(s,'melee',heavy?.62:.34,p.angle,heavy?12:3,owner))return false;if(wasSlide){flow(s);move(s,p,Math.cos(p.angle)*15,Math.sin(p.angle)*15);}event(s,'meleeswing',{x:p.x,y:p.y,heavy});return true;
  }
  // Shared by the player's and guest's melee swings: who it hits, how hard, and what it breaks.
  function meleeHitSweep(s,p){const reach=p.heavy?90:73,damage=(p.heavy?95:[45,55,80][p.meleeIndex])*(p.bot?botDmg(s):1)*(p===s.player&&s.time<s.flowBoost?1.3:1);s.by=p.id;for(const e of s.enemies){if(e.dead||e.gone>0||distance(p,e)>reach+(e.radius-17)||Math.abs(wrap(Math.atan2(e.y-p.y,e.x-p.x)-p.angle))>1.25||!lineOfSight(s,p,e))continue;const finish=e.hp<(p===s.player&&s.perks.executioner?55:35);damageEnemy(s,e,finish?200:damage,p.angle,p.heavy?.9:.45,'melee',p.heavy||finish);event(s,'meleeimpact',{x:e.x,y:e.y,finish});}for(const b of s.walls)if(!b.dead&&Number.isFinite(b.hp)&&circleBox(p.x+Math.cos(p.angle)*45,p.y+Math.sin(p.angle)*45,32,b))damageProp(s,b,damage);s.by='player';}
  const zoneAlive=(s,z)=>s.enemies.some(e=>!e.dead&&e.zone===z)||s.spawnWarnings.some(w=>w.zone===z);
  // Under Sidearms Only a primary can be found (and unlocked) but not carried.
  const carriable=(s,k)=>!(s.mut?.sidearms&&W[k].slot===0);
  const nearbyWeapon=s=>s.pickups.find(q=>!q.taken&&q.type==='weapon'&&s.owned.includes(q.weapon)&&carriable(s,q.weapon)&&!s.player.slots.includes(q.weapon)&&distance(q,s.player)<70);
  function equip(s,q){if(!carriable(s,q.weapon))return;const p=s.player,k=q.weapon,slot=W[k].slot;p.slots[slot]=k;p.slot=slot;p.ammo[k]=W[k].capacity;p.reload=0;p.cooldown=.2;q.taken=true;event(s,'equip',{weapon:k});event(s,'toast',{text:W[k].name+' EQUIPPED'});}
  function interact(s,input){const p=s.player,st=stageDef(s);
    if(!s.training&&(st.kind==='clear'||st.kind==='extract'||st.kind==='hold')&&distance(p,st)<90){
      if(st.kind==='clear'){if(zoneAlive(s,st.zone)){event(s,'toast',{text:'CLEAR THE HOSTILES BEFORE INTERACTING'});return;}advance(s);}
      else if(st.kind==='extract'&&!s.endingStarted){s.cinematic=.001;s.endingStarted=true;if(st.start)event(s,'radio',{...st.start});event(s,'cinematic');}
      return;
    }
    const offer=nearbyOffer(s);if(offer){buyOffer(s,offer);return;}
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
  function advance(s){const st=stageDef(s);charge(s,150);if(st.leave?.radio)event(s,'radio',{...st.leave.radio});if(st.leave?.toast)event(s,'toast',{text:st.leave.toast});event(s,'objective',{name:st.name});enterStage(s,Math.min(s.stage+1,s.map.stages.length-1));}
  function checkpoint(s,pos=null){const p=s.player;if(s.training)return;let stage=s.stage;while(stage>0&&!s.map.stages[stage].spawn)stage--;
    s.checkpoint={stage,time:s.time,kills:s.stats.kills,damage:s.stats.damage,flows:s.stats.flows,credits:s.stats.credits,intel:s.stats.intel,killed:s.enemies.filter(e=>e.dead&&!e.spawned).map(e=>e.id).slice(0,160),dead:s.walls.filter(w=>w.dead&&['jammer','fuel','generator'].includes(w.kind)).map(w=>w.id),slots:[...p.slots],lethal:p.lethal,tactical:p.tactical};
    if(pos&&stage===s.stage&&clearAt(s,pos.x,pos.y,17)){s.checkpoint.x=pos.x;s.checkpoint.y=pos.y;}
    event(s,'checkpoint',{checkpoint:{...s.checkpoint,killed:[...s.checkpoint.killed],dead:[...s.checkpoint.dead],slots:[...p.slots]}});event(s,'toast',{text:'CHECKPOINT SECURED'});p.health=Math.max(p.health,diff(s).heal);p.stamina=100;}
  function resupply(s){const p=s.player;p.health=100;p.armor=50;p.stims=5;p.grenades=9;p.tacticals=9;p.stamina=100;for(const [k,w] of Object.entries(W)){p.ammo[k]=w.capacity;p.reserve[k]=w.reserve;}event(s,'pickup',{kind:'supply',x:p.x,y:p.y});event(s,'toast',{text:'FIELD EQUIPMENT REPLENISHED'});}
  function throwItem(s,kind,input){const p=s.player,d=Math.min(380,Math.hypot((input.aimX??p.x+300)-p.x,(input.aimY??p.y)-p.y));s.grenades.push({kind,x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(p.angle)*d,ty:p.y+Math.sin(p.angle)*d,age:0,duration:.58,fuse:FUSE[kind]||1.15,enemy:false});event(s,'throw',{x:p.x,y:p.y,kind});}
  function lob(s,e,tx,ty,o={}){s.grenades.push({kind:o.kind||'frag',x:e.x,y:e.y,sx:e.x,sy:e.y,tx,ty,age:0,duration:o.duration||.65,fuse:o.fuse||1.65,enemy:true,radius:o.radius,damage:o.damage,from:e.type,missile:!!o.missile,shell:!!o.shell});event(s,'enemygrenade',{x:tx,y:ty,kind:o.kind||'frag',missile:!!o.missile});}
  function deployCover(s){const p=s.player,cx=p.x+Math.cos(p.angle)*64,cy=p.y+Math.sin(p.angle)*64,horiz=Math.abs(Math.sin(p.angle))>Math.abs(Math.cos(p.angle)),w=horiz?120:30,h=horiz?30:120;
    const b={id:'dc'+s.tick,x:cx-w/2,y:cy-h/2,w,h,kind:'barrier',hp:280,maxHp:280,low:true,dead:false,deployed:true},overlap=o=>o.x<b.x+b.w&&o.x+o.w>b.x&&o.y<b.y+b.h&&o.y+o.h>b.y;
    if(cx<60||cy<60||cx>s.map.width-60||cy>s.map.height-60||s.walls.some(o=>!o.dead&&overlap(o))||s.enemies.some(e=>!e.dead&&circleBox(e.x,e.y,e.radius,b))||circleBox(p.x,p.y,p.radius,b)){event(s,'toast',{text:'NO ROOM TO DEPLOY COVER'});return false;}
    const old=s.walls.filter(o=>o.deployed&&!o.dead);if(old.length>=4)old[0].dead=true;s.walls.push(b);event(s,'deploy',{x:cx,y:cy});return true;}
  function detonate(s,g){const kind=g.kind||'frag';if(g.enemy&&g.from)s.blame=g.from;
    if(kind==='frag')explode(s,g.x,g.y,g.radius||155,g.damage||(g.enemy?85:135),g.enemy,g.strike?'strike':g.cluster?'cluster':'grenade');
    else if(kind==='cluster'){explode(s,g.x,g.y,110,90,false,'cluster');for(let i=0;i<5;i++){const a=i/5*Math.PI*2+rand(s),d=70+rand(s)*45;
      s.grenades.push({kind:'frag',x:g.x,y:g.y,sx:g.x,sy:g.y,tx:g.x+Math.cos(a)*d,ty:g.y+Math.sin(a)*d,age:0,duration:.3,fuse:.5+i*.07,enemy:false,radius:95,damage:75,cluster:true});}}
    else if(kind==='sensor'){s.zones.push({kind:'sensor',x:g.x,y:g.y,r:420,life:12});event(s,'sensor',{x:g.x,y:g.y});}
    else if(kind==='gas'){s.zones.push({kind:'gas',x:g.x,y:g.y,r:150,life:9,tick:0});event(s,'smoke',{x:g.x,y:g.y});}
    else if(kind==='incendiary'){explode(s,g.x,g.y,70,35);s.zones.push({kind:'fire',x:g.x,y:g.y,r:95,life:6,tick:0});}
    else if(kind==='smoke'){s.zones.push({kind:'smoke',x:g.x,y:g.y,r:170,life:10.5});event(s,'smoke',{x:g.x,y:g.y});}
    else if(kind==='decoy'){s.decoy={id:'decoy',x:g.x,y:g.y,radius:16,life:7.5,vx:0,vy:0};event(s,'decoy',{x:g.x,y:g.y});}
    // A hostile flashbang (holdout's later waves): an operator who sees it go off is dazed for a moment - slowed and
    // unable to fire - unless a roll or dive carried them through it. An AI teammate loses its target for longer.
    else if(kind==='flash'&&g.enemy){for(const o of ops(s)){if(o.dead||distance(o,g)>270||!lineOfSight(s,o,g)||o.iframes>0||o.state==='roll'||o.state==='dive')continue;
      if(o.bot){const m=s.ai[o.id];if(m){m.react=Math.max(m.react,1.3);m.foe=null;}}else o.stagger=Math.max(o.stagger||0,.9);event(s,'flash',{x:g.x,y:g.y,self:true,who:o.id,enemy:true});}}
    // In team deathmatch the event names everyone on the other team who saw it, and the thrower is not spared their own.
    else if(kind==='flash'){const self=distance(s.player,g)<260&&lineOfSight(s,s.player,g);event(s,'flash',{x:g.x,y:g.y,self,blind:s.tdm?s.enemies.filter(e=>!e.dead&&distance(e,g)<=300&&lineOfSight(s,e,g)).map(e=>e.id):undefined});
      if(s.tdm&&self&&!s.player.dead)s.player.stagger=Math.max(s.player.stagger||0,1.2);
      for(const e of s.enemies){const t=A[e.type];if(e.dead||t.machine||distance(e,g)>300||!lineOfSight(s,e,g))continue;const time=t.boss?.7:3.2;e.stagger=Math.max(e.stagger,time);e.flashed=time;e.attack=0;e.burst=0;e.active=true;}}
    else if(kind==='emp'){event(s,'emp',{x:g.x,y:g.y});if(s.tdm)for(const a of s.allies)if(distance(a,g)<340&&s.enemies.some(o=>o.id===a.owner))a.life=0;for(const h of s.hazards)if(distance(g,{x:h.x+h.w/2,y:h.y+h.h/2})<380)h.off=9;
      for(const e of s.enemies){const t=A[e.type];if(e.dead||distance(e,g)>320)continue;if(t.flying&&t.machine){e.detonated=true;damageEnemy(s,e,999,0,.1,'emp',true,true);}
        else if(t.machine){e.disabled=e.type==='mech'?3.5:e.type==='apc'?5:9;e.shieldDown=Math.max(e.shieldDown,8);e.attack=0;e.burst=0;}else if(t.front){e.shieldDown=9;e.stagger=Math.max(e.stagger,1.2);}else e.stagger=Math.max(e.stagger,.5);}}}
  // The lethal slot. Most are thrown; a mine or C4 is planted at Rook's feet (C4 goes off when the key is pressed
  // again, so one charge is down at a time); a knife is a single heavy round that lies where it lands; the seeker is let go and hunts by itself.
  function useLethal(s,input){const p=s.player,k=p.lethal;
    if(k==='c4'&&s.mines.some(m=>m.remote)){for(const m of s.mines.filter(q=>q.remote)){m.done=true;explode(s,m.x,m.y,185,175,false,'c4');}s.mines=s.mines.filter(m=>!m.done);return;}
    if(p.grenades<=0)return;p.grenades--;
    if(k==='mine'||k==='c4'){s.mines.push({id:'mine'+s.tick,x:p.x,y:p.y,arm:.8,remote:k==='c4'});if(s.mines.length>6)s.mines.shift();event(s,'plant',{x:p.x,y:p.y});}
    else if(k==='knife'){const b=s.projectiles.find(q=>!q.active);if(!b){p.grenades++;return;}const x=p.x+Math.cos(p.angle)*24,y=p.y+Math.sin(p.angle)*24;
      Object.assign(b,{active:true,x,y,px:x,py:y,vx:Math.cos(p.angle)*1250,vy:Math.sin(p.angle)*1250,remaining:540,damage:150,enemy:false,owner:p.id,weapon:'tknife',pierce:0,explosive:0,stagger:.6,breach:false,hitIds:[],whiz:false,bounce:0,chain:0,flame:false,knife:true});event(s,'throw',{x:p.x,y:p.y,kind:'knife'});}
    else if(k==='seeker'){s.allies.push({id:'ally'+s.tick,kind:'seeker',x:p.x,y:p.y,angle:p.angle,life:8,total:8,cooldown:0,vx:0,vy:0,radius:9,moveTime:0});event(s,'throw',{x:p.x,y:p.y,kind:'seeker'});}
    else throwItem(s,k,input);}
  // The tactical slot. The grapple is a dive at speed along the line of aim (so it has a dive's moment of protection)
  // and counts as a flow; the trophy system and the ammo box are set down where Rook stands; the rest are thrown.
  function useTactical(s,input){const p=s.player,k=p.tactical;
    if(k==='cover'){if(deployCover(s))p.tacticals--;return;}
    if(k==='grapple'){const d=clamp(Math.hypot((input.aimX??p.x+300)-p.x,(input.aimY??p.y)-p.y),160,430);if(!begin(s,'dive',d/1150,p.angle,0))return;p.zip=1150;p.tacticals--;flow(s);event(s,'grapple',{x:p.x,y:p.y,angle:p.angle,d});return;}
    p.tacticals--;
    if(k==='trophy'){s.allies.push({id:'ally'+s.tick,kind:'trophy',x:p.x,y:p.y,angle:0,life:20,total:20,cooldown:0,vx:0,vy:0});event(s,'deploy',{x:p.x,y:p.y});}
    else if(k==='ammobox'){[[-40,24],[40,24],[0,-44]].forEach(([dx,dy],i)=>s.pickups.push({id:'box'+s.tick+'_'+i,x:p.x+dx,y:p.y+dy,type:'ammo',taken:false}));event(s,'deploy',{x:p.x,y:p.y});}
    else throwItem(s,k,input);}
  function stepPlayer(s,input,dt){if(s.player.dead)return;const p=s.player,w=W[p.slots[p.slot]],busy=['slide','roll','dive','vault','melee'].includes(p.state);p.age+=dt;p.shotAge+=dt;p.cooldown=Math.max(0,p.cooldown-dt);p.iframes=Math.max(0,p.iframes-dt);p.recoil=Math.max(0,p.recoil-dt*.18);p.aiming=!!input.aiming;
    const mx=input.mx||0,my=input.my||0,len=Math.hypot(mx,my),nx=len?mx/len:0,ny=len?my/len:0;
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))p.angle=Math.atan2(input.aimY-p.y,input.aimX-p.x);
    const want=input.swap?1-p.slot:input.slot;if(want!==undefined&&want!==p.slot&&p.slots[want]){p.slot=want;p.reload=0;p.cooldown=.15;event(s,'swap',{weapon:p.slots[want]});}
    if(input.roll&&!['roll','dive','vault'].includes(p.state)){const dive=input.sprint&&len>0;const chain=p.state==='melee'&&p.age>.19;if(p.stamina<30||!begin(s,dive?'dive':'roll',dive?.63:.4,len?Math.atan2(ny,nx):p.angle,dive?40:30))event(s,'nostamina');else if(chain)flow(s);}
    // A slide or interact pressed a few frames early is held for a moment and fires as soon as it can, instead of being lost.
    p.buffer.slide=input.slide?BUFFER:Math.max(0,p.buffer.slide-dt);
    if(p.buffer.slide>0&&len>0&&Math.hypot(p.vx,p.vy)>265&&!busy){p.buffer.slide=0;if(begin(s,'slide',.7,Math.atan2(p.vy,p.vx),24)){p.slideSpeed=Math.max(490,Math.hypot(p.vx,p.vy)*1.38);}}
    {const blocked=['vault','roll','dive'].includes(p.state);if(input.interact&&blocked)p.buffer.interact=BUFFER;else if(input.interact||p.buffer.interact>0&&!blocked){p.buffer.interact=0;interact(s,{...input,mx:nx,my:ny});}else p.buffer.interact=Math.max(0,p.buffer.interact-dt);}
    if(input.melee){p.meleeHold=0;p.heavyTriggered=false;melee(s,false);}if(input.meleeDown){p.meleeHold+=dt;if(p.meleeHold>.43&&!p.heavyTriggered&&p.state!=='melee'){p.heavyTriggered=true;melee(s,true);}}
    if(input.gadget&&p.stims>0&&p.health<100&&!['roll','dive','vault'].includes(p.state)){p.heal=.85;p.healTotal=.85;event(s,'healstart');}
    if(input.support)callSupport(s,input);
    if(s.perks.regen&&p.health<60&&p.heal<=0&&s.time-(p.hurtAt??-99)>6)p.health=Math.min(60,p.health+dt*7);
    // Timers settle at exactly zero: a negative remainder used to read as "still reloading/healing" and blocked sprint until an action reset it.
    if(p.heal>0){p.heal-=dt;if(p.heal<=0){p.heal=0;p.stims--;p.health=Math.min(100,p.health+50);p.iframes=.25;event(s,'pickup',{kind:'health',x:p.x,y:p.y});}}
    const free=!['vault','roll','dive'].includes(p.state);
    if(input.grenade&&p.lethal&&free)useLethal(s,input);
    if(input.tactical&&p.tacticals>0&&p.tactical&&free)useTactical(s,input);
    const key=p.slots[p.slot];
    if(input.reload&&!p.reload&&p.ammo[key]<w.capacity&&p.reserve[key]>0&&!busy){p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key});}
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){p.reload=0;const k=p.slots[p.slot],def=W[k],amount=Math.min(def.capacity-p.ammo[k],p.reserve[k]);p.ammo[k]+=amount;p.reserve[k]-=amount;event(s,'reloadend');}}
    // A minigun has to be spun up before it fires and winds down twice as fast; a burst weapon finishes the burst it started.
    p.spin=w.spin&&input.fire&&!p.reload&&!busy?Math.min(w.spin,(p.spin||0)+dt):Math.max(0,(p.spin||0)-dt*2);
    if(p.burst>0){if(p.burstGun!==key||p.reload>0||p.ammo[key]<=0||busy)p.burst=0;else if((p.burstT-=dt)<=0){p.burst--;p.burstT=w.gap;shoot(s,p,key,p.angle);p.cooldown=w.rate;}}
    if(input.fire&&p.cooldown<=0&&p.reload<=0&&p.heal<=0&&!(p.stagger>0)&&!(w.spin&&p.spin<w.spin)&&!['roll','dive','vault','melee'].includes(p.state)){if(p.ammo[key]>0){shoot(s,p,key,p.angle);if(w.burst){p.burst=w.burst-1;p.burstT=w.gap;p.burstGun=key;}}else if(p.reserve[key]>0&&!busy){p.cooldown=.2;event(s,'empty');p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key});}else{p.cooldown=.35;event(s,'empty');event(s,'toast',{text:'OUT OF AMMUNITION / SWAP WEAPONS'});}}
    const oldX=p.x,oldY=p.y;
    if(p.state==='vault'){const v=p.vault,t=clamp(p.age/p.duration,0,1),ease=t*t*(3-2*t);const tx=v.sx+(v.tx-v.sx)*ease,ty=v.sy+(v.ty-v.sy)*ease;move(s,p,tx-p.x,ty-p.y,v.ignore);p.vx=Math.cos(p.actionDir)*320;p.vy=Math.sin(p.actionDir)*320;}
    else if(['slide','roll','dive'].includes(p.state)){let speed=p.state==='slide'?p.slideSpeed*Math.exp(-2.6*p.age):p.state==='roll'?550*(1-.55*clamp(p.age/p.duration,0,1)):p.zip||690*(1-.7*clamp(p.age/p.duration,0,1));p.radius=p.state==='slide'?10:16;p.vx=Math.cos(p.actionDir)*speed;p.vy=Math.sin(p.actionDir)*speed;move(s,p,p.vx*dt,p.vy*dt);}
    else{p.radius=16;const push=input.sprint&&len>0&&!p.winded&&!input.fire&&!input.aiming&&!p.heal,sprint=push&&p.stamina>0&&!p.reload,jog=push&&p.reload>0;const speed=(sprint?360:input.aiming?175:jog?300:250)*(p.stagger>0?.5:1)*W[p.slots[p.slot]].mobility*(p.state==='melee'?.45:jog?1:p.reload?.7:p.heal?.45:1);const response=Math.min(1,dt*(len?25:31));p.vx+=(nx*speed-p.vx)*response;p.vy+=(ny*speed-p.vy)*response;move(s,p,p.vx*dt,p.vy*dt);
      if(p.state!=='melee'){p.state=sprint?'sprint':len?'run':'idle';}if(sprint)drain(s,p,dt*13*s.mods.drain);}
    if(p.state==='melee'&&!p.meleeHit&&p.age>=(p.heavy?.24:.12)){p.meleeHit=true;meleeHitSweep(s,p);}
    if(['vault','roll','dive','slide','melee'].includes(p.state)&&p.age>=p.duration){if(p.state==='dive'){p.diveEnd=s.time;p.zip=0;}p.state=len?'run':'idle';p.age=0;p.radius=16;}
    if(!['sprint','roll','dive','slide','vault','melee'].includes(p.state))recover(s,p,dt*26*s.mods.regen);
    const travel=Math.hypot(p.x-oldX,p.y-oldY);if(travel>.05)p.moveAngle=Math.atan2(p.y-oldY,p.x-oldX);p.stepDistance+=travel;if(p.stepDistance>=(p.state==='sprint'?62:51)&&!['slide','roll','dive','vault'].includes(p.state)){p.stepDistance=0;event(s,'footstep',{x:p.x,y:p.y,surface:s.training?'metal':s.map.theme==='snow'?'snow':'concrete'});}
    if(distance(p,s.camp)>110){s.camp.x=p.x;s.camp.y=p.y;s.camp.t=0;}else s.camp.t+=dt;
  }
  // A squadmate's leaner kit: move, aim, sprint, fire, reload, melee, a stim and thrown gadgets. No slide/roll/dive/
  // vault - those are the most stateful parts of stepPlayer, and skipping them keeps this additive rather than a refactor.
  // Every event it raises says whose it is ("who"), so each player's screen and speakers only answer to their own.
  function stepMate(s,p,input,dt){if(!p||p.dead)return;const w=W[p.slots[p.slot]],mine={guest:true,who:p.id};
    p.age+=dt;p.shotAge+=dt;p.cooldown=Math.max(0,p.cooldown-dt);p.iframes=Math.max(0,p.iframes-dt);p.recoil=Math.max(0,p.recoil-dt*.18);p.aiming=!!input.aiming;
    const mx=input.mx||0,my=input.my||0,len=Math.hypot(mx,my),nx=len?mx/len:0,ny=len?my/len:0;
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))p.angle=Math.atan2(input.aimY-p.y,input.aimX-p.x);
    const want=input.swap?1-p.slot:input.slot;if(want!==undefined&&want!==p.slot&&p.slots[want]){p.slot=want;p.reload=0;p.cooldown=.15;event(s,'swap',{weapon:p.slots[want],...mine});}
    // Roll, dive and slide by the player's own rules: the same stamina costs, speeds and the moment in a roll or dive
    // nothing can hit (see damageMate). A vault is the one move a squadmate does not have.
    const dodging=['roll','dive','slide'].includes(p.state);
    if(input.roll&&!dodging&&p.state!=='melee'&&p.stamina>=30){const dive=!!input.sprint&&len>0;begin(s,dive?'dive':'roll',dive?.63:.4,len?Math.atan2(ny,nx):p.angle,dive?40:30,p);}
    if(input.slide&&len>0&&!dodging&&p.state!=='melee'&&Math.hypot(p.vx,p.vy)>265&&begin(s,'slide',.7,Math.atan2(p.vy,p.vx),24,p))p.slideSpeed=Math.max(490,Math.hypot(p.vx,p.vy)*1.38);
    const airborne=p.state==='roll'||p.state==='dive';
    if(input.melee&&!airborne){p.meleeHold=0;p.heavyTriggered=false;melee(s,false,p);}
    if(input.meleeDown&&!airborne){p.meleeHold+=dt;if(p.meleeHold>.43&&!p.heavyTriggered&&p.state!=='melee'){p.heavyTriggered=true;melee(s,true,p);}}
    // The rest of a teammate's kit, for whoever carries it (an AI teammate does; see create): a stim, and a lethal
    // and a tactical thrown at the aim point.
    if(input.gadget&&p.stims>0&&p.health<100&&!(p.heal>0)){p.heal=.85;p.healTotal=.85;event(s,'healstart',{...mine});}
    if(p.heal>0){p.heal-=dt;if(p.heal<=0){p.heal=0;p.stims--;p.health=Math.min(100,p.health+50);p.iframes=.25;event(s,'pickup',{kind:'health',x:p.x,y:p.y,...mine});}}
    if(input.grenade&&p.lethal&&p.grenades>0){p.grenades--;mateThrow(s,p,p.lethal,input);}
    if(input.tactical&&p.tactical&&p.tacticals>0){p.tacticals--;mateThrow(s,p,p.tactical,input);}
    // An AI teammate's own field support: a sentry set down where it stands (see botInput for when it has earned one).
    if(input.support&&p.bot&&!s.tdm){const at=[[0,0],[36,0],[-36,0],[0,36],[0,-36]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(o=>clearAt(s,o.x,o.y,22)&&distance(o,p)>=30)||{x:p.x,y:p.y};
      s.allies.push({id:'ally'+s.tick+p.id,kind:'turret',x:at.x,y:at.y,angle:p.angle,life:25,total:25,cooldown:.5,vx:0,vy:0,shotAge:10,by:p.id});event(s,'deploy',{x:at.x,y:at.y});}
    const key=p.slots[p.slot];
    if(input.reload&&!p.reload&&p.ammo[key]<w.capacity&&p.reserve[key]>0&&p.state!=='melee'){p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key,...mine});}
    // An AI teammate never runs dry: its reserve is topped back up as each magazine goes in.
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){p.reload=0;const k=p.slots[p.slot],def=W[k],amount=Math.min(def.capacity-p.ammo[k],p.reserve[k]);p.ammo[k]+=amount;p.reserve[k]-=amount;if(p.bot)p.reserve[k]=reserveOf(s,k);event(s,'reloadend',{...mine});}}
    if(input.fire&&p.cooldown<=0&&p.reload<=0&&!(p.heal>0)&&p.state!=='melee'&&!airborne){if(p.ammo[key]>0)shoot(s,p,key,p.angle,false,p);else if(p.reserve[key]>0){p.cooldown=.2;event(s,'empty',{...mine});p.reload=reloadOf(s,key);p.reloadTotal=p.reload;event(s,'reload',{weapon:key,...mine});}else{p.cooldown=.35;event(s,'empty',{...mine});}}
    const oldX=p.x,oldY=p.y;
    if(['slide','roll','dive'].includes(p.state)){const t=clamp(p.age/p.duration,0,1),v=p.state==='slide'?p.slideSpeed*Math.exp(-2.6*p.age):p.state==='roll'?550*(1-.55*t):690*(1-.7*t);
      p.radius=p.state==='slide'?10:16;p.vx=Math.cos(p.actionDir)*v;p.vy=Math.sin(p.actionDir)*v;move(s,p,p.vx*dt,p.vy*dt);if(p.age>=p.duration){p.state=len?'run':'idle';p.age=0;p.radius=16;}}
    else{p.radius=16;const sprint=input.sprint&&len>0&&p.stamina>0&&!p.winded&&!input.fire&&!input.aiming&&!p.reload;const speed=(sprint?360:input.aiming?175:250)*w.mobility*(p.state==='melee'?.45:p.heal>0?.45:p.reload?.7:1);const response=Math.min(1,dt*(len?25:31));p.vx+=(nx*speed-p.vx)*response;p.vy+=(ny*speed-p.vy)*response;move(s,p,p.vx*dt,p.vy*dt);
      if(p.state!=='melee')p.state=sprint?'sprint':len?'run':'idle';if(sprint)drain(s,p,dt*13);}
    if(p.state==='melee'&&!p.meleeHit&&p.age>=(p.heavy?.24:.12)){p.meleeHit=true;meleeHitSweep(s,p);}
    if(p.state==='melee'&&p.age>=p.duration){p.state=len?'run':'idle';p.age=0;}
    if(!['sprint','roll','dive','slide'].includes(p.state))recover(s,p,dt*26);
    const travel=Math.hypot(p.x-oldX,p.y-oldY);if(travel>.05)p.moveAngle=Math.atan2(p.y-oldY,p.x-oldX);
  }
  function mateThrow(s,p,kind,input){const tx=input.aimX??p.x+Math.cos(p.angle)*300,ty=input.aimY??p.y+Math.sin(p.angle)*300,d=clamp(Math.hypot(tx-p.x,ty-p.y),60,380),a=Math.atan2(ty-p.y,tx-p.x);
    s.grenades.push({kind,x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(a)*d,ty:p.y+Math.sin(a)*d,age:0,duration:.58,fuse:FUSE[kind]||1.15,enemy:false,owner:p.id});event(s,'throw',{x:p.x,y:p.y,kind,who:p.id});}
  // Blocked dead ahead, a soldier sidesteps along the obstacle. One following the path field ("both") also tries the
  // other side if that way is blocked too, and keeps to it: a body two pixels too low to pass a corner the field sent
  // it round used to push at it for ever, because its one sidestep direction happened to point into the wall.
  function enemyMovement(s,e,tx,ty,speed,dt,both=false){const dx=tx-e.x,dy=ty-e.y,len=Math.hypot(dx,dy);if(len<12)return;const ox=e.x,oy=e.y;move(s,e,dx/len*speed*dt,dy/len*speed*dt);
    if(Math.hypot(e.x-ox,e.y-oy)<.1){const side=a=>move(s,e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt),ahead=Math.atan2(dy,dx);side(ahead+e.side*Math.PI*.5);if(both&&Math.hypot(e.x-ox,e.y-oy)<.1){e.side=-e.side;side(ahead+e.side*Math.PI*.5);}}
    e.vx=(e.x-ox)/dt;e.vy=(e.y-oy)/dt;e.moveTime+=Math.hypot(e.vx,e.vy)*dt/80;}
  // The path field treats a cell as walkable if a body of this radius fits at its centre.
  const BODY=15;
  // Can a body walk the straight line from a to b? Sight is not enough: water, fences, cars and crates can be seen
  // over or past but not walked through.
  const walkClear=(s,a,b)=>!s.walls.some(w=>!w.dead&&segmentBox(a.x,a.y,b.x,b.y,w,(a.radius||BODY)-5)!==null);
  // The 40px walkability grid, rebuilt whenever a wall is added or destroyed.
  function grid(s){const w=Math.ceil(s.map.width/CELL),h=Math.ceil(s.map.height/CELL),sig=s.walls.length*1000+s.walls.filter(b=>b.dead).length;let n=s.nav;
    if(!n||n.sig!==sig){const blocked=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)blocked[y*w+x]=clearAt(s,x*CELL+20,y*CELL+20,BODY)?0:1;n=s.nav={sig,w,h,blocked,dist:new Int16Array(w*h),cell:-1,at:-9};}
    return n;}
  const cellOf=(n,p)=>clamp(Math.floor(p.y/CELL),0,n.h-1)*n.w+clamp(Math.floor(p.x/CELL),0,n.w-1);
  // Breadth-first walking distance from the seed cells to everywhere else, in grid steps (-1 where there is no way).
  function flood(n,dist,seeds){const w=n.w,h=n.h,queue=new Int32Array(w*h);let head=0,tail=0;dist.fill(-1);for(const c of seeds)if(dist[c]<0){dist[c]=0;queue[tail++]=c;}
    while(head<tail){const id=queue[head++],cx=id%w,cy=(id-cx)/w;for(const [dx,dy] of DIRS){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=w||y>=h)continue;const nid=y*w+x;if(dist[nid]>=0||n.blocked[nid]||dx&&dy&&(n.blocked[cy*w+x]||n.blocked[y*w+cx]))continue;dist[nid]=dist[id]+1;queue[tail++]=nid;}}
    return dist;}
  // Distance field to the player. Hunters follow it around buildings instead of stalling at a last-seen corner. With a
  // squad in the field it leads to whichever operator is the shortest walk away.
  function navField(s){const n=grid(s),up=s.mates.length?ops(s).filter(o=>!o.dead):[],seeds=up.length?up.map(o=>cellOf(n,o)):[cellOf(n,lead(s))],key=seeds.length>1?seeds.join():seeds[0];
    if(n.cell!==key||s.time-n.at>1.5){n.cell=key;n.at=s.time;flood(n,n.dist,seeds);}
    return n;}
  // Team deathmatch ground: the hostile base is the spawn point furthest on foot from where the map starts, the
  // squad's is the one furthest from that. "points" is everywhere either side may come back when its base is overrun.
  function bases(s){const n=grid(s),d=new Int16Array(n.w*n.h),start={x:s.map.start.x,y:s.map.start.y},all=[start,...(s.map.spawnPoints||[]).map(q=>({x:q.x,y:q.y}))].filter(q=>clearAt(s,q.x,q.y,17));
    const far=from=>{flood(n,d,[cellOf(n,from)]);let best=from,bd=-1;for(const q of all){const v=d[cellOf(n,q)];if(v>bd){bd=v;best=q;}}return best;},b=far(start),a=far(b);
    flood(n,d,[cellOf(n,a)]);return {bases:[a,b],points:all.filter(q=>d[cellOf(n,q)]>=0)};}
  // Where an operator redeploys: their own team's base, or, while the other team is close to that or has eyes on it,
  // whichever point is furthest from them (out of their sight if there is one), so nobody comes back into a waiting gun.
  function spawnSpot(s,team,self){const T=s.tdm,foes=s.roster.filter(o=>o.team!==team&&!o.dead),mine=s.roster.filter(o=>o.team===team&&!o.dead&&o!==self),near=q=>foes.reduce((m,f)=>Math.min(m,distance(f,q)),9999),
      watched=q=>foes.some(f=>distance(f,q)<900&&lineOfSight(s,f,q)),worth=q=>near(q)-(watched(q)?600:0);
    let at=T.bases[team];if(near(at)<TDM.safe||watched(at))at=T.points.reduce((best,q)=>worth(q)>worth(best)?q:best,at);
    for(const [dx,dy] of [[0,0],[46,0],[-46,0],[0,46],[0,-46],[46,46],[-46,-46],[46,-46],[-46,46],[92,0],[-92,0],[0,92],[0,-92]]){const q={x:at.x+dx,y:at.y+dy};
      if(clearAt(s,q.x,q.y,19)&&!mine.some(o=>distance(o,q)<34))return q;}
    return {x:at.x,y:at.y};}
  // The nearest spot round (x, y) where a body of radius r stands clear of every wall: a spawn point picked for a
  // soldier can be too tight for a commander or a tank.
  function freeSpot(s,x,y,r){if(clearAt(s,x,y,r))return {x,y};for(let d=12;d<=160;d+=12)for(let k=0;k<12;k++){const a=k/12*Math.PI*2,q={x:x+Math.cos(a)*d,y:y+Math.sin(a)*d};if(q.x>r+40&&q.y>r+40&&q.x<s.map.width-r-40&&q.y<s.map.height-r-40&&clearAt(s,q.x,q.y,r))return q;}return {x,y};}
  // The path field is laid out for a soldier-sized body, so something bigger (a commander, a tank) can wedge itself
  // where the field says there is room. Held in place for over a second it backs out in a random clear direction
  // for a moment before trying again.
  function chase(s,e,speed,dt){if(e.unstick>0){e.unstick-=dt;enemyMovement(s,e,e.x+Math.cos(e.ua)*60,e.y+Math.sin(e.ua)*60,speed,dt);return;}
    const n=navField(s),cx=Math.floor(e.x/CELL),cy=Math.floor(e.y/CELL),here=n.dist[cy*n.w+cx],ox=e.x,oy=e.y;let best=null,bd=here<0?32767:here;
    if(here>=0&&here<=1){const to=nearestOp(s,e)||lead(s);enemyMovement(s,e,to.x,to.y,speed,dt,true);}
    else{for(const [dx,dy] of DIRS){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=n.w||y>=n.h)continue;const d=n.dist[y*n.w+x];if(d<0||d>=bd)continue;if(dx&&dy&&(n.blocked[cy*n.w+x]||n.blocked[y*n.w+cx]))continue;bd=d;best={x:x*CELL+20,y:y*CELL+20};}
      enemyMovement(s,e,best?best.x:e.lastX,best?best.y:e.lastY,speed,dt,true);}
    if(Math.hypot(e.x-ox,e.y-oy)<speed*dt*.15){e.stuck=(e.stuck||0)+dt;if(e.stuck>1.2){e.stuck=0;e.unstick=.7;e.ua=rand(s)*Math.PI*2;e.side=-e.side;}}else e.stuck=0;}
  function leadAim(s,e,t,tgt){const D=diff(s),speed=(t.bullet||620)*D.bullet,tt=distance(e,tgt)/speed,lead=Math.max(D.lead,t.lead||0);return Math.atan2(e.lastY+(tgt.vy||0)*tt*lead-e.y,e.lastX+(tgt.vx||0)*tt*lead-e.x);}
  function finishAttack(s,e,t){const D=diff(s);e.cooldown=t.rate*D.rate*(t.boss&&e.phase===3&&e.type!=='commander'?.7:1);e.clip++;if(e.clip>=(t.clip||5)){e.clip=0;e.reload=1.65;event(s,'enemyreload',{x:e.x,y:e.y});}}
  // Where a mortar team's three rounds land round the aim point (tighter on a target a spotter has marked).
  const SHELLS=[[0,0],[90,-55],[-85,60]],SHIELD_DOWN=6;
  function release(s,e,t,tgt,dist,canSee,aim){const p=s.player,mode=e.mode;e.mode=null;s.blame=e.type;
    if(mode==='missiles'){(e.salvo||[]).forEach((q,i)=>lob(s,e,q.x,q.y,{duration:1.05+i*.12,fuse:1.2+i*.12,radius:95,damage:38,missile:true}));e.salvo=null;event(s,'missiles',{x:e.x,y:e.y});}
    else if(mode==='cannon'){enemyFire(s,e,e.aim,{rocket:150,speed:760,damage:72});event(s,'cannon',{x:e.x,y:e.y,angle:e.aim});}
    else if(mode==='flash')lob(s,e,e.targetX,e.targetY,{kind:'flash',duration:.6,fuse:.85});
    else if(t.melee){if(dist<t.range+24&&canSee&&tgt!==s.decoy)hurt(s,tgt,t.damage*(s.map.threat||1)*(e.vet?1.2:1),e.x,e.y,'melee');event(s,'strike',{x:e.x,y:e.y});}
    else if(t.kamikaze){if(dist<95){e.detonated=true;explode(s,e.x,e.y,95,t.damage,true);e.hp=0;e.dead=true;e.deathAge=0;}}
    else if(e.type==='commander'&&e.phase>=2&&e.clip%3===2)lob(s,e,e.targetX,e.targetY);
    else if(t.lob)lob(s,e,e.targetX,e.targetY,{duration:.9,fuse:1.25,radius:130,damage:t.damage});
    else if(t.shell){const k=s.spotted>0?.6:1;for(const [dx,dy] of SHELLS)lob(s,e,e.targetX+dx*k,e.targetY+dy*k,{duration:1.1,fuse:1.6,radius:110,damage:t.damage,shell:true});event(s,'mortar',{x:e.x,y:e.y});}
    else if(mode==='mortar'){for(const [dx,dy] of [[0,0],[110,-60],[-100,70]])lob(s,e,e.targetX+dx,e.targetY+dy,{duration:1,fuse:1.55,radius:120,damage:42});}
    else if(mode==='stomp'){event(s,'explosion',{x:e.x,y:e.y,radius:130});event(s,'stomp',{x:e.x,y:e.y});for(const o of ops(s))if(!o.dead&&distance(e,o)<135&&hurt(s,o,38*(s.map.threat||1),e.x,e.y,'stomp'))move(s,o,Math.cos(aim)*40,Math.sin(aim)*40);}
    else{const a=t.turn?e.angle:t.locked?e.aim:leadAim(s,e,t,tgt);enemyFire(s,e,a);if(e.type==='commander'&&e.phase===3){enemyFire(s,e,a+.14);enemyFire(s,e,a-.14);}
      if(e.type==='mech'&&e.phase>=2&&e.clip%3===2){enemyFire(s,e,a+.25,{rocket:110,speed:560,damage:50});enemyFire(s,e,a-.25,{rocket:110,speed:560,damage:50});}
      const burst=(t.burst||1)+((t.burst||1)===1&&!t.locked&&!t.rocket&&!t.boss?diff(s).burst||0:0);if(burst>1){e.burst=burst-1;e.burstT=t.gap||.1;e.burstAim=a;}
      if(t.blink)e.blinkAt=.55;}
  }
  // Holdout maps have no authored perches: there the Wraith blinks between open spots sampled once from the grid.
  function perchesOf(s){if(s.map.perches?.length)return s.map.perches;if(!s.perches){const n=grid(s);s.perches=[];for(let cy=2;cy<n.h-2;cy+=3)for(let cx=2;cx<n.w-2;cx+=3){const x=cx*CELL+20,y=cy*CELL+20;if(clearAt(s,x,y,28))s.perches.push({x,y});}}return s.perches;}
  function blink(s,e){const p=lead(s),list=perchesOf(s).filter(q=>distance(q,p)>360&&distance(q,e)>200);if(list.length){const pick=list[Math.floor(rand(s)*list.length)];e.x=pick.x;e.y=pick.y;}e.cooldown=.5+rand(s)*.5;e.attack=0;e.seen=4;e.lastX=p.x;e.lastY=p.y;event(s,'blinkin',{x:e.x,y:e.y});}
  // A place to fight from: the far side of a low wall from the target ("hide", out of its sight) and a step past one
  // end of that wall where the target is in view ("peek"). It is kept until the target moves off, the wall goes down
  // or it turns out not to be reachable, and then looked for again (not every step: "cvAt"). At most two soldiers
  // share a wall. "holder" is whoever keeps the answer - the soldier itself, or an AI teammate's mind.
  function coverFor(s,e,tgt,range,holder=e){let c=holder.cv;
    if(c&&(s.time-c.at>7||distance(c,tgt)>150||s.walls[c.wi].dead||s.time-c.at>4&&distance(e,c.hide)>45&&distance(e,c.peek)>45))c=holder.cv=null;
    if(c)return c;if((holder.cvAt||0)>s.time)return null;holder.cvAt=s.time+1.1+rand(s)*.6;let best=null,bs=Infinity;
    s.walls.forEach((w,wi)=>{if(w.dead||!w.low||w.pass||w.kind==='underpass')return;const cx=w.x+w.w/2,cy=w.y+w.h/2,de=Math.hypot(cx-e.x,cy-e.y);if(de>340)return;const dt=Math.hypot(cx-tgt.x,cy-tgt.y);if(dt<150||dt>range*.92)return;
      if(holder===e&&s.enemies.reduce((n,o)=>n+(o!==e&&!o.dead&&o.cv&&o.cv.wi===wi?1:0),0)>=2)return;
      const ux=(cx-tgt.x)/dt,uy=(cy-tgt.y)/dt,depth=w.w/2*Math.abs(ux)+w.h/2*Math.abs(uy)+22,hide={x:cx+ux*depth,y:cy+uy*depth};
      if(!clearAt(s,hide.x,hide.y,18)||lineOfSight(s,tgt,hide))return;
      const px=-uy,py=ux,along=w.w/2*Math.abs(px)+w.h/2*Math.abs(py)+24,side=e.side||1;let peek=null;
      for(const k of [side,-side]){const q={x:hide.x+px*k*along,y:hide.y+py*k*along};if(clearAt(s,q.x,q.y,18)&&lineOfSight(s,q,tgt)){peek=q;break;}}
      if(!peek)return;const score=de+Math.abs(dt-range*.6)*.4;if(score<bs){bs=score;best={hide,peek,wi,x:tgt.x,y:tgt.y,at:s.time};}});
    return holder.cv=best;}
  // A flanker swings wide before it engages: it makes for a point well off to one side of where it met the target and
  // comes in from there, by a route of its own. It gives up after twelve seconds and fights from wherever it is.
  function flank(s,e,type,tgt,dt){if(e.fp===undefined){const a=Math.atan2(e.y-tgt.y,e.x-tgt.x)+e.flank*1.25;e.fa=a;e.flankAt=s.time;e.fp=null;}
    if(s.time-e.flankAt>12){endFlank(s,e);return false;}
    if(!e.fp||s.time-(e.fpAt||0)>3){e.fpAt=s.time;e.fp=null;for(const r of [340,280,420,220]){const q={x:tgt.x+Math.cos(e.fa)*r,y:tgt.y+Math.sin(e.fa)*r};if(q.x>60&&q.y>60&&q.x<s.map.width-60&&q.y<s.map.height-60&&clearAt(s,q.x,q.y,20)){e.fp=q;break;}}if(!e.fp){endFlank(s,e);return false;}}
    if(distance(e,e.fp)<90){endFlank(s,e);return false;}
    const m=s.ai[e.id]||(s.ai[e.id]={}),w=waypoint(s,e,m,e.fp);enemyMovement(s,e,w.x,w.y,type.speed*1.1,dt,true);return true;}
  function endFlank(s,e){e.flank=0;delete s.ai[e.id];}
  // The tank keeps to a firing distance: it closes while it cannot see its target or is too far off, backs away when
  // crowded and otherwise creeps from side to side. Its hull follows the way it drives (in reverse when backing off),
  // and low cover it is pressed against takes a beating.
  function tankMove(s,e,type,tgt,dist,canSee,dt){const ox=e.x,oy=e.y,aim=Math.atan2(tgt.y-e.y,tgt.x-e.x);
    if(!canSee||dist>type.range*.8)chase(s,e,type.speed,dt);
    else if(dist<260)enemyMovement(s,e,e.x-Math.cos(aim)*120,e.y-Math.sin(aim)*120,type.speed,dt,true);
    else enemyMovement(s,e,e.x-Math.sin(aim)*e.side*80,e.y+Math.cos(aim)*e.side*80,type.speed*.5,dt,true);
    if(s.time>(e.sideAt||0)){e.sideAt=s.time+3+rand(s)*3;e.side=-e.side;}
    const moved=Math.hypot(e.x-ox,e.y-oy);if(moved>.05){let want=Math.atan2(e.y-oy,e.x-ox);if(Math.abs(wrap(want-e.hull))>Math.PI/2)want+=Math.PI;e.hull=wrap(e.hull+clamp(wrap(want-e.hull),-2.2*dt,2.2*dt));}
    if(moved<type.speed*dt*.3)for(const b of s.walls)if(!b.dead&&Number.isFinite(b.hp)&&circleBox(e.x,e.y,e.radius+6,b))damageProp(s,b,160*dt);}
  // A medic tops up the hurt around it and brings back a soldier who fell in this wave: it walks to the body, works on
  // it for two seconds and stands it up at half health. Nobody comes back twice, and a second kill pays half. Under fire
  // up close it fights instead (returns false to say so).
  function medic(s,e,type,dist,dt){for(const o of s.enemies)if(!o.dead&&o!==e&&!A[o.type].machine&&o.hp<o.maxHp&&distance(o,e)<150)o.hp=Math.min(o.maxHp,o.hp+7*dt);
    if(dist<220){e.healing=0;return false;}
    let body=e.patient&&s.enemies.find(o=>o.id===e.patient);
    if(!body||!body.dead||body.vanished||body.deathAge>CORPSE.life-.5){body=null;e.patient=null;let bd=420;
      for(const o of s.enemies){const t=A[o.type];if(!o.dead||o.vanished||o.revived||o.deathAge>CORPSE.life-1||o.wave!==e.wave||t.machine||t.boss||t.medic||s.enemies.some(q=>q!==e&&q.patient===o.id))continue;const d=distance(o,e);if(d<bd){bd=d;body=o;}}
      if(body)e.patient=body.id;}
    if(!body){e.healing=0;return false;}
    if(distance(e,body)>34){enemyMovement(s,e,body.x,body.y,type.speed*1.1,dt,true);e.healing=0;return true;}
    e.healing=(e.healing||0)+dt;if(e.healing<2)return true;
    Object.assign(body,{dead:false,hp:body.maxHp*.5,revived:true,active:true,seen:3,stagger:.6,attack:0,burst:0,cooldown:1,deathAge:0});e.healing=0;e.patient=null;event(s,'enemyrevive',{id:body.id,x:body.x,y:body.y});return true;}
  // An engineer sets down a sentry gun a step towards its target (three at most on the field at once).
  function build(s,e){const a=Math.atan2(e.lastY-e.y,e.lastX-e.x),spot=[44,26].map(d=>({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d})).find(q=>clearAt(s,q.x,q.y,22));if(!spot)return;
    const t=makeEnemy(s,{id:e.id+'t',type:'turret',x:spot.x,y:spot.y,zone:0,angle:a,wave:e.wave,built:true});Object.assign(t,{active:true,spawned:true,seen:4,lastX:e.lastX,lastY:e.lastY,cooldown:1});s.enemies.push(t);e.built=true;event(s,'build',{x:spot.x,y:spot.y});}
  // Where a Warden's missile salvo will come down: on the target and round it. Chosen as the salvo is telegraphed.
  function salvo(s,tgt){const out=[{x:tgt.x,y:tgt.y}];for(let i=0;i<4;i++){const a=rand(s)*Math.PI*2,d=70+rand(s)*90;out.push({x:clamp(tgt.x+Math.cos(a)*d,60,s.map.width-60),y:clamp(tgt.y+Math.sin(a)*d,60,s.map.height-60)});}return out;}
  function stepEnemies(s,dt){const p=lead(s),D=diff(s),open=arena(s);s.squad.nade=Math.max(0,s.squad.nade-dt);s.squad.flash=Math.max(0,(s.squad.flash||0)-dt);s.spotted=Math.max(0,(s.spotted||0)-dt);
    // A live jammer that has joined the fight shuts down field support (see charge and callSupport).
    s.jammed=open&&!s.tdm&&s.enemies.some(e=>!e.dead&&e.active&&A[e.type]?.jams);
    for(const e of s.enemies){if(e.dead){e.deathAge=(e.deathAge||0)+dt;continue;}const type=A[e.type]||A.infantry;
      e.vx=0;e.vy=0;e.shotAge=(e.shotAge||0)+dt;e.cooldown-=dt;e.stagger=Math.max(0,e.stagger-dt);e.reload=Math.max(0,e.reload-dt);e.shieldDown=Math.max(0,(e.shieldDown||0)-dt);e.disabled=Math.max(0,(e.disabled||0)-dt);e.flashed=Math.max(0,(e.flashed||0)-dt);if(e.suppressed>0)e.suppressed=Math.max(0,e.suppressed-dt);
      if(e.shieldMax&&e.shieldHp<=0&&!(e.shieldDown>0)){e.shieldHp=e.shieldMax;event(s,'shieldup',{id:e.id,x:e.x,y:e.y});}
      if(e.gone>0){e.gone-=dt;if(e.gone<=0)blink(s,e);continue;}
      if(e.blinkAt>0){e.blinkAt-=dt;if(e.blinkAt<=0){e.gone=.9;e.burst=0;e.attack=0;event(s,'blink',{x:e.x,y:e.y});continue;}}
      // A soldier with a covered spot goes back behind it to reload instead of standing in the open.
      if(e.reload>0&&!(e.stagger>0)&&!(e.disabled>0)&&D.cover&&e.cv){enemyMovement(s,e,e.cv.hide.x,e.cv.hide.y,type.speed,dt,true);continue;}
      if(e.stagger>0||e.reload>0||e.disabled>0){if(e.stagger>0||e.disabled>0){e.burst=0;e.building=0;e.healing=0;}continue;}
      if(e.building>0){e.building-=dt;if(e.building<=0)build(s,e);continue;}
      const decoy=s.decoy&&distance(e,s.decoy)<720&&lineOfSight(s,e,s.decoy)&&distance(e,p)>150?s.decoy:null,tgt=decoy||s.mates.length&&nearestOp(s,e)||p;
      // Team deathmatch only: with the whole squad waiting to redeploy there is nobody to fight.
      if(tgt.dead&&s.tdm)continue;
      const dist=distance(tgt,e),canSee=dist<(type.sight||740)*(tgt===s.player&&s.perks.lowprofile?.75:1)&&sees(s,e,tgt),ok=eligible(s,e),hunter=e.hunt||D.hunt||e.rush;
      if(e.rush&&!tgt.dead&&tgt!==decoy){e.seen=Math.max(e.seen,1);e.lastX=tgt.x;e.lastY=tgt.y;}
      if(canSee&&ok){e.active=true;e.seen=4;e.lastX=tgt.x;e.lastY=tgt.y;}
      // Marked by a spotter: every hostile already in the fight knows where the target is, wall or no wall.
      else if(ok&&e.active&&s.spotted>0&&!tgt.dead&&tgt!==decoy){e.seen=Math.max(e.seen,1.5);e.lastX=tgt.x;e.lastY=tgt.y;}
      else e.seen=Math.max(0,e.seen-dt);
      if(!e.active||!ok)continue;
      if(type.spotter){e.marking=canSee&&dist<type.range&&!tgt.dead&&tgt!==decoy?tgt.id:null;if(e.marking){if(!(s.spotted>0))event(s,'marked',{who:tgt.id,x:tgt.x,y:tgt.y});s.spotted=Math.max(s.spotted,.6);}}
      if(type.medic&&medic(s,e,type,dist,dt))continue;
      if(type.builds&&canSee&&dist>200&&dist<type.range&&!e.built&&s.time>(e.buildAt??0)&&s.enemies.filter(o=>!o.dead&&o.type==='turret').length<3){e.building=2.2;e.buildAt=s.time+8;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type,mode:'build'});continue;}
      if(e.type==='commander'){const phase=e.hp<e.maxHp*.33?3:e.hp<e.maxHp*.66?2:1;if(phase>e.phase){e.phase=phase;e.stagger=.15;e.cooldown=0;if(phase===2)lob(s,e,e.lastX,e.lastY);event(s,'radio',{speaker:'HOSTILE COMMANDER',text:phase===2?'He’s alone. Flush him out.':'Cut off every exit. He does not leave this city.',duration:4});} }
      else if(type.boss){const phase=e.hp<e.maxHp*.33?3:e.hp<e.maxHp*.66?2:1;if(phase>e.phase){e.phase=phase;e.cooldown=Math.min(e.cooldown,.3);event(s,'bossphase',{id:e.id,phase});}}
      // A turret (a sentry gun, a vehicle's or the tank's) turns at its own pace; everyone else faces their aim at once.
      let aim=Math.atan2(e.lastY-e.y,e.lastX-e.x);if(type.turn){e.angle+=clamp(wrap(aim-e.angle),-type.turn*dt,type.turn*dt);}else e.angle=aim;
      if(e.burst>0){e.burstT-=dt;if(e.burstT<=0){e.burst--;e.burstT=type.gap||.08;const want=type.turn?e.angle:leadAim(s,e,type,tgt);e.burstAim+=clamp(wrap(want-e.burstAim),-3*(type.gap||.08),3*(type.gap||.08));enemyFire(s,e,e.burstAim);if(e.burst===0)finishAttack(s,e,type);}continue;}
      if(e.attack>0){e.attackAge+=dt;if(e.attackAge>=e.attack){release(s,e,type,tgt,dist,canSee,aim);e.attack=0;if(!(e.burst>0))finishAttack(s,e,type);}continue;}
      if(type.kamikaze){if(canSee&&dist<70&&e.cooldown<=0){e.attack=type.windup;e.attackAge=0;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type});continue;}chase(s,e,type.speed,dt);continue;}
      // A mortar team fires blind on a target a spotter has marked.
      const blind=type.shell&&s.spotted>0&&e.seen>0&&dist<type.range&&dist>(type.minRange||0);
      if(!blind&&(e.seen<=0||!canSee&&hunter&&e.seen<3.4&&(!e.cv||e.rush))){if(type.static)continue;if(type.cannon){tankMove(s,e,type,tgt,dist,false,dt);continue;}if(hunter)chase(s,e,type.speed*.85,dt);else enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);
        if(D.suppress&&e.seen>1.2&&!type.melee&&!type.lob&&!type.rocket&&!type.shell&&!type.spotter&&e.cooldown<=0&&distance(e,{x:e.lastX,y:e.lastY})<type.range){enemyFire(s,e,Math.atan2(e.lastY-e.y,e.lastX-e.x));e.cooldown=type.rate*D.rate*1.6;}
        continue;}
      e.angle=type.turn?e.angle:aim;
      if(D.camp&&type.cover&&!type.lob&&s.camp.t>D.camp&&s.squad.nade<=0&&e.seen>0&&dist>150&&dist<480&&tgt===p){s.squad.nade=D.nadeCd;s.camp.t=D.camp*.4;lob(s,e,p.x,p.y,{duration:.75,fuse:1.6});e.cooldown=Math.max(e.cooldown,.8);continue;}
      // Later holdout waves bring flashbangs: one thrower at a time, at an operator in plain view at mid range.
      if(D.flash&&type.cover&&!type.lob&&s.squad.flash<=0&&canSee&&dist>140&&dist<360&&!tgt.dead&&tgt!==decoy&&e.cooldown<=0&&rand(s)<dt*.8){s.squad.flash=D.flashCd;e.mode='flash';e.attack=.45;e.attackAge=0;e.targetX=tgt.x;e.targetY=tgt.y;event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type,mode:'flash'});continue;}
      const facing=!type.turn||Math.abs(wrap(aim-e.angle))<.3;
      if((canSee||blind)&&e.cooldown<=0&&facing&&!type.spotter&&!(type.minRange&&dist<type.minRange)){
        const mode=type.stomp&&dist<150?'stomp':type.mortar&&(e.clip%2===1||e.phase>=2&&e.clip%3!==0)?'mortar':e.type==='mech'&&open&&e.clip%4===3&&dist>200?'missiles':type.cannon&&e.clip%3===2?'cannon':null;
        if(dist<type.range||mode==='stomp'||mode==='mortar'){e.mode=mode;e.attack=(mode==='stomp'?.6:mode==='mortar'?1:mode==='missiles'?1.1:mode==='cannon'?1.15:type.windup)*D.windup*(e.suppressed>0?1.4:1);e.attackAge=0;e.aim=aim;e.targetX=tgt.x;e.targetY=tgt.y;if(mode==='missiles')e.salvo=salvo(s,tgt);event(s,'telegraph',{x:e.x,y:e.y,enemy:e.type,mode});continue;}}
      if(type.static)continue;
      if(type.cannon){tankMove(s,e,type,tgt,dist,canSee,dt);continue;}
      // The target is reloading: later waves close in on it instead of waiting.
      const pressing=D.push&&tgt.reload>0&&canSee&&dist<520;
      // A rusher who can see the target but has something in the way goes round it instead of running into it.
      if(type.melee){const speed=type.speed*(pressing?1.25:1);if(hunter&&!canSee||canSee&&tgt!==decoy&&(tgt===p||s.mates.length)&&!walkClear(s,e,tgt))chase(s,e,speed,dt);else enemyMovement(s,e,e.lastX,e.lastY,speed,dt);}
      else if(type.orbit){const r=type.spotter?380:300;enemyMovement(s,e,tgt.x-Math.cos(aim)*r-Math.sin(aim)*e.side*140,tgt.y-Math.sin(aim)*r+Math.cos(aim)*e.side*140,type.speed,dt);}
      else if(e.type==='shield'||type.push){if(dist>(type.push?110:270)||pressing&&dist>90)enemyMovement(s,e,e.lastX,e.lastY,type.speed*(pressing?1.2:1),dt);}
      else if(e.rush&&!canSee&&!type.blink)chase(s,e,type.speed,dt);
      else if(e.type==='sniper'||type.blink||type.standoff){if(dist<280)enemyMovement(s,e,e.x-Math.cos(aim)*150,e.y-Math.sin(aim)*150,type.speed,dt);else if(!canSee&&!blind)enemyMovement(s,e,e.lastX,e.lastY,type.speed*.6,dt);}
      else if(type.minRange&&dist<type.minRange+40){enemyMovement(s,e,e.x-Math.cos(aim)*120,e.y-Math.sin(aim)*120,type.speed,dt);}
      else{
        // A flanker still on its way round, and (from the second threat level) soldiers who fight from cover: out to
        // the peek spot to shoot, back behind the wall between shots and when hurt - but not while the target reloads.
        if(e.flank&&(!canSee||dist>type.range*.55)&&flank(s,e,type,tgt,dt))continue;
        if(D.cover&&type.cover&&!type.boss&&!e.rush){const c=coverFor(s,e,tgt,type.range);if(c){const hide=!pressing&&(e.cooldown>.5||e.suppressed>0||e.hp<e.maxHp*.45&&e.cooldown>.15),to=hide?c.hide:c.peek;if(distance(e,to)>8)enemyMovement(s,e,to.x,to.y,type.speed*(hide?1.1:.95),dt,true);continue;}}
        const cover=s.walls.filter(b=>!b.dead&&b.low&&distance(e,{x:b.x+b.w/2,y:b.y+b.h/2})<250).sort((a,b)=>distance(e,{x:a.x,y:a.y})-distance(e,{x:b.x,y:b.y}))[0];
        if(e.hp<e.maxHp*.4&&cover&&!type.boss){const tx=cover.x+cover.w/2-Math.cos(aim)*65,ty=cover.y+cover.h/2-Math.sin(aim)*65;enemyMovement(s,e,tx,ty,type.speed,dt);}
        else if(!canSee||dist>type.range*.85||pressing){const close=pressing?120:260,tx=e.lastX-Math.cos(aim)*close-Math.sin(aim)*e.side*130,ty=e.lastY-Math.sin(aim)*close+Math.cos(aim)*e.side*130;
          // In holdout a rifleman whose way to a firing position is blocked paths round it too. The campaign keeps its
          // old behaviour here: its reinforcements getting stuck less often measurably raised the difficulty.
          if(hunter&&(!canSee||tgt!==decoy&&(tgt===p||s.mates.length)&&arena(s)&&!walkClear(s,e,{x:tx,y:ty})))chase(s,e,type.speed,dt);else enemyMovement(s,e,tx,ty,type.speed,dt);}
        else if(e.cooldown>.4)enemyMovement(s,e,e.x-Math.sin(aim)*e.side*45,e.y+Math.cos(aim)*e.side*45,type.speed*.6,dt);
      }
    }}
  // ---------- field support ----------
  // Score fills the meter: Rook's own bounties, flows, objectives and cleared waves. It fills fastest in team
  // deathmatch, where a match is short, and slowest in the campaign, where a boss should stay a boss.
  function charge(s,points){const q=s.support;if(!q||q.ready||s.training||s.jammed)return;const kind=stageDef(s).kind,rate=(kind==='tdm'?1.6:kind==='endless'?1:.6)*(s.perks.hardline?1.25:1);
    q.charge=Math.min(q.cost,q.charge+points*rate);if(q.charge>=q.cost){q.ready=true;event(s,'supportready',{key:q.key});}}
  // What a kill by Rook himself earns beyond its bounty: score towards the meter (but not for kills the support
  // itself made, or it would pay for its own next call), and whatever his perks give.
  const NO_SCORE=['sentry','k9','strike','gunship','blackout'];
  // Gadget kills: what each perk makes of a kill with a thrown or planted gadget rather than a gun.
  const GADGET_KILLS=['grenade','cluster','mine','c4','seeker','incendiary','tknife'];
  function credit(s,source,t){const p=s.player,gadget=GADGET_KILLS.includes(source);
    // Hardline: a gadget kill counts double towards field support.
    if(!NO_SCORE.includes(source))charge(s,(t.bounty||15)*(gadget&&s.perks.hardline?2:1));
    // Scrounger: every third gadget kill puts a lethal charge back.
    if(gadget&&s.perks.scrounger&&p.lethal&&(s.scrounged=(s.scrounged||0)+1)%3===0)p.grenades=Math.min(G[p.lethal].count+s.mods.charges+2,p.grenades+1);
    // Flow State: a kill while the flow boost is up keeps it going a second longer (never more than six seconds ahead).
    if(s.perks.flowstate&&s.time<s.flowBoost)s.flowBoost=Math.min(s.time+6,s.flowBoost+1);
    if(s.perks.scrounger&&W[source])p.reserve[source]=Math.min(reserveOf(s,source),p.reserve[source]+Math.ceil(W[source].capacity/4));
    if(s.perks.executioner&&source==='melee'&&!p.dead)p.health=Math.min(100,p.health+20);}
  // Calls in whatever Rook is carrying. The sentry and the hound are "allies": they act by themselves in stepAllies
  // until their time runs out, and hostiles pay them no attention. The airstrike is six heavy shells already on the
  // ground along the line of aim, starting at the aim point and walking away from Rook; their rings give a second's warning.
  function callSupport(s,input={}){const q=s.support,p=s.player;if(!q||!q.ready||p.dead||['vault','roll','dive'].includes(p.state))return false;
    if(s.jammed){event(s,'deny');event(s,'toast',{text:'SIGNAL JAMMED / TAKE OUT THE JAMMER'});return false;}
    if(q.key==='recon')s.recon=20;
    else if(q.key==='turret'){const at=[72,46].map(d=>({x:p.x+Math.cos(p.angle)*d,y:p.y+Math.sin(p.angle)*d})).find(o=>clearAt(s,o.x,o.y,22))||{x:p.x,y:p.y};
      s.allies.push({id:'ally'+s.tick,kind:'turret',x:at.x,y:at.y,angle:p.angle,life:30,total:30,cooldown:.5,vx:0,vy:0,shotAge:10});}
    else if(q.key==='dog')s.allies.push({id:'ally'+s.tick,kind:'dog',x:p.x,y:p.y,angle:p.angle,life:25,total:25,cooldown:0,vx:0,vy:0,radius:12,moveTime:0,biteAge:10});
    else if(q.key==='airstrike'){const d=clamp(Math.hypot((input.aimX??p.x+300)-p.x,(input.aimY??p.y)-p.y),210,560),a=p.angle;
      for(let i=0;i<6;i++){const x=clamp(p.x+Math.cos(a)*(d+i*92),60,s.map.width-60),y=clamp(p.y+Math.sin(a)*(d+i*92),60,s.map.height-60);
        s.grenades.push({kind:'frag',x,y,sx:x,sy:y,tx:x,ty:y,age:.06,duration:.05,fuse:1.25+i*.17,enemy:false,radius:150,damage:170,strike:true});}}
    // A supply drop lands round Rook's feet. Reinforcement is a rifleman who stays at his side; the gunship circles him
    // and fires down over the walls. Blackout is an EMP across the whole map: drones fall, machines and barriers go
    // dark, and every soldier is blinded for five seconds (a boss for one).
    if(q.key==='supply')[['health',-46,0],['armor',46,0],['ammo',0,-46],['ammo',0,46],['lethal',-40,-40],['tactical',40,-40]].forEach(([type,dx,dy],i)=>s.pickups.push({id:'sup'+s.tick+'_'+i,x:p.x+dx,y:p.y+dy,type,taken:false}));
    else if(q.key==='reinforce')s.allies.push({id:'ally'+s.tick,kind:'gunner',x:p.x,y:p.y,angle:p.angle,life:45,total:45,cooldown:.5,vx:0,vy:0,radius:15,moveTime:0,shotAge:10});
    else if(q.key==='gunship')s.allies.push({id:'ally'+s.tick,kind:'gunship',x:p.x,y:p.y-240,angle:0,life:20,total:20,cooldown:.7,vx:0,vy:0,orbit:-Math.PI/2,shotAge:10});
    else if(q.key==='blackout'){for(const h of s.hazards)h.off=9;if(s.tdm)for(const a of s.allies)if(s.enemies.some(o=>o.id===a.owner))a.life=0;for(const e of s.enemies){if(e.dead||e.gone>0)continue;const t=A[e.type];
      if(t.flying&&t.machine){e.detonated=true;damageEnemy(s,e,999,0,.1,'blackout',true,true);}
      else if(t.machine){e.disabled=Math.max(e.disabled||0,t.boss?4:9);e.shieldDown=Math.max(e.shieldDown||0,8);e.attack=0;e.burst=0;}
      else{const time=t.boss?1.2:5;e.stagger=Math.max(e.stagger,time);e.flashed=time;e.attack=0;e.burst=0;e.shieldDown=Math.max(e.shieldDown||0,5);}}}
    q.ready=false;q.charge=0;q.uses++;event(s,'support',{key:q.key,x:p.x,y:p.y,angle:p.angle});return true;}
  // Everything Rook has put in the field that acts for itself, until its time runs out: the sentry, the hound, a
  // reinforcement and the gunship from field support, and the seeker and trophy system from his gadgets.
  function allyShot(s,a,damage){const b=s.projectiles.find(q=>!q.active);if(!b)return;const ang=a.angle+(rand(s)-.5)*.07,mx=a.x+Math.cos(a.angle)*30,my=a.y+Math.sin(a.angle)*30;
    Object.assign(b,{active:true,x:mx,y:my,px:mx,py:my,vx:Math.cos(ang)*1500,vy:Math.sin(ang)*1500,remaining:620,damage,enemy:false,owner:s.player.id,weapon:'sentry',pierce:0,explosive:0,stagger:.08,breach:false,hitIds:[],whiz:false,bounce:0,chain:0,flame:false,knife:false});
    a.shotAge=0;event(s,'shot',{x:mx,y:my,angle:ang,weapon:'smg',enemy:false,ally:true});}
  function allyMove(s,a,to,speed,dt){const m=s.ai[a.id]||(s.ai[a.id]={}),w=waypoint(s,a,m,to),dx=w.x-a.x,dy=w.y-a.y,l=Math.hypot(dx,dy)||1,ox=a.x,oy=a.y;move(s,a,dx/l*speed*dt,dy/l*speed*dt);
    a.vx=(a.x-ox)/dt;a.vy=(a.y-oy)/dt;a.moveTime+=Math.hypot(a.vx,a.vy)*dt/60;if(Math.hypot(a.vx,a.vy)>20)a.angle=Math.atan2(a.vy,a.vx);}
  function stepAllies(s,dt,only){if(s.recon>0)s.recon=Math.max(0,s.recon-dt);if(!s.allies.length)return;const p=s.player,hostile=q=>q.enemy||!!s.tdm&&s.enemies.some(o=>o.id===q.owner);
    for(const a of s.allies){if(only&&a.owner!==only)continue;a.life-=dt;a.cooldown=Math.max(0,a.cooldown-dt);a.shotAge=(a.shotAge||0)+dt;const k=a.kind,nose=k==='dog'||k==='seeker';let foe=null,bd=Infinity;
      // The sentry and the rifleman need a line of sight; the hound and the seeker follow their noses; the gunship sees over walls.
      if(k!=='trophy')for(const e of s.enemies){if(e.dead||e.gone>0)continue;const d=distance(a,e);if(d<bd&&(nose?d<900:k==='gunship'?distance(p,e)<680:d<560&&sees(s,a,e))){bd=d;foe=e;}}
      if(k==='turret'||k==='gunner'){a.vx=0;a.vy=0;
        if(foe){const want=Math.atan2(foe.y-a.y,foe.x-a.x);a.angle+=clamp(wrap(want-a.angle),-5.5*dt,5.5*dt);if(a.cooldown<=0&&Math.abs(wrap(want-a.angle))<.12){a.cooldown=k==='turret'?.14:.17;allyShot(s,a,k==='turret'?15:16);}}
        else if(k==='gunner'&&distance(a,p)>110)allyMove(s,a,p,265,dt);}
      else if(k==='gunship'){a.orbit+=dt*.85;const ox=a.x,oy=a.y;a.x=clamp(p.x+Math.cos(a.orbit)*240,20,s.map.width-20);a.y=clamp(p.y+Math.sin(a.orbit)*240,20,s.map.height-20);a.vx=(a.x-ox)/dt;a.vy=(a.y-oy)/dt;
        if(foe){a.angle=Math.atan2(foe.y-a.y,foe.x-a.x);if(a.cooldown<=0){a.cooldown=.11;a.shotAge=0;event(s,'strafe',{x:a.x,y:a.y,x2:foe.x,y2:foe.y});damageEnemy(s,foe,s.tdm?7:13,a.angle,.05,'gunship');}}
        else a.angle=a.orbit+Math.PI/2;}
      else if(k==='trophy'){for(const g of s.grenades)if(hostile(g)&&!g.exploded&&distance(g,a)<250){g.exploded=true;event(s,'intercept',{x:g.x,y:g.y,x2:a.x,y2:a.y});}
        for(const b of s.projectiles)if(b.active&&hostile(b)&&b.explosive&&distance(b,a)<230){b.active=false;event(s,'intercept',{x:b.x,y:b.y,x2:a.x,y2:a.y});}}
      else{a.biteAge=(a.biteAge||0)+dt;const to=foe||p,d=distance(a,to);a.vx=0;a.vy=0;
        if(foe&&d<32+foe.radius){if(k==='seeker'){explode(s,a.x,a.y,125,135,false,'seeker');a.life=0;a.spent=true;}
          else{a.angle=Math.atan2(foe.y-a.y,foe.x-a.x);if(a.cooldown<=0){a.cooldown=.55;a.biteAge=0;damageEnemy(s,foe,55,a.angle,.5,'k9',true);event(s,'bite',{x:foe.x,y:foe.y});}}}
        else if(foe||d>95)allyMove(s,a,to,k==='seeker'?300:330,dt);}}
    for(const a of s.allies)if(a.life<=0&&(!only||a.owner===only)){delete s.ai[a.id];if(!a.spent)event(s,'allygone',{kind:a.kind,x:a.x,y:a.y});}
    s.allies=s.allies.filter(a=>a.life>0);}
  // ---------- AI teammates ----------
  // A bot is a squadmate whose controls are worked from here instead of by a person: botInput returns what a player's
  // keyboard and mouse would have sent, so everything a bot does goes through stepMate like anyone else's. It is meant
  // to read as a decent player rather than a turret. It takes a moment to pick up a new target, its aim wanders and
  // turns at a human rate, it fires in bursts, and its rounds do less than a person's (BOT.dmg).
  // What it is thinking (target, route, timers) lives in s.ai, away from the operator the other players are sent.
  // kit: the frags and flashbangs a holdout teammate carries into each wave; support: the bounty its own kills have to
  // add up to before it can set down a sentry of its own.
  const BOT={dmg:.5,sight:760,react:[.3,.65],turn:7.5,think:6,kit:{frag:1,flash:1},support:450},botDmg=s=>s.tdm?skill(s).dmg:BOT.dmg;
  // Holdout's squad orders (the order key cycles them): how far from its anchor a teammate will range - Rook, or the
  // spot it was told to hold. "auto" is its own game; "follow" keeps it at his shoulder.
  const ORDERS=['auto','follow','hold'],LEASH={auto:650,follow:240,hold:220};
  // Hostiles a teammate deals with first, wherever they stand: they make everyone else more dangerous.
  const PRIORITY=['rocketeer','sniper','medic','spotter','bomber','mortar','jammer','engineer','grenadier'];
  function orderSquad(s){if(s.tdm||!s.mates.some(m=>m.bot))return;s.order=ORDERS[(ORDERS.indexOf(s.order)+1)%ORDERS.length];s.orderAt=s.order==='hold'?{x:s.player.x,y:s.player.y}:null;event(s,'order',{order:s.order,x:s.player.x,y:s.player.y});}
  // A teammate's call over the radio, at most once every few seconds for each kind.
  function callout(s,op,m,key,text,every=8){m.calls=m.calls||{};if(s.time<(m.calls[key]??-99))return;m.calls[key]=s.time+every;event(s,'callout',{who:op.id,key,text});}
  // The next step of the walk from an operator to a point: straight there when nothing is in the way, otherwise down a
  // distance field of its own (kept per bot, refreshed when the destination moves to another cell).
  function waypoint(s,op,m,to){if(distance(op,to)<60||walkClear(s,op,to))return to;const n=grid(s),cell=cellOf(n,to);let r=m.route;
    if(!r||r.sig!==n.sig)r=m.route={sig:n.sig,dist:new Int16Array(n.w*n.h),cell:-1,at:-9};
    if(r.cell!==cell||s.time-r.at>2){r.cell=cell;r.at=s.time;flood(n,r.dist,[cell]);}
    const cx=clamp(Math.floor(op.x/CELL),0,n.w-1),cy=clamp(Math.floor(op.y/CELL),0,n.h-1),here=r.dist[cy*n.w+cx];let best=null,bd=here<0?32767:here;
    for(const [dx,dy] of DIRS){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=n.w||y>=n.h)continue;const d=r.dist[y*n.w+x];if(d<0||d>=bd)continue;if(dx&&dy&&(n.blocked[cy*n.w+x]||n.blocked[y*n.w+cx]))continue;bd=d;best={x:x*CELL+20,y:y*CELL+20};}
    return best||to;}
  // Where a bot wants to be. In order: out from under a grenade, on revive duty, then its own game in holdout
  // (mateGoal), or in team deathmatch positioned against whoever it is fighting or closing on the nearest hostile.
  function botGoal(s,op,m,i,foe){const T=s.tdm,off=(a,d)=>({x:op.x+Math.cos(a)*d,y:op.y+Math.sin(a)*d,direct:true});
    for(const g of s.grenades)if((g.enemy||s.tdm&&s.enemies.some(o=>o.id===g.owner))&&Math.hypot(op.x-g.tx,op.y-g.ty)<(g.radius||155)+30)return {...off(Math.atan2(op.y-g.ty,op.x-g.tx),170),run:true};
    if(!T&&s.station){const t=s.tags.find(q=>q.owner!==op.id&&(!q.carrier||q.carrier===op.id));if(t)return t.carrier?{x:s.station.x,y:s.station.y,run:true,revive:true,near:22}:{x:t.x,y:t.y,run:true,near:0};}
    if(!T)return mateGoal(s,op,m,i,foe);
    // Under fire, an AI operator in team deathmatch works a peek spot by a low wall, as a holdout teammate does.
    if(foe){const gun=W[op.slots[op.slot]],d=distance(op,foe),pressed=s.time-(m.hurtAt??-99)<3||m.count>=2;
      if(pressed&&d>160){const c=coverFor(s,op,foe,clamp(d*1.3,260,gun.range),m);if(c&&distance(op,c.hide)<260){if(s.time>(m.cvT??0)){m.cvHide=!m.cvHide;m.cvT=s.time+(m.cvHide?.6+rand(s)*.5:1.4+rand(s)*.8);}const q=op.reload>0||op.heal>0||m.cvHide?c.hide:c.peek;return {x:q.x,y:q.y,near:8};}}
      return engage(s,op,m,foe);}
    // Lost sight of them a moment ago: go and look where they were.
    if(m.last&&(s.time-m.last.at>5||distance(op,m.last)<=60))m.last=null;
    if(m.last)return {x:m.last.x,y:m.last.y,near:50};
    // Otherwise only what it can hear: gunfire in the last two seconds within earshot. With nothing heard it patrols the
    // map's points, a new one when it gets there or tires of the walk - it does not simply know where everyone is.
    let near=null,nd=Infinity;for(const e of s.enemies){if(e.dead||e.gone>0||!((e.shotAge??9)<TDM.hear.time))continue;const d=distance(op,e);if(d<nd&&d<TDM.hear.range){nd=d;near=e;}}
    if(near)return {x:near.x,y:near.y,run:nd>520,near:30};
    if(!m.patrol||distance(op,m.patrol)<70||s.time>(m.patrolUntil??0)){const pts=T.points.length?T.points:T.bases;m.patrol=pts[Math.floor(rand(s)*pts.length)];m.patrolUntil=s.time+12+rand(s)*6;}
    return {x:m.patrol.x,y:m.patrol.y,near:60};}
  // In the open against one target: back off when too close (or from anything that wants to get close), close in when
  // too far, and in range sidestep - but only to ground it can stand on and still see the target from.
  function engage(s,op,m,foe){const off=(a,d)=>({x:op.x+Math.cos(a)*d,y:op.y+Math.sin(a)*d,direct:true}),d=distance(op,foe),gun=W[op.slots[op.slot]],lo=clamp(gun.range*.3,130,250),hi=clamp(gun.range*.55,230,470),a=Math.atan2(foe.y-op.y,foe.x-op.x);
    if(s.time>m.turnAt){m.turnAt=s.time+.9+rand(s)*1.1;m.side=-m.side;}
    if(op.health<35||d<lo||A[foe.type].melee&&d<230||A[foe.type].kamikaze&&d<200)return {...off(a+Math.PI+m.side*.5,150),run:A[foe.type].kamikaze};
    if(d>hi)return {x:foe.x,y:foe.y,near:hi*.9};
    const step=k=>{const q=off(a+k*Math.PI/2,90);return clearAt(s,q.x,q.y,17)&&lineOfSight(s,q,foe)?q:null;};return step(m.side)||step(-m.side);}
  // A holdout teammate plays its own game inside its leash (the squad order): it fights whatever it can see; under
  // fire it works a peek spot by a low wall (out to shoot, back in between bursts and to reload); hurt, it breaks
  // contact behind cover to heal; with nothing in view it goes after hostiles already in the fight - those closing on
  // Rook first; and with nothing left to fight it keeps a post off his back, watching the way he is not.
  function mateGoal(s,op,m,i,foe){const boss=s.player,order=s.order||'auto',L=op===boss?Infinity:LEASH[order]||LEASH.auto,anchor=order==='hold'&&s.orderAt?s.orderAt:boss.dead?op:boss,gun=W[op.slots[op.slot]];
    if(distance(op,anchor)>L)return {x:anchor.x,y:anchor.y,run:true,near:L*.5};
    if(foe){const d=distance(op,foe),a=Math.atan2(foe.y-op.y,foe.x-op.x),pressed=s.time-(m.hurtAt??-99)<4||m.count>=2||op.health<70;
      if(op.health<45){callout(s,op,m,'hurt','I’M HIT / FALLING BACK',12);const c=coverFor(s,op,foe,gun.range,m);if(c)return {x:c.hide.x,y:c.hide.y,run:true,near:10};
        return {x:op.x+Math.cos(a+Math.PI+m.side*.4)*170,y:op.y+Math.sin(a+Math.PI+m.side*.4)*170,direct:true,run:true};}
      // Cover is looked for at about the distance it is already fighting from, not a long fall back.
      if(pressed&&!A[foe.type].melee&&!A[foe.type].kamikaze&&d>150){const c=coverFor(s,op,foe,clamp(d*1.3,260,gun.range),m);
        if(c&&distance(op,c.hide)<320){if(s.time>(m.cvT??0)){m.cvHide=!m.cvHide;m.cvT=s.time+(m.cvHide?.6+rand(s)*.5:1.5+rand(s)*.8);}const q=op.reload>0||op.heal>0||m.cvHide?c.hide:c.peek;return {x:q.x,y:q.y,near:8};}}
      return engage(s,op,m,foe);}
    m.cvHide=false;
    if(m.last&&(s.time-m.last.at>5||distance(op,m.last)<=60))m.last=null;
    if(m.last&&distance(m.last,anchor)<L)return {x:m.last.x,y:m.last.y,near:50};
    if(order==='auto'&&!boss.dead){let prey=null,pd=Infinity;for(const e of s.enemies){if(e.dead||e.gone>0||!e.active||A[e.type].cloak&&!(e.attack>0)||distance(e,anchor)>L+150)continue;
        const dd=distance(op,e)*(distance(e,boss)<300?.5:1)*(PRIORITY.includes(e.type)?.8:1);if(dd<pd){pd=dd;prey=e;}}
      // It stops at fighting range only once it can see its prey; until then it keeps closing.
      if(prey)return {x:prey.x,y:prey.y,near:sees(s,op,prey)?clamp(gun.range*.45,200,420):40};}
    if(order==='hold'&&s.orderAt)return distance(op,s.orderAt)>60?{x:s.orderAt.x,y:s.orderAt.y,near:30,run:distance(op,s.orderAt)>300}:null;
    const busy=s.enemies.some(e=>!e.dead)||s.spawnWarnings.length>0,a=boss.angle+Math.PI+(i%2?-.7:.7)*(1+(i>>1)*.5),r=busy&&order==='auto'?150:95,post={x:boss.x+Math.cos(a)*r,y:boss.y+Math.sin(a)*r},d=distance(op,boss);
    return d>r+75?{x:clearAt(s,post.x,post.y,17)?post.x:boss.x,y:clearAt(s,post.x,post.y,17)?post.y:boss.y,run:d>360,near:40}:null;}
  // The slower half of a bot's mind, run a few times a second: who it can see, which of them matters most, and where it
  // is heading. In holdout whatever is going for Rook, the dangerous few (PRIORITY) and the nearly dead come first.
  function botThink(s,op,m,i){let foe=null,best=Infinity,count=0;const rook=s.player,mate=!s.tdm&&op!==rook;
    if(op.health<(m.hp??op.health))m.hurtAt=s.time;m.hp=op.health;
    for(const e of s.enemies){if(e.dead||e.gone>0)continue;const d=distance(op,e);if(d>BOT.sight*(e.ctx&&e.ctx.perks.lowprofile?.75:1)||A[e.type].cloak&&d>170&&!(e.attack>0)&&!(s.recon>0)||!sees(s,op,e))continue;count++;
      let score=d*(e===m.foe?.75:1);if(mate){if(!rook.dead&&distance(e,rook)<260)score*=.55;if(PRIORITY.includes(e.type))score*=.7;if(e.hp<e.maxHp*.35)score*=.8;}if(score<best){best=score;foe=e;}}
    m.count=count;
    if(foe!==m.foe){m.foe=foe;if(foe){m.react=(BOT.react[0]+rand(s)*(BOT.react[1]-BOT.react[0]))*(s.tdm?skill(s).react:1);m.burst=Math.max(m.burst,.4);
      if(mate&&!rook.dead){const behind=Math.abs(wrap(Math.atan2(foe.y-rook.y,foe.x-rook.x)-rook.angle))>2.2&&distance(foe,rook)<550;
        if(behind)callout(s,op,m,'six','CONTACT BEHIND YOU / '+A[foe.type].name);else if(PRIORITY.includes(foe.type)||A[foe.type].boss)callout(s,op,m,'p:'+foe.type,A[foe.type].name+' SPOTTED / ENGAGING',20);}}}
    if(foe)m.last={x:foe.x,y:foe.y,at:s.time};
    m.goal=botGoal(s,op,m,i,foe);m.way=m.goal?m.goal.direct?m.goal:waypoint(s,op,m,m.goal):null;}
  function botInput(s,op,i,dt){const m=s.ai[op.id]||(s.ai[op.id]={foe:null,react:0,aim:op.angle,sway:rand(s)*6,burst:0,rest:0,side:rand(s)>.5?1:-1,turnAt:0,swing:0,goal:null,way:null,route:null,fresh:false});
    if(!m.fresh||(s.tick+i*2)%BOT.think===0){m.fresh=true;botThink(s,op,m,i);}
    const key=op.slots[op.slot],gun=W[key],foe=m.foe&&!m.foe.dead&&!(m.foe.gone>0)?m.foe:null,d=foe?distance(op,foe):Infinity,mate=!s.tdm&&op!==s.player;m.react=Math.max(0,m.react-dt);m.sway+=dt;m.swing=Math.max(0,m.swing-dt);
    // Aim: lead the target by the bullet's flight time, wander a little, and turn no faster than a hand would. With no
    // target a holdout teammate watches the nearest way in, or the side Rook has his back to.
    const idle=()=>{const w=s.spawnWarnings.reduce((b,q)=>!b||distance(op,q)<distance(op,b)?q:b,null);return w?Math.atan2(w.y-op.y,w.x-op.x):s.player.angle+Math.PI;};
    const tt=foe?d/gun.speed:0,want=foe?Math.atan2(foe.y+foe.vy*tt-op.y,foe.x+foe.vx*tt-op.x):Math.hypot(op.vx,op.vy)>60?Math.atan2(op.vy,op.vx):mate&&!s.player.dead?idle():m.aim,held=want+(foe?Math.sin(m.sway*2.3)*.045+Math.sin(m.sway*5.1)*.025:0);
    m.aim+=clamp(wrap(held-m.aim),-BOT.turn*dt,BOT.turn*dt);
    const input={mx:0,my:0,aimX:op.x+Math.cos(m.aim)*260,aimY:op.y+Math.sin(m.aim)*260};
    m.burst-=dt;if(m.burst<-m.rest){m.burst=.35+rand(s)*.5;m.rest=.2+rand(s)*.45;}
    input.fire=!!foe&&d<gun.range*.92&&m.react<=0&&(gun.rate>.2||m.burst>0)&&Math.abs(wrap(held-m.aim))<.1;
    if(foe&&d<64&&m.swing<=0&&op.state!=='melee'){input.melee=true;input.fire=false;m.swing=.55;}
    if(!op.reload&&(op.ammo[key]===0||!foe&&op.ammo[key]<gun.capacity*.5))input.reload=true;
    // An AI operator in team deathmatch has the whole kit: it takes a stim when hurt and out of contact, and (above
    // the easiest skill) throws its lethal at a target standing at grenade range, a few seconds apart.
    if(s.tdm){if(op.health<55&&op.stims>0&&!(op.heal>0)&&(!foe||d>260))input.gadget=true;
      if(foe&&op.lethal&&op.grenades>0&&d>190&&d<380&&skill(s).react<1.5&&s.time>(m.nadeAt??5)){m.nadeAt=s.time+7+rand(s)*7;input.grenade=true;input.fire=false;input.aimX=foe.x;input.aimY=foe.y;}}
    // A holdout teammate's kit: a stim once it has a moment (out of contact or tucked behind cover); a frag into a
    // pack, or behind the wall a hostile just ducked behind; a flashbang when they are on top of it; and a sentry of its
    // own once its kills have earned one. Never a grenade anywhere near Rook, or near itself.
    else if(mate){const tucked=m.cv&&distance(op,m.cv.hide)<30;
      if(op.health<50&&op.stims>0&&!(op.heal>0)&&(!foe||d>260||tucked)){input.gadget=true;input.fire=false;}
      const at=foe||(m.last&&s.time-m.last.at<3?m.last:null),rook=s.player;
      if(at&&op.grenades>0&&s.time>(m.nadeAt??2)){const dd=distance(op,at),pack=s.enemies.filter(e=>!e.dead&&!(e.gone>0)&&distance(e,at)<130).length;
        if(dd>190&&dd<380&&(rook.dead||distance(rook,at)>230)&&(pack>=2||!foe)){m.nadeAt=s.time+8+rand(s)*5;input.grenade=true;input.fire=false;input.aimX=at.x;input.aimY=at.y;callout(s,op,m,'frag','FRAG OUT',4);}}
      if(foe&&op.tacticals>0&&s.time>(m.flashAt??3)&&d<320&&!input.grenade){const near=s.enemies.filter(e=>!e.dead&&!A[e.type].machine&&distance(e,op)<260).length;
        if((near>=2||A[foe.type].melee&&d<220)&&(rook.dead||distance(rook,foe)>330)){m.flashAt=s.time+12+rand(s)*5;input.tactical=true;input.aimX=foe.x;input.aimY=foe.y;callout(s,op,m,'flash','FLASHBANG OUT',4);}}
      if(foe&&(m.support||0)>=BOT.support){m.support=0;input.support=true;callout(s,op,m,'sentry','SENTRY DOWN / COVERING THIS LANE',2);}}
    const g=m.goal,w=m.way;if(g&&w){const far=distance(op,g);if(far>(g.near??16)){const dx=w.x-op.x,dy=w.y-op.y,l=Math.hypot(dx,dy);if(l>8){input.mx=dx/l;input.my=dy/l;}else m.fresh=false;input.sprint=!!g.run&&!input.fire&&far>150;}
      if(g.revive&&distance(op,s.station)<56)input.interactDown=true;}
    // A holdout teammate that sees a shot about to land on it rolls out of the line of fire, now and then.
    if(mate&&op.stamina>=30&&s.time>(m.rollAt??0)&&!input.grenade&&!input.tactical){const threat=s.enemies.find(e=>!e.dead&&e.attack>0&&e.attackAge>e.attack*.55&&!A[e.type].melee&&!A[e.type].kamikaze&&nearestOp(s,e)===op&&distance(e,op)<(A[e.type].range||500)&&lineOfSight(s,e,op));
      if(threat){const a=Math.atan2(op.y-threat.y,op.x-threat.x)+Math.PI/2*m.side;input.roll=true;input.sprint=false;input.mx=Math.cos(a);input.my=Math.sin(a);input.fire=false;m.rollAt=s.time+2.5+rand(s)*1.5;}}
    return input;}
  function warnSpawn(s,entries,quiet=false){const pts=s.map.spawnPoints||[],near=lead(s);for(const e of entries){let pos=e;if(distance(near,e)<340){pos=pts.find(a=>distance(near,a)>=340&&clearAt(s,a.x,a.y,25));}if(!pos)continue;const warning={...e,x:pos.x,y:pos.y,delay:2.3};s.spawnWarnings.push(warning);event(s,'spawnwarning',{x:warning.x,y:warning.y});}if(!quiet)event(s,'toast',{text:'HOSTILE REINFORCEMENTS / WATCH THE APPROACHES'});}
  function entriesFor(s,entries,st){const D=diff(s),pts=s.map.spawnPoints||[],out=[];
    entries.forEach((e,i)=>{if(e.min&&!atLeast(s,e.min))return;const type=s.difficulty==='story'&&e.story?e.story:e.type,p=e.at!==undefined?pts[e.at%pts.length]:e;if(!p)return;out.push({id:e.id||'s'+s.tick+'_'+i,type,x:p.x,y:p.y,zone:st.zone});
      if(D.waveExtra&&!A[type].boss&&pts.length&&rand(s)<D.waveExtra){const q=pts[Math.floor(rand(s)*pts.length)];out.push({id:'s'+s.tick+'_'+i+'x',type,x:q.x,y:q.y,zone:st.zone});}});
    return out;}
  function runWaves(s,st,d){const list=st.waves||[];const w=list[d.wave];if(!w||w.hp!==undefined)return;if(d.clock<(w.after||0))return;if(d.wave>0&&st.kind==='hold'&&d.rest>0)return;if(w.max!==undefined&&s.enemies.filter(e=>!e.dead).length>=w.max)return;
    d.wave++;warnSpawn(s,entriesFor(s,w.entries,st));if(w.med&&diff(s).med&&s.player.health<50)s.pickups.push({id:'director-med'+d.wave,x:w.med.x,y:w.med.y,type:'health',taken:false});if(w.radio)event(s,'radio',{...w.radio});}
  // ---------- holdout ----------
  // The roster: [type, cost, first wave, weight]. A type's first wave is its "new threat" wave: it is announced and
  // at least one is in it. The rank and file (first seen by wave 2) thin out as the run goes on, so late waves are made
  // of late threats rather than more of the early ones.
  const HORDE=[['infantry',1,1,1.2],['rusher',1,1,.8],['scout',1.3,2,1],['breacher',1.8,3,.8],['drone',1.2,3,.7],['grenadier',2.2,4,.7],['shield',2,4,.6],
    ['sniper',2,6,.6],['medic',2,6,.6],['bomber',1,7,.6],['gunner',3.5,7,.5],['mortar',2.6,8,.5],['spotter',1.6,8,.45],['heavy',5,9,.45],
    ['elite',3,11,.8],['engineer',2.4,11,.5],['rocketeer',3,12,.5],['ghost',2,13,.5],['jammer',2.4,14,.4]];
  // Every third wave (never a red one) carries a twist, named on the wave banner and paid for when it is cleared.
  const MODIFIERS={blackout:'BLACKOUT',armoured:'ARMOURED',swarm:'SWARM',marksmen:'MARKSMEN'},REST=9,REST_RED=18,MILESTONES=[5,10,15,20,25,30,40,50];
  // Every fifth wave is a red wave: a boss, in this order, and from wave 25 two at once. Each comes back tougher every
  // time round, and tougher again for every squadmate. COUNTER is what the legendary crate before it holds.
  const BOSSES=['commander','mech','tank','wraith'],COUNTER={commander:'launcher',mech:'rail',tank:'rocket',wraith:'precision'};
  const bossesFor=n=>{if(n<5||n%5)return [];const c=n/5,list=[BOSSES[(c-1)%4]];if(c>=5)list.push(BOSSES[c%4]);return list;};
  // A veteran carries a better gun than the rest of its kind (and drops it).
  const VET_GUN={infantry:'battle',scout:'smg',sniper:'precision',breacher:'autoshotgun',gunner:'lmg',medic:'smg',engineer:'burst',grenadier:'thumper'};
  // The threat level rises every three waves (sooner on the harder pressures) and is folded into the rules every
  // hostile plays by (diff): quicker to fire, a steadier aim that leads a moving target, longer bursts, fighting from
  // cover (level 1), flanking and grenades for anyone who camps (2), suppressing fire and pressing a reload (3),
  // hunting and flashbangs (4), and tighter still beyond. Damage taken and supplies stay as the pressure set them.
  const THREAT_OFFSET={story:-1,standard:0,intense:1,insane:1};
  function pressureFor(s,n){const base=World.difficulties[s.difficulty]||World.difficulties.standard,tier=clamp(Math.floor((n-1)/3)+(THREAT_OFFSET[s.difficulty]||0)+(s.mut?.veterans?1:0),0,6);
    return {tier,D:{...base,windup:base.windup*(1-.035*tier),rate:base.rate*(1-.03*tier),spread:base.spread*(1-.06*tier),lead:Math.max(base.lead,.1*tier),burst:(base.burst||0)+(tier>=3?1:0),
      camp:base.camp?Math.max(2.5,base.camp-tier*.5):tier>=2?9-tier:0,nadeCd:base.nadeCd?Math.max(4,base.nadeCd-tier*.6):14-tier,suppress:base.suppress||tier>=3,hunt:base.hunt||tier>=4,
      cover:tier>=1,flank:tier>=2?Math.min(.45,.1+.07*tier):0,push:tier>=3,flash:tier>=4,flashCd:Math.max(6,16-tier*1.5)}};}
  function composeWave(s,n){const d=s.director,pts=s.map.spawnPoints,mod=d.modifier,bosses=bossesFor(n),out=[],D=s.waveD||diff(s);
    const pool=mod==='swarm'?[['rusher',.5,1,1]]:mod==='marksmen'?[['sniper',2,1,1],['infantry',1,1,1],...(n>=8?[['mortar',2.6,1,.6]]:[])]:HORDE.filter(q=>q[2]<=n);
    const weight=q=>q[3]*(q[2]<=2?Math.max(.25,1-.06*(n-1)):1),total=pool.reduce((a,q)=>a+weight(q),0),pick=()=>{let r=rand(s)*total;for(const q of pool){r-=weight(q);if(r<=0)return q;}return pool[pool.length-1];};
    let budget=(4+n*1.8)*[.8,1,1.15,1.4][Math.max(0,ORDER.indexOf(s.difficulty))]*(bosses.length?.6:1);
    // A boss pays about what a commander does: holdout bounties are for the waves, not one big kill.
    bosses.forEach((type,i)=>{const tough=(1+.25*Math.floor((n/5-1)/4))*(1+.4*s.mates.length)*(i?.75:1);out.push({type,tough,pay:Math.min(1,320/A[type].bounty),...(type==='mech'?{shieldMax:Math.round(380*tough),shieldHp:Math.round(380*tough)}:{})});});
    if(!mod&&n>1)for(const q of HORDE)if(q[2]===n){out.push({type:q[0]});budget-=q[1];}
    while(budget>0){const q=pick();budget-=q[1];out.push({type:q[0]});}
    // Where they come from: one approach early on, two from wave 4 and three from wave 10, picked afresh each wave and
    // split among them a fireteam of three at a time - so later waves come at the squad from more than one side.
    const want=Math.max(1,Math.min(pts.length,n<4?1:n<10?2:3)),idx=pts.map((_,i)=>i);for(let i=0;i<want;i++){const j=i+Math.floor(rand(s)*(idx.length-i));[idx[i],idx[j]]=[idx[j],idx[i]];}
    const lanes=idx.slice(0,want).map(i=>pts[i]);d.lanes=lanes.map(q=>({x:q.x,y:q.y}));
    const tough=1+Math.min(.45,.025*(n-1)),vet=clamp(.06*(n-5),0,.5);
    return out.map((e,i)=>{const t=A[e.type],lane=lanes[Math.floor(i/3)%lanes.length]||pts[0],human=!t.machine&&!t.boss,v=human&&rand(s)<vet,jx=(rand(s)-.5)*80,jy=(rand(s)-.5)*80,ok=clearAt(s,lane.x+jx,lane.y+jy,22);
      return {...e,id:'h'+n+'_'+i,x:lane.x+(ok?jx:0),y:lane.y+(ok?jy:0),zone:0,wave:n,tough:e.tough||tough*(v?1.35:1),vet:v||undefined,gun:v&&VET_GUN[e.type]||undefined,
        plated:mod==='armoured'&&!t.boss,flank:t.cover&&!t.boss&&rand(s)<(D.flank||0)?(rand(s)<.5?1:-1):0};});}
  // Some waves drop a supply uplink out in the open, eight seconds in. Standing by it (an AI teammate counts) fills it
  // over five seconds, and stepping off drains it at half the rate. Filled before it times out, it pays and leaves
  // ammunition and armour; it goes with the wave.
  const UPLINK={from:7,every:4,hold:5,life:40,radius:80},uplinkWave=n=>n>=UPLINK.from&&n%UPLINK.every===UPLINK.from%UPLINK.every&&n%5!==0;
  function stepUplink(s,d,dt){const u=d.uplink;if(!u||u.done)return;
    if(u.x===undefined){if(d.clock<8)return;const p=lead(s),spots=perchesOf(s).filter(q=>distance(q,p)>380&&distance(q,p)<900);if(!spots.length){d.uplink=null;return;}
      const q=spots[Math.floor(rand(s)*spots.length)];Object.assign(u,{x:q.x,y:q.y,until:s.time+UPLINK.life,progress:0});event(s,'uplink',{x:q.x,y:q.y,phase:'start'});return;}
    const near=ops(s).some(o=>!o.dead&&distance(o,u)<UPLINK.radius);u.progress=clamp(u.progress+(near?dt:-dt*.5)/UPLINK.hold,0,1);
    if(u.progress>=1){u.done=true;const pay=80+12*d.wave;s.stats.credits+=pay;s.pickups.push({id:'up'+d.wave+'a',x:u.x-24,y:u.y,type:'ammo',taken:false,until:s.time+DROPS.life},{id:'up'+d.wave+'b',x:u.x+24,y:u.y,type:'armor',taken:false,until:s.time+DROPS.life});event(s,'uplink',{x:u.x,y:u.y,phase:'done',credits:pay});}
    else if(s.time>u.until){u.done=true;event(s,'uplink',{x:u.x,y:u.y,phase:'lost'});}}
  // The supply drop: three crates fall beside the operator after each wave, paid for out of the credits earned so far
  // in this run (so what is spent is never banked) and gone when the next wave starts. The first is one of the basics,
  // whichever the operator is short of if any; the others come from a pool that widens as the waves go on. Before a
  // red wave a fourth, legendary crate lands as well, holding the answer to the boss on its way (COUNTER) at a price
  // that has to be saved for. OFFERS: [cost, rarity (0 standard issue to 4 legendary, as Meta.RARITY), first wave].
  const OFFERS={ammo:[60,0,1],armor:[110,0,1],health:[90,0,1],stim:[140,1,1],gadgets:[120,1,1],weapon:[0,2,1],sentry:[260,1,3],barricade:[160,1,3],partner:[240,2,3],hollow:[300,2,4],charge:[280,2,4],repair:[150,1,5],thermal:[220,2,6]},BASICS=['ammo','armor','health'];
  // What a teammate's primary becomes when the partner crate is bought.
  const MATE_GUNS={rifle:'battle',smg:'battle',burst:'battle',marksman:'battle',ricochet:'lmg',battle:'lmg',shotgun:'autoshotgun',lmg:'pulse',autoshotgun:'pulse'};
  const nearbyOffer=s=>s.pickups.filter(q=>!q.taken&&q.type==='offer'&&distance(q,s.player)<70).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0]||null;
  function offerOpen(s,k){const p=s.player;if(OFFERS[k][2]>s.director.wave)return false;
    if(k==='gadgets')return !!(p.lethal||p.tactical);if(k==='partner')return s.mates.some(m=>m.bot);if(k==='hollow')return (s.boost||0)<3;if(k==='charge')return !!s.support&&!s.support.ready;
    if(k==='repair')return s.walls.some(w=>w.low&&!w.deployed&&Number.isFinite(w.hp)&&(w.dead||w.hp<w.maxHp));if(k==='weapon')return Object.keys(W).some(g=>!s.owned.includes(g)&&carriable(s,g));return true;}
  function supplyDrop(s){const p=lead(s),d=s.director,k=1+d.wave*.06,boss=bossesFor(d.wave+1)[0],pool=Object.keys(OFFERS).filter(o=>!BASICS.includes(o)&&offerOpen(s,o)),picks=[];
    const short=[[s.player.health<60,'health'],[s.player.armor<s.player.maxArmor*.4,'armor'],[stocked(s)<.45,'ammo']].filter(q=>q[0]).map(q=>q[1]);
    picks.push(short.length?short[Math.floor(rand(s)*short.length)]:BASICS[Math.floor(rand(s)*BASICS.length)]);
    while(picks.length<3&&pool.length)picks.push(pool.splice(Math.floor(rand(s)*pool.length),1)[0]);
    for(const b of BASICS)if(picks.length<3&&!picks.includes(b))picks.push(b);
    const crates=picks.map(item=>({item}));// Under Sidearms Only the answer to every boss is the AT4, the one anti-armour weapon that fits the sidearm slot.
    const counter=boss&&(s.mut.sidearms?'rocket':COUNTER[boss]);if(boss)crates.push({item:'weapon',weapon:counter,legendary:true});
    crates.forEach((c,i)=>{let {item,weapon=null}=c,cost=OFFERS[item][0]*k,rarity=OFFERS[item][1];
      if(c.legendary){cost=500+d.wave*45;rarity=4;}
      else if(item==='weapon'){const guns=Object.keys(W).filter(g=>!s.owned.includes(g)&&carriable(s,g)&&g!==(boss&&counter));weapon=guns[Math.floor(rand(s)*guns.length)]||null;
        if(weapon){cost=Math.max(150,(W[weapon].price||14000)/12)*k;rarity=clamp((W[weapon].tier||2)-1,1,3);}else{item='ammo';cost=OFFERS.ammo[0]*k;rarity=0;}}
      const a=p.angle+(i-(crates.length-1)/2)*1.05;let spot=null;for(const r of [165,205,130,245,95]){const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(x>70&&y>70&&x<s.map.width-70&&y<s.map.height-70&&clearAt(s,x,y,20)){spot={x,y};break;}}
      spot=spot||{x:p.x+(i-1)*34,y:p.y};s.pickups.push({id:'offer'+d.wave+'_'+i,x:spot.x,y:spot.y,type:'offer',item,weapon,cost:Math.round(cost/10)*10,rarity,legendary:!!c.legendary,at:s.time,taken:false});});
    event(s,'supplydrop',{wave:d.wave,legendary:boss?COUNTER[boss]:null,boss:boss||null});}
  // Three sections of hard cover round where the crate stood, facing the nearest way in.
  function fortify(s,q){const pts=s.map.spawnPoints||[],near=pts.reduce((b,o)=>!b||distance(o,q)<distance(b,q)?o:b,null),a0=near?Math.atan2(near.y-q.y,near.x-q.x):s.player.angle;let n=0;
    [0,1.05,-1.05].forEach((da,i)=>{const a=a0+da,cx=q.x+Math.cos(a)*78,cy=q.y+Math.sin(a)*78,horiz=Math.abs(Math.sin(a))>Math.abs(Math.cos(a)),w=horiz?110:30,h=horiz?30:110,
      b={id:'fort'+s.tick+'_'+i,x:cx-w/2,y:cy-h/2,w,h,kind:'barrier',hp:420,maxHp:420,low:true,dead:false,fort:true},overlap=o=>o.x<b.x+b.w&&o.x+o.w>b.x&&o.y<b.y+b.h&&o.y+o.h>b.y;
      if(cx<60||cy<60||cx>s.map.width-60||cy>s.map.height-60||s.walls.some(o=>!o.dead&&overlap(o))||ops(s).some(o=>!o.dead&&circleBox(o.x,o.y,o.radius+4,b))||s.enemies.some(e=>!e.dead&&circleBox(e.x,e.y,e.radius,b)))return;
      s.walls.push(b);n++;event(s,'deploy',{x:cx,y:cy});});
    return n;}
  function buyOffer(s,q){const p=s.player;if(s.stats.credits<q.cost){event(s,'deny');event(s,'toast',{text:'NEED '+(q.cost-s.stats.credits)+' MORE CREDITS THIS RUN'});return;}
    if(q.item==='barricade'&&!fortify(s,q)){event(s,'deny');event(s,'toast',{text:'NO ROOM TO FORTIFY HERE'});return;}
    s.stats.credits-=q.cost;s.stats.spent+=q.cost;q.taken=true;
    if(q.item==='ammo')for(const k of p.slots){p.ammo[k]=W[k].capacity;p.reserve[k]=reserveOf(s,k);}
    else if(q.item==='armor')p.armor=Math.min(p.maxArmor,p.armor+50);
    else if(q.item==='health')p.health=100;
    else if(q.item==='stim')p.stims++;
    else if(q.item==='gadgets'){if(p.lethal)p.grenades=Math.max(p.grenades,G[p.lethal].count+s.mods.charges);if(p.tactical)p.tacticals=Math.max(p.tacticals,G[p.tactical].count+s.mods.charges);}
    else if(q.item==='weapon'){const k=q.weapon,slot=W[k].slot;if(!s.owned.includes(k))s.owned.push(k);p.slots[slot]=k;p.slot=slot;p.ammo[k]=W[k].capacity;p.reserve[k]=reserveOf(s,k)*(q.legendary?2:1);p.reload=0;p.cooldown=.2;event(s,'equip',{weapon:k});}
    else if(q.item==='sentry'){const at=[[0,0],[40,0],[-40,0],[0,40],[0,-40]].map(([dx,dy])=>({x:q.x+dx,y:q.y+dy})).find(o=>clearAt(s,o.x,o.y,22))||{x:q.x,y:q.y};s.allies.push({id:'ally'+s.tick,kind:'turret',x:at.x,y:at.y,angle:p.angle,life:45,total:45,cooldown:.5,vx:0,vy:0,shotAge:10});event(s,'deploy',{x:at.x,y:at.y});}
    else if(q.item==='hollow')s.boost=Math.min(3,(s.boost||0)+1);
    else if(q.item==='charge'){const sp=s.support;if(sp&&!sp.ready){sp.charge=sp.cost;sp.ready=true;event(s,'supportready',{key:sp.key});}}
    else if(q.item==='thermal')s.thermal=true;
    else if(q.item==='repair'){let n=0;for(const w of s.walls){if(!w.low||w.deployed||!Number.isFinite(w.hp)||!w.dead&&w.hp>=w.maxHp)continue;if(w.dead&&(ops(s).some(o=>!o.dead&&circleBox(o.x,o.y,o.radius,w))||s.enemies.some(e=>!e.dead&&circleBox(e.x,e.y,e.radius,w))))continue;w.dead=false;w.hp=w.maxHp;n++;}event(s,'toast',{text:'COVER REBUILT / '+n+' SECTION'+(n===1?'':'S')});}
    // The partner crate: an AI teammate who is down is back on its feet at once, and every one is patched up, rearmed
    // and handed a better primary.
    else if(q.item==='partner')for(const m of s.mates){if(!m.bot)continue;
      if(m.dead){s.tags=s.tags.filter(t=>t.owner!==m.id);const at=[[44,0],[-44,0],[0,44],[0,-44]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(o=>clearAt(s,o.x,o.y,17))||{x:p.x,y:p.y};Object.assign(m,{dead:false,x:at.x,y:at.y,vx:0,vy:0,state:'idle',age:0,iframes:2,reload:0,heal:0});event(s,'revive',{who:m.id,by:'player',x:at.x,y:at.y});}
      Object.assign(m,{health:100,armor:m.maxArmor,stims:Math.max(m.stims,s.mods.stims),grenades:BOT.kit.frag+1,tacticals:BOT.kit.flash+1});const up=MATE_GUNS[m.slots[0]];if(up){m.slots[0]=up;m.slot=0;m.ammo[up]=W[up].capacity;m.reserve[up]=reserveOf(s,up);}}
    event(s,'bought',{item:q.item,weapon:q.weapon,cost:q.cost,x:q.x,y:q.y,legendary:q.legendary});}
  function startWave(s,d){d.wave++;d.phase='fight';d.clock=0;d.thin=0;d.last=false;for(const q of s.pickups)if(q.type==='offer')q.taken=true;
    const P=pressureFor(s,d.wave);s.waveD=P.D;d.tier=P.tier;d.red=d.wave%5===0;d.bosses=bossesFor(d.wave);d.taken=s.stats.damage;
    const names=Object.keys(MODIFIERS);d.modifier=d.wave%3===0&&!d.red?names[Math.floor(rand(s)*names.length)]:null;if(d.modifier==='blackout'){d.lit=s.dark;s.dark=Math.max(s.dark,.86);}
    d.queue=composeWave(s,d.wave);d.seen=d.seen||[];const fresh=[...new Set(d.queue.map(e=>e.type))].filter(t=>!d.seen.includes(t));d.seen.push(...fresh);
    d.uplink=uplinkWave(d.wave)?{progress:0}:null;if(s.thermal){s.thermal=false;s.recon=Math.max(s.recon||0,90);}
    event(s,'wave',{wave:d.wave,modifier:d.modifier,red:d.red,bosses:[...d.bosses],tier:d.tier,fresh:d.wave>1?fresh.filter(t=>!A[t].boss):[],lanes:d.lanes});
    event(s,'toast',{text:'WAVE '+d.wave+(d.red?' / RED WAVE / '+d.bosses.map(b=>A[b].name).join(' + ')+' INBOUND':d.modifier?' / '+MODIFIERS[d.modifier]:'')});}
  // A cleared wave pays its bonus, and a clean one (little damage taken) pays a little more; the next wave's wait is
  // longer before a red one, to shop and dig in.
  function clearWave(s,d){d.phase='rest';const next=d.wave+1,red=next%5===0;d.timer=red?REST_RED:REST;s.stats.wave=d.wave;s.boss=null;
    const bonus=40+d.wave*10+(d.modifier?50+d.wave*10:0),taken=s.stats.damage-(d.taken||0),grade=taken<10?'flawless':taken<35?'clean':null,clean=grade==='flawless'?15+3*d.wave:grade==='clean'?6+2*d.wave:0;s.stats.credits+=bonus+clean;
    if(d.uplink&&d.uplink.x!==undefined&&!d.uplink.done)event(s,'uplink',{x:d.uplink.x,y:d.uplink.y,phase:'lost'});d.uplink=null;
    event(s,'waveclear',{wave:d.wave,bonus,modifier:d.modifier,grade,clean,milestone:MILESTONES.includes(d.wave)?d.wave:0,next:red?{red:true,bosses:bossesFor(next)}:null});charge(s,60);
    if(d.modifier==='blackout')s.dark=d.lit||0;d.modifier=null;
    s.pickups=s.pickups.filter(q=>!q.taken||q.base);for(const q of s.pickups)if(q.base)q.taken=false;
    // An AI teammate's kit comes back between waves: its frag and flashbang, and one stim.
    for(const m of s.mates)if(m.bot&&!m.dead){m.grenades=Math.max(m.grenades,BOT.kit.frag);m.tacticals=Math.max(m.tacticals,BOT.kit.flash);m.stims=Math.min(Math.max(m.stims,s.mods.stims),m.stims+1);}
    supplyDrop(s);}
  // At most "cap" hostiles are on the field at once (more as the waves go on, and with a squad); the rest of the wave
  // waits in the queue and comes in four or five at a time as room opens up.
  // The end of a wave: once the queue is empty and only a few are left for a while, they stop hanging back - they come
  // for the squad and are marked wherever they are ("last stand"). Sentries an engineer set down do not hold a wave
  // open, and go dark when it is cleared.
  const LAST_STAND={left:3,after:12};
  function holdout(s,dt,d){const count=()=>s.enemies.filter(e=>!e.dead&&!e.built).length+s.spawnWarnings.length,cap=Math.min(18,8+Math.floor(d.wave*.6))+2*s.mates.length;d.queue=d.queue||[];
    if(d.queue.length&&count()<cap)warnSpawn(s,d.queue.splice(0,Math.min(d.wave>=10?5:4,cap-count())),true);
    // Counted again after the release: the last of the queue going out onto an empty field must not clear the wave.
    const alive=count();
    if(d.wave===0||d.phase==='rest'){d.timer=(d.timer??3)-dt;s.progress=0;if(d.timer<=0)startWave(s,d);}
    else{stepUplink(s,d,dt);const boss=s.enemies.find(e=>!e.dead&&A[e.type].boss&&e.wave===d.wave);s.boss=boss?boss.id:null;
      if(!d.queue.length&&alive<=LAST_STAND.left&&alive>0){d.thin=(d.thin||0)+dt;if(d.thin>LAST_STAND.after&&!d.last){d.last=true;for(const e of s.enemies)if(!e.dead&&!e.built){e.rush=true;e.active=true;}event(s,'laststand',{left:alive});}}else d.thin=0;
      if(!d.queue.length&&alive===0){for(const e of s.enemies)if(!e.dead&&e.built){e.dead=true;e.vanished=true;e.deathAge=0;}clearWave(s,d);}}}
  function director(s,dt){const d=s.director,p=lead(s);d.clock+=dt;d.rest=Math.max(0,d.rest-dt);d.pressure=clamp(s.enemies.filter(e=>e.active&&!e.dead).length/7+(100-p.health)/200,0,1);
    d.supplyCooldown=Math.max(0,(d.supplyCooldown||0)-dt);const equipped=p.slots[p.slot];
    if(!s.training&&d.supplyCooldown===0&&p.reserve[equipped]<W[equipped].capacity&&s.pickups.filter(a=>!a.taken&&a.type==='ammo').length<2){const x=p.x-Math.cos(p.angle)*80,y=p.y-Math.sin(p.angle)*80;if(clearAt(s,x,y,12)){s.pickups.push({id:'support'+s.tick,x,y,type:'ammo',taken:false});d.supplyCooldown=s.mut?.scarcity?32:18;}}
    for(const warning of s.spawnWarnings){warning.delay-=dt;if(warning.delay<=0&&!warning.spawned){warning.spawned=true;const e=makeEnemy(s,warning);if(!A[e.type].flying)Object.assign(e,freeSpot(s,e.x,e.y,e.radius));e.active=true;e.seen=4;e.lastX=p.x;e.lastY=p.y;e.spawned=true;e.hunt=true;const existing=s.enemies.find(a=>a.id===e.id);if(existing)Object.assign(existing,e);else s.enemies.push(e);}}
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
    else if(st.kind==='tdm')deathmatch(s,dt,d);
  }
  // Team deathmatch: the clock, the respawns and the result. A kill is a point for the killer's team (fallen); the
  // first team to the limit wins, or whoever is ahead when the clock runs out. "result" is how it ended for Alpha.
  function deathmatch(s,dt){const T=s.tdm,d=s.director;d.clock+=dt;T.left=Math.max(0,T.time-d.clock);s.progress=clamp(Math.max(T.score[0],T.score[1])/T.limit,0,1);
    for(const op of s.roster){if(!op.dead||op.vanished)continue;op.respawn-=dt;if(op.respawn<=0)act(s,op,()=>redeploy(s,op));}
    if(T.score[0]>=T.limit||T.score[1]>=T.limit||T.left<=0){T.winner=T.score[0]>T.score[1]?0:T.score[1]>T.score[0]?1:-1;T.result=T.winner===0?'win':T.winner===1?'loss':'draw';s.completed=true;
      event(s,'complete',{tdm:true,winner:T.winner,result:T.result,score:[...T.score],time:s.time});}}
  // How a finished match went for one operator: their team, the result, what it pays and whether it is kept in the
  // record. Pay is scaled down for a short match or a smaller team opposite; only a match to 20 or more against a
  // team at least the size of your own is "ranked".
  function verdict(s,id){const T=s.tdm,op=s.roster.find(o=>o.id===id)||s.player,mine=s.roster.filter(o=>o.team===op.team).length,theirs=s.roster.length-mine,result=T.winner<0?'draw':T.winner===op.team?'win':'loss';
    return {team:op.team,result,match:Math.round(TDM.pay[result]*Math.min(1,T.limit/30)*Math.min(1,theirs/mine)),ranked:T.limit>=20&&theirs>=mine,ai:s.roster.some(o=>o.team!==op.team&&o.bot)};}
  // Ending a defence or killing a boss sends that fight's reinforcements running, so extraction reads as a win rather than a mop-up.
  function rout(s){let n=0;for(const e of s.enemies)if(!e.dead&&e.spawned){e.dead=true;e.vanished=true;e.deathAge=0;n++;}s.spawnWarnings=[];if(n)event(s,'toast',{text:'REMAINING HOSTILES ARE RETREATING'});}
  // The field rating. The score starts at 10,000: every perfect flow adds 200, every point of damage taken costs 14 and
  // every second over par costs 10. S asks for more than not getting hurt: a high score that includes at least one
  // perfect flow, the movement the game is built round.
  function rating(s){const par=World.missions.find(m=>m.id===s.mission)?.par||240,score=Math.max(0,Math.round(10000+s.stats.flows*200-s.stats.damage*14-Math.max(0,s.time-par)*10));
    return {time:s.time,score,rating:score>=9800&&s.stats.flows>0?'S':score>=8200?'A':score>=6500?'B':'C'};}
  function stepThrown(s,dt,only){for(const g of s.grenades){if(only&&g.owner!==only)continue;g.age+=dt;if(g.age<g.duration){const t=clamp(g.age/g.duration,0,1);const nx=g.sx+(g.tx-g.sx)*t,ny=g.sy+(g.ty-g.sy)*t;if(!g.blocked){if(!s.walls.some(w=>!w.dead&&!w.low&&!w.pass&&circleBox(nx,ny,4,w))){g.x=nx;g.y=ny;}else g.blocked=true;}}if(g.age>=g.fuse&&!g.exploded){g.exploded=true;const by=s.by;if(!s.tdm&&g.owner&&!g.enemy)s.by=g.owner;detonate(s,g);s.by=by;}}
    s.grenades=s.grenades.filter(g=>!g.exploded);
    for(const z of s.zones){if(only&&z.owner!==only)continue;z.life-=dt;
      // Tear gas: any soldier standing in it is doubled over and cannot fight. Machines and bosses are not troubled.
      if(z.kind==='gas'){z.tick-=dt;if(z.tick<=0){z.tick=.4;for(const e of s.enemies)if(!e.dead&&!A[e.type].machine&&!A[e.type].boss&&distance(e,z)<z.r){e.stagger=Math.max(e.stagger,.6);e.attack=0;e.burst=0;}}}
      if(z.kind==='fire'){z.tick-=dt;if(z.tick<=0){z.tick=.25;for(const e of s.enemies)if(!e.dead&&!A[e.type].flying&&distance(e,z)<z.r)damageEnemy(s,e,9.5,Math.atan2(e.y-z.y,e.x-z.x),.05,'incendiary');if(distance(s.player,z)<z.r)damagePlayer(s,5,z.x,z.y,'fire');}}}
    s.zones=s.zones.filter(z=>z.life>0);if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=0)s.decoy=null;}
    for(const m of s.mines){if(only&&m.owner!==only)continue;m.arm-=dt;if(m.arm<=0&&!m.done&&!m.remote&&s.enemies.some(e=>!e.dead&&!(e.gone>0)&&!A[e.type].flying&&distance(e,m)<78+e.radius-17)){m.done=true;explode(s,m.x,m.y,150,160,false,'mine');}}
    s.mines=s.mines.filter(m=>!m.done);
    const p=s.player;p.zap=Math.max(0,(p.zap||0)-dt);const up=s.mates.filter(o=>!o.dead);for(const gp of up)gp.zap=Math.max(0,(gp.zap||0)-dt);
    for(const h of s.hazards){if(!only||only==='player')h.off=Math.max(0,h.off-dt);h.on=h.off<=0&&((s.time+h.phase)%h.period)<h.period*h.duty;
      if(h.on&&!p.zap&&circleBox(p.x,p.y,p.radius-3,h)&&damagePlayer(s,22,h.x+h.w/2,h.y+h.h/2,'laser')){p.zap=.7;event(s,'zap',{x:p.x,y:p.y});}
      for(const gp of up)if(h.on&&!gp.zap&&circleBox(gp.x,gp.y,gp.radius-3,h)&&damageMate(s,gp,22,h.x+h.w/2,h.y+h.h/2,'laser')){gp.zap=.7;event(s,'zap',{x:gp.x,y:gp.y});}}}
  function stepPickups(s,dt){const p=s.player.dead?{x:-1e9,y:-1e9}:s.player,up=s.mates.filter(o=>!o.dead);for(const pick of s.pickups){if(pick.taken||pick.type==='supply'||pick.type==='offer')continue;if(pick.until&&s.time>pick.until){pick.taken=true;continue;}
      if(pick.type==='weapon'){if(!pick.owned&&s.owned.includes(pick.weapon))pick.owned=true;if(distance(pick,p)<=35&&!pick.owned){s.owned.push(pick.weapon);pick.owned=true;event(s,'weaponfound',{weapon:pick.weapon,x:pick.x,y:pick.y});}if(pick.owned){pick.ttl+=dt;if(pick.ttl>45)pick.taken=true;}continue;}
      // Lethal/tactical gadgets stay player-only: a squadmate's leaner v1 kit has no gadget slots to fill.
      if(pick.type==='lethal'){if(distance(pick,p)>35||!p.lethal)continue;p.grenades=Math.min(G[p.lethal].count+s.mods.charges+2,p.grenades+1);pick.taken=true;event(s,'pickup',{kind:pick.type,x:pick.x,y:pick.y});continue;}
      if(pick.type==='tactical'){if(distance(pick,p)>35||!p.tactical)continue;p.tacticals=Math.min(G[p.tactical].count+s.mods.charges+2,p.tacticals+1);pick.taken=true;event(s,'pickup',{kind:pick.type,x:pick.x,y:pick.y});continue;}
      // Health/ammo/armor/intel/cache go to whichever operator is actually closest, so a squadmate can self-sustain.
      let target=p;for(const gp of up)if(distance(pick,gp)<distance(pick,target))target=gp;if(distance(pick,target)>35)continue;
      if(pick.type==='health'){if(target.health>=100)continue;target.health=Math.min(100,target.health+30);}
      else if(pick.type==='armor')target.armor=Math.min(target.maxArmor,target.armor+30);
      else if(pick.type==='ammo'){if(target.slots.every(k=>target.reserve[k]>=reserveOf(s,k)*2))continue;for(const k of target.slots)target.reserve[k]=Math.min(reserveOf(s,k)*2,target.reserve[k]+Math.ceil(W[k].reserve/3));}
      else if(pick.type==='intel'){s.stats.intel++;event(s,'intel',{x:pick.x,y:pick.y});}
      else if(pick.type==='cache'){s.stats.credits+=120;event(s,'cache',{x:pick.x,y:pick.y,credits:120});}
      pick.taken=true;event(s,'pickup',{kind:pick.type,x:pick.x,y:pick.y,guest:target!==p,who:target!==p?target.id:s.player.id});}
    if(s.tick%600===0&&s.pickups.length>40)s.pickups=s.pickups.filter(q=>!q.taken||q.base);}
  // ---------- team deathmatch: every operator the same ----------
  // The rules for moving, shooting, gadgets, perks and field support were written for one player, Rook, and the
  // hostiles he faces (s.player, s.enemies, and what the simulation keeps about him). In team deathmatch each operator
  // takes a turn at being that player: act() puts them, their own context and the other team in those places, runs
  // the same rules, and puts everything back. Whatever an operator owns - rounds in flight, grenades, fire, mines, a
  // sentry - is stepped in its owner's turn, so it harms the other team and its kills are its owner's.
  function act(s,op,fn){const keep={player:s.player,mates:s.mates,enemies:s.enemies,acting:s.acting};for(const k of CTX){keep[k]=s[k];s[k]=op.ctx[k];}
    s.player=op;s.mates=[];s.enemies=s.roster.filter(o=>o.team!==op.team);s.acting=op.id;
    try{fn();}finally{for(const k of CTX){op.ctx[k]=s[k];s[k]=keep[k];}s.player=keep.player;s.mates=keep.mates;s.enemies=keep.enemies;s.acting=keep.acting;}}
  // Whatever was put in the field during this turn is this operator's.
  function claim(s,op){for(const list of [s.grenades,s.zones,s.mines,s.allies])for(const q of list)if(q.owner===undefined&&!q.enemy){q.owner=op.id;q.team=op.team;}}
  // One operator's hit on another: armour and health as for anyone, but no protection after a hit (every pellet of a
  // blast lands) - only a dodge, a vault or the moment after redeploying saves them. A kill is a point for the team, a
  // bounty for a player, and a step in the killer's chain.
  function strike(s,e,amount,angle,source,blast){const me=s.player,T=s.tdm;if(e.dead||e.iframes>0||e.state==='vault'&&e.age<.24)return;
    if(e.state==='roll'&&e.age>=.055&&e.age<=.25||e.state==='dive'&&e.age>=.07&&e.age<=.28)return;
    // Their flak vest against a blast; the attacker's Ambusher, which here means a hit from behind.
    // A knife is final, as it is in any deathmatch.
    const theirs=e.ctx.perks;if(source==='melee')amount=Math.max(amount,400);amount*=TDM.dmg*(blast&&theirs.flak?.6:1)*(s.perks.ambusher&&!blast&&Math.abs(wrap(angle-e.angle))<1?1.35:1);
    const armor=Math.min(e.armor,amount*.65);e.armor-=armor;e.health=Math.max(0,e.health-amount+armor);e.hp=e.health;e.hurtAt=s.time;e.heal=0;s.stats.hits++;
    event(s,'hit',{id:e.id,x:e.x,y:e.y,angle,amount,player:true,by:me.id});event(s,'damage',{x:e.x,y:e.y,amount,fromX:me.x,fromY:me.y,src:source,who:e.id});
    if(e.health<=0&&theirs.secondwind&&!e.ctx.windUsed){e.ctx.windUsed=true;e.health=e.hp=30;e.iframes=1.2;event(s,'secondwind',{x:e.x,y:e.y,who:e.id});}
    if(e.health>0)return;
    fallen(s,e,me.id);s.stats.kills++;s.mastery[source]=(s.mastery[source]||0)+1;s.combo=s.time-s.comboAt<3.5?s.combo+1:1;s.comboAt=s.time;s.stats.bestCombo=Math.max(s.stats.bestCombo,s.combo);
    const t=A.operator,credits=me.bot?0:Math.round(t.bounty*(1+.1*Math.min(s.combo-1,8))*(source==='melee'?1.5:1)*TDM.bounty),row=T.board[me.id];s.stats.credits+=credits;row.k++;row.cr+=credits;
    event(s,'kill',{x:e.x,y:e.y,enemy:'operator',id:e.id,victim:e.id,credits,combo:s.combo,boss:false,source,by:me.id,bot:me.bot});credit(s,source,t);
    if(loose(s,'ammo')<3)s.pickups.push({id:'fall'+s.tick+e.id,x:e.x,y:e.y,type:'ammo',taken:false,until:s.time+DROPS.life});}
  function stepVersus(s,input,dt){s.tick++;s.time+=dt;
    s.roster.forEach((op,i)=>act(s,op,()=>{s.flowTime=Math.max(0,s.flowTime-dt);op.stagger=Math.min(TDM.stun,Math.max(0,(op.stagger||0)-dt));
      const raw=i?input.mates&&input.mates[i-1]||{}:input;stepPlayer(s,op.dead||op.vanished?{}:op.bot?botInput(s,op,i,dt):raw,dt);claim(s,op);
      stepAllies(s,dt,op.id);stepProjectiles(s,dt,op.id);stepThrown(s,dt,op.id);if(!op.dead)stepPickups(s,dt);claim(s,op);op.hp=op.health;}));
    deathmatch(s,dt);}
  // A fallen hostile that a wave or the director sent in lies where it fell for CORPSE.life seconds (the renderer fades
  // it over the last CORPSE.fade of them) and is then removed, so a long holdout run does not carry every body it has
  // ever made. Authored campaign soldiers stay: a checkpoint records them as killed by id.
  const CORPSE={life:6,fade:1.5},NIGHT=.82;
  // Intel: the first time in a run the player gets a clear look at a type of hostile (in line of sight, within 950,
  // and for a cloaked one only once it shows itself), a 'sighted' event says so; the game files it in the save.
  function sight(s){if(s.tick%12||s.tdm||s.training)return;const p=s.player,seen=s.sighted||(s.sighted={});if(p.dead)return;
    for(const e of s.enemies){if(e.dead||e.gone>0||e.vanished||seen[e.type])continue;const t=A[e.type]||{},d=distance(e,p);if(d>950)continue;
      if(t.cloak&&d>170&&!(s.recon>0)&&!(e.attack>0)&&!(e.flashed>0))continue;if(!lineOfSight(s,p,e))continue;seen[e.type]=1;event(s,'sighted',{enemy:e.type,x:e.x,y:e.y,boss:!!t.boss});}}
  function prune(s){if(s.tick%60||s.tdm)return;const keep=s.enemies.filter(e=>!(e.dead&&e.spawned&&(e.deathAge||0)>CORPSE.life));if(keep.length!==s.enemies.length)s.enemies=keep;}
  function step(s,input={},dt=DT){if(s.completed||s.dead)return;if(s.tdm)return stepVersus(s,input,dt);
    if(s.hitstop>0){s.hitstop=Math.max(0,s.hitstop-dt);s.buffered=s.buffered||{};for(const key of ['roll','slide','interact','reload','gadget','melee','grenade','tactical','swap','support'])if(input[key])s.buffered[key]=true;if(input.slot!==undefined)s.buffered.slot=input.slot;return;}
    if(s.buffered){input={...input,...s.buffered};s.buffered=null;}
    s.tick++;s.time+=dt;s.flowTime=Math.max(0,s.flowTime-dt);if(s.mut.night&&s.dark<NIGHT)s.dark=NIGHT;
    if(s.cinematic>0){s.cinematic+=dt;const cin=stageDef(s).cinematic||{duration:2.5,beats:[]};s.beats=s.beats||{};cin.beats.forEach((b,i)=>{if(s.cinematic>b.at&&!s.beats[i]){s.beats[i]=true;if(b.explode)explode(s,s.player.x+b.explode[0],s.player.y+b.explode[1],b.explode[2],0);if(b.radio)event(s,'radio',{...b.radio});}});if(s.cinematic>cin.duration){s.completed=true;event(s,'complete',{...rating(s)});}return;}
    stepPlayer(s,input,dt);if(s.dead)return;if(s.player.stagger>0)s.player.stagger=Math.max(0,s.player.stagger-dt);if(input.order)orderSquad(s);
    // Each squadmate's controls for this step: the AI's for a bot, otherwise what its player sent (input.mates, or
    // input.guest for the first of them).
    if(s.mates.length){const inputs={player:input};s.mates.forEach((m,i)=>{const mi=m.dead?{}:m.bot?botInput(s,m,i,dt):input.mates&&input.mates[i]||i===0&&input.guest||{};inputs[m.id]=mi;stepMate(s,m,mi,dt);});stepRevive(s,inputs,dt);}
    stepEnemies(s,dt);stepAllies(s,dt);stepProjectiles(s,dt);stepThrown(s,dt);if(s.dead)return;stepPickups(s,dt);director(s,dt);prune(s);sight(s);
  }
  return {DT,CELL,REVIVE_TIME,TDM,BOT,CORPSE,ORDERS,BOSSES,COUNTER,OFFERS,HORDE,bossesFor,pressureFor,composeWave,supplyDrop,orderSquad,coverFor,create,step,move,clearAt,lineOfSight,sees,circleBox,segmentBox,segmentCircle,distance,shoot,damagePlayer,damageEnemy,damageProp,explode,vault,interact,melee,checkpoint,resupply,rating,stageDef,arena,ops,botInput,act,verdict,callSupport,chargeSupport:charge,advance,enterStage,eligible,navField,nearbyWeapon,nearbyOffer,reserveOf,diff,MODIFIERS,STAMINA_SHORT,STAMINA_LONG,WINDED_UNTIL};
});

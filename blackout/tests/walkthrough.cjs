'use strict';
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js');
const TILE=32;
function pathTo(s,target){const W=Math.ceil(s.map.width/TILE),H=Math.ceil(s.map.height/TILE),key=(x,y)=>y*W+x;
 const signature=s.walls.filter(w=>w.dead).map(w=>w.id).join(',')+s.walls.length;if(!s._nav||s._nav.signature!==signature){const blocked=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)blocked[key(x,y)]=!Core.clearAt(s,x*TILE+16,y*TILE+16,20);s._nav={blocked,signature};}const blocked=s._nav.blocked;
 const sx=Math.floor(s.player.x/TILE),sy=Math.floor(s.player.y/TILE);let gx=Math.floor(target.x/TILE),gy=Math.floor(target.y/TILE);if(blocked[key(gx,gy)]){let best=Infinity;s._nearest=null;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=gx+dx,y=gy+dy;if(x<1||y<1||x>=W-1||y>=H-1||blocked[key(x,y)])continue;const d=(x*TILE+16-target.x)**2+(y*TILE+16-target.y)**2;if(d<best){best=d;s._nearest={x,y};}}if(!s._nearest)return [];gx=s._nearest.x;gy=s._nearest.y;}
 const start=key(sx,sy),goal=key(gx,gy),open=[{id:start,x:sx,y:sy,g:0,f:0}],cost=new Map([[start,0]]),parent=new Map(),visited=new Set();let bestH=Infinity,bestId=start;
 const trace=end=>{let id=end;const path=[];while(id!==start){path.push({x:(id%W)*TILE+16,y:Math.floor(id/W)*TILE+16});id=parent.get(id);if(id===undefined)return [];}return path.reverse();};
 while(open.length){open.sort((a,b)=>b.f-a.f);const n=open.pop();if(visited.has(n.id))continue;visited.add(n.id);if(n.id===goal)return trace(goal);
  const h=Math.hypot(n.x-gx,n.y-gy);if(h<bestH){bestH=h;bestId=n.id;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,y=n.y+dy,id=key(x,y),first=n.id===start,wall=t=>first?!Core.clearAt(s,(t%W)*TILE+16,Math.floor(t/W)*TILE+16,8):blocked[t];if(x<1||y<1||x>=W-1||y>=H-1||wall(id)||!first&&dx&&dy&&(wall(key(n.x+dx,n.y))||wall(key(n.x,n.y+dy))))continue;const g=n.g+(dx&&dy?1.414:1);if(g>=(cost.get(id)??Infinity))continue;cost.set(id,g);parent.set(id,n.id);open.push({id,x,y,g,f:g+Math.hypot(x-gx,y-gy)});}
 }return bestId===start?[]:trace(bestId);
}
// Clear shot to a destructible objective: the target itself may be the only thing in the way.
function clearShot(s,p,box){const c={x:box.x+box.w/2,y:box.y+box.h/2};return !s.walls.some(w=>w!==box&&!w.dead&&!w.pass&&w.kind!=='glass'&&Core.segmentBox(p.x,p.y,c.x,c.y,w)!==null);}
// Ordinary control packets only: movement, aim, fire, reload, stim, grenade, gadget, swap and interact. Nothing in the simulation is edited.
const LOADOUTS={crash:{primary:'rifle',secondary:'pistol'},ruins:{primary:'shotgun',secondary:'pistol',lethal:'frag'},kestrel:{primary:'marksman',secondary:'pistol',lethal:'frag',tactical:'smoke'},underground:{primary:'shotgun',secondary:'pistol',lethal:'frag',tactical:'flash'},convoy:{primary:'rifle',secondary:'rocket',lethal:'frag'},meridian:{primary:'pulse',secondary:'thumper',lethal:'frag',tactical:'emp'},holdout:{primary:'rifle',secondary:'pistol',lethal:'frag'}};
function run(difficulty='standard',checkpoint=null,mission='crash',options={}){const loadout=options.loadout||(mission==='crash'?undefined:LOADOUTS[mission]);
 const s=Core.create({difficulty,checkpoint,mission,loadout,owned:Object.keys(World.weapons),profile:options.profile});let nav=[],lastTarget='',lastStage=s.stage;const records=[],limit=options.limit||72000,human={id:'',seen:0,angle:null};
 for(let i=0;i<limit&&!s.completed&&!s.dead;i++){
  const p=s.player,st=Core.stageDef(s),must=st.kind==='clear',live=s.enemies.filter(e=>!e.dead&&!(e.gone>0)&&Core.eligible(s,e)&&(must&&e.zone===st.zone||e.active&&Core.distance(e,p)<700&&Core.lineOfSight(s,p,e)||e.spawned||World.archetypes[e.type].boss));
  let target=live.sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0];
  const barrier=target&&World.archetypes[target.type].barrier&&!(target.shieldDown>0)&&!target.barrierOff,gen=barrier?s.walls.find(w=>w.kind==='generator'&&!w.dead):null;
  const prop=st.kind==='destroy'?s.walls.filter(w=>w.kind===st.targets&&!w.dead).sort((a,b)=>Core.distance(p,{x:a.x+a.w/2,y:a.y+a.h/2})-Core.distance(p,{x:b.x+b.w/2,y:b.y+b.h/2}))[0]:gen;
  const near=target&&Core.distance(target,p)<520&&Core.lineOfSight(s,p,target);
  const aimProp=prop&&(!near||gen)&&Core.distance(p,{x:prop.x+prop.w/2,y:prop.y+prop.h/2})<(gen?260:420)&&clearShot(s,p,prop);
  const obj=st.kind==='destroy'?s.goal:st,dest=aimProp||gen?{x:prop.x+prop.w/2,y:prop.y+prop.h/2}:target&&(must||near||st.kind!=='reach')?target:prop&&!target?{x:prop.x+prop.w/2,y:prop.y+prop.h/2}:obj;
  const dist=Core.distance(p,dest),los=aimProp||Core.lineOfSight(s,p,dest),key=(dest===target?target.id:aimProp?'prop':'obj')+s.stage;
  if(key!==lastTarget||i%90===0||s.stage!==lastStage){nav=pathTo(s,dest);lastTarget=key;}
  const armoured=target&&World.archetypes[target.type].armor;const wantSlot=armoured&&World.weapons[p.slots[1]].explosive&&p.ammo[p.slots[1]]+p.reserve[p.slots[1]]>0?1:0;
  const input={aimX:dest.x,aimY:dest.y,fire:(!!target&&los||aimProp)&&dist<800,reload:p.ammo[p.slots[p.slot]]===0||!target&&p.ammo[p.slots[p.slot]]<Math.min(15,World.weapons[p.slots[p.slot]].capacity),gadget:p.health<60&&p.heal<=0,slot:wantSlot!==p.slot?wantSlot:undefined,
   grenade:!!target&&los&&dist>170&&dist<365&&p.grenades>0&&i%180===0&&['shield','commander','gunner','apc','mech','wraith'].includes(target.type),tactical:!!target&&los&&dist<330&&p.tacticals>0&&i%240===0&&(p.tactical==='emp'?barrier||World.archetypes[target.type].machine:p.tactical==='flash'),
   interact:(st.kind==='clear'||st.kind==='extract')&&!target&&Core.distance(p,st)<80&&i%20===0,melee:!!target&&dist<70&&i%60===0};
  if(target&&los&&dist<480&&dist>150&&dest===target){const angle=Math.atan2(target.y-p.y,target.x-p.x),side=(Math.floor(i/260)%2?1:-1);input.mx=-Math.sin(angle)*side;input.my=Math.cos(angle)*side;input.aiming=true;input.roll=!p.reload&&target.attack>0&&target.attackAge>target.attack*.7&&i%20===0;}
  else if(target&&World.archetypes[target.type].stomp&&Core.distance(p,target)<230){const angle=Math.atan2(p.y-target.y,p.x-target.x);input.mx=Math.cos(angle);input.my=Math.sin(angle);input.melee=false;}
  else if(!(aimProp&&dist<300)){while(nav.length&&Core.distance(p,nav[0])<18)nav.shift();if(nav[0]){const dx=nav[0].x-p.x,dy=nav[0].y-p.y,len=Math.hypot(dx,dy);input.mx=dx/len;input.my=dy/len;input.sprint=!target;}}
  if(st.kind==='survive'&&!target&&Core.distance(p,st)<140){input.mx=0;input.my=0;}
  // Respect cycling laser grids like a player would: hold position while a beam ahead is live.
  if(input.mx||input.my){const len=Math.hypot(input.mx,input.my)||1,ax=p.x+input.mx/len*34,ay=p.y+input.my/len*34,inside=s.hazards.some(h=>Core.circleBox(p.x,p.y,18,h));if(!inside&&s.hazards.some(h=>Core.circleBox(ax,ay,20,h)&&(h.on||((s.time+.35+h.phase)%h.period)<h.period*h.duty))){input.mx=0;input.my=0;input.sprint=false;}}
  if(options.human){const h=options.human;if((target?.id||'')!==human.id){human.id=target?.id||'';human.seen=s.time;}const react=s.time-human.seen<h.react;
   const want=Math.atan2(input.aimY-p.y,input.aimX-p.x),cur=human.angle??want,turn=Math.atan2(Math.sin(want-cur),Math.cos(want-cur));human.angle=cur+Math.max(-h.turn*Core.DT,Math.min(h.turn*Core.DT,turn))+Math.sin(s.time*7.3)*h.wobble*Core.DT*6;
   const r=Math.hypot(input.aimX-p.x,input.aimY-p.y)||100;input.aimX=p.x+Math.cos(human.angle)*r;input.aimY=p.y+Math.sin(human.angle)*r;if(react&&target)input.fire=false;}
  Core.step(s,input);if(s.stage!==lastStage){records.push({stage:s.stage,time:+s.time.toFixed(1),health:+p.health.toFixed(0),kills:s.stats.kills});lastStage=s.stage;nav=[];}
  if(options.trace)for(const ev of s.events)if(ev.type==='damage')options.trace(s,ev);
  s.events=[];
 }
 const out={mission,difficulty,completed:s.completed,dead:s.dead,stage:s.stage,time:+s.time.toFixed(1),health:+s.player.health.toFixed(0),kills:s.stats.kills,credits:s.stats.credits,records,position:{x:Math.round(s.player.x),y:Math.round(s.player.y)},remaining:s.enemies.filter(e=>!e.dead).length};
 return {s,out};
}
// Default replay: THE CRASH on its three original tiers, then every later operation on standard with the modest upgrades a player owns by then.
const PLAN=[['crash','story'],['crash','standard'],['crash','intense'],['ruins','standard'],['kestrel','standard'],['underground','standard'],['convoy','standard',{upgrades:{plating:1,medic:1}}],['meridian','standard',{upgrades:{plating:1,medic:1}}]];
if(require.main===module){const plan=process.argv[2]?[[process.argv[2],process.argv[3]||'standard']]:PLAN;
 for(const [mission,difficulty,profile] of plan){const {s,out}=run(difficulty,null,mission,{profile});console.log(JSON.stringify({mission:out.mission,difficulty,completed:out.completed,time:out.time,health:out.health,kills:out.kills,credits:out.credits}));assert(s.completed,`${mission} ${difficulty} must complete with normal control packets`);}
 // Insane is a skill tier: a player who fights in the open with human reaction and aim limits does not survive it.
 if(!process.argv[2])for(const mission of ['crash','ruins','kestrel']){const {s,out}=run('insane',null,mission,{human:{react:.3,turn:5,wobble:.5}});console.log(JSON.stringify({mission,difficulty:'insane',openField:true,dead:out.dead,time:out.time}));assert(s.dead,`${mission} insane must punish open-field play`);}
 console.log('Campaign replays completed through actual combat, collision, checkpoints, director and extraction.');}
module.exports={run,pathTo,LOADOUTS};

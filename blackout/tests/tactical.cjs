'use strict';
// A cover-using player model for INSANE. Human-limited aim (reaction delay, finite turn rate, wobble) and ordinary control
// packets only. It peeks one target at a time, breaks line of sight whenever an attack telegraph lights up or it is outnumbered,
// and reloads/heals out of sight. If this model wins while the open-field model dies, the tier rewards cover, not luck.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),{pathTo,LOADOUTS}=require('./walkthrough.cjs');
const A=World.archetypes,TILE=32;
function safeTile(s,threats,radius=7){const p=s.player,W=Math.ceil(s.map.width/TILE),sx=Math.floor(p.x/TILE),sy=Math.floor(p.y/TILE);let best=null,bd=Infinity;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=(sx+dx)*TILE+16,y=(sy+dy)*TILE+16,d=Math.hypot(dx,dy);if(d>radius||d>=bd||!Core.clearAt(s,x,y,18))continue;const q={x,y};
    if(threats.some(e=>[[0,0],[16,0],[-16,0],[0,16],[0,-16]].some(([ox,oy])=>Core.lineOfSight(s,e,{x:x+ox,y:y+oy}))))continue;if(Math.hypot(x-p.x,y-p.y)>40&&!pathTo(s,q).length)continue;best=q;bd=d;}
  return best;}
function run(difficulty='insane',mission='crash',options={}){const human=options.human||{react:.3,turn:5,wobble:.5},loadout=mission==='crash'?undefined:LOADOUTS[mission];
  const s=Core.create({difficulty,mission,loadout,owned:Object.keys(World.weapons),profile:options.profile});let nav=[],navKey='',hide=null,aim=null,seenId='',seenAt=0;const limit=options.limit||90000;let decided=-99;
  for(let i=0;i<limit&&!s.completed&&!s.dead;i++){const p=s.player,st=Core.stageDef(s),must=st.kind==='clear';
    const known=s.enemies.filter(e=>!e.dead&&!(e.gone>0)&&e.active&&Core.eligible(s,e)&&Core.distance(e,p)<1500);
    const threats=known.filter(e=>Core.lineOfSight(s,p,e)&&Core.distance(e,p)<(A[e.type].sight||740)+80);
    const target=threats.find(e=>e.id===seenId)||threats.sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0];
    const winding=threats.some(e=>e.attack>0&&e.attackAge>e.attack*.35||e.burst>0||A[e.type].melee&&Core.distance(e,p)<150);
    const nade=s.grenades.find(g=>g.enemy&&Core.distance(g,p)<170)||known.find(e=>e.attack>0&&A[e.type].locked&&Core.distance(e,p)<1200);
    const gun=p.slots[p.slot],low=p.ammo[gun]<Math.max(3,World.weapons[gun].capacity*.25);
    const danger=nade||winding||threats.length>=3||threats.length===2&&p.health<70||p.health<35||low&&threats.length;
    const input={};let goal=null;
    if(danger&&(i-decided>20||!hide)){hide=safeTile(s,known)||safeTile(s,threats)||safeTile(s,threats,11);decided=i;}
    if(!danger)hide=null;
    const shot=threats.find(e=>e.attack>0&&e.attackAge>e.attack*.75);if(danger&&shot&&p.stamina>40&&!p.reload)input.roll=true;
    const sniper=threats.find(e=>e.attack>0&&A[e.type].locked&&e.attackAge>e.attack*.55);
    const live=s.grenades.find(g=>g.enemy&&Core.distance(g,p)<190);
    if(live){const a=Math.atan2(p.y-live.y,p.x-live.x);let best=null;for(let k=-3;k<=3;k++){const q={x:p.x+Math.cos(a+k*.45)*120,y:p.y+Math.sin(a+k*.45)*120};if(Core.clearAt(s,q.x,q.y,17)&&Core.distance(q,live)>Core.distance(p,live)){best=q;break;}}if(best){hide=null;goal=best;input.sprint=true;}}
    else if(hide){goal=hide;input.sprint=true;}
    else if(target){input.aiming=true;input.fire=true;}
    else{const prop=st.kind==='destroy'?s.walls.filter(w=>w.kind===st.targets&&!w.dead).sort((a,b)=>Core.distance(p,{x:a.x+a.w/2,y:a.y+a.h/2})-Core.distance(p,{x:b.x+b.w/2,y:b.y+b.h/2}))[0]:null;
      const hunt=known.filter(e=>must&&e.zone===st.zone||e.spawned||A[e.type].boss).sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0]||(must?s.enemies.filter(e=>!e.dead&&e.zone===st.zone).sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0]:null);
      if(prop&&Core.distance(p,{x:prop.x+prop.w/2,y:prop.y+prop.h/2})<300){input.fire=true;input.aimX=prop.x+prop.w/2;input.aimY=prop.y+prop.h/2;}
      if(p.health<70&&p.stims>0&&p.heal<=0)input.gadget=true;else if(low||p.ammo[gun]<World.weapons[gun].capacity)input.reload=true;
      if(!input.reload&&!(p.heal>0))goal=hunt||(prop?{x:prop.x+prop.w/2,y:prop.y+prop.h/2}:st.kind==='destroy'?s.goal:st);
      if(st.kind==='survive'&&Core.distance(p,st)<160&&!hunt)goal=null;
      const med=p.health<65&&s.pickups.filter(q=>!q.taken&&(q.type==='health'||p.armor<20&&q.type==='armor')&&Core.distance(q,p)<700).sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0];if(med&&!(p.heal>0))goal=med;
      if((st.kind==='clear'||st.kind==='extract')&&!hunt&&Core.distance(p,st)<80&&i%20===0)input.interact=true;}
    if(goal){const k=Math.round(goal.x/64)+':'+Math.round(goal.y/64)+':'+s.stage;if(k!==navKey||i%60===0){nav=pathTo(s,goal);navKey=k;}while(nav.length&&Core.distance(p,nav[0])<16)nav.shift();if(nav[0]){const dx=nav[0].x-p.x,dy=nav[0].y-p.y,l=Math.hypot(dx,dy);input.mx=dx/l;input.my=dy/l;}}
    if(sniper){const a=Math.atan2(sniper.y-p.y,sniper.x-p.x)+Math.PI/2,side=Core.clearAt(s,p.x+Math.cos(a)*60,p.y+Math.sin(a)*60,16)?1:-1;input.mx=Math.cos(a)*side;input.my=Math.sin(a)*side;input.roll=p.stamina>30;}
    if(input.mx||input.my){const l=Math.hypot(input.mx,input.my),ax=p.x+input.mx/l*34,ay=p.y+input.my/l*34;if(!s.hazards.some(h=>Core.circleBox(p.x,p.y,18,h))&&s.hazards.some(h=>Core.circleBox(ax,ay,20,h)&&(h.on||((s.time+.35+h.phase)%h.period)<h.period*h.duty))){input.mx=0;input.my=0;}}
    if(target&&p.grenades>0&&(threats.length>=2||A[target.type].front||A[target.type].boss)&&Core.distance(target,p)>170&&Core.distance(target,p)<370&&i%90===0)input.grenade=true;
    if(target&&p.tacticals>0&&i%150===0&&(p.tactical==='flash'&&threats.length>=2||p.tactical==='emp'&&(A[target.type].machine||A[target.type].barrier)||p.tactical==='smoke'&&threats.length>=2))input.tactical=true;
    const armoured=target&&A[target.type].armor,wantSlot=armoured&&World.weapons[p.slots[1]].explosive&&p.ammo[p.slots[1]]+p.reserve[p.slots[1]]>0?1:0;if(wantSlot!==p.slot&&!p.reload)input.slot=wantSlot;
    const want=target?{x:target.x,y:target.y}:input.aimX!==undefined?{x:input.aimX,y:input.aimY}:nav[0]||{x:p.x+Math.cos(p.angle)*100,y:p.y+Math.sin(p.angle)*100};
    if((target?.id||'')!==seenId){seenId=target?.id||'';seenAt=s.time;}if(s.time-seenAt<human.react&&target)input.fire=false;
    const wa=Math.atan2(want.y-p.y,want.x-p.x),cur=aim??wa,turn=Math.atan2(Math.sin(wa-cur),Math.cos(wa-cur));aim=cur+Math.max(-human.turn*Core.DT,Math.min(human.turn*Core.DT,turn))+Math.sin(s.time*7.3)*human.wobble*Core.DT*6;
    input.aimX=p.x+Math.cos(aim)*300;input.aimY=p.y+Math.sin(aim)*300;if(target&&Math.abs(turn)>.25)input.fire=false;
    Core.step(s,input);s.events=[];}
  return {s,out:{mission,difficulty,completed:s.completed,dead:s.dead,stage:s.stage,time:+s.time.toFixed(1),health:+s.player.health.toFixed(0),kills:s.stats.kills,damage:Math.round(s.stats.damage)}};}
if(require.main===module){const mission=process.argv[2]||'crash',difficulty=process.argv[3]||'insane';const {out}=run(difficulty,mission);console.log(JSON.stringify(out));assert(out.completed,`${mission} ${difficulty} must be winnable with cover play`);}
module.exports={run};

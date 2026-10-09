'use strict';
const assert=require('node:assert/strict'),Core=require('../core.js');
const TILE=32;
function pathTo(s,target){const W=Math.ceil(s.map.width/TILE),H=Math.ceil(s.map.height/TILE),key=(x,y)=>y*W+x;
 const signature=s.walls.filter(w=>w.dead).map(w=>w.id).join(',');if(!s._nav||s._nav.signature!==signature){const blocked=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)blocked[key(x,y)]=!Core.clearAt(s,x*TILE+16,y*TILE+16,20);s._nav={blocked,signature};}const blocked=s._nav.blocked;
 const sx=Math.floor(s.player.x/TILE),sy=Math.floor(s.player.y/TILE);let gx=Math.floor(target.x/TILE),gy=Math.floor(target.y/TILE);if(blocked[key(gx,gy)]){let best=Infinity;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=gx+dx,y=gy+dy;if(x<1||y<1||x>=W-1||y>=H-1||blocked[key(x,y)])continue;const d=(x*TILE+16-target.x)**2+(y*TILE+16-target.y)**2;if(d<best){best=d;s._nearest={x,y};}}if(!s._nearest)return [];gx=s._nearest.x;gy=s._nearest.y;}
 const start=key(sx,sy),goal=key(gx,gy),open=[{id:start,x:sx,y:sy,g:0,f:0}],cost=new Map([[start,0]]),parent=new Map(),visited=new Set();
 while(open.length){open.sort((a,b)=>b.f-a.f);const n=open.pop();if(visited.has(n.id))continue;visited.add(n.id);if(n.id===goal){let id=goal;const path=[];while(id!==start){path.push({x:(id%W)*TILE+16,y:Math.floor(id/W)*TILE+16});id=parent.get(id);if(id===undefined)return [];}return path.reverse();}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,y=n.y+dy,id=key(x,y);if(x<1||y<1||x>=W-1||y>=H-1||blocked[id]||dx&&dy&&(blocked[key(n.x+dx,n.y)]||blocked[key(n.x,n.y+dy)]))continue;const g=n.g+(dx&&dy?1.414:1);if(g>=(cost.get(id)??Infinity))continue;cost.set(id,g);parent.set(id,n.id);open.push({id,x,y,g,f:g+Math.hypot(x-gx,y-gy)});}
 }return [];
}
function run(difficulty='standard',checkpoint=null){const s=Core.create({difficulty,checkpoint});let nav=[],lastTarget='',lastStage=s.stage;const records=[];
 for(let i=0;i<72000&&!s.completed&&!s.dead;i++){
  const p=s.player,alive=s.enemies.filter(e=>!e.dead&&e.zone<=Math.min(s.stage,2)),target=alive.sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0],obj=s.map.objectives[Math.min(s.stage,4)],dest=target||obj,dist=Core.distance(p,dest),los=Core.lineOfSight(s,p,dest),key=target?.id||'obj'+s.stage;
  if(key!==lastTarget||i%90===0||s.stage!==lastStage){nav=pathTo(s,dest);lastTarget=key;}
  const input={aimX:dest.x,aimY:dest.y,fire:!!target&&los&&dist<800,reload:p.ammo[p.slots[p.slot]]===0||!target&&p.ammo[p.slots[p.slot]]<15,gadget:p.health<60&&p.heal<=0,grenade:!!target&&los&&dist>170&&dist<365&&p.grenades>0&&i%180===0&&(target.type==='shield'||target.type==='commander'),interact:!target&&dist<80&&i%20===0,melee:!!target&&dist<70&&i%60===0};
  if(target&&los&&dist<480&&dist>150){const angle=Math.atan2(target.y-p.y,target.x-p.x),side=(Math.floor(i/260)%2?1:-1);input.mx=-Math.sin(angle)*side;input.my=Math.cos(angle)*side;input.aiming=true;input.roll=target.attack>0&&target.attackAge>target.attack*.7&&i%20===0;}
  else{while(nav.length&&Core.distance(p,nav[0])<18)nav.shift();if(nav[0]){const dx=nav[0].x-p.x,dy=nav[0].y-p.y,len=Math.hypot(dx,dy);input.mx=dx/len;input.my=dy/len;input.sprint=!target;}}
  Core.step(s,input);if(s.stage!==lastStage){records.push({stage:s.stage,time:s.time,health:p.health,kills:s.stats.kills});lastStage=s.stage;nav=[];}
  s.events=[];
 }
 const out={difficulty,completed:s.completed,dead:s.dead,stage:s.stage,time:s.time,health:s.player.health,kills:s.stats.kills,records,position:{x:s.player.x,y:s.player.y},remaining:s.enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,hp:e.hp})),ammo:s.player.ammo,reserve:s.player.reserve};
 return {s,out};
}
if(require.main===module){for(const difficulty of ['story','standard','intense']){const {s,out}=run(difficulty);console.log(JSON.stringify(out,null,2));assert(s.completed,`${difficulty} campaign must complete with normal control packets`);}console.log('All three campaign difficulties completed through actual combat, collision, checkpoints, director and extraction.');}
module.exports={run,pathTo};

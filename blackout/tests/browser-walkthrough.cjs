'use strict';
const assert=require('node:assert/strict'),Core=require('../core.js'),{pathTo}=require('./walkthrough.cjs');
// Reads cloned diagnostics and drives only normal keyboard/mouse events.
// It never assigns to the live simulation, kills an enemy or bypasses collision.
async function play(page,onScreenshot){let nav=[],lastTarget='',held=new Set(),firing=false,iteration=0;const started=Date.now();let outcome;
 while(Date.now()-started<180000){const snap=await page.evaluate(()=>BPApp.inspect());if(snap.mode==='complete'){outcome=snap;break;}if(snap.mode!=='playing'){console.log('Failed live route',JSON.stringify({stage:snap.world.stage,p:snap.world.player,kills:snap.world.stats.kills,time:snap.world.time}));await onScreenshot?.('route-failure');}assert.equal(snap.mode,'playing','Live campaign must remain playable');const s=snap.world,p=s.player,st=s.map.stages[Math.min(s.stage,s.map.stages.length-1)],alive=s.enemies.filter(e=>!e.dead&&(e.zone<=st.zone||e.woke||e.spawned)),target=alive.sort((a,b)=>Core.distance(a,p)-Core.distance(b,p))[0],obj=st,dest=target||obj,dist=Core.distance(p,dest),los=Core.lineOfSight(s,p,dest),key=target?.id||'obj'+s.stage;
  if(key!==lastTarget||iteration%8===0){nav=pathTo(s,dest);lastTarget=key;}
  let mx=0,my=0,sprint=false;
  if(target&&los&&dist<440&&dist>140){const angle=Math.atan2(target.y-p.y,target.x-p.x),side=Math.floor(iteration/24)%2?1:-1;mx=-Math.sin(angle)*side;my=Math.cos(angle)*side;}
  else{while(nav.length&&Core.distance(p,nav[0])<14)nav.shift();if(nav[0]){mx=nav[0].x-p.x;my=nav[0].y-p.y;sprint=!target;}}
  const desired=new Set();if(mx>4||mx>.25&&Math.abs(mx)<=1)desired.add('KeyD');if(mx<-4||mx<-.25&&Math.abs(mx)<=1)desired.add('KeyA');if(my>4||my>.25&&Math.abs(my)<=1)desired.add('KeyS');if(my<-4||my<-.25&&Math.abs(my)<=1)desired.add('KeyW');if(sprint)desired.add('ShiftLeft');
  for(const code of held)if(!desired.has(code))await page.keyboard.up(code);for(const code of desired)if(!held.has(code))await page.keyboard.down(code);held=desired;
  const c=snap.camera,x=(dest.x-c.scrollX)*c.zoom+c.width*(1-c.zoom)*c.originX,y=(dest.y-c.scrollY)*c.zoom+c.height*(1-c.zoom)*c.originY;
  await page.mouse.move(Math.max(2,Math.min(c.width-2,x)),Math.max(65,Math.min(c.height-25,y)));
  const fire=!!target&&los&&dist<800;if(fire&&!firing){await page.mouse.down();firing=true;}else if(!fire&&firing){await page.mouse.up();firing=false;}
  if(p.ammo[p.slots[p.slot]]===0||!target&&p.ammo[p.slots[p.slot]]<15)await page.keyboard.press('KeyR');if(p.health<65&&p.heal<=0&&p.stims>0)await page.keyboard.press('KeyQ');if(!target&&dist<83)await page.keyboard.press('KeyE');if(target&&dist<70&&iteration%5===0)await page.keyboard.press('KeyF');if(target&&los&&dist>170&&dist<365&&p.grenades>0&&iteration%18===0&&(target.type==='shield'||target.type==='commander'))await page.keyboard.press('KeyG');
  if(iteration%100===0)console.log('Live route',s.stage,s.time.toFixed(1),'health',p.health.toFixed(0),'kills',s.stats.kills,'target',key,'position',p.x.toFixed(0),p.y.toFixed(0));if(s.stage===3&&iteration%20===0)await onScreenshot?.('extraction');await page.waitForTimeout(90);iteration++;
 }
 for(const code of held)await page.keyboard.up(code);if(firing)await page.mouse.up();assert(outcome,'Campaign must reach its ending using keyboard and mouse');assert(outcome.world.completed);console.log(`Live browser campaign: ${outcome.world.time.toFixed(1)} simulation seconds, ${outcome.world.stats.kills} kills, ${iteration} control observations.`);return outcome;
}
module.exports={play};

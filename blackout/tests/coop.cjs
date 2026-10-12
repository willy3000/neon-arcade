'use strict';
const assert=require('node:assert/strict'),Core=require('../core.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
function range(guest){const s=Core.create({training:true,guest:guest||{}});s.enemies=[];s.events=[];return s;}
const dummy=(s,extra={})=>({id:'target',x:650,y:625,radius:16,hp:70,maxHp:70,angle:0,type:'infantry',dead:false,zone:0,active:false,seen:0,cooldown:100,stagger:0,reload:0,vx:0,vy:0,...extra});
function ticks(s,n,input={}){for(let i=0;i<n;i++)Core.step(s,typeof input==='function'?input(i):input);return s;}

test('a guest is created alongside the player, with its own position and starter loadout',()=>{
  const s=range();
  assert.ok(s.guest);assert.equal(s.guest.dead,false);assert.deepEqual(s.guest.slots,['rifle','pistol']);
  assert.ok(Math.hypot(s.guest.x-s.player.x,s.guest.y-s.player.y)>10,'guest should not spawn on top of the player');
});
test('no guest is created when options.guest is omitted (solo path unaffected)',()=>{
  const s=Core.create({training:true});assert.equal(s.guest,undefined);
});
test('guest moves, aims, fires and reloads independently of the player',()=>{
  const s=range();
  ticks(s,30,{guest:{mx:1}});
  assert(s.guest.vx>60,'guest should have accelerated right');
  assert.equal(s.player.vx,0,'player should not move from guest-only input');
  const before=s.guest.ammo.rifle;
  ticks(s,1,{guest:{fire:true,aimX:1550,aimY:s.guest.y}});
  assert(s.guest.ammo.rifle<before,'firing should decrement the GUEST ammo');
  assert.equal(s.player.ammo.rifle,30,'firing as guest must not touch player ammo');
  for(let i=0;i<before;i++)ticks(s,1,{guest:{fire:true,aimX:1550,aimY:s.guest.y}});
  ticks(s,1,{guest:{reload:true}});
  assert(s.guest.reload>0,'empty guest weapon should start reloading on request');
});
test('guest can melee and the hit sweep damages enemies, not the player\'s stats',()=>{
  const s=range();s.enemies=[dummy(s,{x:s.guest.x+40,y:s.guest.y,angle:Math.PI})];
  ticks(s,1,{guest:{aimX:s.guest.x+100,aimY:s.guest.y,melee:true}});
  ticks(s,20,{});
  assert(s.enemies[0].hp<70,'guest melee should have damaged the dummy enemy');
});
test('an enemy targets whichever of player/guest is closer',()=>{
  const s=range();
  s.guest.x=s.player.x+500;s.guest.y=s.player.y;
  const e=dummy(s,{x:s.guest.x+30,y:s.guest.y});s.enemies=[e];
  ticks(s,1,{});
  assert.equal(s.enemies[0].lastX,s.guest.x,'enemy should have locked onto the nearer guest, not the distant player');
});
test('guest death sets s.guest.dead, never s.dead, and stops the guest acting',()=>{
  // damageGuest isn't exported directly; drive it the way the real game would, via an exploding grenade at the guest's feet.
  // A single overwhelming blast avoids the post-hit iframes window (which would block a same-tick second hit); radius
  // is kept under the player/guest spawn offset (~40px) so it doesn't also catch the player standing nearby.
  const s=range();Core.explode(s,s.guest.x,s.guest.y,30,500,false,'test');
  assert.equal(s.guest.dead,true,'a lethal nearby explosion should down the guest');
  assert.equal(s.dead,false,'a downed guest must never end the host\'s run');
  const beforeX=s.guest.x;ticks(s,30,{guest:{mx:1,fire:true}});
  assert.equal(s.guest.x,beforeX,'a downed guest should not respond to input');
});
test('determinism holds with a guest configured: two sims given the same seed and inputs stay identical',()=>{
  const a=range(),b=range();
  const inputs=i=>({mx:i<180?1:-1,fire:i%5===0,aimX:1550,aimY:620,guest:{mx:i%100>50?1:-1,fire:i%7===0,aimX:1500,aimY:600,melee:i%40===0}});
  ticks(a,300,inputs);ticks(b,300,inputs);
  assert.deepEqual(a,b,'stepGuest must introduce no non-determinism');
});
test('a guest can pick up a nearby health pack when closer than the player',()=>{
  const s=range();s.guest.health=40;s.player.health=100;
  s.pickups=[{id:'hp1',x:s.guest.x+10,y:s.guest.y,type:'health',taken:false}];
  ticks(s,1,{});
  assert.equal(s.guest.health,70,'guest should have healed from the pack it was standing on');
});
// ---- Downed operators, dog tags and the revive station ----
const kill=(s,op)=>Core.explode(s,op.x,op.y,30,500,false,'test'),HOLD=Math.ceil(Core.REVIVE_TIME/Core.DT)+2;
test('a co-op run gets a revive station: open ground, reachable, a short run from the start',()=>{
  const s=range();assert.ok(s.station,'co-op runs have a station');
  assert.ok(Core.clearAt(s,s.station.x,s.station.y,40),'the station stands on open ground');
  const d=Math.hypot(s.station.x-s.player.x,s.station.y-s.player.y);assert(d>150&&d<900,'neither on top of the start nor across the map, got '+d.toFixed(0));
  assert.equal(Core.create({training:true}).station,null,'solo runs have none');
});
test('the host going down no longer ends the run: Rook drops tags and the squadmate fights on',()=>{
  const s=range();s.guest.x=s.player.x+400;kill(s,s.player);
  assert.equal(s.player.dead,true);assert.equal(s.dead,false,'the run continues while the squadmate is alive');
  assert.deepEqual(s.tags.map(t=>[t.owner,t.carrier]),[['player',null]],'Rook leaves dog tags where he fell');
  assert.ok(s.events.some(e=>e.type==='down'&&e.who==='player'));assert.ok(!s.events.some(e=>e.type==='death'),'no run-over event');
  const px=s.player.x,ammo=s.player.ammo.rifle;ticks(s,30,{mx:1,fire:true,aimX:1500,aimY:600,guest:{mx:1}});
  assert.equal(s.player.x,px,'a downed Rook does not move');assert.equal(s.player.ammo.rifle,ammo,'or fire');assert(s.guest.vx>60,'the squadmate still has control');
  const hp=s.player.health;Core.damagePlayer(s,50,0,0);assert.equal(s.player.health,hp,'a downed operator takes no further damage');
});
test('hostiles hunt the surviving squadmate while Rook is down',()=>{
  const s=range();s.guest.x=s.player.x+500;kill(s,s.player);
  const e=dummy(s,{x:s.player.x+30,y:s.player.y});s.enemies=[e];ticks(s,1,{});
  assert.equal(s.enemies[0].lastX,s.guest.x,'the enemy beside the body turns on the living operator instead');
});
test('carrying the tags to the revive station brings the operator back',()=>{
  const s=range();s.guest.x=s.player.x+400;kill(s,s.player);const tag=s.tags[0];s.events=[];
  s.guest.x=tag.x+10;s.guest.y=tag.y;ticks(s,1,{});
  assert.equal(s.tags[0].carrier,'guest','walking over the tags picks them up');assert.ok(s.events.some(e=>e.type==='tags'&&e.by==='guest'));
  assert.equal(s.player.dead,true,'holding the tags is not enough');
  s.guest.x=s.station.x+20;s.guest.y=s.station.y;ticks(s,240,{});
  assert.equal(s.player.dead,true,'standing on the pad does nothing by itself');assert.equal(s.tags[0].progress,0);
  ticks(s,HOLD>>1,{guest:{interactDown:true}});const half=s.tags[0].progress;
  assert(half>.45&&half<.55,'holding interact fills the station at a steady rate, got '+half);assert.equal(s.player.dead,true,'and half way is not enough');assert.ok(s.events.some(e=>e.type==='reviving'));
  ticks(s,60,{});assert(s.tags[0].progress<half-.15,'letting go drains the progress');
  ticks(s,30,{guest:{interactDown:true}});const kept=s.tags[0].progress;s.guest.x=s.station.x+200;ticks(s,30,{guest:{interactDown:true}});assert(s.tags[0].progress<kept,'so does stepping off the pad, even while holding');
  s.guest.x=s.station.x+20;ticks(s,HOLD,{guest:{interactDown:true}});
  assert.equal(s.player.dead,false,'a full '+Core.REVIVE_TIME+' second hold revives Rook');assert.equal(s.tags.length,0);assert(s.player.health>0&&s.player.health<100,'with part of his health');
  assert(Math.hypot(s.player.x-s.station.x,s.player.y-s.station.y)<=60,'standing at the station');assert.ok(s.events.some(e=>e.type==='revive'&&e.who==='player'));
  ticks(s,40,{mx:1});assert(s.player.vx>60,'and back under control');
});
test('it works the other way round: the host revives the guest',()=>{
  const s=range();s.guest.x=s.player.x+400;const where={x:s.guest.x,y:s.guest.y};kill(s,s.guest);
  assert.equal(s.guest.dead,true);assert.equal(s.dead,false);assert.equal(s.tags[0].owner,'guest');
  s.player.x=where.x;s.player.y=where.y+12;ticks(s,1,{});assert.equal(s.tags[0].carrier,'player');
  s.player.x=s.station.x;s.player.y=s.station.y+24;ticks(s,HOLD,{guest:{interactDown:true}});assert.equal(s.guest.dead,true,'only the carrier holding interact counts');
  ticks(s,HOLD,{interactDown:true});assert.equal(s.guest.dead,false);
  ticks(s,40,{guest:{mx:1}});assert(s.guest.vx>60,'the revived guest responds to input again');
});
test('losing both operators ends the run, and a solo death still ends it at once',()=>{
  const s=range();s.guest.x=s.player.x+400;kill(s,s.player);assert.equal(s.dead,false);kill(s,s.guest);
  assert.equal(s.dead,true,'squad wipe');assert.ok(s.events.some(e=>e.type==='death'));
  const solo=Core.create({training:true});solo.enemies=[];Core.damagePlayer(solo,500,0,0);assert.equal(solo.dead,true);assert.equal(solo.tags.length,0);
});
test('determinism holds through a down and a revive',()=>{
  const run=()=>{const s=range();s.guest.x=s.player.x+400;kill(s,s.player);ticks(s,60,i=>({guest:{mx:i%20<10?1:-1,fire:i%6===0,aimX:1500,aimY:600}}));s.guest.x=s.tags[0].x;s.guest.y=s.tags[0].y;ticks(s,2,{});s.guest.x=s.station.x;s.guest.y=s.station.y;ticks(s,HOLD,{guest:{interactDown:true}});ticks(s,90,i=>({mx:1,guest:{my:1}}));if(s.player.dead)throw new Error('not revived');return s;};
  assert.deepEqual(run(),run());
});
console.log(`${passed} co-op checks passed.`);

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
console.log(`${passed} co-op checks passed.`);

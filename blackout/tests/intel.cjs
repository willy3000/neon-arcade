'use strict';
// Intel: the armory's file on every hostile. The data must match what the game really spawns, sightings and kills must
// be recorded by the rules the files promise, and a completed file must pay exactly once.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
const A=World.archetypes,I=World.intel;let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};

test('every hostile that can be met has a file, graded on the armory scale, and nothing else does',()=>{
  const spawnable=new Set();for(const m of World.missions)for(const d of ['story','standard','insane']){const s=Core.create({mission:m.id,difficulty:d});for(const e of s.enemies)spawnable.add(e.type);for(const st of s.map.stages){if(st.boss)spawnable.add(st.boss.type);for(const w of st.waves||[])for(const e of w.entries||[])spawnable.add(e.type);}}
  for(const [type] of Core.HORDE)spawnable.add(type);for(const b of Core.BOSSES)spawnable.add(b);spawnable.add('turret');
  assert.deepEqual(Object.keys(I).sort(),[...spawnable].sort());
  for(const [k,t] of Object.entries(I)){assert(A[k],k);assert([1,2,3,4,5].includes(t.tier),k);assert(t.role&&t.desc&&t.weak,k);assert.equal(t.tier===5,!!A[k].boss,k+': red is for bosses');}
  assert.deepEqual([1,2,3,4,5].map(n=>Meta.INTEL_KEYS.filter(k=>I[k].tier===n).length).every(n=>n>0),true,'every grade has hostiles in it');});

test("each file's 'met in' is where the game really sends that hostile",()=>{
  const at=(id,d)=>{const s=Core.create({mission:id,difficulty:d}),t=new Set(s.enemies.map(e=>e.type));for(const st of s.map.stages){if(st.boss)t.add(st.boss.type);for(const w of st.waves||[])for(const e of w.entries||[])if(!e.min||d==='insane')t.add(e.type);}return t;};
  for(const m of World.missions){const std=at(m.id,'standard'),ins=at(m.id,'insane');
    for(const k of Object.keys(I)){const t=I[k];assert.equal(t.ops.includes(m.id),std.has(k),k+' in '+m.id);assert.equal(!!t.insane?.includes(m.id),ins.has(k)&&!std.has(k),k+' insane in '+m.id);}}
  for(const [type,,wave] of Core.HORDE)assert.equal(I[type].wave,wave,type+' joins holdout on wave '+wave);
  for(const b of Core.BOSSES){const first=[5,10,15,20,25].find(n=>Core.bossesFor(n).includes(b));assert.equal(I[b].wave,first,b+' red wave');}
  assert.equal(I.apc.wave,0,'the Bulwark is a campaign boss only');});

test('a hostile in plain view is sighted once a run; one behind a wall or a cloaked one far off is not',()=>{
  const s=Core.create({mission:'holdout',seed:2});s.director.timer=1e9;s.enemies=[];const p=s.player;
  const put=(type,dx,dy,extra={})=>{const e={id:type+dx,type,x:p.x+dx,y:p.y+dy,radius:17,hp:100,maxHp:100,angle:0,dead:false,zone:0,active:true,seen:0,cooldown:99,stagger:0,reload:0,vx:0,vy:0,spawned:true,attack:0,attackAge:0,...extra};s.enemies.push(e);return e;};
  const free=(d)=>[[d,0],[-d,0],[0,d],[0,-d]].find(([x,y])=>Core.clearAt(s,p.x+x,p.y+y,20)&&Core.lineOfSight(s,p,{x:p.x+x,y:p.y+y}));
  const [x,y]=free(200);put('scout',x,y);put('ghost',x*2.4,y*2.4);put('medic',2400,0);
  const seen=[];for(let i=0;i<40;i++){Core.step(s,{});for(const e of s.events)if(e.type==='sighted')seen.push(e.enemy);s.events.length=0;for(const e of s.enemies){e.cooldown=99;e.attack=0;}}
  assert.deepEqual(seen,['scout'],'only the scout in plain view: '+seen);
  put('scout',x*.5,y*.5);for(let i=0;i<30;i++){Core.step(s,{});for(const e of s.events)assert.notEqual(e.type==='sighted'&&e.enemy,'scout','once a run');s.events.length=0;}
  const tdm=Core.create({mode:'tdm',mission:'holdout',squad:[{team:0},{team:1,bot:true}]});for(let i=0;i<60;i++){Core.step(tdm,{});assert(!tdm.events.some(e=>e.type==='sighted'));tdm.events.length=0;}});

test('sightings and kills fill a file step by step, and a completed file pays once',()=>{
  const save=Save.defaults(),k='grenadier',goal=Meta.INTEL_GOAL[I[k].tier];assert.equal(Meta.intelOf(save,k).level,0);
  assert.equal(Meta.intelSight(save,k),true);assert.equal(Meta.intelSight(save,k),false);assert.equal(Meta.intelOf(save,k).label,'SIGHTED');
  const first=Meta.intelKill(save,k);assert.equal(first.studied,true);assert.equal(Meta.intelOf(save,k).level,2);
  const c0=save.credits;let paid=0;for(let i=1;i<goal+5;i++)paid+=Meta.intelKill(save,k).pay;assert.equal(paid,Meta.INTEL_PAY[I[k].tier]);assert.equal(save.credits-c0,paid);assert.equal(Meta.intelOf(save,k).level,3);
  const boss=Save.defaults();Meta.intelKill(boss,'tank');const r=Meta.intelKill(boss,'tank');assert.equal(r.complete,true,'two kills complete a boss file');assert.equal(r.pay,750);
  assert.equal(Meta.intelKill(save,'operator'),null,'team deathmatch operators have no file');
  assert.deepEqual(Meta.intelSummary(save),{total:25,seen:1,studied:1,complete:1});});

test('intel survives a save round trip, and a hand-edited file cannot be paid twice',()=>{
  const save=Save.defaults();for(let i=0;i<10;i++)Meta.intelKill(save,'grenadier');Meta.intelSight(save,'tank');save.intelInit=1;
  const back=Save.decode(JSON.stringify(save));assert.deepEqual(back.intel.grenadier,{seen:1,kills:10,paid:1});assert.deepEqual(back.intel.tank,{seen:1,kills:0,paid:0});assert.equal(back.intelInit,1);
  const forged=Save.decode(JSON.stringify({version:3,intel:{grenadier:{seen:1,kills:0,paid:1},rifle:{kills:5},tank:{kills:'9e99'}}}));assert.deepEqual(forged.intel.grenadier,{seen:1,kills:0,paid:0});assert.equal(forged.intel.rifle,undefined);assert(forged.intel.tank.kills<=1e6);
  const old=Save.decode(JSON.stringify({version:3,credits:7}));assert.deepEqual(old.intel,{});assert.equal(old.intelInit,0);});

test('a save from before intel starts with the files it has earned, once',()=>{
  const save=Save.decode(JSON.stringify({version:3,missions:{crash:{done:true,diffs:['standard']},kestrel:{done:true,diffs:['insane']}},holdout:{standard:6}}));
  const n=Meta.intelBackfill(save);assert(n>0);const lvl=k=>Meta.intelOf(save,k).level;
  for(const k of ['infantry','rusher','sniper','grenadier','shield','commander','drone','gunner','bomber','wraith','rocketeer','elite','scout','breacher','medic'])assert.equal(lvl(k),1,k);
  for(const k of ['mortar','heavy','ghost','jammer','tank','mech','apc'])assert.equal(lvl(k),0,k);
  assert.equal(Meta.intelOf(save,'infantry').kills,0,'sightings only');assert.equal(Meta.intelBackfill(save),0,'once');
  const fresh=Save.defaults();assert.equal(Meta.intelBackfill(fresh),0);assert.equal(Meta.intelSummary(fresh).seen,0);});

test('a real run of THE CRASH files sightings and kills by the events the game listens to',()=>{
  const save=Save.defaults(),{run}=require('./walkthrough.cjs');
  const {out}=run('standard',null,'crash',{onEvents:(s,events)=>{for(const e of events){if(e.type==='sighted')Meta.intelSight(save,e.enemy);if(e.type==='kill'&&e.by&&!e.bot)Meta.intelKill(save,e.enemy);}}});assert(out.completed);
  for(const k of ['infantry','rusher','sniper','grenadier','shield','commander'])assert(Meta.intelOf(save,k).level>=2,k+' studied after THE CRASH');
  const kills=Meta.INTEL_KEYS.reduce((n,k)=>n+Meta.intelOf(save,k).kills,0);assert.equal(kills,out.kills,'every kill is filed');});

console.log(passed+' intel checks passed.');

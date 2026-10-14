'use strict';
// Holdout's long game: waves that get smarter as well as bigger, new threats on a schedule, red waves with bosses, the
// legendary crate that answers them, the supply crates, and an AI partner that plays its own game. Everything here
// runs the real simulation headless.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js'),A=World.archetypes,W=World.weapons;
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const dummy=(extra={})=>({id:'target',x:0,y:0,radius:16,hp:70,maxHp:70,angle:0,hull:0,type:'infantry',dead:false,zone:0,active:false,seen:0,cooldown:100,stagger:0,reload:0,vx:0,vy:0,spawned:true,...extra});
const quiet=(o={})=>{const s=Core.create({mission:'holdout',seed:7,...o});s.director.timer=99999;s.enemies=[];s.events=[];return s;};
function ticks(s,n,input={}){for(let i=0;i<n;i++)Core.step(s,typeof input==='function'?input(i):input);return s;}
// Plays waves out with every hostile dropped the moment it joins the fight, keeping the operator alive.
function toWave(n,o={}){const s=Core.create({mission:'holdout',seed:1701,...o}),log=[];
  for(let i=0;i<120*60*40&&s.stats.wave<n;i++){s.player.health=100;Core.step(s,{});log.push(...s.events);s.events.length=0;for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,1e6,0,.1,'rifle',true,true);}
  return {s,log};}
// Somewhere at about "d" from a point with a clear view of it.
const inView=(s,from,d)=>[0,1,2,3,4,5,6,7].map(k=>({x:from.x+Math.cos(k*Math.PI/4)*d,y:from.y+Math.sin(k*Math.PI/4)*d})).find(q=>Core.clearAt(s,q.x,q.y,22)&&Core.lineOfSight(s,from,q));

// ---------- the waves ----------
test('the threat level climbs every three waves, sooner on harder pressure, and tightens the rules as it goes',()=>{
  const s=Core.create({mission:'holdout'}),at=(n,d='standard')=>Core.pressureFor({...s,difficulty:d},n);
  assert.deepEqual([1,3,4,7,10,13,19,40].map(n=>at(n).tier),[0,0,1,2,3,4,6,6]);assert.equal(at(1,'intense').tier,1);assert.equal(at(1,'story').tier,0);assert.equal(at(4,'story').tier,0);
  const early=at(1).D,late=at(16).D;assert(late.windup<early.windup&&late.spread<early.spread&&late.lead>early.lead,'quicker, steadier, leading the target');
  assert.equal(early.cover,false);assert.equal(at(4).D.cover,true,'cover from level I');assert(at(7).D.flank>0&&at(7).D.camp>0,'flankers and grenades for campers from level II');
  assert(at(10).D.suppress&&at(10).D.push&&at(10).D.burst>=1,'suppression and pressing reloads from level III');assert(at(13).D.flash&&at(13).D.hunt,'flashbangs and hunting from level IV');
  assert.equal(at(13).D.dmg,World.difficulties.standard.dmg,'what a hit does to you stays as the pressure set it');});
test('each new threat arrives on its own wave, is in it, and never before; the rank and file thin out',()=>{
  for(const seed of [1,2,3,4,5]){const s=Core.create({mission:'holdout',seed});
    for(let n=1;n<=16;n++){s.director.modifier=null;s.waveD=Core.pressureFor(s,n).D;const list=Core.composeWave(s,n),types=new Set(list.map(e=>e.type));
      for(const [type,,from] of Core.HORDE){if(from>n)assert(!types.has(type),`${type} on wave ${n}, before its wave ${from}`);if(from===n&&n>1)assert(types.has(type),`${type} missing from its first wave ${n}`);}}}
  const s=Core.create({mission:'holdout',seed:9}),share=n=>{let basic=0,all=0;for(let k=0;k<20;k++){const l=Core.composeWave(s,n);all+=l.length;basic+=l.filter(e=>['infantry','rusher'].includes(e.type)).length;}return basic/all;};
  assert(share(18)<share(2)*.5,'late waves are made of later threats');});
test('every fifth wave is red, with its boss: commander, Warden, tank, Wraith, then two at once',()=>{
  assert.deepEqual([5,10,15,20].map(n=>Core.bossesFor(n)),[['commander'],['mech'],['tank'],['wraith']]);assert.deepEqual(Core.bossesFor(4),[]);assert.equal(Core.bossesFor(25).length,2);
  const s=Core.create({mission:'holdout',seed:3});s.waveD=Core.pressureFor(s,10).D;const w=Core.composeWave(s,10),mech=w.find(e=>e.type==='mech');
  assert(mech&&mech.shieldMax>0&&mech.shieldHp===mech.shieldMax,'the holdout Warden carries a breakable barrier');assert(mech.pay<1,'and pays about what a commander does');
  const solo=Core.composeWave(s,15).find(e=>e.type==='tank').tough,duo=Core.create({mission:'holdout',seed:3,mates:[{bot:true}]});duo.waveD=s.waveD;
  assert(Core.composeWave(duo,15).find(e=>e.type==='tank').tough>solo,'a boss is tougher with a squadmate in the field');
  const {log}=toWave(5);const red=log.filter(e=>e.type==='wave').map(e=>!!e.red);assert.deepEqual(red,[false,false,false,false,true]);
  assert.equal(log.find(e=>e.type==='wave'&&e.red).bosses[0],'commander');assert(log.find(e=>e.type==='waveclear'&&e.wave===4).next.red,'the wave before says a red wave is next');});
test('more hostiles share the field as the waves go on: the cap grows from eight',()=>{
  for(const [wave,cap] of [[1,8],[10,14],[20,18]]){const s=Core.create({mission:'holdout',seed:5});Object.assign(s.director,{wave,phase:'fight',queue:Array.from({length:40},(_,i)=>({type:'infantry',id:'q'+i,x:s.map.spawnPoints[0].x,y:s.map.spawnPoints[0].y,zone:0}))});
    let most=0;for(let i=0;i<120*12;i++){s.player.health=100;Core.step(s,{});s.events.length=0;most=Math.max(most,s.enemies.filter(e=>!e.dead).length+s.spawnWarnings.length);}
    assert.equal(most,cap,'wave '+wave);}});
test('later waves bring veterans with better guns, and a soldier spawned too wide for its spawn point is moved clear',()=>{
  const s=Core.create({mission:'holdout',seed:2});s.waveD=Core.pressureFor(s,18).D;const l=Array.from({length:6},()=>Core.composeWave(s,18)).flat(),vets=l.filter(e=>e.vet);
  assert(vets.length>3);assert(vets.every(v=>!A[v.type].machine&&!A[v.type].boss));assert(vets.some(v=>v.type==='infantry'&&v.gun==='battle'));assert(!Core.composeWave(s,3).some(e=>e.vet),'none early on');
  // The killhouse's west spawn point is a step from a crate: a commander standing exactly on it would be inside it.
  const q=quiet(),pt=q.map.spawnPoints.find(p=>!Core.clearAt(q,p.x,p.y,25));assert(pt,'a spawn point too tight for a commander');
  q.spawnWarnings.push({id:'boss',type:'commander',x:pt.x,y:pt.y,zone:0,delay:0});ticks(q,2);const c=q.enemies.find(e=>e.id==='boss');assert(Core.clearAt(q,c.x,c.y,c.radius),'it stands clear');});

// ---------- the new threats ----------
test('a medic brings back a soldier who fell in its wave, once, and the second kill pays half',()=>{
  const s=quiet(),p=s.player,spot=inView(s,p,420);s.player.iframes=999;
  const body=dummy({id:'body',...spot,x:spot.x+30,dead:true,deathAge:1,wave:3,hp:0}),medic=dummy({id:'medic',type:'medic',...spot,hp:75,maxHp:75,active:true,seen:4,cooldown:9,wave:3,lastX:p.x,lastY:p.y});
  s.enemies=[body,medic];for(let i=0;i<120*5&&body.dead;i++){p.health=100;Core.step(s,{});}
  assert.equal(body.dead,false,'back on its feet');assert(body.revived&&body.hp===body.maxHp*.5);assert(s.events.some(e=>e.type==='enemyrevive'));
  const before=s.stats.credits;Core.damageEnemy(s,body,1e6,0,.1,'rifle');assert.equal(s.stats.credits-before,Math.round(A.infantry.bounty*.5*.6));});
test('a spotter drone marks the operator for everyone, through walls, and a mortar team fires on the mark unseen',()=>{
  const s=quiet(),p=s.player;p.iframes=999;const view=inView(s,p,330);
  // A rifleman who cannot see Rook from where it is: the far side of a solid wall.
  const hidden=s.map.spawnPoints.map(q=>({x:q.x,y:q.y})).find(q=>!Core.lineOfSight(s,q,p));assert(hidden,'somewhere out of sight');
  const rifle=dummy({id:'r',...hidden,active:true,seen:.5,lastX:0,lastY:0,cooldown:99}),spotter=dummy({id:'sp',type:'spotter',...view,hp:40,maxHp:40,active:true,seen:4});s.enemies=[rifle,spotter];
  ticks(s,30);assert(s.spotted>0);assert(!Core.sees(s,rifle,p),'still out of sight');assert(s.events.some(e=>e.type==='marked'));assert(Math.hypot(rifle.lastX-p.x,rifle.lastY-p.y)<40,'the rifleman knows where Rook is');
  const mortar=dummy({id:'m',type:'mortar',...hidden,active:true,seen:2,cooldown:0,lastX:p.x,lastY:p.y});rifle.dead=true;s.enemies.push(mortar);s.events=[];
  for(let i=0;i<120*3&&!s.events.some(e=>e.type==='mortar');i++){p.health=100;Core.step(s,{});}assert(s.events.some(e=>e.type==='mortar'),'the mortar fired blind on the mark');
  assert(s.grenades.filter(g=>g.enemy&&g.shell).length===3,'three rounds');});
test('a jammer shuts field support down while it lives, and an engineer\'s sentries do not hold a wave open',()=>{
  const s=quiet({loadout:{primary:'rifle',secondary:'pistol',support:'airstrike'}});const p=s.player,spot=inView(s,p,380);s.support.charge=s.support.cost;s.support.ready=true;p.iframes=999;
  s.enemies=[dummy({id:'j',type:'jammer',...spot,hp:95,maxHp:95,active:true,seen:4,cooldown:99,stagger:999})];ticks(s,2);assert.equal(s.jammed,true);
  assert.equal(Core.callSupport(s,{}),false,'no call while jammed');s.enemies[0].dead=true;ticks(s,2);assert.equal(s.jammed,false);assert.equal(Core.callSupport(s,{}),true);
  const q=Core.create({mission:'holdout',seed:4});q.player.iframes=999;const at=inView(q,q.player,360),eng=dummy({id:'e',type:'engineer',...at,hp:75,maxHp:75,active:true,seen:4,cooldown:99,lastX:q.player.x,lastY:q.player.y,wave:1});
  Object.assign(q.director,{wave:1,phase:'fight',queue:[],timer:0});q.enemies=[eng];for(let i=0;i<120*4&&!eng.built;i++){q.player.health=100;Core.step(q,{});}
  const sentry=q.enemies.find(e=>e.type==='turret');assert(eng.built&&sentry&&sentry.built,'it set down a sentry');Core.damageEnemy(q,eng,1e6,0,.1,'rifle');ticks(q,3);
  assert.equal(q.director.phase,'rest','the wave cleared with the sentry still standing');assert(sentry.dead&&sentry.vanished,'which went dark');});
test('the tank shrugs off rifle rounds from the front, takes them in the engine from behind, and full damage from rockets',()=>{
  const s=quiet(),tank=()=>dummy({id:'t',type:'tank',hp:1700,maxHp:1700,radius:32,hull:0,x:900,y:640,stagger:0}),hit=(angle,src='rifle',blast=false)=>{const t=tank();s.enemies=[t];Core.damageEnemy(s,t,100,angle,.1,src,false,blast);return 1700-t.hp;};
  const front=hit(Math.PI),rear=hit(0),rocket=hit(Math.PI,'rocket',true);assert.equal(front,25);assert.equal(rear,160);assert.equal(rocket,100);});
test('in holdout the Warden\'s barrier soaks a set amount, breaks for a few seconds and comes back; rail slugs pass through it',()=>{
  const s=quiet(),w=dummy({id:'w',type:'mech',hp:1200,maxHp:1200,radius:30,shieldMax:300,shieldHp:300,x:900,y:640,stagger:0,active:true,seen:4,cooldown:99});s.enemies=[w];
  Core.damageEnemy(s,w,200,0,.1,'rifle');assert(w.hp>1180,'mostly absorbed');assert.equal(w.shieldHp,100);Core.damageEnemy(s,w,150,0,.1,'rifle');assert(w.shieldDown>0&&s.events.some(e=>e.type==='shieldbreak'));
  const hp=w.hp;Core.damageEnemy(s,w,100,0,.1,'rifle');assert.equal(hp-w.hp,100,'full damage while it is down');ticks(s,Math.ceil(7/Core.DT));assert.equal(w.shieldHp,300,'and it comes back');
  const h2=w.hp;Core.damageEnemy(s,w,100,0,.1,'rail',true);assert.equal(h2-w.hp,100,'a rail slug ignores it');});
test('a hostile flashbang dazes an operator who sees it go off - unless a roll carries them through',()=>{
  const s=quiet(),p=s.player;s.grenades.push({kind:'flash',x:p.x+80,y:p.y,sx:p.x+80,sy:p.y,tx:p.x+80,ty:p.y,age:0,duration:.1,fuse:.2,enemy:true,from:'elite'});ticks(s,40);
  assert(p.stagger>0,'dazed');assert(s.events.some(e=>e.type==='flash'&&e.enemy&&e.who==='player'));});

// ---------- end of a wave, side objectives, pay ----------
test('a clean wave pays a bonus on top of the wave bonus, and the stragglers at the end of a wave come to you',()=>{
  const {log}=toWave(2);const c=log.find(e=>e.type==='waveclear');assert.equal(c.grade,'flawless');assert.equal(c.clean,15+3);assert.equal(c.bonus,50,'the wave bonus is as it was');
  const s=Core.create({mission:'holdout',seed:6});s.player.iframes=999;const far=s.map.spawnPoints[0];Object.assign(s.director,{wave:3,phase:'fight',queue:[],timer:0});
  s.enemies=[dummy({id:'a',type:'sniper',x:far.x,y:far.y,hp:60,maxHp:60,active:true,seen:4,cooldown:99,wave:3})];for(let i=0;i<120*14&&!s.enemies[0].rush;i++){s.player.health=100;Core.step(s,{});}
  assert(s.enemies[0].rush,'the last one stops hanging back');assert(s.events.some(e=>e.type==='laststand'));});
test('a supply uplink lands on some waves; standing by it secures credits, ammunition and armour',()=>{
  const s=Core.create({mission:'holdout',seed:8});s.player.iframes=999;Object.assign(s.director,{wave:6,phase:'rest',timer:0});s.stats.wave=6;ticks(s,2);assert.equal(s.director.wave,7);assert(s.director.uplink);
  s.enemies=[];s.director.queue=[];s.spawnWarnings=[];s.director.queue=[{type:'infantry',id:'keep',x:s.map.spawnPoints[0].x,y:s.map.spawnPoints[0].y,zone:0}];
  for(let i=0;i<120*9&&s.director.uplink?.x===undefined;i++){s.player.health=100;s.enemies.forEach(e=>{e.stagger=999;});Core.step(s,{});}const u=s.director.uplink;assert(u&&u.x!==undefined,'it landed');
  const before=s.stats.credits;s.player.x=u.x;s.player.y=u.y;for(let i=0;i<120*6&&!u.done;i++){s.player.health=100;s.player.x=u.x;s.player.y=u.y;s.enemies.forEach(e=>{e.stagger=999;});Core.step(s,{});}
  assert(u.done,'secured');assert.equal(s.stats.credits-before,80+12*7);assert(s.pickups.some(q=>q.id==='up7b'&&q.type==='armor'));});
test('milestone waves pay once, the first time they are reached on that pressure',()=>{
  const run=wave=>({mode:'holdout',mission:'holdout',difficulty:'standard',completed:false,time:300,stats:{kills:60,flows:0,damage:0,credits:1000,intel:0,bestCombo:3,wave,spent:0},mastery:{},rating:null,score:0,deaths:0});
  const save=Save.defaults(),first=Meta.settle(save,run(11),50),again=Meta.settle(save,run(11),50);
  assert.deepEqual(first.lines.filter(l=>l.label.startsWith('MILESTONE')).map(l=>l.value),[250,600]);assert(!again.lines.some(l=>l.label.startsWith('MILESTONE')));});
test('the death screen learns what put you down',()=>{
  const s=quiet(),p=s.player;s.enemies=[dummy({id:'g',type:'gunner',x:p.x+200,y:p.y,active:true})];Core.damagePlayer(s,1,0,0);s.blame=null;
  s.projectiles[0]=Object.assign(s.projectiles[0],{active:true,x:p.x+60,y:p.y,px:p.x+60,py:p.y,vx:-1500,vy:0,remaining:500,damage:500,enemy:true,from:'gunner',weapon:'lmg',pierce:0,explosive:0,hitIds:[],bounce:0,chain:0});
  p.iframes=0;ticks(s,10);assert.equal(s.dead,true);assert.equal(s.events.find(e=>e.type==='death').blame,'gunner');});

// ---------- the supply drop ----------
test('the crate before a red wave is legendary and holds the answer to its boss, and it is the dearest in the drop',()=>{
  for(const [n,boss] of [[4,'commander'],[9,'mech'],[14,'tank'],[19,'wraith']]){const s=Core.create({mission:'holdout',seed:n});s.director.wave=n;s.stats.credits=99999;Core.supplyDrop(s);
    const crates=s.pickups.filter(q=>q.type==='offer'),leg=crates.find(q=>q.legendary);assert.equal(crates.length,4,'three crates and a legendary one');
    assert.equal(leg.weapon,Core.COUNTER[boss]);assert.equal(leg.rarity,4);assert(crates.every(q=>q===leg||q.cost<leg.cost||q.item==='weapon'));}
  const s=Core.create({mission:'holdout',seed:1});s.director.wave=13;Core.supplyDrop(s);assert.equal(s.pickups.filter(q=>q.type==='offer').length,3,'no legendary crate otherwise');
  const b=Core.create({mission:'holdout',seed:1});b.director.wave=14;b.stats.credits=99999;Core.supplyDrop(b);const at4=b.pickups.find(q=>q.legendary),p=b.player;p.x=at4.x;p.y=at4.y;Core.interact(b,{});
  assert.equal(p.slots[1],'rocket','the AT4 in hand');assert.equal(p.reserve.rocket,Core.reserveOf(b,'rocket')*2,'with double the rockets');});
test('the first crate is always a basic - whichever you are short of - and the wider pool opens up with the waves',()=>{
  const s=Core.create({mission:'holdout',seed:2});s.player.health=30;s.player.armor=s.player.maxArmor;s.director.wave=2;Core.supplyDrop(s);assert.equal(s.pickups.find(q=>q.type==='offer').item,'health');
  const seen=new Set();for(let seed=1;seed<60;seed++){const q=Core.create({mission:'holdout',seed,mates:[{bot:true}],loadout:{primary:'rifle',secondary:'pistol',lethal:'frag',support:'airstrike'}});q.director.wave=8;Core.supplyDrop(q);for(const o of q.pickups)if(o.type==='offer')seen.add(o.item);}
  for(const k of ['sentry','barricade','partner','hollow','charge','thermal'])assert(seen.has(k),k+' turns up by wave 8');
  const e=Core.create({mission:'holdout',seed:3});e.director.wave=1;const early=new Set();for(let i=0;i<40;i++){e.pickups=[];Core.supplyDrop(e);for(const o of e.pickups)early.add(o.item);}assert(!early.has('hollow')&&!early.has('thermal'),'not on wave 1');});
test('each new crate does what it says',()=>{
  const fresh=()=>{const s=Core.create({mission:'holdout',seed:4,mates:[{bot:true}],loadout:{primary:'rifle',secondary:'pistol',support:'airstrike'}});s.stats.credits=9999;s.director.wave=8;return s;};
  const buy=(s,item,extra={})=>{const q={id:'o'+item,x:s.player.x,y:s.player.y,type:'offer',item,weapon:null,cost:100,taken:false,...extra};s.pickups.push(q);Core.interact(s,{});return q;};
  let s=fresh();buy(s,'sentry');assert(s.allies.some(a=>a.kind==='turret'));
  s=fresh();const walls=s.walls.length;const fort=buy(s,'barricade');assert(fort.taken&&s.walls.length>walls&&s.walls.at(-1).fort);
  s=fresh();buy(s,'hollow');const d0=Core.create({mission:'holdout'});Core.shoot(d0,d0.player,'rifle',0);Core.shoot(s,s.player,'rifle',0);assert(Math.abs(s.projectiles.find(b=>b.active).damage/d0.projectiles.find(b=>b.active).damage-1.12)<1e-9);
  s=fresh();buy(s,'charge');assert(s.support.ready);
  s=fresh();buy(s,'thermal');assert(s.thermal);Object.assign(s.director,{phase:'rest',timer:0});ticks(s,2);assert(s.recon>80,'the next wave is scanned');
  s=fresh();const mate=s.guest;Core.explode(s,mate.x,mate.y,18,900,false,'test');assert(mate.dead);buy(s,'partner');assert(!mate.dead&&mate.health===100&&mate.slots[0]==='battle','back up, patched and rearmed');
  s=fresh();const low=s.walls.find(w=>w.low&&Number.isFinite(w.hp));low.dead=true;buy(s,'repair');assert(!low.dead&&low.hp===low.maxHp);});

// ---------- the AI partner ----------
test('the partner fights on its own: it goes after a hostile Rook cannot see, unless told to stay at his shoulder',()=>{
  const run=order=>{const s=quiet({mates:[{bot:true}]}),p=s.player,bot=s.guest;p.iframes=999;bot.iframes=999;s.order=order;
    // A hostile in the fight, out of view, inside the partner's leash (650 from Rook) but well away from both of them.
    const far=s.map.spawnPoints.map(q=>({x:q.x,y:q.y})).filter(q=>Core.distance(q,p)<720).sort((a,b)=>Core.distance(b,p)-Core.distance(a,p))[0];
    s.enemies=[dummy({id:'far',...far,hp:9999,maxHp:9999,active:true,seen:4,stagger:9999})];assert(!Core.sees(s,bot,far));let fired=0;
    for(let i=0;i<120*10;i++){p.health=100;Core.step(s,{aimX:p.x+300,aimY:p.y});fired+=s.events.filter(e=>e.type==='shot'&&!e.enemy).length;s.events.length=0;}return {fired,hp:s.enemies[0].hp,rook:Core.distance(bot,p)};};
  const auto=run('auto'),follow=run('follow');assert(auto.fired>5&&auto.hp<9999,'it went hunting and found it');assert.equal(follow.fired,0,'told to follow, it stays put');assert(follow.rook<260);});
test('the order key cycles free / follow / hold, and a holding partner keeps to the spot',()=>{
  const s=quiet({mates:[{bot:true}]}),p=s.player;assert.equal(s.order,'auto');Core.step(s,{order:true});assert.equal(s.order,'follow');Core.step(s,{order:true});assert.equal(s.order,'hold');const spot={...s.orderAt};
  for(let i=0;i<120*8;i++){const dx=s.map.spawnPoints[0].x-p.x,dy=s.map.spawnPoints[0].y-p.y,d=Math.hypot(dx,dy);Core.step(s,d>40?{mx:dx/d,my:dy/d}:{});s.events.length=0;}
  assert(Core.distance(s.guest,spot)<120,'it held');Core.step(s,{order:true});assert.equal(s.order,'auto');assert.equal(s.orderAt,null);
  const solo=quiet();Core.step(solo,{order:true});assert.equal(solo.order,'auto','no partner, no orders');});
test('the partner stims when hurt and out of contact, and throws a frag into a pack - never at Rook',()=>{
  const s=quiet({mates:[{bot:true}]}),bot=s.guest;bot.health=30;const stims=bot.stims;for(let i=0;i<120*2;i++){s.player.health=100;Core.step(s,{});}assert(bot.stims<stims&&bot.health>30,'stimmed');
  const q=quiet({mates:[{bot:true}]}),b=q.guest;b.iframes=999;q.player.iframes=999;const at=inView(q,b,300);assert(at);
  q.enemies=['a','b','c'].map((id,i)=>dummy({id,x:at.x+i*30,y:at.y,hp:9999,maxHp:9999,active:true,seen:4,stagger:9999}));q.player.x=b.x-Math.cos(Math.atan2(at.y-b.y,at.x-b.x))*60;q.player.y=b.y-Math.sin(Math.atan2(at.y-b.y,at.x-b.x))*60;
  let thrown=null;for(let i=0;i<120*10&&!thrown;i++){Core.step(q,{});thrown=q.grenades.find(g=>g.owner===b.id&&g.kind==='frag');q.events.length=0;}
  assert(thrown,'a frag went out');assert(Core.distance({x:thrown.tx,y:thrown.ty},q.player)>200,'well clear of Rook');});
test('the partner calls out a contact behind Rook, and earns a sentry of its own from its kills',()=>{
  const s=quiet({mates:[{bot:true}]}),p=s.player,bot=s.guest;p.iframes=999;bot.iframes=999;p.angle=0;bot.x=p.x;bot.y=p.y;const behind=inView(s,p,300);
  s.enemies=[dummy({id:'six',...behind,hp:9999,maxHp:9999,active:true,seen:4,stagger:9999})];const look=Math.atan2(behind.y-p.y,behind.x-p.x)+Math.PI;
  let call=null;for(let i=0;i<120*3&&!call;i++){Core.step(s,{aimX:p.x+Math.cos(look)*300,aimY:p.y+Math.sin(look)*300});call=s.events.find(e=>e.type==='callout');s.events.length=0;}
  assert(call&&call.key==='six','CONTACT BEHIND YOU');
  s.ai[bot.id].support=Core.BOT.support;for(let i=0;i<120*2&&!s.allies.length;i++)Core.step(s,{});assert(s.allies.some(a=>a.kind==='turret'&&a.by===bot.id),'its sentry');});

console.log(passed+' holdout checks passed.');

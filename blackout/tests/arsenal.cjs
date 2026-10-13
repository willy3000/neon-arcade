'use strict';
// The second wave of the armory: guns, gadgets and field support that each bring a mechanic of their own.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const W=World.weapons,G=World.gear,A=World.archetypes;
// A holdout run with the waves held off, so only what a test puts in the field is there.
function run(loadout={}){const s=Core.create({mission:'holdout',difficulty:'standard',seed:91,owned:Object.keys(W),loadout:{primary:'rifle',secondary:'pistol',...loadout}});s.director.timer=99999;s.enemies=[];s.events=[];return s;}
const dummy=(s,extra={})=>({id:'t'+(s.enemies.length+1)+'_'+(extra.x|0),x:0,y:0,radius:16,hp:70,maxHp:70,angle:0,type:'infantry',dead:false,zone:0,active:true,seen:4,cooldown:999,stagger:999,reload:0,vx:0,vy:0,spawned:true,lastX:0,lastY:0,...extra});
function ticks(s,n,input={}){for(let i=0;i<n;i++)Core.step(s,typeof input==='function'?input(i):input);return s;}
const secs=t=>Math.ceil(t/Core.DT),count=(s,type)=>s.events.filter(e=>e.type===type).length;
// Open ground about "d" from the operator that he can see, and the angle to it.
function inView(s,d=300,from=s.player){for(let k=0;k<16;k++){const a=k*Math.PI/8,q={x:from.x+Math.cos(a)*d,y:from.y+Math.sin(a)*d};if(Core.clearAt(s,q.x,q.y,22)&&Core.lineOfSight(s,from,q))return {...q,a};}throw new Error('no open ground in view');}
const block=s=>s.walls.find(w=>!w.low&&w.kind==='building'&&w.x>100&&w.y>100&&w.w>100&&w.w<500&&w.h<500);
const shots=(s,n,input)=>{let fired=0;for(let i=0;i<n;i++){Core.step(s,typeof input==='function'?input(i):input);fired+=s.events.filter(e=>e.type==='shot'&&!e.enemy).length;s.events.length=0;}return fired;};

// ---- guns ----
test('the burst rifle fires three rounds on one pull, then waits',()=>{
  const s=run({primary:'burst'}),p=s.player,aim={aimX:p.x+400,aimY:p.y};
  assert.equal(shots(s,1,{fire:true,...aim}),1);assert.equal(shots(s,secs(.3),aim),2,'the other two follow without the trigger');assert.equal(p.ammo.burst,W.burst.capacity-3);
  assert.equal(shots(s,secs(1),aim),0);assert.equal(shots(s,secs(W.burst.rate*2+.05),{fire:true,...aim}),6,'held down, it is burst after burst');
  // Swapping away mid-burst abandons the rest of it.
  const q=run({primary:'burst'});ticks(q,1,{fire:true,aimX:q.player.x+400,aimY:q.player.y});ticks(q,1,{swap:true});q.events.length=0;assert.equal(shots(q,secs(.3),{}),0);
});
test('the minigun has to spin up, then does not stop, and winds down when released',()=>{
  const s=run({primary:'minigun'}),p=s.player,hold={fire:true,aimX:p.x+400,aimY:p.y};
  assert.equal(shots(s,secs(W.minigun.spin)-2,hold),0,'nothing while it spins up');const n=shots(s,secs(1),hold);assert(n>=20,'then about twenty-four rounds a second, got '+n);
  ticks(s,secs(.5));assert.equal(p.spin,0);assert.equal(shots(s,secs(.3),hold),0,'released, it has to spin up again');
});
test('a ricochet round comes back off a wall and hits what is behind the shooter',()=>{
  const hit=gun=>{const s=run({primary:gun}),p=s.player,w=block(s);p.x=w.x+w.w/2;p.y=w.y+w.h+180;const e=dummy(s,{x:p.x,y:p.y+140,hp:500,maxHp:500});s.enemies=[e];
    ticks(s,1,{fire:true,aimX:p.x,aimY:w.y+w.h});const bounced=count(s,'ricochet');ticks(s,secs(.6));return {lost:500-e.hp,bounced};};
  const r=hit('ricochet');assert.equal(r.bounced,0);assert.equal(r.lost,W.ricochet.damage,'straight at the wall, straight back, and into the hostile behind');
  assert.equal(hit('rifle').lost,0,'an ordinary round stops at the wall');
  // Two bounces and no more.
  const s=run({primary:'ricochet'}),p=s.player;s.walls=s.walls.filter(w=>w.kind==='building'&&(w.x<=0||w.y<=0||w.x+w.w>=s.map.width||w.y+w.h>=s.map.height));p.x=200;p.y=200;
  // Fired into a corner of the outer wall: off the west wall, off the north wall, and then it flies until it is spent.
  ticks(s,1,{fire:true,aimX:60,aimY:130});let n=0;for(let i=0;i<secs(3);i++){Core.step(s,{});n+=count(s,'ricochet');s.events.length=0;}assert.equal(n,2);assert.equal(s.projectiles.some(b=>b.active),false);
});
test('the flamethrower reaches a short way, burns through a crowd and leaves the ground alight',()=>{
  const s=run({primary:'flamer'}),p=s.player,at=inView(s,150);s.enemies=[dummy(s,{x:at.x,y:at.y,hp:60,maxHp:60}),dummy(s,{x:p.x+Math.cos(at.a)*185,y:p.y+Math.sin(at.a)*185,hp:60,maxHp:60}),dummy(s,{x:p.x+Math.cos(at.a)*420,y:p.y+Math.sin(at.a)*420,hp:60,maxHp:60})];
  ticks(s,secs(2.5),{fire:true,aimX:at.x,aimY:at.y});assert.equal(s.enemies[0].dead&&s.enemies[1].dead,true,'the stream passes through the first hostile to the second');
  assert.equal(s.enemies[2].hp,60,'and does not reach one 420 away');assert(s.zones.some(z=>z.kind==='fire'),'fire is left where the stream ends');assert(s.zones.length<=14);
});
test('an arc caster bolt jumps to two more hostiles for 60% each, and stalls a machine',()=>{
  const s=run({primary:'arc'}),p=s.player,at=inView(s,300),e=[dummy(s,{x:at.x,y:at.y,hp:300,maxHp:300}),dummy(s,{x:at.x+Math.cos(at.a+1.5)*110,y:at.y+Math.sin(at.a+1.5)*110,hp:300,maxHp:300,type:'turret'}),dummy(s,{x:at.x+Math.cos(at.a+1.5)*215,y:at.y+Math.sin(at.a+1.5)*215,hp:300,maxHp:300}),dummy(s,{x:at.x+Math.cos(at.a)*420,y:at.y+Math.sin(at.a)*420,hp:300,maxHp:300})];
  e[1].angle=Math.atan2(e[1].y-e[0].y,e[1].x-e[0].x);s.enemies=e;ticks(s,1,{fire:true,aimX:at.x,aimY:at.y});ticks(s,secs(.4));
  assert.equal(300-e[0].hp,W.arc.damage);assert(Math.abs(300-e[2].hp-W.arc.damage*.6)<.01,'the bolt goes on from the sentry to the soldier beyond it, for 60% again');assert(e[1].hp<300&&e[1].disabled>0,'the sentry gun is hit and stalled');
  assert.equal(e[3].hp,300,'one out of reach is untouched');assert.equal(count(s,'arc'),2);
});
test('a kill with any new gun is a kill with that gun',()=>{
  for(const k of ['burst','ricochet','flamer','minigun','arc']){const s=run({primary:k}),e=dummy(s);s.enemies=[e];Core.damageEnemy(s,e,999,0,.1,k);assert.equal(s.mastery[k],1);assert.equal(W[k].slot,0);assert.ok(World.categories.some(c=>c.cls.includes(W[k].cls)),k+' has an armory category');}
});

// ---- lethals ----
const throwAt=(s,q)=>ticks(s,1,{grenade:true,aimX:q.x,aimY:q.y});
test('a throwing knife drops a soldier in one and lies there to be picked up again',()=>{
  const s=run({lethal:'knife'}),p=s.player,at=inView(s,260),e=dummy(s,{x:at.x,y:at.y});s.enemies=[e];assert.equal(p.grenades,G.knife.count);
  throwAt(s,at);assert.equal(p.grenades,2);ticks(s,secs(.5));assert.equal(e.dead,true);const knife=s.pickups.find(q=>q.id.startsWith('knife')&&!q.taken);assert.ok(knife,'the knife is on the ground');assert(Core.distance(knife,e)<40);
  p.x=knife.x;p.y=knife.y;ticks(s,2);assert.equal(p.grenades,3,'and back in hand');
  const miss=run({lethal:'knife'}),far=inView(miss,300);throwAt(miss,far);ticks(miss,secs(1));assert.equal(miss.pickups.filter(q=>q.id.startsWith('knife')&&!q.taken).length,1,'a miss can be picked up as well');
});
test('a cluster grenade goes off, then scatters five bomblets round itself',()=>{
  const s=run({lethal:'cluster'}),at=inView(s,280);s.enemies=[0,1,2,3].map(i=>dummy(s,{x:at.x+Math.cos(i*1.57)*85,y:at.y+Math.sin(i*1.57)*85,hp:110,maxHp:110}));
  throwAt(s,at);ticks(s,secs(1.05));const live=s.grenades.filter(g=>g.cluster);assert.equal(live.length,5);assert.equal(count(s,'explosion'),1);
  ticks(s,secs(1.2));assert.equal(count(s,'explosion'),6);assert(s.enemies.filter(e=>e.dead).length>=3,'most of a ring of hostiles round it is dead');assert(s.mastery.cluster>=3);
});
test('C4 waits for the second press, however close a hostile stands, and leaves the other charge in hand',()=>{
  const s=run({lethal:'c4'}),p=s.player,a={x:p.x,y:p.y};ticks(s,1,{grenade:true});assert.equal(s.mines.length,1);assert.equal(s.mines[0].remote,true);assert.equal(p.grenades,1);
  s.enemies=[dummy(s,{x:a.x+30,y:a.y}),dummy(s,{x:a.x-40,y:a.y+20})];const at=inView(s,330);p.x=at.x;p.y=at.y;ticks(s,secs(2));assert.equal(s.enemies.some(e=>e.dead),false,'a hostile standing on it does not set it off');
  const hp=p.health+p.armor;ticks(s,1,{grenade:true});assert.equal(s.mines.length,0);assert.equal(s.enemies.every(e=>e.dead),true,'the next press does');assert.equal(p.grenades,1,'without using the second charge');assert.equal(p.health+p.armor,hp,'and Rook, having walked away, is clear of it');assert.equal(s.mastery.c4,2);
  ticks(s,1,{grenade:true});assert.equal(s.mines.length,1);assert.equal(p.grenades,0);ticks(s,1,{grenade:true});assert.equal(s.mines.length,0,'the last charge can still be set off with none left in hand');
});
test('the seeker rolls to the nearest hostile, round a corner if need be, and goes off',()=>{
  const s=run({lethal:'seeker'}),p=s.player,w=block(s);p.x=w.x+w.w/2;p.y=w.y+w.h+50;const e=dummy(s,{x:w.x+w.w/2,y:w.y-50,hp:100,maxHp:100});s.enemies=[e];
  ticks(s,1,{grenade:true});assert.equal(s.allies[0].kind,'seeker');ticks(s,secs(6));assert.equal(e.dead,true);assert.equal(s.allies.length,0);assert.equal(s.mastery.seeker,1);
  const dud=run({lethal:'seeker'});ticks(dud,1,{grenade:true});ticks(dud,secs(8.2));assert.equal(dud.allies.length,0,'with nothing to find it is spent after eight seconds');assert.equal(count(dud,'explosion'),0);
});

// ---- tacticals ----
test('the grapple hook pulls Rook along his aim in a blink, as a flow, and stops at a wall',()=>{
  const s=run({tactical:'grapple'}),p=s.player,at=inView(s,400),from={x:p.x,y:p.y},flows=s.stats.flows;ticks(s,1,{tactical:true,aimX:at.x,aimY:at.y});
  assert.equal(p.state,'dive');assert.equal(p.tacticals,G.grapple.count-1);assert.equal(s.stats.flows,flows+1);ticks(s,secs(.45));
  const moved=Core.distance(p,from);assert(moved>330&&moved<440,'about 400 in under half a second, got '+moved.toFixed(0));assert.notEqual(p.state,'dive');assert.equal(p.zip,0);
  const w=run({tactical:'grapple'}),q=w.player,b=block(w);q.x=b.x+b.w/2;q.y=b.y+b.h+90;ticks(w,1,{tactical:true,aimX:q.x,aimY:b.y-300});ticks(w,secs(.5));assert(q.y>b.y+b.h,'a building is not a way through');
});
test('a sensor dart marks its ground for twelve seconds; tear gas stops soldiers in it from fighting',()=>{
  const s=run({tactical:'sensor'}),at=inView(s,250);ticks(s,1,{tactical:true,aimX:at.x,aimY:at.y});ticks(s,secs(.7));const z=s.zones.find(q=>q.kind==='sensor');assert.ok(z);assert(Core.distance(z,at)<5);assert(z.r>=400);ticks(s,secs(12));assert.equal(s.zones.length,0);
  const g=run({tactical:'gas'}),spot=inView(g,260);g.player.health=100;const soldier=dummy(g,{x:spot.x,y:spot.y,stagger:0,cooldown:0}),sentry=dummy(g,{x:spot.x+40,y:spot.y+40,type:'turret',stagger:0,cooldown:0}),out=dummy(g,{x:spot.x+Math.cos(spot.a)*5,y:spot.y+Math.sin(spot.a)*5,stagger:0});
  g.enemies=[soldier,sentry];void out;ticks(g,1,{tactical:true,aimX:spot.x,aimY:spot.y});ticks(g,secs(1.2));assert.ok(g.zones.some(q=>q.kind==='gas'));
  let attacks=0;for(let i=0;i<secs(6);i++){Core.step(g,{});if(soldier.attack>0)attacks++;g.player.health=100;}assert.equal(attacks,0,'the soldier in the gas never gets an attack off');assert(soldier.stagger>0);assert.equal(sentry.stagger,0,'a machine is not troubled');
});
test('the trophy system knocks down grenades and rockets near it; the ammo box drops ammunition',()=>{
  const s=run({tactical:'trophy'}),p=s.player;ticks(s,1,{tactical:true});const t=s.allies[0];assert.equal(t.kind,'trophy');
  s.grenades.push({kind:'frag',x:p.x+120,y:p.y,sx:p.x+120,sy:p.y,tx:p.x+120,ty:p.y,age:0,duration:.1,fuse:1.2,enemy:true},{kind:'frag',x:p.x+600,y:p.y,sx:p.x+600,sy:p.y,tx:p.x+600,ty:p.y,age:0,duration:.1,fuse:9,enemy:true});
  const rocket=s.projectiles.find(b=>!b.active);Object.assign(rocket,{active:true,x:p.x+150,y:p.y-100,px:p.x+150,py:p.y-100,vx:-10,vy:10,remaining:900,damage:60,enemy:true,weapon:'rocket',pierce:0,explosive:130,stagger:0,breach:false,hitIds:[],whiz:false,bounce:0,chain:0,flame:false,knife:false});
  const hp=p.health+p.armor;ticks(s,secs(2));assert.equal(count(s,'intercept'),2);assert.equal(count(s,'explosion'),0);assert.equal(p.health+p.armor,hp);assert.equal(s.grenades.length,1,'one out of its reach is left alone');assert.equal(rocket.active,false);
  ticks(s,secs(19));assert.equal(s.allies.length,0);
  const a=run({tactical:'ammobox'});a.player.reserve.rifle=0;ticks(a,1,{tactical:true});assert.equal(a.pickups.filter(q=>q.id.startsWith('box')&&q.type==='ammo'&&!q.taken).length,3);a.player.x+=40;a.player.y+=24;ticks(a,2);assert(a.player.reserve.rifle>0);
});

// ---- field support ----
const call=(key,setup)=>{const s=run({support:key});s.support.charge=s.support.cost;s.support.ready=true;if(setup)setup(s);Core.callSupport(s,{});return s;};
test('a supply drop lands health, armour, ammunition and gadget refills round Rook',()=>{
  const s=call('supply');assert.deepEqual(s.pickups.filter(q=>q.id.startsWith('sup')).map(q=>q.type).sort(),['ammo','ammo','armor','health','lethal','tactical']);
  for(const q of s.pickups.filter(q=>q.id.startsWith('sup')))assert(Core.distance(q,s.player)>36&&Core.distance(q,s.player)<70,'close by, not underfoot');
});
test('a reinforcement shoots what he can see and keeps at Rook\'s side for 45 seconds',()=>{
  const s=call('reinforce'),p=s.player,at=inView(s,300),e=dummy(s,{x:at.x,y:at.y,hp:120,maxHp:120});s.enemies=[e];const man=s.allies[0];assert.equal(man.kind,'gunner');
  ticks(s,secs(5));assert.equal(e.dead,true);assert.equal(s.stats.kills,1);const far=inView(s,420);p.x=far.x;p.y=far.y;ticks(s,secs(4));assert(Core.distance(man,p)<150,'he follows');
  ticks(s,secs(37));assert.equal(s.allies.length,0);
});
test('the gunship circles Rook and fires over walls at anything near him',()=>{
  const s=call('gunship'),p=s.player,w=block(s);p.x=w.x+w.w/2;p.y=w.y+w.h+60;const e=dummy(s,{x:w.x+w.w/2,y:w.y-60,hp:200,maxHp:200});s.enemies=[e];assert.equal(Core.lineOfSight(s,p,e),false);
  const ship=s.allies[0];ticks(s,secs(4));assert.equal(e.dead,true,'a hostile behind a building is no safer');assert(Math.abs(Core.distance(ship,p)-240)<30,'it holds its circle');assert.equal(s.support.charge,0,'and its kills do not charge the next call');
  ticks(s,secs(17));assert.equal(s.allies.length,0);
});
test('blackout: drones fall, machines go dark, every soldier is blinded, bosses only briefly',()=>{
  const s=call('blackout',q=>{const p=q.player;q.enemies=[dummy(q,{x:p.x+900,y:p.y,stagger:0}),dummy(q,{x:p.x-300,y:p.y,type:'drone',stagger:0,hp:45}),dummy(q,{x:p.x,y:p.y+500,type:'turret',stagger:0}),dummy(q,{x:p.x,y:p.y-400,type:'commander',stagger:0,hp:420,maxHp:420})];});
  const [man,drone,sentry,boss]=s.enemies;assert(man.stagger>=5&&man.flashed>=5,'however far away');assert.equal(drone.dead,true);assert(sentry.disabled>=9);assert(boss.stagger>0&&boss.stagger<=1.2);assert.equal(s.support.charge,0);
});

// ---- owning them ----
test('every new item is bought or earned, and the new challenges award guns and gadgets too',()=>{
  for(const [kind,table] of [['weapon',W],['gear',G],['support',World.support]])for(const [k,v] of Object.entries(table)){if(v.challenge){assert.ok(Meta.CHALLENGES[v.challenge],k+' names a real challenge');assert.equal(v.price,undefined,k+' is not also for sale');assert.equal(Meta.price(Save.defaults(),kind,k),null);}}
  const save=Save.defaults();save.credits=1e7;save.xp=Meta.need(15);assert.equal(Meta.buy(save,'weapon','minigun').ok,false);assert.equal(Meta.buy(save,'weapon','arc').ok,true);assert.equal(Meta.buy(save,'gear','seeker').ok,true);assert.equal(Meta.buy(save,'support','gunship').ok,true);
  assert.equal(Meta.price(save,'kit','flamer')>0,true,'a challenge gun still has kit parts to fit');
  save.holdout={standard:12};assert.deepEqual(Meta.claim(save).map(u=>u.key),['minigun']);
  save.mastery.incendiary=25;assert.deepEqual(Meta.claim(save).map(u=>u.key),['flamer']);
  save.mastery={...save.mastery,grenade:10,c4:0,cluster:10,seeker:5,thumper:15};assert.deepEqual(Meta.claim(save).map(u=>u.key),['c4']);
  for(const m of World.missions)Meta.mission(save,m.id).done=true;assert.deepEqual(Meta.claim(save).map(u=>u.key),['blackout']);
  assert.deepEqual(Meta.loadout(save,{primary:'minigun',secondary:'pistol',lethal:'c4',tactical:'grapple',support:'blackout'}),{primary:'minigun',secondary:'pistol',lethal:'c4',tactical:null,support:'blackout',perks:[null,null,null]});
  // Kills with the new explosives are kept for the career, and survive a save and load.
  const s=Core.create({mission:'holdout',difficulty:'standard'});s.mastery={c4:3,cluster:2,seeker:1,tknife:4};s.stats.wave=1;const fresh=Save.defaults();Meta.settle(fresh,Meta.summarize(s),5);
  assert.deepEqual([fresh.mastery.c4,fresh.mastery.cluster,fresh.mastery.seeker],[3,2,1]);assert.equal(Save.decode(JSON.stringify(fresh)).mastery.cluster,2);
});
test('a holdout supply crate can offer a gun that has no armory price',()=>{
  const s=Core.create({mission:'holdout',difficulty:'standard',seed:3,owned:Object.keys(W).filter(k=>!['minigun','flamer'].includes(k))});for(let i=0;i<120*200&&s.stats.wave<6;i++){s.player.health=100;Core.step(s,{});for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,99999,0,.1,'rifle',true,true);
    for(const q of s.pickups)if(q.type==='offer'){assert(Number.isFinite(q.cost)&&q.cost>0,'crate cost '+q.cost);}s.events.length=0;}
  assert(s.stats.wave>=6);
});
console.log(`${passed} arsenal checks passed.`);

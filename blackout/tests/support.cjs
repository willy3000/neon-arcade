'use strict';
// Field support (the abilities a run's score charges), perks, and the challenges that award some of them.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const A=World.archetypes,SUP=World.support;
// A holdout run with the waves held off, so only what a test puts in the field is there.
function run(loadout={},extra={}){const s=Core.create({mission:'holdout',difficulty:'standard',seed:77,loadout:{primary:'rifle',secondary:'pistol',...loadout},...extra});s.director.timer=99999;s.enemies=[];s.events=[];return s;}
const dummy=(s,extra={})=>({id:'t'+(s.enemies.length+1),x:0,y:0,radius:16,hp:70,maxHp:70,angle:0,type:'infantry',dead:false,zone:0,active:true,seen:4,cooldown:999,stagger:999,reload:0,vx:0,vy:0,spawned:true,lastX:0,lastY:0,...extra});
function ticks(s,n,input={}){for(let i=0;i<n;i++)Core.step(s,typeof input==='function'?input(i):input);return s;}
const secs=t=>Math.ceil(t/Core.DT),ready=s=>{s.support.charge=s.support.cost;s.support.ready=true;};
// Somewhere the operator can see, about "d" away, on open ground.
function inView(s,d=300){const p=s.player;for(let k=0;k<16;k++){const a=k*Math.PI/8,q={x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d};if(Core.clearAt(s,q.x,q.y,22)&&Core.lineOfSight(s,p,q))return {...q,a};}throw new Error('no open ground in view');}
// A building standing inside the map (not its outer wall), to put between two things.
const block=s=>s.walls.find(w=>!w.low&&w.kind==='building'&&w.x>100&&w.y>100&&w.w>100&&w.w<500&&w.h<500);
const kill=(s,e,source='rifle')=>Core.damageEnemy(s,e,9999,0,.1,source);

// ---- the meter ----
test('the meter fills with Rook\'s own score, calls out when full and starts again after a call',()=>{
  const s=run({support:'recon'});assert.deepEqual({...s.support},{key:'recon',cost:SUP.recon.cost,charge:0,ready:false,uses:0});
  s.enemies=[dummy(s),dummy(s)];kill(s,s.enemies[0]);assert.equal(s.support.charge,A.infantry.bounty,'a kill is worth its bounty in holdout');
  Core.chargeSupport(s,10000);assert.equal(s.support.charge,s.support.cost,'it stops at full');assert.equal(s.support.ready,true);assert.equal(s.events.filter(e=>e.type==='supportready').length,1);
  kill(s,s.enemies[1]);assert.equal(s.events.filter(e=>e.type==='supportready').length,1,'and says so once');
  assert.equal(Core.callSupport(s,{}),true);assert.deepEqual([s.support.charge,s.support.ready,s.support.uses],[0,false,1]);assert.ok(s.events.some(e=>e.type==='support'&&e.key==='recon'));
  assert.equal(Core.callSupport(s,{}),false,'nothing to call until it has filled again');
  assert.equal(run().support,null,'a run without one carries no meter');assert.equal(Core.create({training:true,loadout:{support:'recon'}}).support,null,'and the range never does');
});
test('it fills fastest in team deathmatch and slowest in the campaign, and only from the player\'s own work',()=>{
  const rate=o=>{const s=Core.create({difficulty:'standard',loadout:{support:'airstrike'},...o});Core.chargeSupport(s,100);return s.support.charge;};
  assert.equal(rate({mission:'holdout'}),100);assert.equal(rate({mission:'holdout',mode:'tdm'}),160);assert.equal(rate({mission:'crash'}),60);
  const s=run({support:'airstrike'},{mates:[{bot:true}]});s.enemies=[dummy(s),dummy(s),dummy(s)];
  s.by='guest';kill(s,s.enemies[0]);s.by='player';assert.equal(s.support.charge,0,'an AI teammate\'s kill does not charge it');
  kill(s,s.enemies[1],'sentry');assert.equal(s.support.charge,0,'nor does a kill the support itself made');
  kill(s,s.enemies[2],'melee');assert.equal(s.support.charge,A.infantry.bounty);
  const f=run({support:'airstrike'});ticks(f,1);const before=f.support.charge;Core.advance(f);assert.equal(f.support.charge,before+150,'an objective is worth 150');
});
test('the call key works through the real controls and cannot be used mid-roll or while down',()=>{
  const s=run({support:'recon'});ready(s);ticks(s,1,{support:true});assert.equal(s.recon>19,true);assert.equal(s.support.uses,1);
  const d=run({support:'recon'});ready(d);d.player.dead=true;assert.equal(Core.callSupport(d,{}),false);assert.equal(d.support.ready,true,'it is kept for when Rook is back up');
});

// ---- the abilities ----
test('recon sweep marks the field for twenty seconds',()=>{
  const s=run({support:'recon'});ready(s);Core.callSupport(s,{});assert.equal(s.recon,20);ticks(s,secs(5));assert(Math.abs(s.recon-15)<.05);ticks(s,secs(15.5));assert.equal(s.recon,0);
});
test('the sentry turret is set in front of Rook, shoots hostiles it can see, and packs up after thirty seconds',()=>{
  const s=run({support:'turret'}),at=inView(s,330);s.player.angle=at.a;s.enemies=[dummy(s,{x:at.x,y:at.y,hp:120,maxHp:120})];ready(s);Core.callSupport(s,{});
  const t=s.allies[0];assert.equal(t.kind,'turret');assert(Core.distance(t,s.player)>30&&Core.distance(t,s.player)<90,'set down just ahead');assert.ok(Core.clearAt(s,t.x,t.y,20));
  let shots=0;for(let i=0;i<secs(6)&&!s.enemies[0].dead;i++){Core.step(s,{});shots+=s.events.filter(e=>e.type==='shot'&&e.ally).length;s.events.length=0;}
  assert.equal(s.enemies[0].dead,true,'it kills a hostile standing in its view');assert(shots>5);assert.equal(s.stats.kills,1,'and the kill is Rook\'s');assert.equal(s.support.charge,0,'though it does not pay towards the next call');
  assert.equal(s.player.ammo.rifle,World.weapons.rifle.capacity,'without touching his ammunition');
  assert.equal(s.allies.length,1);ticks(s,secs(30));assert.equal(s.allies.length,0,'gone after thirty seconds');assert.ok(s.events.some(e=>e.type==='allygone'&&e.kind==='turret'));
});
test('the sentry does not fire at what it cannot see',()=>{
  const s=run({support:'turret'});ready(s);Core.callSupport(s,{});const t=s.allies[0];
  // A hostile on the far side of a building from the turret.
  const wall=block(s),e=dummy(s,{x:wall.x+wall.w/2,y:wall.y-40});t.x=wall.x+wall.w/2;t.y=wall.y+wall.h+40;s.enemies=[e];
  assert.equal(Core.sees(s,t,e),false);ticks(s,secs(3));assert.equal(e.hp,70);
});
test('the K9 unit runs down a hostile round a corner and bites until it drops',()=>{
  const s=run({support:'dog'}),p=s.player,wall=block(s);
  // Rook on one side of a building, the hostile on the other: no line of sight, so only a path will do.
  p.x=wall.x+wall.w/2;p.y=wall.y+wall.h+50;const e=dummy(s,{x:wall.x+wall.w/2,y:wall.y-50,hp:160,maxHp:160});s.enemies=[e];assert.equal(Core.lineOfSight(s,p,e),false);
  ready(s);Core.callSupport(s,{});const dog=s.allies[0];assert.equal(dog.kind,'dog');
  let bites=0;for(let i=0;i<secs(12)&&!e.dead;i++){Core.step(s,{});bites+=s.events.filter(q=>q.type==='bite').length;s.events.length=0;}
  assert.equal(e.dead,true,'the hound reached it and killed it');assert(bites>=3,'in several bites');assert.equal(s.stats.kills,1);assert.equal(s.support.charge,0);
  ticks(s,secs(3));assert(Core.distance(s.allies[0],p)<140,'with nothing left to chase it comes back to heel');
  ticks(s,secs(25));assert.equal(s.allies.length,0);
});
test('the airstrike walks six shells away from Rook along his aim, warned by their rings',()=>{
  const s=run({support:'airstrike'}),p=s.player,at=inView(s,320);p.angle=at.a;s.enemies=[dummy(s,{x:at.x,y:at.y,hp:150,maxHp:150})];ready(s);Core.callSupport(s,{aimX:at.x,aimY:at.y});
  const shells=s.grenades.filter(g=>g.strike);assert.equal(shells.length,6);assert(Math.abs(Core.distance(shells[0],at))<2,'the first lands on the aim point');
  for(let i=1;i<6;i++)assert(Core.distance(shells[i],p)>=Core.distance(shells[i-1],p)-1,'each one further out');
  assert(shells.every(g=>g.fuse>=1.2&&!g.enemy),'a second or more of warning');assert.equal(s.enemies[0].hp,150,'nothing has gone off yet');
  const hp=p.health+p.armor;ticks(s,secs(2.6));assert.equal(s.enemies[0].dead,true);assert.equal(s.grenades.length,0);assert.equal(p.health+p.armor,hp,'Rook, standing clear, is untouched');
  assert.equal(s.stats.kills,1);assert.equal(s.support.charge,0,'its kills do not pay for the next one');
  // Called at his own feet it is as dangerous to him as any grenade.
  const c=run({support:'airstrike'});ready(c);Core.callSupport(c,{aimX:c.player.x+250,aimY:c.player.y});c.player.x=c.grenades[0].x;c.player.y=c.grenades[0].y;ticks(c,secs(1.5));assert(c.player.health<100);
});
test('allies are deterministic, and a run plays the same from the same seed with one in the field',()=>{
  const play=()=>{const s=Core.create({mission:'holdout',difficulty:'standard',seed:5,loadout:{support:'dog',perks:['regen','scrounger','flowstate']}});ready(s);ticks(s,secs(3.5));Core.callSupport(s,{});ticks(s,secs(14),i=>({mx:i%240<120?1:-1,fire:i%9===0,aimX:1200,aimY:600}));delete s.nav;s.ai={};return s;};
  assert.deepEqual(play(),play());
});

// ---- perks ----
test('a perk only counts in its own slot',()=>{
  assert.deepEqual(run({perks:['regen','scrounger','flowstate']}).perks,{regen:true,scrounger:true,flowstate:true});
  assert.deepEqual(run({perks:['flowstate','regen','bogus']}).perks,{},'out of place, or unknown, is nothing');assert.deepEqual(run().perks,{});
});
test('field dressing: after six quiet seconds health climbs back to 60, and no further',()=>{
  const s=run({perks:['regen',null,null]}),p=s.player;Core.damagePlayer(s,90,0,0);const low=p.health;assert(low<40);
  ticks(s,secs(5.5));assert.equal(p.health,low,'nothing for the first six seconds');ticks(s,secs(3));assert(p.health>low+10);ticks(s,secs(12));assert.equal(p.health,60);
  Core.damagePlayer(s,10,0,0);const hit=p.health;ticks(s,secs(3));assert.equal(p.health,hit,'being hit starts the wait again');
  const none=run();Core.damagePlayer(none,90,0,0);const h=none.player.health;ticks(none,secs(12));assert.equal(none.player.health,h,'and without the perk there is none');
});
test('flak vest takes 40% off blasts and fire, and nothing off bullets',()=>{
  const dmg=(perks,src)=>{const s=run({perks});s.player.armor=0;Core.damagePlayer(s,50,0,0,src);return 100-s.player.health;};
  assert(Math.abs(dmg(['flak',null,null],'blast')-30)<.01);assert(Math.abs(dmg(['flak',null,null],'fire')-30)<.01);assert.equal(dmg(['flak',null,null],'rifle'),50);assert.equal(dmg([null,null,null],'blast'),50);
});
test('second wind turns one killing blow per run into 30 health',()=>{
  const s=run({perks:['secondwind',null,null]}),p=s.player;Core.damagePlayer(s,999,0,0);assert.equal(s.dead,false);assert.equal(p.health,30);assert(p.iframes>1,'with a moment to get clear');assert.ok(s.events.some(e=>e.type==='secondwind'));
  p.iframes=0;Core.damagePlayer(s,999,0,0);assert.equal(s.dead,true,'the second one counts');
});
test('scrounger returns a quarter magazine per gun kill, up to a full reserve',()=>{
  const s=run({perks:[null,'scrounger',null]}),p=s.player,full=Core.reserveOf(s,'rifle');p.reserve.rifle=10;s.enemies=[dummy(s),dummy(s),dummy(s)];
  kill(s,s.enemies[0]);assert.equal(p.reserve.rifle,10+Math.ceil(World.weapons.rifle.capacity/4));kill(s,s.enemies[1],'melee');assert.equal(p.reserve.rifle,18,'a knife kill returns none');
  p.reserve.rifle=full-1;kill(s,s.enemies[2]);assert.equal(p.reserve.rifle,full);
});
test('ambusher hits an unaware hostile 35% harder; executioner heals on a knife kill',()=>{
  const hit=(perks,active)=>{const s=run({perks}),e=dummy(s,{active,hp:500,maxHp:500});s.enemies=[e];Core.damageEnemy(s,e,100,0,.1,'rifle');return 500-e.hp;};
  assert.equal(hit([null,'ambusher',null],false),135);assert.equal(hit([null,'ambusher',null],true),100,'once they have noticed, it is an ordinary hit');assert.equal(hit([null,null,null],false),100);
  const s=run({perks:[null,'executioner',null]});s.player.health=50;s.enemies=[dummy(s),dummy(s)];kill(s,s.enemies[0],'melee');assert.equal(s.player.health,70);kill(s,s.enemies[1]);assert.equal(s.player.health,70,'a bullet does not');
});
test('low profile: hostiles have to be a quarter closer to notice Rook',()=>{
  const seen=perks=>{const s=run({perks}),at=inView(s,640),e=dummy(s,{x:at.x,y:at.y,active:false,seen:0,stagger:0});s.enemies=[e];ticks(s,3);return e.active;};
  assert.equal(seen([null,null,null]),true,'at 640 a rifleman (sight 740) sees him');assert.equal(seen([null,null,'lowprofile']),false,'with the perk that is too far (555)');
});
test('flow state gives three seconds of harder hits after a perfect flow; hardline charges support faster',()=>{
  const s=run({perks:[null,null,'flowstate']}),p=s.player,dmg=()=>{Core.shoot(s,p,'rifle',0);const b=s.projectiles.filter(q=>q.active).at(-1).damage;for(const q of s.projectiles)q.active=false;return b;};
  const base=dmg();s.flowBoost=s.time+3;assert(Math.abs(dmg()/base-1.3)<1e-9);s.time+=3.1;assert.equal(dmg(),base);
  const h=run({support:'recon',perks:[null,null,'hardline']});Core.chargeSupport(h,100);assert.equal(h.support.charge,125);
});

// ---- owning them ----
test('abilities and perks are bought at their rank or earned by a challenge, never both',()=>{
  for(const [kind,table] of [['support',World.support],['perk',World.perks]])for(const [k,v] of Object.entries(table)){assert.equal(!!v.price!==!!v.challenge,true,k+' has a price or a challenge');if(v.challenge)assert.ok(Meta.CHALLENGES[v.challenge],k+' names a real challenge');assert(v.tier>=1&&v.tier<=5);void kind;}
  for(const slot of [0,1,2])assert.equal(Object.values(World.perks).filter(p=>p.slot===slot).length,3,'three perks to choose from in each slot');
  const save=Save.defaults();save.credits=1e6;
  assert.match(Meta.buy(save,'support','turret').reason,/RANK 7/);save.xp=Meta.need(7);assert.equal(Meta.buy(save,'support','turret').ok,true);assert.equal(Meta.owns(save,'support','turret'),true);assert.equal(Meta.buy(save,'support','turret').reason,'OWNED');
  assert.equal(Meta.buy(save,'support','dog').ok,false,'the hound is not for sale');assert.equal(Meta.price(save,'perk','flowstate'),null);
  assert.equal(Meta.buy(save,'perk','regen').ok,true);assert.equal(save.credits,1e6-World.support.turret.price-World.perks.regen.price);
  assert.equal(Meta.rarity(save,'support','airstrike'),4);assert.ok(Meta.catalogue(save).some(i=>i.kind==='perk'&&i.key==='flak'));assert.ok(!Meta.catalogue(save).some(i=>i.key==='dog'),'challenge items are not in the shop list');
});
test('a loadout takes one owned ability and one owned perk per slot, in slots the rank has opened',()=>{
  const save=Save.defaults();save.owned.support=['turret'];save.owned.perks=['regen','scrounger','lowprofile'];const want={support:'turret',perks:['regen','scrounger','lowprofile']};
  assert.deepEqual(Meta.loadout(save,want).perks,[null,null,null],'no slots at rank 1');assert.equal(Meta.loadout(save,want).support,'turret');
  save.xp=Meta.need(2);assert.deepEqual(Meta.loadout(save,want).perks,['regen',null,null]);save.xp=Meta.need(5);assert.equal(Meta.perkSlots(save),2);save.xp=Meta.need(8);assert.deepEqual(Meta.loadout(save,want).perks,['regen','scrounger','lowprofile']);
  assert.deepEqual(Meta.loadout(save,{support:'airstrike',perks:['flak','regen','scrounger']}),{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,support:null,perks:[null,null,null]},'unowned, or in the wrong slot, is dropped');
});
test('meeting a challenge awards its item at the end of that run, once',()=>{
  const save=Save.defaults(),flows=n=>{const s=Core.create({mission:'holdout',difficulty:'standard'});s.stats.flows=n;s.stats.wave=1;return Meta.settle(save,Meta.summarize(s),10);};
  assert.deepEqual(Meta.challenge(save,'flows'),{id:'flows',text:'Chain 50 perfect flows',goal:50,progress:0,done:false});
  assert.deepEqual(flows(20).unlocks,[]);assert.equal(Meta.challenge(save,'flows').progress,20,'flows are now counted across runs');
  assert.deepEqual(flows(10).unlocks.map(u=>[u.kind,u.key]),[['gear','grapple']],'a gadget can be a challenge award too: twenty-five flows is the grapple hook');assert.equal(Meta.owns(save,'gear','grapple'),true);
  const r=flows(25);assert.deepEqual(r.unlocks.map(u=>[u.kind,u.key]),[['perk','flowstate']]);assert.equal(Meta.owns(save,'perk','flowstate'),true);assert.deepEqual(flows(5).unlocks,[],'only once');
  // Knife kills are kept for the career as well, and a deathmatch win counts towards its perk.
  const k=Core.create({mission:'holdout',difficulty:'standard'});k.mastery={melee:31};k.stats.wave=1;assert.deepEqual(Meta.settle(save,Meta.summarize(k),10).unlocks.map(u=>u.key),['executioner']);assert.equal(save.mastery.melee,31);
  save.tdm={standard:{played:6,wins:3},story:{played:2,wins:2}};assert.deepEqual(Meta.claim(save).map(u=>u.key),['hardline']);
  save.stats.kills=400;assert.deepEqual(Meta.claim(save).map(u=>u.key),['dog']);assert.deepEqual(Meta.claim(save),[]);
});
test('the save keeps them, and drops what it does not recognise',()=>{
  const d=Save.decode(JSON.stringify({version:3,stats:{flows:12},owned:{support:['turret','nuke'],perks:['regen','hardline','x']},loadout:{support:'turret',perks:['regen','regen','hardline']},presets:[{support:'nuke',perks:['hardline',null,null]}]}));
  assert.deepEqual(d.owned.support,['turret']);assert.deepEqual(d.owned.perks,['regen','hardline']);assert.equal(d.stats.flows,12);
  assert.equal(d.loadout.support,'turret');assert.deepEqual(d.loadout.perks,['regen',null,'hardline']);assert.equal(d.settings.bindings.support,'KeyV');assert.equal(d.settings.padBindings.support,'back');
  const fresh=Save.decode('{}');assert.deepEqual(fresh.loadout.perks,[null,null,null]);assert.deepEqual(fresh.owned.support,[]);
});
console.log(`${passed} support checks passed.`);

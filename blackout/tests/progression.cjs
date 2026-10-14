'use strict';
// Checks for the gameplay and progression plan (docs/BLACKOUT_GAMEPLAY_PLAN.md): stamina rules, movement chains,
// input buffering, the holdout supply drop and wave modifiers, and the economy (income bands, tiers, drops, kit).
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Save=require('../save.js'),Meta=require('../meta.js');
const {payouts,estimate}=require('../qa/economy-report.cjs');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
function ticks(s,n,input={}){for(let i=0;i<n;i++)Core.step(s,typeof input==='function'?input(i):input);return s;}
function range(){const s=Core.create({training:true});s.enemies=[];s.events=[];return s;}
const seconds=n=>Math.round(n/Core.DT);
const dummy=(extra={})=>({id:'target',x:650,y:625,radius:16,hp:70,maxHp:70,angle:0,type:'infantry',dead:false,zone:0,active:false,seen:0,cooldown:100,stagger:0,reload:0,vx:0,vy:0,...extra});

// ---------- stamina ----------
test('a short sprint refills after the short delay, not at once and not after the long one',()=>{
  const s=range();ticks(s,seconds(1),{mx:1,sprint:true});const spent=s.player.stamina;assert(spent<100&&spent>50);assert.equal(s.player.winded,false);
  ticks(s,seconds(Core.STAMINA_SHORT*.8));assert.equal(s.player.stamina,spent,'no refill inside the short delay');
  ticks(s,seconds(Core.STAMINA_SHORT*.6));assert(s.player.stamina>spent,'refilling once the short delay has passed');});
test('running the bar dry leaves the operator winded: the long delay, then no sprint until a quarter is back',()=>{
  const s=range();s.walls=[];s.player.stamina=6;ticks(s,seconds(.8),{mx:1,sprint:true});
  assert.equal(s.player.stamina,0);assert.equal(s.player.winded,true);assert(s.events.some(e=>e.type==='winded'));assert.notEqual(s.player.state,'sprint','sprint stops by itself');
  ticks(s,seconds(Core.STAMINA_LONG*.85),{mx:-1,sprint:true});assert.equal(s.player.stamina,0,'still empty inside the long delay');
  ticks(s,seconds(Core.STAMINA_LONG*.3),{mx:1,sprint:true});assert(s.player.stamina>0&&s.player.stamina<Core.WINDED_UNTIL);assert.notEqual(s.player.state,'sprint','winded: holding sprint only runs');
  ticks(s,seconds(1.2),{mx:-1});assert(s.player.stamina>=Core.WINDED_UNTIL);assert.equal(s.player.winded,false);Core.step(s,{mx:1,sprint:true});assert.equal(s.player.state,'sprint');});
test('rolls restart the short delay, and a roll without the stamina is refused with a signal',()=>{
  const s=range();Core.step(s,{mx:1,roll:true});assert.equal(s.player.state,'roll');const after=s.player.stamina;ticks(s,seconds(.5));ticks(s,seconds(.3));assert.equal(s.player.stamina,after,'no refill in the second after a roll');
  const t=range();t.player.stamina=20;Core.step(t,{mx:1,roll:true});assert.notEqual(t.player.state,'roll');assert(t.events.some(e=>e.type==='nostamina'));});
test('conditioning shortens the wait before stamina refills',()=>{
  const base=range(),fit=Core.create({training:true,profile:{upgrades:{conditioning:3}}});fit.enemies=[];
  for(const s of [base,fit]){ticks(s,seconds(.5),{mx:1,sprint:true});s.mark=s.player.stamina;ticks(s,seconds(.85));}
  assert.equal(base.player.stamina,base.mark);assert(fit.player.stamina>fit.mark,'three levels cut the one-second wait to 0.7');});
test('reloading no longer drops a sprinting operator to a walk',()=>{
  const jog=range(),walk=range();for(const s of [jog,walk]){s.walls=[];s.player.ammo.rifle=5;Core.step(s,{reload:true});}
  ticks(jog,40,{mx:1,sprint:true});ticks(walk,40,{mx:1});assert(jog.player.reload>0);assert(jog.player.vx>walk.player.vx+80);assert(jog.player.vx<330,'a jog, not a sprint');assert.equal(jog.player.stamina,100,'the jog costs no stamina');});

// ---------- movement chains and buffering ----------
test('a kill made mid-slide and a knife kill out of a dive are flow chains, once each',()=>{
  const s=range();s.player.state='slide';s.player.age=.1;s.player.duration=.7;s.player.slideSpeed=400;s.enemies=[dummy({id:'a'}),dummy({id:'b'})];
  Core.damageEnemy(s,s.enemies[0],999,0,.1,'rifle');assert.equal(s.stats.flows,1);Core.damageEnemy(s,s.enemies[1],999,0,.1,'rifle');assert.equal(s.stats.flows,1,'one chain per slide');
  const kills=s.events.filter(e=>e.type==='kill');assert(kills[0].credits>20,'a slide kill pays a little more');
  const d=range();d.player.diveEnd=d.time-.2;d.enemies=[dummy()];Core.damageEnemy(d,d.enemies[0],999,0,.1,'melee');assert.equal(d.stats.flows,1);
  const late=range();late.player.diveEnd=late.time-3;late.enemies=[dummy()];Core.damageEnemy(late,late.enemies[0],999,0,.1,'melee');assert.equal(late.stats.flows,0);});
test('rolling through an attack is a flow chain; rolling through nothing is not',()=>{
  const s=range();Core.step(s,{mx:1,roll:true});ticks(s,12);assert.equal(Core.damagePlayer(s,20,0,0,'rifle'),false);assert.equal(s.stats.flows,1);assert(s.events.some(e=>e.type==='dodge'));
  assert.equal(Core.damagePlayer(s,20,0,0,'rifle'),false);assert.equal(s.stats.flows,1,'one chain per roll');assert.equal(s.player.health,100);
  const t=range();Core.step(t,{mx:1,roll:true});ticks(t,12);Core.damagePlayer(t,20,0,0,'fire');assert.equal(t.stats.flows,0,'standing fire is not a dodge');});
test('a slide pressed a few frames before sprint speed still happens; one pressed far too early does not',()=>{
  const early=range();early.walls=[];ticks(early,2,{mx:1,sprint:true});assert(Math.hypot(early.player.vx,early.player.vy)<265);
  Core.step(early,{mx:1,sprint:true,slide:true});assert.notEqual(early.player.state,'slide','too slow on the frame it was pressed');ticks(early,10,{mx:1,sprint:true});assert.equal(early.player.state,'slide','the buffered press fires as soon as it can');
  const tooEarly=range();tooEarly.walls=[];Core.step(tooEarly,{slide:true});ticks(tooEarly,30);ticks(tooEarly,40,{mx:1,sprint:true});assert.notEqual(tooEarly.player.state,'slide','a press from a quarter of a second ago is forgotten');});
test('interact pressed during a roll is held until the roll ends instead of being lost',()=>{
  const s=range();s.pickups.push({id:'crate',x:s.player.x,y:s.player.y,type:'offer',item:'stim',weapon:null,cost:0,taken:false});const stims=s.player.stims;
  Core.step(s,{roll:true});assert.equal(s.player.state,'roll');s.player.x=s.pickups.at(-1).x;s.player.y=s.pickups.at(-1).y;
  // Pressed with only a few frames of the roll left: the press is kept and lands the moment the roll ends.
  s.player.age=s.player.duration-.03;Core.step(s,{interact:true});assert.equal(s.player.stims,stims,'ignored while rolling');
  s.pickups.at(-1).x=s.player.x;s.pickups.at(-1).y=s.player.y;ticks(s,8,i=>{s.pickups.at(-1).x=s.player.x;s.pickups.at(-1).y=s.player.y;return {};});assert.equal(s.player.stims,stims+1);});

// ---------- holdout: supply drop and wave modifiers ----------
function holdoutTo(wave,options={}){const s=Core.create({mission:'holdout',seed:1701,...options}),log=[];
  for(let i=0;i<120*60*20&&s.stats.wave<wave;i++){s.player.health=100;Core.step(s,{});for(const e of s.events)if(['wave','waveclear','supplydrop'].includes(e.type))log.push(e);s.events.length=0;
    for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,99999,0,.1,'rifle',true,true);}
  return {s,log};}
test('clearing a holdout wave pays the wave bonus and lands a three-crate supply drop',()=>{
  const {s,log}=holdoutTo(1);const clear=log.find(e=>e.type==='waveclear');assert.equal(clear.bonus,50,'40 + 10 x wave');assert(log.some(e=>e.type==='supplydrop'));
  const offers=s.pickups.filter(q=>q.type==='offer'&&!q.taken);assert.equal(offers.length,3);assert.equal(new Set(offers.map(o=>o.item)).size,3,'three different offers');assert(offers.every(o=>o.cost>0&&Core.clearAt(s,o.x,o.y,12)));});
test('a crate is bought with this run\'s credits, refused when they fall short, and gone when the next wave starts',()=>{
  const {s}=holdoutTo(1);const offers=s.pickups.filter(q=>q.type==='offer'),o=offers[0],p=s.player;p.x=o.x;p.y=o.y;assert.equal(Core.nearbyOffer(s),o);
  s.stats.credits=o.cost-1;s.events.length=0;Core.interact(s,{});assert.equal(o.taken,false);assert(s.events.some(e=>e.type==='deny'));
  s.stats.credits=o.cost+5;Core.interact(s,{});assert.equal(o.taken,true);assert.equal(s.stats.credits,5);assert.equal(s.stats.spent,o.cost);assert(s.events.some(e=>e.type==='bought'));
  for(let i=0;i<120*12&&s.director.wave<2;i++){p.health=100;Core.step(s,{});}assert.equal(s.director.wave,2);assert(!s.pickups.some(q=>q.type==='offer'&&!q.taken),'unsold crates leave with the next wave');});
test('each supply item does what it says, and a bought gun is carried for the run',()=>{
  const fresh=()=>{const s=Core.create({mission:'holdout',loadout:{primary:'rifle',secondary:'pistol',lethal:'frag',tactical:'flash'}});s.stats.credits=9999;return s;};
  const buy=(s,item,extra={})=>{const q={id:'o',x:s.player.x,y:s.player.y,type:'offer',item,weapon:null,cost:100,taken:false,...extra};s.pickups.push(q);Core.interact(s,{});assert(q.taken,item);return s;};
  let s=fresh();s.player.armor=10;buy(s,'armor');assert.equal(s.player.armor,60);
  s=fresh();s.player.health=30;buy(s,'health');assert.equal(s.player.health,100);
  s=fresh();const stims=s.player.stims;buy(s,'stim');assert.equal(s.player.stims,stims+1);
  s=fresh();s.player.reserve.rifle=3;s.player.ammo.rifle=1;buy(s,'ammo');assert.equal(s.player.ammo.rifle,World.weapons.rifle.capacity);assert.equal(s.player.reserve.rifle,Core.reserveOf(s,'rifle'));
  s=fresh();s.player.grenades=0;s.player.tacticals=0;buy(s,'gadgets');assert.equal(s.player.grenades,World.gear.frag.count);assert.equal(s.player.tacticals,World.gear.flash.count);
  s=fresh();buy(s,'weapon',{weapon:'magnum'});assert.deepEqual(s.player.slots,['rifle','magnum']);assert.equal(s.player.slot,1);assert(s.owned.includes('magnum'));});
test('every third wave carries a modifier, commander waves never do, and it pays extra',()=>{
  const {log}=holdoutTo(6);const waves=log.filter(e=>e.type==='wave'),clears=log.filter(e=>e.type==='waveclear');
  assert.deepEqual(waves.map(w=>!!w.modifier),[false,false,true,false,false,true]);assert(waves.filter(w=>w.modifier).every(w=>Core.MODIFIERS[w.modifier]));
  assert.equal(clears[1].bonus,60);assert.equal(clears[2].bonus,40+30+50+30,'wave 3: wave bonus plus modifier bonus');assert.equal(clears[4].bonus,90);});
test('the modifiers change the wave: swarm is all rushers, armoured adds plating, blackout dims and restores the light',()=>{
  // Wave 3 is a modifier wave. Which one is the simulation's pick, so try seeds until it is the one wanted.
  const force=mod=>{for(let seed=1;seed<200;seed++){const s=Core.create({mission:'holdout',seed});
      for(let i=0;i<120*60*10&&s.director.wave<3;i++){s.player.health=100;Core.step(s,{});s.events.length=0;for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,99999,0,.1,'rifle',true,true);}
      if(s.director.modifier===mod)return s;}throw new Error('no seed gave '+mod);};
  const swarm=force('swarm');assert(swarm.director.queue.concat(swarm.spawnWarnings).every(e=>e.type==='rusher'));assert(swarm.director.queue.length+swarm.spawnWarnings.length>=12);
  const plated=force('armoured');for(let i=0;i<120*4;i++){plated.player.health=100;Core.step(plated,{});}const foe=plated.enemies.find(e=>!e.dead&&e.plated);assert(foe);assert.equal(foe.maxHp,World.archetypes[foe.type].hp*1.5*foe.tough,'plating on top of the wave toughness');
  const dark=force('blackout');assert(dark.dark>=.86);for(let i=0;i<120*90&&dark.stats.wave<3;i++){dark.player.health=100;Core.step(dark,{});dark.events.length=0;for(const e of dark.enemies)if(!e.dead&&e.active)Core.damageEnemy(dark,e,99999,0,.1,'rifle',true,true);}assert.equal(dark.stats.wave,3);assert.equal(dark.dark,0,'the lights come back when the wave is cleared');});

test('every killhouse lets its hostiles reach the operator: no spawn point is walled off',()=>{
  for(const h of World.holdoutMaps){const s=Core.create({mission:h.id}),n=Core.navField(s);
    for(const q of s.map.spawnPoints)assert(n.dist[Math.floor(q.y/Core.CELL)*n.w+Math.floor(q.x/Core.CELL)]>=0,h.id+' spawn point '+Math.round(q.x)+','+Math.round(q.y)+' is cut off from the start');
    assert(!s.walls.some(w=>w.kind==='gate'),h.id+' still has a campaign gate');}});

test('hostiles close on an operator who stands still in every killhouse instead of jamming on the way',()=>{
  const A=World.archetypes;
  for(const h of World.holdoutMaps)for(const seed of [1701,7,42]){const s=Core.create({mission:h.id,seed}),p=s.player,was=new Map();
    for(let i=0;i<120*45;i++){p.health=100;Core.step(s,{aimX:p.x+300,aimY:p.y});s.events.length=0;if(i===120*30)for(const e of s.enemies)was.set(e.id,{x:e.x,y:e.y});}
    // Stalled: has not moved in fifteen seconds and is still further away than it fights from.
    const stalled=s.enemies.filter(e=>{const t=was.get(e.id),a=A[e.type];return !e.dead&&t&&Math.hypot(e.x-t.x,e.y-t.y)<25&&Core.distance(e,p)>(a.melee?60:a.range||500);});
    assert.equal(stalled.length,0,h.id+' seed '+seed+': '+stalled.map(e=>e.type+' stuck '+Math.round(Core.distance(e,p))+' away').join(', '));}});

// ---------- economy ----------
test('holdout pays inside the agreed band at waves 5, 10 and 15 on every difficulty',()=>{
  // Credits before the debrief's difficulty multiplier. "none" never chains kills, "full" always does.
  const BAND={5:[800,2100],10:[2400,5600],15:[4500,11000]};
  for(const d of World.order){const rows=payouts(d,15);for(const [wave,[lo,hi]] of Object.entries(BAND)){const r=rows[wave-1];assert(r.none>=lo&&r.full<=hi,`${d} wave ${wave}: ${r.none} to ${r.full} is outside ${lo} to ${hi}`);assert(r.full<r.none*1.6,'the combo is a bonus, not most of the pay');}}});
test('by the pacing estimate everything but the legendary pair takes about thirteen hours, and the pair several more',()=>{
  const e=estimate();assert(e.firstPurchaseMinutes<=20,'first purchase after '+e.firstPurchaseMinutes+' minutes');assert(e.hours>=18&&e.hours<=25,'estimated '+e.hours.toFixed(1)+' hours for the whole armory');
  // The log is every purchase in order, as "<hours>h <name>": the two legendary guns come last, well after the rest.
  const bought=e.log.map(l=>({at:parseFloat(l),name:l.slice(l.indexOf(' ')+1)})),rest=bought.slice(0,-2);assert.deepEqual(bought.slice(-2).map(b=>b.name),['XR-9','ARC-7']);
  assert(rest.at(-1).at>=10&&rest.at(-1).at<=15,'everything else is owned after '+rest.at(-1).at+' hours');assert(e.hours-rest.at(-1).at>=4,'the legendary pair adds '+(e.hours-rest.at(-1).at).toFixed(1)+' hours');
  assert.deepEqual(Object.keys(e.tiers),['2','3','4','5']);assert(e.tiers[5]>e.tiers[4]&&e.tiers[4]>e.tiers[3]&&e.tiers[3]>e.tiers[2]);});
test('every item has a grade, and the legendary pair costs several times anything else',()=>{
  const save=Save.defaults(),W=World.weapons;assert.equal(Meta.RARITY.length,5);
  assert.equal(Meta.rarity(save,'weapon','rifle'),1);assert.equal(Meta.rarity(save,'weapon','smg'),2);assert.equal(Meta.rarity(save,'weapon','rail'),5);assert.equal(Meta.rarity(save,'gear','frag'),1);assert.equal(Meta.rarity(save,'gear','emp'),4);
  assert.equal(Meta.rarity(save,'kit','pulse'),5,'a kit part is graded with its gun');
  // An upgrade is graded by the level it would be bought at next.
  assert.equal(Meta.rarity(save,'upgrade','plating'),1);save.upgrades.plating=1;assert.equal(Meta.rarity(save,'upgrade','plating'),2);save.upgrades.plating=3;assert.equal(Meta.rarity(save,'upgrade','plating'),4);
  for(const k of Object.keys(W))assert(Meta.rarity(save,'weapon',k)>=1&&Meta.rarity(save,'weapon',k)<=5);
  const legendary=Object.keys(W).filter(k=>W[k].tier===5),rest=Object.keys(W).filter(k=>W[k].tier<5),top=Math.max(...rest.map(k=>W[k].price||0));assert.deepEqual(legendary.sort(),['pulse','rail']);
  for(const k of legendary)assert(W[k].price>=top*3.5,W[k].short+' costs '+W[k].price+', against '+top+' for the dearest other gun');
  assert.equal(World.tiers[4],15,'and they open at the last rank title');assert.equal(Meta.rankOf(Meta.need(15)).title,'BLACKOUT');});
test('the armory opens in five tiers by rank',()=>{
  const save=Save.defaults();save.credits=1e6;assert.equal(Meta.locked(save,'weapon','shotgun'),0);assert.equal(Meta.locked(save,'weapon','rail'),15);assert.equal(Meta.locked(save,'gear','emp'),10);
  const r=Meta.buy(save,'weapon','smg');assert.equal(r.ok,false);assert.match(r.reason,/RANK 4/);save.xp=Meta.need(4);assert.equal(Meta.buy(save,'weapon','smg').ok,true);
  // An upgrade's next level decides its tier: levels 1, 2 and 3 sit in tiers 1, 2 and 4.
  const fresh=Save.defaults();fresh.credits=1e6;assert.equal(Meta.buy(fresh,'upgrade','plating').ok,true);assert.match(Meta.buy(fresh,'upgrade','plating').reason,/RANK 4/);fresh.xp=Meta.need(4);assert.equal(Meta.buy(fresh,'upgrade','plating').ok,true);assert.match(Meta.buy(fresh,'upgrade','plating').reason,/RANK 10/);
  for(const [k,w] of Object.entries(World.weapons))assert(w.tier>=1&&w.tier<=5,k);for(const [k,g] of Object.entries(World.gear))assert(g.tier>=1&&g.tier<=5,k);});
test('a gun found in the field is 25% off from then on, and is not owned',()=>{
  const save=Save.defaults();const full=Meta.price(save,'weapon','marksman');save.found.push('marksman');assert.equal(Meta.price(save,'weapon','marksman'),full*.75);assert.equal(Meta.owns(save,'weapon','marksman'),false);
  assert.deepEqual(Meta.loadout(save,{primary:'marksman'}).primary,'rifle','a found gun cannot be put in a loadout until it is bought');});
test('weapon kit parts are bought in order, need mastery and the gun, and change the gun',()=>{
  const save=Save.defaults();save.credits=1e6;save.xp=Meta.need(13);assert.match(Meta.buy(save,'kit','smg').reason,/BUY THE WEAPON/);assert.match(Meta.buy(save,'kit','rifle').reason,/MASTERY/);
  save.mastery.rifle=Meta.MASTERY[0];assert.equal(Meta.buy(save,'kit','rifle').ok,true);assert.equal(save.kit.rifle,1);assert.match(Meta.buy(save,'kit','rifle').reason,/MASTERY LEVEL 2/);
  save.mastery.rifle=Meta.MASTERY[2];assert(Meta.buy(save,'kit','rifle').ok);assert(Meta.buy(save,'kit','rifle').ok);assert.equal(Meta.owns(save,'kit','rifle'),true);assert.equal(Meta.buy(save,'kit','rifle').ok,false);
  const plain=Core.create({training:true}),fitted=Core.create({training:true,profile:Meta.profile(save)});assert.deepEqual(fitted.mods.kit.rifle,3);
  assert(Core.diff(fitted)&&fitted.mods.kit.pistol===0);for(const s of [plain,fitted]){s.enemies=[];s.player.ammo.rifle=1;Core.step(s,{reload:true});}assert(fitted.player.reload<plain.player.reload,'fast mag');});
test('campaign killhouses pay more than the default one and keep their own records',()=>{
  const run=id=>({mode:'holdout',mission:id,difficulty:'standard',completed:false,time:300,stats:{kills:60,flows:0,damage:0,credits:2000,intel:0,bestCombo:3,wave:7,spent:300},mastery:{},rating:null,score:0,deaths:0});
  const a=Save.defaults(),b=Save.defaults(),base=Meta.settle(a,run('holdout'),50),hard=Meta.settle(b,run('holdout-kestrel'),50);
  assert(hard.credits>base.credits);assert(hard.lines.some(l=>l.label.startsWith('KILLHOUSE')&&l.note==='×1.3'));assert(!base.lines.some(l=>l.label.startsWith('KILLHOUSE')));
  assert.equal(b.killhouse['holdout-kestrel'].standard,7);assert.equal(a.killhouse.holdout.standard,7);assert.equal(b.killhouse.holdout,undefined);assert(base.lines[0].note.includes('300 CR SPENT'));});
test('the debrief names the next goal, and the armory marks the next buy for the coming operation',()=>{
  const save=Save.defaults();let g=Meta.nextGoal(save);assert.equal(g.item.need,g.item.cost);assert.deepEqual(g.tier.tier,2);assert.equal(g.tier.rank,4);
  save.credits=5000;g=Meta.nextGoal(save);assert(g.afford);assert(!g.item||g.item.cost>5000);
  // The opening operation recommends only the starting kit, so the suggestion falls back to the cheapest open gun or gadget.
  const first=Meta.nextUp(Save.defaults());assert(first&&first.kind!=='upgrade');assert.equal(Meta.locked(Save.defaults(),first.kind,first.key),0);
  save.missions.crash={done:true,best:null,medals:[],diffs:[],intel:false};
  const up=Meta.nextUp(save),rec=World.missions[1].rec;assert(up&&[...rec.weapons,...rec.gear].includes(up.key));assert.equal(Meta.owns(save,up.kind,up.key),false);});

// ---------- saves ----------
test('a version 2 save starts the economy again but keeps campaign progress, records, mastery and settings',()=>{
  const old={version:2,credits:99999,xp:42000,owned:{weapons:['rifle','pistol','rail','smg'],gear:['emp']},upgrades:{plating:3},loadout:{primary:'rail',tactical:'emp'},seen:['rail'],
    missions:{crash:{done:true,medals:['complete'],diffs:['standard']},ruins:{done:true,medals:[],diffs:['standard']}},holdout:{standard:11},mastery:{rifle:70},stats:{kills:900,missions:5,deaths:9},settings:{volume:.3,callsign:'GHOST'}};
  const s=Save.decode(JSON.stringify(old));assert.equal(s.version,3);assert.equal(s.credits,0);assert.equal(s.xp,0);assert.deepEqual(s.upgrades,{});assert.deepEqual(s.loadout,{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,support:null,perks:[null,null,null]});
  assert.deepEqual(s.owned,{weapons:['rifle','pistol','shotgun'],gear:['frag'],support:[],perks:[]},'the opening operation\'s story cache is kept');
  assert.equal(s.missions.ruins.done,true);assert.equal(s.holdout.standard,11);assert.equal(s.mastery.rifle,70);assert.equal(s.stats.kills,900);assert.equal(s.settings.callsign,'GHOST');assert.equal(s.drill,true);assert.equal(s.notice,'rebalance');
  const never=Save.decode(JSON.stringify({version:2,credits:500,settings:{}}));assert.deepEqual(never.owned.weapons,['rifle','pistol']);});
test('version 3 saves keep finds, kit, killhouse records, presets and the drill flag, and reject bad values',()=>{
  const d=Save.defaults();assert.equal(d.drill,false);assert.equal(d.presets.length,3);
  const raw={...d,credits:777,owned:{weapons:['rifle','pistol','smg'],gear:['smoke']},loadout:{primary:'smg',secondary:'pistol',lethal:null,tactical:'smoke'},preset:1,presets:[{primary:'rail'},{primary:'smg'},{primary:'smg',tactical:'smoke'}],
    found:['marksman','nonsense'],kit:{rifle:2,smg:9,bogus:1},killhouse:{holdout:{standard:6,weird:3},'not-a-map':{standard:9}},drill:true,notice:'rebalance'};
  const s=Save.decode(JSON.stringify(raw));assert.equal(s.credits,777);assert.deepEqual(s.found,['marksman']);assert.deepEqual(s.kit,{rifle:2,smg:3});assert.deepEqual(s.killhouse,{holdout:{standard:6}});assert.equal(s.drill,true);assert.equal(s.preset,1);
  assert.equal(s.presets[0].primary,'rifle','a preset cannot name a gun the save does not own');assert.deepEqual(s.presets[1],s.loadout,'the active preset mirrors the loadout');assert.equal(s.presets[2].tactical,'smoke');
  assert.deepEqual(Save.decode(JSON.stringify(s)),s,'stable across a second load');});
console.log(`\n${passed} progression checks passed.`);

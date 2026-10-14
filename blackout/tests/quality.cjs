'use strict';
// Regression checks for the audit fixes: contracts a player can actually do, a battlefield that clears its dead, and
// the other rules added with them. Everything here runs the real simulation and the real save/progression code.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
const W=World.weapons,A=World.archetypes;
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const kinds=save=>({shotgun:save.owned.weapons.some(k=>W[k].cls==='shotgun'),precision:save.owned.weapons.some(k=>W[k].cls==='precision'),smg:save.owned.weapons.some(k=>W[k].cls==='smg')});

// ---------- daily contracts ----------
test('a fresh profile is never offered a contract it cannot do, on any day',()=>{
  const fresh=Save.defaults();
  for(let day=19000;day<19400;day++){const ids=Meta.contractsFor(day,fresh).map(c=>c.id);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
    for(const id of ['smg','shotgun','precision','explosive'])assert(!ids.includes(id),`day ${day} offered ${id} to a fresh profile`);}});
test('weapon contracts open up with the armory, and the same player gets the same three on the same day',()=>{
  const save=Save.defaults();save.owned.weapons.push('smg','shotgun','marksman');save.owned.gear.push('frag');const seen=new Set();
  for(let day=19000;day<19400;day++)for(const c of Meta.contractsFor(day,save))seen.add(c.id);
  for(const id of ['smg','shotgun','precision','explosive'])assert(seen.has(id),id+' should be offered once owned');
  assert.deepEqual(Meta.contractsFor(19123,save).map(c=>c.id),Meta.contractsFor(19123,save).map(c=>c.id));
  assert.equal(Meta.contractsFor(5).length,3,'without a save every contract is eligible, as before');});
test('an explosive contract needs an explosive: a launcher or an explosive gadget, not a throwing knife',()=>{
  const save=Save.defaults();save.owned.gear.push('knife','smoke');const has=()=>{for(let d=19000;d<19400;d++)if(Meta.contractsFor(d,save).some(c=>c.id==='explosive'))return true;return false;};
  assert.equal(has(),false);save.owned.weapons.push('thumper');assert.equal(has(),true);});
test('today\'s list keeps its progress; an impossible contract nobody has started is swapped, a started one is kept',()=>{
  const save=Save.defaults(),day=19050;save.contracts={day,list:[{id:'smg',progress:0,done:false},{id:'shotgun',progress:4,done:false},{id:'kills',progress:12,done:false}]};
  const list=Meta.refreshContracts(save,day);assert.equal(list.length,3);assert(!list.some(c=>c.id==='smg'),'the unstarted SMG contract was replaced');
  assert(list.some(c=>c.id==='shotgun'&&c.progress===4),'progress already made is never thrown away');assert(list.some(c=>c.id==='kills'&&c.progress===12));
  assert.equal(new Set(list.map(c=>c.id)).size,3,'no duplicates');
  const again=Meta.refreshContracts(save,day);assert.deepEqual(again.map(c=>c.id),list.map(c=>c.id),'stable within the day');});
test('a contract id the game no longer knows is replaced, and a saved list survives a save round trip',()=>{
  const save=Save.defaults(),day=19051;save.contracts={day,list:[{id:'bogus',progress:0,done:false},{id:'kills',progress:3,done:false},{id:'flows',progress:0,done:true}]};
  const list=Meta.refreshContracts(save,day);assert(!list.some(c=>c.id==='bogus'));assert(list.every(c=>c.text&&c.goal));
  const back=Save.decode(JSON.stringify(save));assert.deepEqual(back.contracts.list.map(c=>c.id),save.contracts.list.map(c=>c.id));});
test('a contract still pays at the end of a run',()=>{
  const save=Save.defaults(),day=19052;Meta.refreshContracts(save,day);const kills=save.contracts.list.find(c=>c.id==='kills')||save.contracts.list[0];
  save.contracts.list=[{id:'kills',progress:39,done:false}];const run={mode:'holdout',mission:'holdout',difficulty:'standard',completed:false,time:100,stats:{kills:5,flows:0,damage:0,credits:0,intel:0,bestCombo:1,wave:2,spent:0},mastery:{},rating:null,score:0,deaths:0};
  const report=Meta.settle(save,run,day);assert(report.lines.some(l=>l.label==='CONTRACT / ELIMINATE 40 HOSTILES'));assert(kills);});

// ---------- the dead are cleared away ----------
test('a long holdout run keeps only the recent dead: the battlefield stays bounded and the kills still count',()=>{
  const s=Core.create({mission:'holdout',seed:3});let most=0;
  for(let i=0;i<120*60*14&&s.stats.wave<17;i++){s.player.health=100;Core.step(s,{});s.events.length=0;for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,1e6,0,.1,'rifle',true,true);most=Math.max(most,s.enemies.length);}
  assert(s.stats.wave>=17);assert(most<70,'at most '+most+' hostiles kept at once');assert(s.stats.kills>200,'every kill was counted: '+s.stats.kills);
  assert(s.enemies.every(e=>!e.dead||e.deathAge<=Core.CORPSE.life+.6),'no body outlives its time');});
test('a body lies there for a few seconds before it is cleared, and a medic can still reach it in that time',()=>{
  const s=Core.create({mission:'holdout',seed:4});s.director.timer=99999;s.enemies=[];const e={id:'x',type:'infantry',x:500,y:500,radius:17,hp:70,maxHp:70,angle:0,hull:0,dead:false,zone:0,active:true,seen:4,cooldown:99,stagger:999,reload:0,vx:0,vy:0,spawned:true,wave:1};
  s.enemies=[e];Core.damageEnemy(s,e,999,0,.1,'rifle');for(let i=0;i<120*4;i++)Core.step(s,{});assert(s.enemies.includes(e),'still there after 4 s');
  for(let i=0;i<120*3;i++)Core.step(s,{});assert(!s.enemies.includes(e),'gone after the corpse time');});
test('authored campaign soldiers are never cleared, so a checkpoint still knows who is dead',()=>{
  const s=Core.create({mission:'crash',seed:2});const first=s.enemies.find(e=>!e.spawned);Core.damageEnemy(s,first,999,0,.1,'rifle');
  for(let i=0;i<120*10;i++){s.player.health=100;s.player.iframes=1;Core.step(s,{});s.events.length=0;}
  assert(s.enemies.includes(first),'the authored body is kept');Core.checkpoint(s);assert(s.checkpoint.killed.includes(first.id));});
test('team deathmatch never prunes operators',()=>{
  const s=Core.create({mode:'tdm',mission:'holdout',seed:5,mates:[{bot:true}]});const n=s.enemies.length;for(let i=0;i<120*10;i++)Core.step(s,{});assert.equal(s.enemies.length,n);});

// ---------- weapon roles ----------
const Report=require('../qa/weapon-report.cjs');
const target=(s,type,extra={})=>{const t=A[type];const e={id:'t',type,x:600,y:600,radius:t.radius||17,hp:1e5,maxHp:1e5,angle:Math.PI,hull:Math.PI,dead:false,zone:0,active:true,seen:4,cooldown:99,stagger:0,reload:0,vx:0,vy:0,spawned:true,...extra};s.enemies=[e];return e;};
const hitWith=(k,type,extra={},opts={})=>{const s=Core.create({mission:'holdout',seed:1,...opts});s.director.timer=1e9;const e=target(s,type,extra);Core.damageEnemy(s,e,100,0,.1,k);return {s,e,dealt:1e5-e.hp};};
test('armour-piercing rounds get through armour and shield fronts; ordinary rounds do not',()=>{
  assert.equal(hitWith('rifle','heavy').dealt,50);assert.equal(hitWith('battle','heavy').dealt,75,'half armour-piercing');assert.equal(hitWith('marksman','heavy').dealt,100,'fully armour-piercing');
  assert(hitWith('marksman','shield').dealt>hitWith('rifle','shield').dealt*5,'a marksman round goes through a riot shield');});
test('a counter-shot lands half as hard again on a hostile winding up an attack, and only then',()=>{
  assert.equal(hitWith('marksman','infantry',{attack:.8,attackAge:.2}).dealt,150);assert.equal(hitWith('marksman','infantry').dealt,100);assert.equal(hitWith('rifle','infantry',{attack:.8}).dealt,100);
  assert(hitWith('marksman','infantry',{attack:.8}).s.events.some(e=>e.type==='countershot'));});
test('suppressing fire slows a soldier\'s wind-up and widens its shots; machines shrug it off',()=>{
  const {e}=hitWith('lmg','infantry');assert(e.suppressed>0);assert.equal(hitWith('lmg','drone').e.suppressed,undefined);
  const s=Core.create({mission:'holdout',seed:2});s.director.timer=1e9;s.player.iframes=1e9;const p=s.player;const near=target(s,'infantry',{x:p.x+300,y:p.y,angle:Math.PI,cooldown:0,lastX:p.x,lastY:p.y});near.suppressed=5;
  let wind=0;for(let i=0;i<60&&!wind;i++){Core.step(s,{});if(near.attack>0)wind=near.attack;}assert(wind>A.infantry.windup*1.3,'wind-up '+wind);});
test('a steady gun keeps its accuracy at a run and hits harder from a slide',()=>{
  const spreadAt=(k,state)=>{const s=Core.create({training:true});s.enemies=[];const p=s.player;p.vx=300;p.state=state;Core.shoot(s,p,k,0);const b=s.projectiles.find(q=>q.active);return {dmg:b.damage};};
  assert(spreadAt('smg','slide').dmg>spreadAt('smg','run').dmg*1.2);assert.equal(spreadAt('rifle','slide').dmg,spreadAt('rifle','run').dmg);});
test('the XR-9 overloads barriers: it drains the Warden\'s shield twice as fast and gets more through',()=>{
  const shield={shieldMax:1000,shieldHp:1000};const pulse=hitWith('pulse','mech',{...shield}),rifle=hitWith('rifle','mech',{...shield});
  assert(pulse.dealt>rifle.dealt*2.5);assert.equal(1000-pulse.e.shieldHp,2*(1000-rifle.e.shieldHp));});
test('every gun for sale is better than the free one in its slot at something, and the legendary pair out-damages it',()=>{
  const rows=Report.matrix(),why=Report.reasons(rows);
  for(const r of why){if(r.key==='rifle'||r.key==='pistol')continue;assert(r.beats.length>0,r.key+' has no reason to exist');}
  const rifle=rows.find(r=>r.key==='rifle');for(const k of ['pulse','rail'])assert(rows.find(r=>r.key===k).sustained>rifle.sustained,k+' should out-damage the free rifle');
  // No cheap gun is better than a legendary at everything.
  for(const r of rows.filter(r=>typeof r.price==='number'&&r.price<=13000))for(const k of ['pulse','rail']){const L=rows.find(x=>x.key===k);assert(Report.SCENARIOS.some(sc=>sc==='ttk'?L[sc]<r[sc]:L[sc]>r[sc]),r.key+' matches the '+k+' everywhere');}});
test('every gun has a role and its traits are listed in the armory',()=>{for(const [k,w] of Object.entries(W)){assert(w.role,k+' has no role');assert(Array.isArray(Meta.weaponTraits(k)));}
  assert(Meta.weaponTraits('marksman').includes('COUNTER-SHOT ×1.5'));assert(Meta.weaponTraits('lmg').includes('SUPPRESSING'));});

// ---------- perks that make builds ----------
const run=(perks,extra={})=>{const s=Core.create({mission:'holdout',seed:3,loadout:{primary:'rifle',secondary:'pistol',lethal:'frag',perks,...extra}});s.director.timer=1e9;s.enemies=[];s.events=[];return s;};
test('executioner: the knife finishes anyone under 55 health',()=>{
  const knife=(perks)=>{const s=run(perks),p=s.player;const e=target(s,'infantry',{x:p.x+40,y:p.y,hp:50,maxHp:70});p.angle=0;Core.melee(s,false);for(let i=0;i<40;i++)Core.step(s,{});return e.dead;};
  assert.equal(knife([null,'executioner',null]),true);assert.equal(knife([null,null,null]),false,'without the perk 50 health survives a first slash');});
test('flow state: a kill in the boost keeps it going, but never more than six seconds ahead',()=>{
  const s=run([null,null,'flowstate']);s.flowBoost=s.time+3;const before=s.flowBoost;for(let i=0;i<10;i++){const e=target(s,'infantry',{hp:1,maxHp:70});Core.damageEnemy(s,e,10,0,.1,'rifle');}
  assert(s.flowBoost>before);assert(s.flowBoost<=s.time+6);});
test('hardline: gadget kills charge field support twice as fast; scrounger: every third gadget kill returns a lethal',()=>{
  const charge=perks=>{const s=run(perks,{support:'airstrike'});const e=target(s,'infantry',{hp:1});Core.damageEnemy(s,e,10,0,.1,'grenade');return s.support.charge;};
  const base=charge([null,null,null]),hard=charge([null,null,'hardline']);assert(Math.abs(hard-base*2*1.25)<1e-9,'double, on top of the 25%: '+base+' -> '+hard);
  const s=run([null,'scrounger',null]);s.player.grenades=0;for(let i=0;i<3;i++){const e=target(s,'infantry',{hp:1});Core.damageEnemy(s,e,10,0,.1,'grenade');}assert.equal(s.player.grenades,1);});

// ---------- seeded challenges and local records ----------
test('a seeded challenge is the same for everyone on the same day, different the next, and the weekly holds all week',()=>{
  const a=Meta.challengeFor('daily',20400),b=Meta.challengeFor('daily',20400),c=Meta.challengeFor('daily',20401);assert.deepEqual(a,b);assert.notDeepEqual(a,c);
  const week=[20402,20403,20404,20405,20406,20407,20408].map(d=>Meta.challengeFor('weekly',d));assert(week.every(w=>w.period===week[0].period));assert.notEqual(Meta.challengeFor('weekly',20409).period,week[0].period);
  for(const cfg of [a,c,week[0]]){assert(World.holdoutMaps.some(h=>h.id===cfg.map));assert(W[cfg.loadout.primary]&&W[cfg.loadout.secondary]);assert(cfg.mutators.every(k=>World.mutators[k]));}});
test('the same challenge seed plays out the same waves',()=>{
  const cfg=Meta.challengeFor('daily',20410),run=()=>{const s=Core.create({mission:cfg.map,difficulty:cfg.difficulty,seed:cfg.seed,loadout:cfg.loadout,mutators:cfg.mutators,owned:Object.values(cfg.loadout).filter(k=>W[k])});
    const out=[];for(let i=0;i<120*60*4&&s.stats.wave<4;i++){s.player.health=100;Core.step(s,{});for(const e of s.events)if(e.type==='wave')out.push(e.wave+':'+s.director.queue.map(q=>q.type).join(','));s.events.length=0;for(const e of s.enemies)if(!e.dead&&e.active)Core.damageEnemy(s,e,1e6,0,.1,'rifle',true,true);}return out;};
  const first=run();assert(first.length>=4);assert.deepEqual(run(),first);});
test('the daily counts its first attempt only; the weekly keeps its best; nothing is filed twice',()=>{
  const save=Save.defaults(),day=20420,d=Meta.challengeFor('daily',day),w=Meta.challengeFor('weekly',day);
  const s1=Meta.startChallenge(save,d,day);assert.equal(s1.eligible,true);const r1=Meta.recordChallenge(save,d,{wave:6,kills:70,bestCombo:5},'run1',s1.eligible);assert.equal(r1.practice,false);assert.equal(r1.rank,1);
  const s2=Meta.startChallenge(save,d,day);assert.equal(s2.eligible,false,'a second daily attempt is practice');assert.equal(Meta.recordChallenge(save,d,{wave:9},'run2',s2.eligible).practice,true);
  assert.equal(Meta.recordChallenge(save,d,{wave:6,kills:70,bestCombo:5},'run1',true).duplicate,true);
  for(const [id,wave] of [['w1',4],['w2',8],['w3',6]]){const st=Meta.startChallenge(save,w,day);assert.equal(st.eligible,true);Meta.recordChallenge(save,w,{wave},id,st.eligible);}
  assert.equal(save.challenges.best['weekly:'+w.period].wave,8);assert.deepEqual(Meta.challengeBoard(save,'weekly').map(e=>e.wave),[8,6,4]);
  const old=Meta.challengeFor('daily',day-3);assert.equal(Meta.startChallenge(save,old,day).eligible,false,'a past day is practice');});
test('challenge records survive a save round trip, and the board keeps the best ten',()=>{
  const save=Save.defaults(),day=20430,w=Meta.challengeFor('weekly',day);for(let i=0;i<14;i++){Meta.startChallenge(save,w,day);Meta.recordChallenge(save,w,{wave:i,kills:i*3},'r'+i,true);}
  assert.equal(Meta.challengeBoard(save,'weekly').length,10);const back=Save.decode(JSON.stringify(save));assert.deepEqual(Meta.challengeBoard(back,'weekly').map(e=>e.id),Meta.challengeBoard(save,'weekly').map(e=>e.id));
  assert.equal(back.challenges.best['weekly:'+w.period].wave,13);});
test('a challenge run keeps out of the ordinary holdout records, and pays as a holdout run',()=>{
  const save=Save.defaults(),run={mode:'holdout',mission:'holdout',difficulty:'standard',challenge:true,completed:false,time:300,stats:{kills:60,flows:0,damage:0,credits:1000,intel:0,bestCombo:3,wave:12,spent:0},mastery:{},rating:null,score:0,deaths:0};
  const r=Meta.settle(save,run,20440);assert.equal(save.holdout.standard,undefined);assert(!r.lines.some(l=>l.label.startsWith('MILESTONE')));assert(r.credits>0);});

// ---------- mutators ----------
test('each mutator changes how a run plays, and pays for it',()=>{
  const night=Core.create({mission:'crash',mutators:['night']});Core.step(night,{});assert(night.dark>=.8);
  const vet=Core.create({mission:'crash',mutators:['veterans']}),plain=Core.create({mission:'crash'});assert.equal(Core.diff(vet).cover,true);assert(!Core.diff(plain).cover);
  const side=Core.create({mission:'holdout',mutators:['sidearms']});assert(side.player.slots.every(k=>W[k].slot===1));side.pickups.push({id:'g',x:side.player.x,y:side.player.y,type:'weapon',weapon:'lmg',taken:false,owned:true,ttl:0});side.owned.push('lmg');assert.equal(Core.nearbyWeapon(side),undefined,'a primary cannot be picked up');
  side.director.wave=4;Core.supplyDrop(side);assert(side.pickups.filter(q=>q.type==='offer'&&q.item==='weapon').every(q=>W[q.weapon].slot===1),'and none is offered in a crate');
  const scarce=Core.create({mission:'holdout',mutators:['scarcity']}),full=Core.create({mission:'holdout'});assert.equal(scarce.player.reserve.rifle,Math.floor(full.player.reserve.rifle/2));
  const pay=muts=>Meta.settle(Save.defaults(),{mode:'campaign',mission:'crash',difficulty:'standard',mutators:muts,completed:true,time:120,stats:{kills:10,flows:0,damage:50,credits:300,intel:0,bestCombo:2,wave:0},mastery:{},rating:'B',score:7000,deaths:1},20450).credits;
  assert(pay(['night','sidearms'])>pay([]));const vs=Core.create({mode:'tdm',mission:'holdout',mutators:['night','veterans']});assert.equal(vs.mut.night,true,'a match carries night ops');assert.equal(vs.mut.veterans,undefined,'but not veterans, which is about hostile soldiers');});
test('an operation challenge pays once, for what it asks',()=>{
  const save=Save.defaults(),run=flows=>({mode:'campaign',mission:'crash',difficulty:'standard',completed:true,time:200,stats:{kills:15,flows,damage:30,credits:500,intel:0,bestCombo:4,wave:0},mastery:{},rating:'A',score:9000,deaths:0});
  assert(!Meta.settle(save,run(2),20460).lines.some(l=>l.label.startsWith('OPERATION CHALLENGE')));const r=Meta.settle(save,run(3),20460);assert(r.lines.some(l=>l.label.startsWith('OPERATION CHALLENGE')));assert.equal(save.missions.crash.opChallenge,true);
  assert(!Meta.settle(save,run(4),20461).lines.some(l=>l.label.startsWith('OPERATION CHALLENGE')),'once');for(const id of World.missions.map(m=>m.id))assert(Meta.OP_CHALLENGES[id],id+' has a challenge');});
test('S needs a perfect flow on top of a clean run',()=>{const s=Core.create({mission:'crash'});s.time=60;s.stats.damage=0;s.stats.flows=0;assert.notEqual(Core.rating(s).rating,'S');s.stats.flows=1;assert.equal(Core.rating(s).rating,'S');});

// ---------- squadmates ----------
test('a squadmate rolls, dives and slides by the rules the player has, and a roll carries it through a blast',()=>{
  const s=Core.create({mission:'holdout',seed:3,mates:[{loadout:{primary:'rifle',secondary:'pistol'}}]});s.director.timer=1e9;s.enemies=[];const m=s.guest;
  Core.step(s,{mates:[{mx:1,roll:true}]});assert.equal(m.state,'roll');assert(m.stamina<=70);for(let i=0;i<10;i++)Core.step(s,{mates:[{mx:1}]});
  const hp=m.health;Core.explode(s,m.x+5,m.y,60,50,true,'test');assert.equal(m.health,hp,'mid-roll nothing lands');for(let i=0;i<120;i++)Core.step(s,{});
  Core.step(s,{mates:[{mx:1,sprint:true,roll:true}]});assert.equal(m.state,'dive');for(let i=0;i<120;i++)Core.step(s,{});
  for(let i=0;i<60;i++)Core.step(s,{mates:[{mx:-1,sprint:true}]});Core.step(s,{mates:[{mx:-1,sprint:true,slide:true}]});assert.equal(m.state,'slide');});
test('an AI teammate rolls out of a shot about to land on it',()=>{
  const s=Core.create({mission:'holdout',seed:4,mates:[{bot:true}]});s.director.timer=1e9;const bot=s.guest;bot.iframes=1e9;s.player.x=bot.x-400;
  const e={id:'sn',type:'sniper',x:bot.x+300,y:bot.y,radius:17,hp:1e4,maxHp:1e4,angle:Math.PI,hull:0,dead:false,zone:0,active:true,seen:4,cooldown:99,stagger:0,reload:0,vx:0,vy:0,spawned:true,attack:1,attackAge:.8,lastX:bot.x,lastY:bot.y,aim:Math.PI};
  if(!Core.lineOfSight(s,e,bot)){e.x=bot.x;e.y=bot.y+300;}s.enemies=[e];let rolled=false;for(let i=0;i<20&&!rolled;i++){Core.step(s,{});rolled=bot.state==='roll'||bot.state==='dive';}assert(rolled,'it rolled');});

// ---------- team deathmatch pace ----------
test('team deathmatch: an AI operator hunts what it has seen or heard, not an enemy it cannot know about; bigger maps run longer',()=>{
  const s=Core.create({mode:'tdm',mission:'holdout-convoy',seed:6,squad:[{team:0,bot:true},{team:1,bot:true}]});const [a,b]=s.roster;b.shotAge=99;
  Core.botInput(s,a,1,Core.DT);const goal=s.ai[a.id].goal;assert(goal);if(!Core.sees(s,a,b))assert(!(Math.abs(goal.x-b.x)<5&&Math.abs(goal.y-b.y)<5),'it does not walk straight to an unseen, silent enemy');
  const small=Core.create({mode:'tdm',mission:'holdout',limit:30,squad:[{team:0},{team:1,bot:true}]}),big=Core.create({mode:'tdm',mission:'holdout-convoy',limit:30,squad:[{team:0},{team:1,bot:true}]});assert(big.tdm.time>small.tdm.time);
  assert(World.holdoutMaps.every(h=>['small','large'].includes(h.size)));});

console.log(passed+' quality checks passed.');

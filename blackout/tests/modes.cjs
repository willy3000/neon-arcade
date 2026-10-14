'use strict';
// The combat modes beyond holdout and team deathmatch: arms race, uplink, hunted and breach (team deathmatch's engine
// with rules of their own), extraction and flow trials (holdout's engine with a stage of their own).
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const bots=(n,m=n)=>[...Array(n)].map(()=>({team:0,bot:true})).concat([...Array(m)].map(()=>({team:1,bot:true})));
const play=(s,limit=120*900,each)=>{const seen={};for(let i=0;i<limit&&!s.completed&&!s.dead;i++){Core.step(s,{});for(const e of s.events){seen[e.type]=(seen[e.type]||0)+1;each?.(e,s);}s.events.length=0;}return seen;};

test('arms race: every kill is a step up the ladder, a knife kill sets the victim back, and the knife on the last step wins',()=>{
  const s=Core.create({mode:'tdm',rules:'arms',mission:'holdout',seed:5,squad:bots(4)});const L=Core.ARMS_LADDER;
  assert.equal(s.tdm.limit,L.length+1);for(const op of s.roster){assert.equal(op.arms,0);assert.deepEqual(op.slots,[L[0],L[0]]);assert.equal(op.grenades,0,'no lethals in an arms race');}
  const [a,b]=[s.roster[0],s.roster.find(o=>o.team===1)];Core.VERSUS.arms.kill(s,a,b,'rifle');assert.equal(a.arms,1);assert.equal(a.slots[0],L[1]);
  b.arms=3;Core.VERSUS.arms.kill(s,a,b,'melee');assert.equal(b.arms,2,'knifed: back a step');
  a.arms=L.length;Core.VERSUS.arms.kill(s,a,b,'rifle');assert(!s.completed,'a gun kill on the last step does not win');Core.VERSUS.arms.kill(s,a,b,'melee');assert(s.completed);assert.equal(s.tdm.winner,a.team);
  const full=Core.create({mode:'tdm',rules:'arms',mission:'holdout-ruins',seed:7,squad:bots(4)});const seen=play(full);assert(full.completed,'an all-AI arms race finishes');assert(seen.armsup>20);});

test('uplink: three relays between the bases, taken by standing in them, scoring a point a second each',()=>{
  for(const map of ['holdout','holdout-ruins','holdout-convoy','holdout-kestrel']){const s=Core.create({mode:'tdm',rules:'uplink',mission:map,seed:7,squad:bots(4)}),T=s.tdm,[a,b]=T.bases;
    assert.equal(T.relays.length,3,map+' has three relays');for(const z of T.relays){assert(Core.clearAt(s,z.x,z.y,30),map+' relay on open ground');assert(Core.distance(z,a)>250&&Core.distance(z,b)>250,map+' relay away from the bases');}}
  const s=Core.create({mode:'tdm',rules:'uplink',mission:'holdout',seed:7,squad:[{team:0},{team:1,bot:true}]}),T=s.tdm,z=T.relays[0],me=s.player,them=s.roster[1];
  them.x=z.x+900;them.y=z.y;them.dead=true;them.respawn=1e9;me.x=z.x;me.y=z.y;for(let i=0;i<120*5;i++)Core.step(s,{});assert.equal(z.owner,0,'held after four seconds');
  const before=T.score[0];for(let i=0;i<120*3;i++)Core.step(s,{});assert(T.score[0]-before>=2,'and it scores');
  const full=Core.create({mode:'tdm',rules:'uplink',mission:'holdout-ruins',seed:7,squad:bots(4)});play(full);assert(full.completed);assert(Math.max(...full.tdm.score)>=full.tdm.limit||full.tdm.left<=0);});

test('hunted: one cloaked hunter with the health of the squad, nobody redeploys, and a sweep shows it',()=>{
  const s=Core.create({mode:'tdm',rules:'hunted',mission:'holdout',seed:3,squad:bots(4,3)}),T=s.tdm,h=s.roster.find(o=>o.hunter);
  assert(h&&h.team===1&&h.cloak);assert.equal(s.roster.filter(o=>o.team===1&&!o.vanished).length,1,'one hunter, the rest of Delta sits out');assert(h.maxHealth>300);
  const sq=s.roster.find(o=>o.team===0);sq.x=h.x+600;sq.y=h.y;h.shotAge=9;h.revealed=0;h.hurtAt=-9;assert.equal(Core.veiled(s,h,sq),true,'cloaked at range');sq.x=h.x+100;assert.equal(Core.veiled(s,h,sq),false,'not up close');
  sq.x=h.x+600;h.shotAge=.5;assert.equal(Core.veiled(s,h,sq),false,'not just after it fires');
  const seen=play(s);assert(s.completed);assert.equal(s.roster.filter(o=>o.respawn>0&&Number.isFinite(o.respawn)&&o.dead).length,0,'nobody waits to redeploy');assert([0,1].includes(s.tdm.winner));});

test('hunted: the hunter blinks instead of rolling',()=>{
  const s=Core.create({mode:'tdm',rules:'hunted',mission:'holdout',seed:3,squad:[{team:1},{team:0,bot:true}]}),h=s.player;assert(h.hunter);const x0=h.x,y0=h.y;
  // A blink needs clear ground ahead, so it is tried each way round until one direction has some.
  let blinked=false;for(const [mx,my] of [[1,0],[-1,0],[0,1],[0,-1]]){h.blinkAt=0;s.events.length=0;Core.step(s,{roll:true,mx,my});if(s.events.some(e=>e.type==='blink')){blinked=true;break;}}
  assert(blinked);assert(Math.hypot(h.x-x0,h.y-y0)>50);assert.notEqual(h.state,'roll');assert(h.blinkAt>s.time,'then it has to wait');});

test('breach: a setup the attackers sit out, a plant at the site, one life a round, first to four with sides swapped',()=>{
  const s=Core.create({mode:'tdm',rules:'breach',mission:'holdout',seed:7,squad:bots(4)}),T=s.tdm;assert.equal(T.phase,'setup');assert(T.site);
  const att=s.roster.filter(o=>o.team===T.attack);for(let i=0;i<120*5;i++)Core.step(s,{});for(const o of att)assert(Core.distance(o,T.base[o.id])<75,'attackers held at their base in setup');
  const why=[];let swapped=false;const first=T.attack;play(s,120*1200,e=>{if(e.type==='breachwon')why.push(e.why);if(e.type==='breachround'&&e.attack!==first)swapped=true;});
  assert(s.completed);assert.equal(Math.max(...T.score),4);assert(why.length>=4);if(T.round>3)assert(swapped,'sides swap after round three');
  const kills=Object.values(T.board).reduce((n,b)=>n+b.k,0);assert(kills>=6,'rounds are fought, not timed out: '+kills+' kills');});

test('mutators carry into a match; veterans does not',()=>{
  const s=Core.create({mode:'tdm',mission:'holdout',seed:1,squad:bots(2),mutators:['night','sidearms','scarcity','veterans']});assert(s.mut.night&&s.mut.sidearms&&s.mut.scarcity);assert(!s.mut.veterans);
  for(const op of s.roster)assert(op.slots.every(k=>World.weapons[k].slot===1));Core.step(s,{});assert(s.dark>=.8);});

test('extraction: five caches on every map, each worth more than the last, and the loot is paid only if the squad gets out',()=>{
  for(const h of World.holdoutMaps){const s=Core.create({mission:h.id,extraction:true,seed:3});assert.equal(s.pickups.filter(q=>q.type==='loot').length,5,h.id);assert(Core.distance(s.extract.lz,s.map.start)>500,h.id+' landing zone is far from the start');}
  const s=Core.create({mission:'holdout-ruins',extraction:true,seed:3}),p=s.player;p.iframes=1e9;const vals=[];
  for(const q of s.pickups.filter(q=>q.type==='loot')){p.x=q.x;p.y=q.y;Core.step(s,{});for(const e of s.events)if(e.type==='loot')vals.push(e.value);s.events.length=0;}
  assert.equal(vals.length,5);assert(vals.every((v,i)=>!i||v>vals[i-1]));assert.equal(s.extract.loot,vals.reduce((a,b)=>a+b,0));
  p.x=s.extract.lz.x;p.y=s.extract.lz.y;for(let i=0;i<120*26&&!s.completed;i++){p.x=s.extract.lz.x;p.y=s.extract.lz.y;Core.step(s,{});s.events.length=0;}assert(s.completed,'held the landing zone');
  const out=Meta.settle(Save.defaults(),Meta.summarize(s),20600),dead=Meta.summarize(s);dead.extract={...dead.extract,out:false};const lost=Meta.settle(Save.defaults(),dead,20600);
  assert(out.lines.some(l=>l.label==='LOOT EXTRACTED'&&l.value===s.extract.loot));assert(!lost.lines.some(l=>l.label==='LOOT EXTRACTED'),'nothing for the loot if they did not get out');});

test('extraction: the pressure grows with time and with every cache taken, and only one boss comes',()=>{
  const s=Core.create({mission:'holdout',extraction:true,seed:4,difficulty:'insane'}),p=s.player;p.iframes=1e9;let bosses=0;const heat=[];
  for(let i=0;i<120*400;i++){p.health=100;Core.step(s,{});for(const e of s.events)if(e.type==='spawnwarning')null;s.events.length=0;if(i%(120*60)===0)heat.push(s.extract.heat);
    if(i===120*100)for(const q of s.pickups.filter(q=>q.type==='loot').slice(0,3)){p.x=q.x;p.y=q.y;Core.step(s,{});}}
  bosses=new Set(s.enemies.filter(e=>World.archetypes[e.type].boss).map(e=>e.id)).size;assert(heat[heat.length-1]>heat[0]);assert(bosses<=1,'at most one boss: '+bosses);});

test('flow trials: a seeded course of gates and passive targets, timed from the first gate, scored by the rules',()=>{
  const a=Core.create({mission:'holdout-crash',trial:{seed:99}}),b=Core.create({mission:'holdout-crash',trial:{seed:99}}),c=Core.create({mission:'holdout-crash',trial:{seed:100}});
  assert.deepEqual(a.trial.gates,b.trial.gates,'same seed, same course');assert.notDeepEqual(a.trial.gates,c.trial.gates);assert.equal(a.trial.gates.length,10);assert.equal(a.trial.targets.length,7);
  const p=a.player;for(let i=0;i<120*3;i++)Core.step(a,{});assert.equal(a.trial.time,0,'the clock waits at the start gate');assert.equal(p.health,100,'targets never fight');
  const T=a.trial;for(const g of T.gates.slice(1)){p.x=g.x;p.y=g.y;Core.step(a,{});}assert(a.completed&&T.done);
  assert.equal(T.score,+(T.time+(T.targets.length-T.hit)*3-T.flows*.5).toFixed(2));
  for(const h of World.holdoutMaps){const t=Core.create({mission:h.id,trial:{seed:7}});assert(t.trial.gates.length>=8,h.id);for(const g of t.trial.gates)assert(Core.clearAt(t,g.x,g.y,20),h.id+' gate on open ground');}});

test('flow trials: the same inputs replay the same run, which is what a ghost is',()=>{
  const inputs=[];for(let i=0;i<120*12;i++)inputs.push({mx:Math.cos(i/90),my:Math.sin(i/140),sprint:i%400<300,slide:i%240===0,roll:i%333===0,fire:i%50<5,aimX:1000+Math.sin(i/30)*400,aimY:700});
  const run=()=>{const s=Core.create({mission:'holdout',trial:{seed:5},seed:1701});for(const inp of inputs)Core.step(s,inp);return [s.player.x,s.player.y,s.trial.time,s.trial.next,s.stats.flows];};
  assert.deepEqual(run(),run());});

test('the new records survive a save round trip, and nothing else gets in',()=>{
  const save=Save.defaults();save.extract['holdout-ruins']={runs:3,out:2,best:1800};save.trials['holdout:42']={best:31.5,time:28,hit:6,targets:7,flows:1,at:1,runs:2};save.ghosts['holdout:42']='5*0,0,,0,|3*1000,0,12,1,';
  save.settings.vsMutators=['night','veterans'];save.settings.lobbyMode='breach';
  const back=Save.decode(JSON.stringify(save));assert.deepEqual(back.extract,save.extract);assert.deepEqual(back.trials,save.trials);assert.equal(back.ghosts['holdout:42'],save.ghosts['holdout:42']);
  assert.deepEqual(back.settings.vsMutators,['night']);assert.equal(back.settings.lobbyMode,'breach');
  const bad=Save.decode(JSON.stringify({version:3,extract:{nowhere:{best:9}},trials:{'nowhere:1':{best:1},'holdout:x':{best:2}},ghosts:{'holdout:1':12}}));assert.deepEqual(bad.extract,{});assert.deepEqual(bad.trials,{});assert.deepEqual(bad.ghosts,{});});

console.log(passed+' mode checks passed.');

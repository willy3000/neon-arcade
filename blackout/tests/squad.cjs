'use strict';
// Squads of up to four operators, AI teammates, and team deathmatch. Everything here runs the real simulation headless.
const assert=require('node:assert/strict'),Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const KITS=[{primary:'smg',secondary:'machinepistol'},{primary:'battle',secondary:'pistol'},{primary:'shotgun',secondary:'pistol'}],bots=n=>KITS.slice(0,n).map(loadout=>({loadout,bot:true}));
const match=(o={})=>Core.create({mode:'tdm',mission:'holdout',difficulty:'standard',seed:4242,mates:bots(3),...o});
const dummy=(extra={})=>({id:'target',x:0,y:0,radius:16,hp:70,maxHp:70,angle:0,type:'infantry',dead:false,zone:0,active:false,seen:0,cooldown:100,stagger:0,reload:0,vx:0,vy:0,spawned:true,...extra});
function ticks(s,n,input={}){for(let i=0;i<n;i++){Core.step(s,typeof input==='function'?input(i):input);}return s;}
// Plays a run with the AI on Rook's controls too, or with Rook standing still.
function play(s,seconds,rook=true){const cap=seconds/Core.DT;let n=0;while(!s.completed&&!s.dead&&n++<cap){Core.step(s,rook&&!s.player.dead?Core.botInput(s,s.player,3,Core.DT):{});s.events.length=0;}return s;}

// ---- squads ----
test('a squad of four: three mates beside Rook, each with its own kit, on open ground',()=>{
  const s=Core.create({mission:'holdout',mates:[{loadout:KITS[0]},{loadout:KITS[1],bot:true},{loadout:KITS[2],bot:true}]});
  assert.deepEqual(s.mates.map(m=>m.id),['guest','m2','m3']);assert.equal(s.guest,s.mates[0],'the first mate is still known as the guest');
  assert.deepEqual(s.mates.map(m=>m.bot),[false,true,true]);assert.deepEqual(s.mates.map(m=>m.slots[0]),['smg','battle','shotgun']);
  const all=Core.ops(s);assert.equal(all.length,4);
  for(const a of all){assert.ok(Core.clearAt(s,a.x,a.y,16),a.id+' starts on open ground');for(const b of all)if(a!==b)assert(Core.distance(a,b)>20,a.id+' and '+b.id+' do not start on top of each other');}
  assert.equal(Core.create({mission:'holdout'}).mates.length,0,'and a solo run has none');
});
test('a mate is worked by the input for its own seat and nobody else\'s',()=>{
  const s=Core.create({training:true,mates:[{},{},{}]});s.enemies=[];
  ticks(s,30,{mates:[null,{mx:1},{my:1}]});
  assert.equal(s.mates[0].vx,0);assert(s.mates[1].vx>60&&Math.abs(s.mates[1].vy)<1);assert(s.mates[2].vy>60&&Math.abs(s.mates[2].vx)<1);assert.equal(s.player.vx,0);
  const legacy=Core.create({training:true,guest:{}});legacy.enemies=[];ticks(legacy,30,{guest:{mx:1}});assert(legacy.guest.vx>60,'two-player co-op\'s "guest" input still works');
});
test('hostiles go for whichever operator is nearest, and the run only ends when all of them are down',()=>{
  const s=Core.create({training:true,mates:[{},{},{}]});s.events=[];
  s.mates[2].x=s.player.x+600;s.mates[2].y=s.player.y;s.enemies=[dummy({x:s.mates[2].x+30,y:s.mates[2].y})];ticks(s,1);
  assert.equal(s.enemies[0].lastX,s.mates[2].x,'the hostile beside the fourth operator targets them');
  s.enemies=[];const kill=op=>Core.explode(s,op.x,op.y,18,900,false,'test');s.mates.forEach((m,i)=>{m.x=s.player.x+200+i*150;});
  kill(s.player);kill(s.mates[0]);kill(s.mates[1]);assert.equal(s.dead,false,'one operator standing keeps the run alive');assert.equal(s.tags.length,3);
  kill(s.mates[2]);assert.equal(s.dead,true,'the last one down ends it');
});
test('any living squadmate can carry tags and revive, not only the first',()=>{
  const s=Core.create({training:true,mates:[{},{},{}]});s.enemies=[];s.mates.forEach((m,i)=>{m.x=s.player.x+300+i*120;});
  Core.explode(s,s.player.x,s.player.y,18,900,false,'test');const tag=s.tags[0],third=s.mates[2];third.x=tag.x+8;third.y=tag.y;ticks(s,1);
  assert.equal(s.tags[0].carrier,'m3');third.x=s.station.x+10;third.y=s.station.y;
  ticks(s,Math.ceil(Core.REVIVE_TIME/Core.DT)+2,{mates:[null,null,{interactDown:true}]});assert.equal(s.player.dead,false,'the fourth operator brought Rook back');
});

// ---- AI teammates ----
test('an AI teammate finds a hostile, closes in and kills it without any input',()=>{
  const s=Core.create({mission:'holdout',mates:bots(1),seed:7});const bot=s.guest;s.director.timer=999;
  // The target stands wherever the bot has a clear view at about 400 units, whichever way that is on this map.
  const spot=[0,1,2,3,4,5,6,7].map(k=>({x:bot.x+Math.cos(k*Math.PI/4)*400,y:bot.y+Math.sin(k*Math.PI/4)*400})).find(q=>Core.clearAt(s,q.x,q.y,20)&&Core.lineOfSight(s,bot,q));assert.ok(spot,'somewhere in view to stand a target');
  s.enemies=[dummy({...spot,hp:120,maxHp:120,stagger:999})];s.events=[];
  let fired=0;for(let i=0;i<120*12&&!s.enemies[0].dead;i++){Core.step(s,{});fired+=s.events.filter(e=>e.type==='shot'&&!e.enemy).length;s.events.length=0;}
  assert.equal(s.enemies[0].dead,true,'the bot should have killed a stationary target within twelve seconds');assert(fired>3,'by shooting it');
});
test('an AI teammate\'s kill is not yours: no combo, mastery or kill count, and half a bounty in holdout',()=>{
  const s=Core.create({mission:'holdout',mates:bots(1)});s.director.timer=999;s.events=[];const bot=s.guest,e=dummy({x:bot.x+60,y:bot.y,hp:1,maxHp:70});s.enemies=[e];
  s.by='guest';Core.damageEnemy(s,e,50,0,.1,'smg');s.by='player';
  assert.equal(e.dead,true);assert.equal(s.stats.kills,0);assert.equal(s.combo,0);assert.deepEqual(s.mastery,{});
  const full=Math.round(World.archetypes.infantry.bounty*.6);assert.equal(s.stats.credits,Math.round(World.archetypes.infantry.bounty*.5*.6),'half of the '+full+' a holdout kill pays');
  const kill=s.events.find(q=>q.type==='kill');assert.equal(kill.by,'guest');assert.equal(kill.bot,true);assert.equal(kill.combo,0);
});
test('an AI teammate hits softer than a player with the same gun, and never runs out of ammunition',()=>{
  const shot=bot=>{const s=Core.create({training:true,mates:[{bot}]});s.enemies=[];Core.shoot(s,s.guest,'rifle',0,false,s.guest);return s.projectiles.find(b=>b.active).damage;};
  assert(shot(true)<shot(false)*.6,'bot rounds do less');
  const s=Core.create({training:true,mates:bots(1)});s.enemies=[];const bot=s.guest,k=bot.slots[0];bot.ammo[k]=0;bot.reserve[k]=5;ticks(s,Math.ceil(3/Core.DT));
  assert(bot.ammo[k]>0,'it reloaded by itself');assert.equal(bot.reserve[k],Core.reserveOf(s,k),'and its reserve was topped back up');
});
test('in holdout an AI teammate fetches your dog tags and revives you',()=>{
  const s=Core.create({mission:'holdout',mates:bots(1),seed:11});s.director.timer=9999;s.enemies=[];
  Core.explode(s,s.player.x,s.player.y,18,900,false,'test');assert.equal(s.player.dead,true);assert.equal(s.dead,false);
  for(let i=0;i<120*40&&s.player.dead;i++){Core.step(s,{});s.events.length=0;}
  assert.equal(s.player.dead,false,'the bot should have carried the tags to the station and held the revive');
});
test('an AI teammate keeps up with Rook and does not get stuck on any killhouse',()=>{
  for(const h of World.holdoutMaps){const s=Core.create({mission:h.id,mates:bots(1),seed:3});s.director.timer=9999;s.enemies=[];const p=s.player,pts=s.map.spawnPoints;
    // Rook is walked from spawn point to spawn point by the same route finder; the bot has to stay with him.
    let worst=0;for(let leg=0;leg<3;leg++){const to=pts[(leg*3)%pts.length];for(let i=0;i<120*9;i++){const dx=to.x-p.x,dy=to.y-p.y,d=Math.hypot(dx,dy);Core.step(s,d>40?{mx:dx/d,my:dy/d}:{});s.events.length=0;}
      for(let i=0;i<120*5;i++){Core.step(s,{});s.events.length=0;}worst=Math.max(worst,Core.distance(s.guest,p));}
    assert(worst<330,h.id+': the bot ended '+Math.round(worst)+' away from Rook');}
});

// ---- team deathmatch: Alpha against Delta, every operator whole ----
const KIT={primary:'rifle',secondary:'pistol',lethal:'frag',tactical:'flash',support:'turret',perks:['flak','scrounger','flowstate']};
// Rook and a second player on Alpha; a third player and an AI operator on Delta.
const vs=(o={})=>Core.create({mode:'tdm',mission:'holdout',difficulty:'standard',seed:4242,squad:[{team:0,loadout:KIT},{team:0,loadout:{primary:'shotgun',secondary:'pistol',lethal:'frag'}},{team:1,loadout:{primary:'smg',secondary:'magnum',tactical:'smoke',perks:['secondwind',null,null]}},{team:1,bot:true}],...o});
const aiMatch=(a,b,o={})=>Core.create({mode:'tdm',mission:'holdout',difficulty:'standard',seed:77,squad:[...Array(a).fill({team:0,bot:true}),...Array(b).fill({team:1,bot:true})],...o});
const quiet=s=>{for(const o of s.roster)o.bot=false;s.events=[];return s;},as=(s,op,fn)=>Core.act(s,op,fn),hpOf=o=>o.health+o.armor;
function finish(s,seconds=700){let n=0;while(!s.completed&&n++<seconds/Core.DT){Core.step(s,{});s.events.length=0;}return s;}
test('team deathmatch seats two teams of whole operators at opposite ends of every map',()=>{
  for(const h of World.holdoutMaps){const s=vs({mission:h.id}),T=s.tdm,[a,b]=T.bases;assert(Core.distance(a,b)>600,h.id+': bases are '+Math.round(Core.distance(a,b))+' apart');
    assert.deepEqual(s.roster.map(o=>[o.id,o.team,o.bot]),[['player',0,false],['guest',0,false],['m2',1,false],['m3',1,true]]);assert.equal(s.roster[0],s.player);assert.deepEqual(s.mates,s.roster.slice(1));
    for(const o of s.roster){assert.ok(Core.clearAt(s,o.x,o.y,16),h.id+': '+o.id+' starts on open ground');assert(Core.distance(o,T.bases[o.team])<140,o.id+' starts at its own base');assert.ok(o.ctx&&o.ctx.stats&&o.ctx.mods,'with a context of its own');}
    assert.equal(s.enemies.length,0,'there is no hostile roster: the other team is the enemy');assert.equal(s.station,null);assert.equal(Core.arena(s),true);}
  const s=vs(),[rook,mate,foe,ai]=s.roster;assert.deepEqual(rook.ctx.perks,{flak:true,scrounger:true,flowstate:true});assert.equal(rook.ctx.support.key,'turret');assert.equal(rook.grenades,World.gear.frag.count);
  assert.deepEqual(mate.slots,['shotgun','pistol']);assert.equal(mate.lethal,'frag');assert.equal(mate.ctx.support,null);assert.deepEqual(foe.ctx.perks,{secondwind:true});assert.equal(foe.tacticals,World.gear.smoke.count);assert.equal(ai.lethal,'frag','an AI operator carries frags');
  assert.equal(vs({support:false}).player.ctx.support,null,'the host can switch field support off for everyone');
  const lone=Core.create({mode:'tdm',mission:'holdout'});assert.deepEqual(lone.roster.map(o=>[o.team,o.bot]),[[0,false],[1,true]],'with no squad given it is one player against one AI');
});
test('every operator has the same moves and gadgets as Rook, worked by its own input',()=>{
  const s=quiet(vs()),foe=s.roster[2],seat=i=>({mates:[null,i,null]}),at={x:foe.x,y:foe.y};
  ticks(s,1,seat({roll:true,mx:-1}));assert.equal(foe.state,'roll','a roll');ticks(s,60,seat({mx:-1}));assert(Core.distance(foe,at)>80);assert.equal(s.player.state,'idle','and nobody else moved');
  ticks(s,90,seat({mx:-1,sprint:true}));ticks(s,2,seat({mx:-1,sprint:true,slide:true}));assert.equal(foe.state,'slide','a slide out of a sprint');ticks(s,100,{});
  ticks(s,1,seat({tactical:true,aimX:foe.x-200,aimY:foe.y}));assert.equal(foe.tacticals,World.gear.smoke.count-1);assert.equal(s.grenades.at(-1).owner,'m2','a thrown gadget is its thrower\'s');
  foe.health=40;ticks(s,1,seat({gadget:true}));ticks(s,Math.ceil(1/Core.DT),{});assert.equal(foe.health,90,'a stim');
  const ammo=foe.ammo.smg;ticks(s,1,seat({fire:true,aimX:foe.x-300,aimY:foe.y}));assert.equal(foe.ammo.smg,ammo-1);assert.equal(foe.ctx.stats.shots,1,'and its shots are counted as its own');assert.equal(s.player.ctx.stats.shots,0);
});
test('a hit lands on the other team only, every pellet of it, and a kill is a point, a bounty and a respawn',()=>{
  const s=quiet(vs()),[rook,mate,foe]=s.roster,T=s.tdm;foe.iframes=mate.iframes=0;
  as(s,rook,()=>Core.damageEnemy(s,foe,40,0,.1,'rifle'));assert(Math.abs(125-hpOf(foe)-40*Core.TDM.dmg)<.01);as(s,rook,()=>Core.damageEnemy(s,foe,40,0,.1,'rifle'));assert(Math.abs(125-hpOf(foe)-80*Core.TDM.dmg)<.01,'no protection after a hit: the second lands at once');
  // A shotgun at arm's length: all eight pellets count (122 damage), which kills an operator whose armour is gone.
  foe.x=rook.x+60;foe.y=rook.y;mate.x=rook.x+90;mate.y=rook.y+6;foe.health=100;foe.armor=0;foe.ctx.windUsed=true;const before=hpOf(mate);rook.slots[0]='shotgun';s.events=[];ticks(s,1,{fire:true,aimX:foe.x,aimY:foe.y});ticks(s,12,{});
  assert.equal(foe.dead,true);assert.equal(hpOf(mate),before,'a teammate standing behind the target is untouched');assert.deepEqual(T.score,[1,0]);assert.deepEqual([T.board.player.k,T.board.m2.d],[1,1]);
  assert.equal(rook.ctx.stats.kills,1);assert.equal(rook.ctx.stats.credits,Math.round(World.archetypes.operator.bounty*Core.TDM.bounty));assert.equal(rook.ctx.mastery.shotgun,1);assert.equal(rook.ctx.combo,1);
  const kill=s.events.find(e=>e.type==='kill'),down=s.events.find(e=>e.type==='down');assert.deepEqual([kill.by,kill.victim,down.who,down.by],['player','m2','m2','player']);assert.ok(s.pickups.some(q=>q.id.startsWith('fall')),'the fallen leave ammunition');
  ticks(s,Math.ceil((Core.TDM.respawn+.1)/Core.DT),{});assert.equal(foe.dead,false);assert(Core.distance(foe,T.bases[1])<160,'back at Delta\'s base');assert.equal(foe.health,100);assert(foe.iframes>0);assert.equal(foe.tacticals,World.gear.smoke.count);
});
test('a dodge still dodges, and an operator can be the death of themselves but not of a teammate',()=>{
  const s=quiet(vs()),[rook,mate,foe]=s.roster;foe.iframes=0;foe.state='roll';foe.age=.1;as(s,rook,()=>Core.damageEnemy(s,foe,80,0,.1,'rifle'));assert.equal(hpOf(foe),125,'a roll carries them through it');foe.state='idle';
  // Rook's own frag between a teammate, an enemy and himself.
  rook.iframes=mate.iframes=0;mate.x=rook.x+60;mate.y=rook.y;foe.x=rook.x-60;foe.y=rook.y;s.grenades.push({kind:'frag',x:rook.x,y:rook.y,sx:rook.x,sy:rook.y,tx:rook.x,ty:rook.y,age:0,duration:.05,fuse:.2,enemy:false,owner:'player',team:0});
  ticks(s,40,{});assert(hpOf(foe)<60,'the enemy is caught');assert.equal(hpOf(mate),125,'the teammate is not');assert(hpOf(rook)<125,'and Rook hurts himself, less for his flak vest');
  const t=s.tdm;rook.health=1;rook.armor=0;rook.iframes=0;as(s,rook,()=>Core.damagePlayer(s,50,0,0,'blast'));assert.equal(rook.dead,true);assert.equal(t.score[1],1,'a death by his own hand is still a point for Delta');
});
test('stuns, perks and field support work for and against whoever is involved',()=>{
  const s=quiet(vs()),[rook,mate,foe,ai]=s.roster;for(const o of s.roster)o.iframes=0;
  // Delta's flashbang: Alpha in view is stunned (capped), Delta is not.
  ai.x=rook.x+80;ai.y=rook.y;s.grenades.push({kind:'flash',x:rook.x+40,y:rook.y,sx:0,sy:0,tx:rook.x+40,ty:rook.y,age:1,duration:.1,fuse:.5,enemy:false,owner:'m2',team:1});ticks(s,2,{});
  assert(rook.stagger>1.5&&rook.stagger<=Core.TDM.stun,'Rook is stunned for '+rook.stagger.toFixed(1)+'s');assert.equal(ai.stagger,0);const shots=rook.ctx.stats.shots;ticks(s,10,{fire:true,aimX:rook.x+300,aimY:rook.y});assert.equal(rook.ctx.stats.shots,shots,'and cannot fire until it passes');
  ticks(s,Math.ceil(2.3/Core.DT),{});assert.equal(rook.stagger,0);
  // Second Wind is the victim's, once; Scrounger and the support meter are the killer's.
  foe.x=rook.x+200;foe.y=rook.y;foe.health=20;foe.armor=0;rook.reserve.rifle=10;as(s,rook,()=>Core.damageEnemy(s,foe,90,0,.1,'rifle'));assert.equal(foe.dead,false);assert.equal(foe.health,30);assert.equal(foe.ctx.windUsed,true);
  foe.iframes=0;as(s,rook,()=>Core.damageEnemy(s,foe,90,0,.1,'rifle'));assert.equal(foe.dead,true);assert(rook.reserve.rifle>10,'scrounger');assert.equal(rook.ctx.support.charge,World.archetypes.operator.bounty*1.6,'the kill charged Rook\'s meter');assert.equal(mate.ctx.support,null);
  // Ambusher is a hit from behind.
  const hit=(angle)=>{const q=quiet(vs()),[a,,b]=q.roster;a.ctx.perks.ambusher=true;b.iframes=0;b.armor=0;b.angle=0;as(q,a,()=>Core.damageEnemy(q,b,40,angle,.1,'rifle'));return 100-b.health;};
  assert(Math.abs(hit(0)/hit(Math.PI)-1.35)<.01,'35% more into their back than into their face');
  // Rook's sentry shoots Delta and nobody else, and its kills are his.
  const t=quiet(vs()),[r2,m2,f2,a2]=t.roster;for(const o of t.roster)o.iframes=0;r2.ctx.support.ready=true;f2.x=r2.x+260;f2.y=r2.y;m2.x=r2.x+200;m2.y=r2.y+80;a2.x=-5000;r2.angle=0;as(t,r2,()=>Core.callSupport(t,{}));assert.equal(t.allies[0].kind,'turret');
  ticks(t,2,{});assert.equal(t.allies[0].owner,'player');let n=0;while(!f2.dead&&n++<600)Core.step(t,{});assert.equal(f2.dead,true);assert.equal(hpOf(m2),125);assert.equal(t.tdm.board.player.k,1);
});
test('the host sets the kills needed; the clock follows, and decides a match nobody finishes',()=>{
  assert.deepEqual([vs().tdm.limit,vs({limit:5}).tdm.limit,vs({limit:7}).tdm.limit,vs({limit:50}).tdm.limit],[30,5,30,50]);assert.equal(vs({limit:5}).tdm.time,180,'never less than three minutes');assert.equal(vs({limit:30}).tdm.time,540,'eighteen seconds a kill with four in the match');assert.equal(aiMatch(4,4).tdm.time,420,'fourteen with eight');assert.equal(aiMatch(1,1,{limit:10}).tdm.time,260,'twenty-six with two');
  const s=quiet(vs({limit:5})),[rook,,foe]=s.roster;s.tdm.score=[4,3];foe.iframes=0;foe.ctx.windUsed=true;as(s,rook,()=>Core.damageEnemy(s,foe,999,0,.1,'rifle'));ticks(s,1,{});assert.equal(s.completed,true);assert.equal(s.tdm.winner,0);
  const done=s.events.find(e=>e.type==='complete');assert.deepEqual([done.tdm,done.winner,done.score.join()],[true,0,'5,3']);
  const late=quiet(vs());late.tdm.score=[2,6];late.director.clock=late.tdm.time;ticks(late,1,{});assert.equal(late.tdm.winner,1,'ahead when time runs out');
  const even=quiet(vs());even.tdm.score=[4,4];even.director.clock=even.tdm.time;ticks(even,1,{});assert.equal(even.tdm.winner,-1);assert.equal(even.tdm.result,'draw');
});
test('AI operators on both sides play a whole match, the same from the same seed, on any team sizes',()=>{
  const a=finish(aiMatch(4,4,{limit:20})),b=finish(aiMatch(4,4,{limit:20}));assert.equal(a.completed,true);assert.deepEqual(a.tdm.score,b.tdm.score);assert.equal(a.time,b.time);assert.deepEqual(a.tdm.board,b.tdm.board);
  const rows=Object.values(a.tdm.board),kills=t=>rows.filter(r=>r.team===t).reduce((n,r)=>n+r.k,0),deaths=t=>rows.filter(r=>r.team===t).reduce((n,r)=>n+r.d,0);
  assert(Math.max(...a.tdm.score)===20||a.tdm.left<=0);assert.equal(deaths(1),a.tdm.score[0],'every Delta death is an Alpha point');assert.equal(deaths(0),a.tdm.score[1]);assert(kills(0)<=a.tdm.score[0]&&kills(1)<=a.tdm.score[1]);
  assert(Math.min(...a.tdm.score)>=5,'evenly matched AI makes a contest of it: '+a.tdm.score.join('-'));
  for(const [x,y] of [[1,1],[1,3],[3,4],[2,2]]){const s=finish(aiMatch(x,y,{limit:10,seed:5}));assert.equal(s.completed,true,x+'v'+y+' finishes');assert.equal(s.roster.length,x+y);}
  // One against three is uphill: the three win.
  assert.equal(finish(aiMatch(1,3,{limit:10,seed:9})).tdm.winner,1);
});
test('enemy pressure is how good the AI operators are',()=>{
  const dmg=d=>{const s=aiMatch(1,1,{difficulty:d}),o=s.roster[0];Core.act(s,o,()=>Core.shoot(s,o,'rifle',0));return s.projectiles.find(b=>b.active).damage;};
  assert(dmg('story')<dmg('standard')&&dmg('standard')<dmg('intense')&&dmg('intense')<dmg('insane'));assert.equal(dmg('insane'),World.weapons.rifle.damage,'at Insane they hit as hard as a player');
  // A player's own damage does not change with it.
  const mine=d=>{const s=vs({difficulty:d}),o=s.player;Core.act(s,o,()=>Core.shoot(s,o,'rifle',0));return s.projectiles.find(b=>b.active).damage;};assert.equal(mine('story'),mine('insane'));
});
test('a finished match pays bounties and a result bonus; only a proper match counts for the record',()=>{
  const save=Save.defaults(),run=(o={})=>({mode:'tdm',mission:'holdout',difficulty:'standard',completed:true,time:200,stats:{kills:12,credits:400,match:300,flows:0},mastery:{rifle:12},result:'win',score:[30,21],ranked:true,rating:null,deaths:0,...o});
  const report=Meta.settle(save,run(),100),get=l=>report.lines.find(x=>x.label.startsWith(l));assert.equal(get('HOSTILE BOUNTIES').value,400);assert.equal(get('MATCH WON').value,300);assert.ok(get('DAILY OPERATION'));
  assert.deepEqual(save.tdm.standard,{played:1,wins:1});assert.equal(save.stats.kills,12);assert.equal(save.mastery.rifle,12);
  const r2=Meta.settle(save,run({ranked:false,stats:{kills:5,credits:120,match:50,flows:0}}),101);assert.ok(r2.lines.find(x=>x.label==='MATCH WON'),'a short or lopsided match still pays');assert.deepEqual(save.tdm.standard,{played:1,wins:1},'but is not kept in the record');
  assert.ok(!r2.lines.find(x=>x.label==='DAILY OPERATION'));
  Meta.settle(save,run({result:'loss',difficulty:'intense',stats:{kills:3,credits:90,match:100,flows:0}}),100);assert.deepEqual(save.tdm.intense,{played:1,wins:0});
});
test('the save keeps deathmatch records and how the lobby was left, and rejects nonsense',()=>{
  const d=Save.decode(JSON.stringify({version:3,tdm:{standard:{played:7,wins:4},insane:{played:'x',wins:-3},bogus:{played:1,wins:1}},settings:{lobbyMode:'tdm',lobbyMap:'holdout-crash',fill:true}}));
  assert.deepEqual(d.tdm,{standard:{played:7,wins:4},insane:{played:0,wins:0}});assert.equal(d.settings.lobbyMode,'tdm');assert.equal(d.settings.lobbyMap,'holdout-crash');assert.equal(d.settings.fill,true);
  const bad=Save.decode(JSON.stringify({version:3,settings:{lobbyMode:'ctf',lobbyMap:'nowhere',fill:'yes'}}));assert.equal(bad.settings.lobbyMode,'holdout');assert.equal(bad.settings.lobbyMap,'holdout');assert.equal(bad.settings.fill,false);
});
console.log(`${passed} squad checks passed.`);

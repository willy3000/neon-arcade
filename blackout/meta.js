(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPMeta=api;})(globalThis,function(World){
  'use strict';
  // Progression and economy. Pure functions over the save object so the reward loop is testable without a browser.
  const W=World.weapons,G=World.gear,U=World.upgrades,SUP=World.support,PERKS=World.perks,AV=World.avatars,ORDER=World.order;
  // Field support, perks and avatars are kept in lists of their own on the save; these pick the table and the list for a kind.
  const tableOf=kind=>kind==='support'?SUP:kind==='perk'?PERKS:kind==='avatar'?AV:null,listOf=(save,kind)=>kind==='support'?save.owned.support:kind==='avatar'?save.owned.avatars:save.owned.perks;
  const TITLES=['RECRUIT','PRIVATE','CORPORAL','SERGEANT','STAFF SERGEANT','OPERATOR','SPECIALIST','VETERAN','ELITE','GHOST','PHANTOM','SPECTRE','WRAITH HUNTER','LEGEND','BLACKOUT'];
  // XP needed to hold a rank. Rank opens the armory tiers (World.tiers), so the curve is paced against the whole
  // catalogue: see blackout/qa/economy-report.cjs.
  const need=r=>r<=1?0:Math.round(XP_BASE*Math.pow(r-1,XP_POWER)/50)*50,XP_BASE=1500,XP_POWER=1.75;
  function rankOf(xp){let r=1;while(need(r+1)<=xp&&r<99)r++;const base=need(r),next=need(r+1);return {rank:r,title:TITLES[Math.min(r-1,TITLES.length-1)]+(r>TITLES.length?' '+(r-TITLES.length+1):''),into:xp-base,span:next-base,next};}
  const MASTERY=[20,60,150],masteryLevel=k=>MASTERY.filter(n=>k>=n).length,MASTERY_PERKS=['+10% reserve ammunition','8% faster reload','+6% damage'];
  // Weapon kit: one purchasable part per mastery level, bought in order. Parts cost a share of the gun's price.
  const KIT=[{name:'MATCH BARREL',desc:'20% tighter spread.',share:.25},{name:'FAST MAG',desc:'10% faster reload.',share:.4},{name:'HOT LOADS',desc:'+8% damage.',share:.6}],FOUND_DISCOUNT=.25;
  // A gun's numbers as a player meets them: damage per shot, rounds a second, damage a second while the trigger is
  // held, and over a whole magazine and its reload ("sustained"). A burst gun fires "burst" rounds "gap" apart each pull.
  function weaponStats(k){const w=W[k],per=w.damage*w.pellets,shots=w.burst||1,cycle=w.rate+(shots-1)*(w.gap||0),rps=shots/cycle,magTime=(w.capacity/shots)*cycle;
    return {per,rps,dps:per*rps,sustained:per*w.capacity/(magTime+w.reload),mag:w.capacity,reload:w.reload,range:w.range,mobility:w.mobility};}
  // What a gun does beyond its numbers, in the armory's words.
  function weaponTraits(k){const w=W[k],out=[];if(w.ap)out.push(w.ap>=1?'ARMOUR-PIERCING':'HALF ARMOUR-PIERCING');if(w.counter)out.push('COUNTER-SHOT ×'+w.counter);if(w.suppress)out.push('SUPPRESSING');if(w.steady)out.push('STEADY ON THE MOVE','+25% FROM A SLIDE');if(w.overload)out.push('SHIELD OVERLOAD');
    if(w.pierce)out.push('PIERCES '+w.pierce);if(w.breach)out.push('THROUGH COVER');if(w.explosive)out.push('BLAST · FULL VS ARMOUR');if(w.chain)out.push('CHAINS TO '+w.chain);if(w.bounce)out.push('RICOCHETS '+w.bounce+'×');if(w.flame)out.push('SETS FIRE');if(w.spin)out.push('SPIN-UP '+w.spin+' S');if(w.burst)out.push(w.burst+'-ROUND BURST');if(w.pellets>1)out.push(w.pellets+' PELLETS');return out;}
  // Operation challenges: one optional goal per operation, paid once, that asks for a different way of playing it.
  // Every one can be met with the starting kit (flows, the knife, a combo, a time, care).
  const OP_CHALLENGES={
    crash:{text:'Finish with three perfect flows',reward:400,met:r=>(r.stats.flows||0)>=3},
    ruins:{text:'Finish inside par time',reward:450,met:(r,m)=>r.time<=(m?.par||240)},
    kestrel:{text:'Reach a ×6 kill combo',reward:500,met:r=>(r.stats.bestCombo||0)>=6},
    underground:{text:'Take less than 40 damage',reward:550,met:r=>(r.stats.damage||0)<40},
    convoy:{text:'Make three knife kills',reward:600,met:r=>(r.mastery?.melee||0)>=3},
    meridian:{text:'Five perfect flows without dying',reward:700,met:r=>(r.stats.flows||0)>=5&&!r.deaths},
    redline:{text:'Bring Lark out with 100 health or more',reward:750,met:r=>(r.stats.escort||0)>=100},
    citadel:{text:'Reach a ×8 kill combo',reward:800,met:r=>(r.stats.bestCombo||0)>=8},
    blackout:{text:'Finish without dying, taking under 100 damage',reward:900,met:r=>(r.stats.damage||0)<100&&!r.deaths}};
  // ---------- seeded challenges ----------
  // A daily and a weekly holdout challenge, the same for everyone on that day or week: map, enemy pressure, a fixed
  // loadout, one mutator, and the seed every wave is drawn from. Upgrades bought in the armory are left at the door.
  // The daily counts its first attempt only - later runs that day are practice; the weekly keeps the best attempt.
  // Records are local to this machine (save.challenges) and say so.
  const CHALLENGE_RULES=1,CHALLENGE_KINDS={daily:{label:'DAILY CHALLENGE',difficulty:'standard',once:true},weekly:{label:'WEEKLY CHALLENGE',difficulty:'intense',once:false}};
  const CHALLENGE_KITS=[{primary:'rifle',secondary:'pistol',lethal:'frag',tactical:'flash',support:'airstrike'},{primary:'smg',secondary:'sawedoff',lethal:'incendiary',tactical:'smoke',support:'turret'},
    {primary:'battle',secondary:'magnum',lethal:'frag',tactical:'emp',support:'recon'},{primary:'shotgun',secondary:'machinepistol',lethal:'mine',tactical:'flash',support:'dog'},
    {primary:'marksman',secondary:'pistol',lethal:'cluster',tactical:'smoke',support:'supply'},{primary:'lmg',secondary:'pistol',lethal:'frag',tactical:'cover',support:'turret'},
    {primary:'burst',secondary:'thumper',lethal:'knife',tactical:'decoy',support:'airstrike'},{primary:'ricochet',secondary:'magnum',lethal:'seeker',tactical:'sensor',support:'recon'}];
  const CHALLENGE_TWISTS=['night','veterans','scarcity','sidearms',null];
  // Weeks start on a Monday (day 0, 1 January 1970, was a Thursday).
  const challengePeriod=(kind,day)=>kind==='weekly'?Math.floor((day+3)/7):day;
  function challengeFor(kind,day){const k=CHALLENGE_KINDS[kind]||CHALLENGE_KINDS.daily,period=challengePeriod(kind,day);let seed=(Math.imul(period+1,2654435761)^(kind==='weekly'?0x9e3779b9:0x85ebca6b))>>>0;
    // The generator's high bits are the well-mixed ones; the low bits of a linear congruential generator repeat quickly.
    const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>16)%n;},maps=World.holdoutMaps;
    const map=maps[next(maps.length)].id,kit={...CHALLENGE_KITS[next(CHALLENGE_KITS.length)],perks:[null,null,null]},mutator=CHALLENGE_TWISTS[next(CHALLENGE_TWISTS.length)];
    return {kind,period,label:k.label,difficulty:k.difficulty,once:k.once,map,loadout:kit,mutators:mutator?[mutator]:[],seed:1701+((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%1e6),rules:CHALLENGE_RULES};}
  // A challenge run's score: waves first, then hostiles and the best chain.
  const challengeScore=stats=>Math.max(0,Math.round((stats.wave||0)*1000+(stats.kills||0)*10+(stats.bestCombo||0)*25));
  // A challenge run is counted when it starts (so restarting does not dodge the daily's one-attempt rule): this says
  // whether it can set a record - it is today's (or this week's) challenge, and for the daily, its first attempt.
  function startChallenge(save,cfg,day){const c=save.challenges||(save.challenges={attempts:{},best:{},board:[]}),key=cfg.kind+':'+cfg.period,before=c.attempts[key]||0;c.attempts[key]=before+1;
    return {eligible:challengePeriod(cfg.kind,day)===cfg.period&&(!cfg.once||before===0),attempt:before+1};}
  // Files a finished challenge run: a practice run is scored but not recorded; an eligible one goes on this machine's
  // board (the best ten of its kind) and may be the period's new best. The same run is never filed twice.
  function recordChallenge(save,cfg,stats,runId,eligible,at=Date.now()){const c=save.challenges||(save.challenges={attempts:{},best:{},board:[]}),key=cfg.kind+':'+cfg.period,score=challengeScore(stats);
    if(!eligible)return {score,practice:true};if(c.board.some(e=>e.id===String(runId))||c.best[key]?.id===String(runId))return {score,practice:false,duplicate:true};
    const entry={id:String(runId),kind:cfg.kind,period:cfg.period,seed:cfg.seed,map:cfg.map,score,wave:stats.wave||0,kills:stats.kills||0,combo:stats.bestCombo||0,time:Math.round(stats.time||0),rules:cfg.rules,at};
    const prev=c.best[key],newBest=!prev||score>prev.score;if(newBest)c.best[key]=entry;
    c.board=c.board.filter(e=>e.kind!==cfg.kind).concat([...c.board.filter(e=>e.kind===cfg.kind),entry].sort((a,b)=>b.score-a.score).slice(0,10));
    const rank=challengeBoard(save,cfg.kind).findIndex(e=>e.id===entry.id)+1;return {score,practice:false,newBest,rank};}
  const challengeBoard=(save,kind)=>(save.challenges?.board||[]).filter(e=>e.kind===kind).sort((a,b)=>b.score-a.score);
  const cls=(m,c)=>Object.entries(m).reduce((n,[k,v])=>n+(W[k]&&W[k].cls===c?v:0),0);
  const CONTRACTS=[
    {id:'kills',text:'Eliminate 40 hostiles',goal:40,reward:300,stat:r=>r.stats.kills},
    {id:'melee',text:'Score 8 knife kills',goal:8,reward:350,stat:r=>r.mastery.melee||0},
    {id:'explosive',text:'Get 10 explosive kills',goal:10,reward:350,stat:r=>(r.mastery.grenade||0)+(r.mastery.mine||0)+(r.mastery.incendiary||0)+cls(r.mastery,'explosive')},
    {id:'flows',text:'Chain 12 perfect flows',goal:12,reward:300,stat:r=>r.stats.flows},
    {id:'shotgun',text:'25 kills with shotguns',goal:25,reward:350,stat:r=>cls(r.mastery,'shotgun')},
    {id:'precision',text:'15 kills with precision rifles',goal:15,reward:350,stat:r=>cls(r.mastery,'precision')},
    {id:'sidearm',text:'15 kills with sidearms',goal:15,reward:300,stat:r=>cls(r.mastery,'sidearm')},
    {id:'smg',text:'25 kills with submachine guns',goal:25,reward:300,stat:r=>cls(r.mastery,'smg')},
    {id:'combo',text:'Reach a ×5 kill combo',goal:5,reward:400,max:true,stat:r=>r.stats.bestCombo||0},
    {id:'hard',text:'Complete a mission on Intense or Insane',goal:1,reward:600,stat:r=>r.completed&&r.mode==='campaign'&&ORDER.indexOf(r.difficulty)>=2?1:0},
    {id:'flawless',text:'Complete a mission without dying',goal:1,reward:450,stat:r=>r.completed&&r.mode==='campaign'&&!r.deaths?1:0},
    {id:'holdout',text:'Reach wave 8 in HOLDOUT',goal:8,reward:500,max:true,stat:r=>r.mode==='holdout'?r.stats.wave||0:0},
    {id:'srank',text:'Earn an S field rating',goal:1,reward:500,stat:r=>r.completed&&r.rating==='S'?1:0}];
  // A contract is only offered to a player who can do it today: the weapon- and gadget-specific ones need something of
  // that kind in the armory (the knife, the pistol, every mode and every difficulty are open to anyone, so the rest
  // always can be). Without a save every contract is eligible.
  const EXPLOSIVE_GEAR=['frag','incendiary','mine','cluster','c4','seeker'],ownsClass=(save,c)=>save.owned.weapons.some(k=>W[k]&&W[k].cls===c);
  const NEEDS={shotgun:s=>ownsClass(s,'shotgun'),precision:s=>ownsClass(s,'precision'),smg:s=>ownsClass(s,'smg'),explosive:s=>ownsClass(s,'explosive')||s.owned.gear.some(k=>EXPLOSIVE_GEAR.includes(k))};
  const eligible=(save,c)=>!!c&&(!save||!NEEDS[c.id]||NEEDS[c.id](save));
  // Three contracts a day, picked from the day number alone (so the same player gets the same three), out of those the
  // player can do.
  function contractsFor(day,save=null){let seed=(day*2654435761)>>>0;const pool=CONTRACTS.filter(c=>eligible(save,c)),out=[];while(out.length<3&&pool.length){seed=(Math.imul(seed,1664525)+1013904223)>>>0;out.push(pool.splice(seed%pool.length,1)[0]);}return out;}
  // A new day rolls new contracts. Within a day the list is kept, progress and all - except a contract the player
  // cannot do and has not started (one rolled before this rule, or one a save no longer recognises), which is swapped
  // for the next eligible one of the day.
  function refreshContracts(save,day){if(save.contracts.day!==day)save.contracts={day,list:contractsFor(day,save).map(c=>({id:c.id,progress:0,done:false}))};
    else{const fresh=contractsFor(day,save),list=save.contracts.list;for(let i=0;i<list.length;i++){const c=list[i],def=CONTRACTS.find(x=>x.id===c.id);if(def&&(c.done||c.progress>0||eligible(save,def)))continue;
      const swap=fresh.find(f=>!list.some(x=>x.id===f.id));if(swap)list[i]={id:swap.id,progress:0,done:false};else if(!def)list.splice(i--,1);}}
    return save.contracts.list.map(c=>({...CONTRACTS.find(x=>x.id===c.id),...c}));}
  const medalsFor=m=>[{id:'complete',name:'MISSION COMPLETE'},{id:'flawless',name:'NO DEATHS'},{id:'srank',name:'S RATING'},{id:'intel',name:'INTEL RECOVERED'},{id:'insane',name:'INSANE CLEAR'}];
  const mission=(save,id)=>save.missions[id]||(save.missions[id]={done:false,best:null,medals:[],diffs:[],intel:false});
  function unlocked(save,id){const i=World.missions.findIndex(m=>m.id===id);return i<=0||!!save.missions[World.missions[i-1].id]?.done;}
  const nextMission=save=>World.missions.find(m=>!save.missions[m.id]?.done)||null;
  function summarize(sim,extra={}){const r=World.order.includes(sim.difficulty)?sim.difficulty:'standard',rate=sim.completed&&!sim.tdm?(()=>{const p=World.missions.find(m=>m.id===sim.mission)?.par||240,score=Math.max(0,Math.round(10000+sim.stats.flows*200-sim.stats.damage*14-Math.max(0,sim.time-p)*10));return {score,rating:score>=9800&&sim.stats.flows>0?'S':score>=8200?'A':score>=6500?'B':'C'};})():{score:0,rating:null};
    // Any holdout killhouse (the default one, or an endless variant overlaid on a campaign map) has a single
    // wave-survival stage; checking that instead of the literal id covers every unlocked killhouse.
    const kind=sim.map.objectives[0]?.kind,endless=kind==='endless';
    const more=kind==='extraction'?{extract:{loot:sim.extract.loot,found:sim.extract.found,total:sim.extract.total,out:!!sim.completed}}:kind==='trial'?{trial:{seed:sim.trial.seed,time:+sim.trial.time.toFixed(2),score:sim.trial.score??null,hit:sim.trial.hit,targets:sim.trial.targets.length,flows:sim.trial.flows,done:!!sim.trial.done}}:{};
    return {...more,mode:sim.tdm?'tdm':endless?'holdout':kind==='extraction'?'extract':kind==='trial'?'trial':sim.training?'training':'campaign',result:sim.tdm?sim.tdm.result:undefined,mission:sim.mission,difficulty:r,mutators:Object.keys(sim.mut||{}),completed:sim.completed,time:sim.time,stats:{...sim.stats},mastery:{...sim.mastery},rating:rate.rating,score:sim.tdm?[...sim.tdm.score]:rate.score,deaths:0,...extra};}
  // Applies one finished run to the save and returns the debrief: every line the tally screen counts up, plus rank, medals and contracts.
  const HOLDOUT_MILESTONES=[[5,250],[10,600],[15,1000],[20,1500],[25,2000],[30,2500],[40,3500],[50,5000]];
  function settle(save,run,day=0){const report={lines:[],credits:0,xp:0,medals:[],contracts:[],mastery:[],rankUps:[],newBest:false,rankBefore:rankOf(save.xp)};
    if(run.mode==='training')return report;const D=World.difficulties[run.difficulty]||World.difficulties.standard,meta=World.missions.find(m=>m.id===run.mission);let sub=0;const line=(label,value,note='')=>{if(value){report.lines.push({label,value:Math.round(value),note});sub+=value;}};
    for(const [k,v] of Object.entries(run.mastery||{})){if(!W[k])continue;const before=masteryLevel(save.mastery[k]||0);save.mastery[k]=(save.mastery[k]||0)+v;const after=masteryLevel(save.mastery[k]);if(after>before)report.mastery.push({weapon:k,level:after,perk:MASTERY_PERKS[after-1]});}
    save.stats.kills+=run.stats.kills||0;save.stats.flows=(save.stats.flows||0)+(run.stats.flows||0);
    // Kills that belong to no gun are counted too: the career challenges below ask for them.
    for(const k of EXTRA_KILLS)if(run.mastery?.[k])save.mastery[k]=(save.mastery[k]||0)+run.mastery[k];
    if(run.mode==='campaign'&&run.completed&&meta){const m=mission(save,run.mission),firstAtDiff=!m.diffs.includes(run.difficulty);
      line('MISSION COMPLETE',meta.reward);line('HOSTILE BOUNTIES',run.stats.credits);line('FLOW CHAINS',(run.stats.flows||0)*20,'×'+(run.stats.flows||0));line('FIELD RATING '+run.rating,{S:400,A:250,B:100}[run.rating]||0);
      if(!run.deaths)line('NO DEATHS',250);if(run.stats.intel&&!m.intel)line('INTEL RECOVERED',200);if(firstAtDiff)line('FIRST CLEAR / '+D.label,meta.reward*1.5);
      const earned=[!0,!run.deaths,run.rating==='S',run.stats.intel>0||m.intel,run.difficulty==='insane'];medalsFor(meta).forEach((md,i)=>{if(earned[i]&&!m.medals.includes(md.id)){m.medals.push(md.id);report.medals.push(md);line('MEDAL / '+md.name,150);}});
      const oc=OP_CHALLENGES[run.mission];if(oc&&!m.opChallenge&&oc.met(run,meta)){m.opChallenge=true;line('OPERATION CHALLENGE / '+oc.text.toUpperCase(),oc.reward);report.opChallenge={...oc,met:undefined};}
      m.done=true;if(run.stats.intel)m.intel=true;if(firstAtDiff)m.diffs.push(run.difficulty);const best={score:run.score,rating:run.rating,time:+run.time.toFixed(1),difficulty:run.difficulty};if(!m.best||run.score>m.best.score){m.best=best;report.newBest=true;}save.stats.missions++;}
    // Extraction: the bounties, and what the caches were worth only if the squad got out. Each killhouse keeps its best haul.
    else if(run.mode==='extract'){const hm=World.holdoutMaps.find(h=>h.id===run.mission),X=run.extract||{loot:0,found:0,total:0,out:false};line('HOSTILE BOUNTIES',run.stats.credits);
      if(X.out){line('LOOT EXTRACTED',X.loot,X.found+' OF '+X.total+' CACHES');line('EXTRACTION',200);}
      if(hm&&hm.pay>1)line('KILLHOUSE / '+hm.title,(run.stats.credits+(X.out?X.loot:0))*(hm.pay-1),'×'+hm.pay);
      const rec=save.extract[run.mission]||(save.extract[run.mission]={runs:0,out:0,best:0});rec.runs++;if(X.out){rec.out++;rec.best=Math.max(rec.best,X.loot);}}
    // Flow trials pay for skill, not time: a course's first finish and every new best on it. Each course keeps its best.
    else if(run.mode==='trial'){const T=run.trial,key=run.mission+':'+(T?.seed??0);if(T?.done&&Number.isFinite(T.score)){const rec=save.trials[key],first=!rec;
        if(first){line('COURSE FINISHED',150,'FIRST TIME');save.trials[key]={best:T.score,time:T.time,hit:T.hit,targets:T.targets,flows:T.flows,at:Date.now(),runs:1};}
        else{rec.runs=(rec.runs||0)+1;if(T.score<rec.best){line('PERSONAL BEST',75,(rec.best-T.score).toFixed(2)+' S FASTER');Object.assign(rec,{best:T.score,time:T.time,hit:T.hit,targets:T.targets,flows:T.flows,at:Date.now()});}}}}
    else if(run.mode==='holdout'){const hm=World.holdoutMaps.find(h=>h.id===run.mission),wave=run.stats.wave||0;line('HOSTILE BOUNTIES + WAVES',run.stats.credits,run.stats.spent?'AFTER '+Math.round(run.stats.spent)+' CR SPENT ON SUPPLIES':'');
      // The campaign killhouses are harder ground and pay a little more than the default one.
      if(hm&&hm.pay>1)line('KILLHOUSE / '+hm.title,run.stats.credits*(hm.pay-1),'×'+hm.pay);
      // A milestone wave reached for the first time on this pressure pays once, on top of everything else.
      // A seeded challenge (fixed kit, a mutator) is a record of its own: it does not touch the ordinary wave records.
      const b=save.holdout[run.difficulty]||0;if(!run.challenge){for(const [m,pay] of HOLDOUT_MILESTONES)if(wave>=m&&b<m)line('MILESTONE / WAVE '+m,pay,'FIRST TIME ON '+D.label);
      if(wave>b){save.holdout[run.difficulty]=wave;report.newBest=true;if(b)line('NEW RECORD / WAVE '+wave,100*wave);}}
      if(hm&&!run.challenge){const rec=save.killhouse[hm.id]||(save.killhouse[hm.id]={});if(wave>(rec[run.difficulty]||0)){rec[run.difficulty]=wave;report.newBest=true;}}}
    // Team deathmatch: bounties for the hostiles you put down yourself, a bonus for the result, and the same map
    // bonus a killhouse pays. An abandoned match (no result) banks its bounties only.
    else if(run.mode==='tdm'){const hm=World.holdoutMaps.find(h=>h.id===run.mission);line('HOSTILE BOUNTIES',run.stats.credits);
      if(run.result){line(run.result==='win'?'MATCH WON':run.result==='draw'?'MATCH DRAWN':'MATCH PLAYED',run.stats.match||0,Array.isArray(run.score)?run.score.join(' – '):'');
        if(run.ranked!==false){const rec=save.tdm[run.difficulty]||(save.tdm[run.difficulty]={played:0,wins:0});rec.played++;if(run.result==='win')rec.wins++;}}
      if(hm&&hm.pay>1)line('MAP / '+hm.title,sub*(hm.pay-1),'×'+hm.pay);}
    // Mutators pay for the harder rules they set (World.mutators).
    const muts=(run.mutators||[]).filter(k=>Object.hasOwn(World.mutators,k));if(muts.length&&sub){const m=muts.reduce((a,k)=>a*World.mutators[k].reward,1);line('MUTATORS / '+muts.map(k=>World.mutators[k].short).join(' + '),sub*(m-1),'×'+m.toFixed(2));}
    const mult=D.reward;if(sub&&mult!==1){const extra=sub*(mult-1);report.lines.push({label:'DIFFICULTY / '+D.label,value:Math.round(extra),note:'×'+mult});sub+=extra;}
    report.xp=Math.round(sub);
    const scav=Math.min(3,save.upgrades.scavenger||0);if(scav&&sub){const extra=sub*.08*scav;report.lines.push({label:'SCAVENGER',value:Math.round(extra),note:'+'+8*scav+'%'});sub+=extra;}
    const qualifies=run.mode==='extract'&&!!run.extract?.out||run.mode==='campaign'&&run.completed||run.mode==='holdout'&&(run.stats.wave||0)>=3||run.mode==='tdm'&&!!run.result&&run.ranked!==false;
    if(qualifies&&save.daily.day!==day){save.daily.streak=save.daily.day===day-1?save.daily.streak+1:1;save.daily.day=day;const bonus=150*Math.min(5,save.daily.streak);report.lines.push({label:'DAILY OPERATION',value:bonus,note:'STREAK '+save.daily.streak});sub+=bonus;}
    for(const c of refreshContracts(save,day)){if(c.done)continue;const v=c.stat(run),entry=save.contracts.list.find(x=>x.id===c.id);entry.progress=Math.min(c.goal,c.max?Math.max(entry.progress,v):entry.progress+v);if(entry.progress>=c.goal){entry.done=true;report.lines.push({label:'CONTRACT / '+c.text.toUpperCase(),value:c.reward});sub+=c.reward;}report.contracts.push({text:c.text,progress:entry.progress,goal:c.goal,done:entry.done,reward:c.reward});}
    report.credits=Math.round(sub);save.credits+=report.credits;save.xp+=report.xp;
    let after=rankOf(save.xp);for(let r=report.rankBefore.rank+1;r<=after.rank;r++){const bonus=150*r;save.credits+=bonus;report.credits+=bonus;const tier=World.tiers.indexOf(r)+1;report.rankUps.push({rank:r,title:rankOf(need(r)).title,bonus,tier});}
    report.rankAfter=after;report.unlocks=claim(save);report.goal=nextGoal(save);return report;}
  // Career challenges. An ability or perk marked with one is never sold: it is awarded the moment the challenge is
  // met, at the end of the run that met it (claim), and until then its card shows how far along the player is.
  const CHALLENGES={
    kills:{text:'Eliminate 400 hostiles',goal:400,value:s=>s.stats.kills},
    flawless:{text:'Finish 2 operations without dying',goal:2,value:s=>Object.values(s.missions).filter(m=>m.medals.includes('flawless')).length},
    knife:{text:'Score 30 knife kills',goal:30,value:s=>s.mastery.melee||0},
    flows:{text:'Chain 50 perfect flows',goal:50,value:s=>s.stats.flows||0},
    tdm:{text:'Win 5 team deathmatches',goal:5,value:s=>Object.values(s.tdm||{}).reduce((n,r)=>n+(r.wins||0),0)},
    flows25:{text:'Chain 25 perfect flows',goal:25,value:s=>s.stats.flows||0},
    burn:{text:'Get 25 kills with fire',goal:25,value:s=>s.mastery.incendiary||0},
    explosive:{text:'Get 40 explosive kills',goal:40,value:s=>['grenade','mine','c4','cluster','seeker'].reduce((n,k)=>n+(s.mastery[k]||0),0)+cls(s.mastery,'explosive')},
    wave:{text:'Reach wave 12 in HOLDOUT',goal:12,value:s=>Math.max(0,...Object.values(s.holdout||{}))},
    campaign:{text:'Finish all six operations',goal:6,value:s=>World.missions.filter(m=>s.missions[m.id]?.done).length},
    // The mythic avatars (World.avatars, tier 6): the long-haul feats of a career.
    sentinel:{text:'Win 25 team deathmatches',goal:25,value:s=>Object.values(s.tdm||{}).reduce((n,r)=>n+(r.wins||0),0)},
    override:{text:'Reach wave 25 in HOLDOUT',goal:25,value:s=>Math.max(0,...Object.values(s.holdout||{}),...Object.values(s.killhouse||{}).flatMap(r=>Object.values(r||{})))}};
  // Kills that belong to no gun and are still kept for the career: the knife, and each kind of explosive and fire.
  const EXTRA_KILLS=['melee','grenade','mine','incendiary','c4','cluster','seeker'];
  function challenge(save,id){const c=CHALLENGES[id];if(!c)return null;const progress=Math.max(0,Math.min(c.goal,Math.floor(c.value(save)||0)));return {id,text:c.text,goal:c.goal,progress,done:progress>=c.goal};}
  function claim(save){const out=[];for(const [kind,table] of [['weapon',W],['gear',G],['support',SUP],['perk',PERKS],['avatar',AV]])for(const [key,item] of Object.entries(table))if(item.challenge&&!owns(save,kind,key)&&challenge(save,item.challenge).done){grant(save,kind,key);out.push({kind,key,name:item.name,text:CHALLENGES[item.challenge].text});}return out;}
  // How many perk slots the player's rank has opened (World.perkSlots).
  const perkSlots=save=>World.perkSlots.filter(r=>rankOf(save.xp).rank>=r).length;
  // A gun found in the field (picked up from a fallen enemy) is 25% off from then on. "kit" is a weapon's next part.
  function price(save,kind,key){if(tableOf(kind))return tableOf(kind)[key]?.price??null;if((kind==='weapon'?W:kind==='gear'?G:{})[key]?.challenge)return null;if(kind==='weapon')return W[key]?Math.round(W[key].price*(save.found.includes(key)?1-FOUND_DISCOUNT:1)/10)*10:undefined;if(kind==='gear')return G[key]?.price;if(kind==='upgrade'){const lvl=save.upgrades[key]||0;return lvl>=3?null:U[key]?.prices[lvl];}
    if(kind==='kit'){const lvl=save.kit[key]||0;return lvl>=3||!W[key]?null:Math.round(Math.min(8000,Math.max(W[key].price||12000,1500))*KIT[lvl].share/50)*50;}return null;}
  function owns(save,kind,key){return tableOf(kind)?listOf(save,kind).includes(key):kind==='weapon'?save.owned.weapons.includes(key):kind==='gear'?save.owned.gear.includes(key):kind==='kit'?(save.kit[key]||0)>=3:(save.upgrades[key]||0)>=3;}
  // The armory tier an item (or an upgrade's next level) sits in, and the rank that tier opens at.
  const tierOf=(save,kind,key)=>tableOf(kind)?tableOf(kind)[key]?.tier||1:kind==='upgrade'?World.upgradeTiers[Math.min(2,save.upgrades[key]||0)]:kind==='gear'?G[key]?.tier||1:W[key]?.tier||1,rankFor=tier=>World.tiers[tier-1]||1;
  // An item's grade, 1 to 5, is its armory tier; the screens colour it by that (silver, green, blue, gold, and a
  // fiery red for the legendary pair) so what is ordinary and what is exceptional can be told at a glance. An
  // upgrade is graded by the level it would be bought at next, and a weapon's kit by the weapon.
  // Avatars add a sixth grade above legendary, MYTHIC, for the ones that are awarded rather than sold.
  const RARITY=['STANDARD ISSUE','FIELD GRADE','SPECIALIST','ELITE','LEGENDARY','MYTHIC'],rarity=(save,kind,key)=>Math.max(1,Math.min(RARITY.length,tierOf(save,kind==='kit'?'weapon':kind,key)));
  // 0 when the item can be bought at the player's rank, otherwise the rank it needs.
  function locked(save,kind,key){const rank=rankFor(tierOf(save,kind,key));return rankOf(save.xp).rank>=rank?0:rank;}
  function buy(save,kind,key){const cost=price(save,kind,key);if(cost==null)return {ok:false,reason:'UNAVAILABLE'};if(owns(save,kind,key))return {ok:false,reason:'OWNED'};
    if(kind==='kit'){if(!save.owned.weapons.includes(key))return {ok:false,reason:'BUY THE WEAPON FIRST'};const lvl=save.kit[key]||0;if(masteryLevel(save.mastery[key]||0)<=lvl)return {ok:false,reason:'NEEDS MASTERY LEVEL '+(lvl+1)+' / '+MASTERY[lvl]+' KILLS WITH IT'};}
    const rank=locked(save,kind,key);if(rank)return {ok:false,reason:'REACH RANK '+rank+' TO UNLOCK'};if(save.credits<cost)return {ok:false,reason:'NEED '+(cost-save.credits)+' MORE CREDITS'};
    save.credits-=cost;grant(save,kind,key);return {ok:true,cost};}
  // Puts an item in the save without charging for it: what a purchase, a challenge award and the pacing estimate all end in.
  function grant(save,kind,key){if(tableOf(kind)){if(!listOf(save,kind).includes(key))listOf(save,kind).push(key);}else if(kind==='weapon')save.owned.weapons.push(key);else if(kind==='gear')save.owned.gear.push(key);else if(kind==='kit')save.kit[key]=(save.kit[key]||0)+1;else save.upgrades[key]=(save.upgrades[key]||0)+1;}
  // Everything still for sale: each unowned gun and gadget, and the next level of each unfinished upgrade.
  function catalogue(save){return [...Object.keys(W).map(k=>['weapon',k]),...Object.keys(G).map(k=>['gear',k]),...Object.keys(SUP).map(k=>['support',k]),...Object.keys(PERKS).map(k=>['perk',k]),...Object.keys(U).map(k=>['upgrade',k])].filter(([kind,key])=>!owns(save,kind,key)&&price(save,kind,key)>0)
    .map(([kind,key])=>({kind,key,name:tableOf(kind)?tableOf(kind)[key].name:kind==='upgrade'?U[key].name+' LV '+((save.upgrades[key]||0)+1):kind==='gear'?G[key].name:W[key].short,cost:price(save,kind,key),rank:locked(save,kind,key)}));}
  // What to aim for next, shown after a run: the cheapest thing the player's rank allows but their credits do not yet
  // cover (or, if they can afford everything open to them, the best thing they can buy now), and the next armory tier.
  function nextGoal(save){const open=catalogue(save).filter(i=>!i.rank).sort((a,b)=>a.cost-b.cost),short=open.find(i=>i.cost>save.credits),afford=open.filter(i=>i.cost<=save.credits).pop(),r=rankOf(save.xp),tier=World.tiers.findIndex(t=>t>r.rank);
    return {item:short?{...short,need:short.cost-save.credits}:null,afford:afford||null,tier:tier<0?null:{tier:tier+1,rank:World.tiers[tier],ranks:World.tiers[tier]-r.rank,xp:need(World.tiers[tier])-save.xp}};}
  // The armory's "next up" marker: the cheapest unowned thing recommended for the next unfinished operation, or, when
  // the player already has all of that, the cheapest gun or gadget their rank lets them buy.
  function nextUp(save){const m=nextMission(save),rec=m?.rec?[...(m.rec.weapons||[]).map(k=>['weapon',k]),...(m.rec.gear||[]).map(k=>['gear',k])]:[];
    return rec.filter(([kind,key])=>!owns(save,kind,key)).map(([kind,key])=>({kind,key,cost:price(save,kind,key)})).sort((a,b)=>a.cost-b.cost)[0]||catalogue(save).filter(i=>!i.rank&&i.kind!=='upgrade').sort((a,b)=>a.cost-b.cost)[0]||null;}
  function loadout(save,lo=save.loadout){const ow=save.owned.weapons,og=save.owned.gear,pick=(k,slot,fb)=>k&&W[k]&&W[k].slot===slot&&ow.includes(k)?k:fb,gear=(k,slot)=>k&&G[k]&&G[k].slot===slot&&og.includes(k)?k:null;
    // One field support, and one perk in each slot the player's rank has opened.
    const open=perkSlots(save),perks=[0,1,2].map(i=>{const k=Array.isArray(lo.perks)?lo.perks[i]:null;return i<open&&PERKS[k]?.slot===i&&save.owned.perks.includes(k)?k:null;});
    return {primary:pick(lo.primary,0,'rifle'),secondary:pick(lo.secondary,1,'pistol'),lethal:gear(lo.lethal,'lethal'),tactical:gear(lo.tactical,'tactical'),support:Object.hasOwn(SUP,lo.support??'')&&save.owned.support.includes(lo.support)?lo.support:null,perks};}
  const profile=save=>({upgrades:{...save.upgrades},kit:{...save.kit},mastery:Object.fromEntries(Object.entries(save.mastery).map(([k,v])=>[k,masteryLevel(v)]))});
  // ---------- Intel: the armory's file on every hostile ----------
  // A file opens in three steps: UNKNOWN (never met: a silhouette in its threat colour), SIGHTED (seen in a run: its
  // picture, name, role and description), STUDIED (one kill: its counter and its numbers), and COMPLETE once enough
  // have been killed (fewer for the dangerous ones), which pays once. save.intel[type] = {seen, kills, paid}.
  const INTEL=World.intel||{},INTEL_KEYS=Object.keys(INTEL).sort((a,b)=>INTEL[a].tier-INTEL[b].tier),INTEL_GOAL=[0,15,10,8,5,2],INTEL_PAY=[0,100,150,250,400,750],INTEL_LEVELS=['UNKNOWN','SIGHTED','STUDIED','COMPLETE'];
  const intelEntry=(save,k)=>(save.intel||(save.intel={}))[k]||(save.intel[k]={seen:0,kills:0});
  function intelOf(save,k){const t=INTEL[k];if(!t)return null;const i=save.intel?.[k]||{seen:0,kills:0},goal=INTEL_GOAL[t.tier],level=i.kills>=goal?3:i.kills>0?2:i.seen?1:0;
    return {key:k,tier:t.tier,level,label:INTEL_LEVELS[level],seen:!!i.seen||i.kills>0,kills:i.kills||0,goal,pay:INTEL_PAY[t.tier],paid:!!i.paid};}
  // A first sighting; true if it opened the file.
  function intelSight(save,k){if(!INTEL[k])return false;const i=intelEntry(save,k);if(i.seen)return false;i.seen=1;return true;}
  // A kill by the player's squad. Completing a file pays its reward straight into the wallet, once.
  function intelKill(save,k){if(!INTEL[k])return null;const before=intelOf(save,k),i=intelEntry(save,k);i.seen=1;i.kills=Math.min(1e6,(i.kills||0)+1);const after=intelOf(save,k);let pay=0;
    if(after.level===3&&!i.paid){i.paid=1;pay=after.pay;save.credits+=pay;}return {opened:!before.seen,studied:before.level<2&&after.level>=2,complete:pay>0,pay,level:after.level};}
  function intelSummary(save){const all=INTEL_KEYS.map(k=>intelOf(save,k));return {total:all.length,seen:all.filter(i=>i.level>=1).length,studied:all.filter(i=>i.level>=2).length,complete:all.filter(i=>i.level>=3).length};}
  // Where a hostile is met, in words, for its file.
  function intelWhere(k){const t=INTEL[k];if(!t)return [];const title=id=>World.missions.find(m=>m.id===id)?.title||id.toUpperCase(),out=[];
    if(t.ops.length)out.push(t.ops.map(title).join(' · '));if(t.insane?.length)out.push(t.insane.map(title).join(' · ')+' (HARDER PRESSURE ONLY)');
    if(t.wave)out.push(t.tier===5?'HOLDOUT · RED WAVE '+t.wave:t.built?'HOLDOUT · BUILT BY ENGINEERS FROM WAVE '+t.wave:'HOLDOUT · FROM WAVE '+t.wave);return out;}
  // A save from before Intel existed starts with the files it has earned: every hostile of the operations it has
  // cleared (and their Insane reinforcements, if cleared on Insane), and every one a holdout run of its best wave met.
  // Sightings only - kills are counted from here on. Done once per save.
  function intelBackfill(save){if(save.intelInit)return 0;save.intelInit=1;let n=0;const best=Math.max(0,...Object.values(save.holdout||{}).map(Number).filter(Number.isFinite),...Object.values(save.killhouse||{}).flatMap(r=>Object.values(r||{})).map(Number).filter(Number.isFinite));
    for(const k of INTEL_KEYS){const t=INTEL[k],m=id=>save.missions?.[id]?.done,met=t.ops.some(m)||(t.insane||[]).some(id=>m(id)&&(save.missions[id].diffs||[]).includes('insane'))||t.wave>0&&best>=t.wave;if(met&&intelSight(save,k))n++;}return n;}
  return {INTEL_KEYS,INTEL_GOAL,INTEL_PAY,INTEL_LEVELS,intelOf,intelSight,intelKill,intelSummary,intelWhere,intelBackfill,OP_CHALLENGES,CHALLENGE_RULES,CHALLENGE_KINDS,challengePeriod,challengeFor,challengeScore,startChallenge,recordChallenge,challengeBoard,weaponStats,weaponTraits,TITLES,rankOf,need,MASTERY,masteryLevel,MASTERY_PERKS,CONTRACTS,contractsFor,refreshContracts,medalsFor,mission,unlocked,nextMission,summarize,settle,price,owns,buy,loadout,profile,KIT,FOUND_DISCOUNT,tierOf,rankFor,RARITY,rarity,CHALLENGES,EXTRA_KILLS,challenge,claim,grant,perkSlots,locked,catalogue,nextGoal,nextUp};
});

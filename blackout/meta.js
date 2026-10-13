(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPMeta=api;})(globalThis,function(World){
  'use strict';
  // Progression and economy. Pure functions over the save object so the reward loop is testable without a browser.
  const W=World.weapons,G=World.gear,U=World.upgrades,ORDER=World.order;
  const TITLES=['RECRUIT','PRIVATE','CORPORAL','SERGEANT','STAFF SERGEANT','OPERATOR','SPECIALIST','VETERAN','ELITE','GHOST','PHANTOM','SPECTRE','WRAITH HUNTER','LEGEND','BLACKOUT'];
  // XP needed to hold a rank. Rank opens the armory tiers (World.tiers), so the curve is paced against the whole
  // catalogue: see blackout/qa/economy-report.cjs.
  const need=r=>r<=1?0:Math.round(XP_BASE*Math.pow(r-1,XP_POWER)/50)*50,XP_BASE=1500,XP_POWER=1.75;
  function rankOf(xp){let r=1;while(need(r+1)<=xp&&r<99)r++;const base=need(r),next=need(r+1);return {rank:r,title:TITLES[Math.min(r-1,TITLES.length-1)]+(r>TITLES.length?' '+(r-TITLES.length+1):''),into:xp-base,span:next-base,next};}
  const MASTERY=[20,60,150],masteryLevel=k=>MASTERY.filter(n=>k>=n).length,MASTERY_PERKS=['+10% reserve ammunition','8% faster reload','+6% damage'];
  // Weapon kit: one purchasable part per mastery level, bought in order. Parts cost a share of the gun's price.
  const KIT=[{name:'MATCH BARREL',desc:'20% tighter spread.',share:.25},{name:'FAST MAG',desc:'10% faster reload.',share:.4},{name:'HOT LOADS',desc:'+8% damage.',share:.6}],FOUND_DISCOUNT=.25;
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
    {id:'hard',text:'Complete a mission on High intensity or Insane',goal:1,reward:600,stat:r=>r.completed&&r.mode==='campaign'&&ORDER.indexOf(r.difficulty)>=2?1:0},
    {id:'flawless',text:'Complete a mission without dying',goal:1,reward:450,stat:r=>r.completed&&r.mode==='campaign'&&!r.deaths?1:0},
    {id:'holdout',text:'Reach wave 8 in HOLDOUT',goal:8,reward:500,max:true,stat:r=>r.mode==='holdout'?r.stats.wave||0:0},
    {id:'srank',text:'Earn an S field rating',goal:1,reward:500,stat:r=>r.completed&&r.rating==='S'?1:0}];
  function contractsFor(day){let seed=(day*2654435761)>>>0;const pool=[...CONTRACTS],out=[];while(out.length<3){seed=(Math.imul(seed,1664525)+1013904223)>>>0;out.push(pool.splice(seed%pool.length,1)[0]);}return out;}
  function refreshContracts(save,day){if(save.contracts.day!==day){save.contracts={day,list:contractsFor(day).map(c=>({id:c.id,progress:0,done:false}))};}return save.contracts.list.map(c=>({...CONTRACTS.find(x=>x.id===c.id),...c}));}
  const medalsFor=m=>[{id:'complete',name:'MISSION COMPLETE'},{id:'flawless',name:'NO DEATHS'},{id:'srank',name:'S RATING'},{id:'intel',name:'INTEL RECOVERED'},{id:'insane',name:'INSANE CLEAR'}];
  const mission=(save,id)=>save.missions[id]||(save.missions[id]={done:false,best:null,medals:[],diffs:[],intel:false});
  function unlocked(save,id){const i=World.missions.findIndex(m=>m.id===id);return i<=0||!!save.missions[World.missions[i-1].id]?.done;}
  const nextMission=save=>World.missions.find(m=>!save.missions[m.id]?.done)||null;
  function summarize(sim,extra={}){const r=World.order.includes(sim.difficulty)?sim.difficulty:'standard',rate=sim.completed?(()=>{const p=World.missions.find(m=>m.id===sim.mission)?.par||240,score=Math.max(0,Math.round(10000+sim.stats.flows*200-sim.stats.damage*14-Math.max(0,sim.time-p)*10));return {score,rating:score>=9600?'S':score>=8200?'A':score>=6500?'B':'C'};})():{score:0,rating:null};
    // Any holdout killhouse (the default one, or an endless variant overlaid on a campaign map) has a single
    // wave-survival stage; checking that instead of the literal id covers every unlocked killhouse.
    const endless=sim.map.objectives[0]?.kind==='endless';
    return {mode:endless?'holdout':sim.training?'training':'campaign',mission:sim.mission,difficulty:r,completed:sim.completed,time:sim.time,stats:{...sim.stats},mastery:{...sim.mastery},rating:rate.rating,score:rate.score,deaths:0,...extra};}
  // Applies one finished run to the save and returns the debrief: every line the tally screen counts up, plus rank, medals and contracts.
  function settle(save,run,day=0){const report={lines:[],credits:0,xp:0,medals:[],contracts:[],mastery:[],rankUps:[],newBest:false,rankBefore:rankOf(save.xp)};
    if(run.mode==='training')return report;const D=World.difficulties[run.difficulty]||World.difficulties.standard,meta=World.missions.find(m=>m.id===run.mission);let sub=0;const line=(label,value,note='')=>{if(value){report.lines.push({label,value:Math.round(value),note});sub+=value;}};
    for(const [k,v] of Object.entries(run.mastery||{})){if(!W[k])continue;const before=masteryLevel(save.mastery[k]||0);save.mastery[k]=(save.mastery[k]||0)+v;const after=masteryLevel(save.mastery[k]);if(after>before)report.mastery.push({weapon:k,level:after,perk:MASTERY_PERKS[after-1]});}
    save.stats.kills+=run.stats.kills||0;
    if(run.mode==='campaign'&&run.completed&&meta){const m=mission(save,run.mission),firstAtDiff=!m.diffs.includes(run.difficulty);
      line('MISSION COMPLETE',meta.reward);line('HOSTILE BOUNTIES',run.stats.credits);line('FLOW CHAINS',(run.stats.flows||0)*20,'×'+(run.stats.flows||0));line('FIELD RATING '+run.rating,{S:400,A:250,B:100}[run.rating]||0);
      if(!run.deaths)line('NO DEATHS',250);if(run.stats.intel&&!m.intel)line('INTEL RECOVERED',200);if(firstAtDiff)line('FIRST CLEAR / '+D.label,meta.reward*1.5);
      const earned=[!0,!run.deaths,run.rating==='S',run.stats.intel>0||m.intel,run.difficulty==='insane'];medalsFor(meta).forEach((md,i)=>{if(earned[i]&&!m.medals.includes(md.id)){m.medals.push(md.id);report.medals.push(md);line('MEDAL / '+md.name,150);}});
      m.done=true;if(run.stats.intel)m.intel=true;if(firstAtDiff)m.diffs.push(run.difficulty);const best={score:run.score,rating:run.rating,time:+run.time.toFixed(1),difficulty:run.difficulty};if(!m.best||run.score>m.best.score){m.best=best;report.newBest=true;}save.stats.missions++;}
    else if(run.mode==='holdout'){const hm=World.holdoutMaps.find(h=>h.id===run.mission),wave=run.stats.wave||0;line('HOSTILE BOUNTIES + WAVES',run.stats.credits,run.stats.spent?'AFTER '+Math.round(run.stats.spent)+' CR SPENT ON SUPPLIES':'');
      // The campaign killhouses are harder ground and pay a little more than the default one.
      if(hm&&hm.pay>1)line('KILLHOUSE / '+hm.title,run.stats.credits*(hm.pay-1),'×'+hm.pay);
      const b=save.holdout[run.difficulty]||0;if(wave>b){save.holdout[run.difficulty]=wave;report.newBest=true;if(b)line('NEW RECORD / WAVE '+wave,100*wave);}
      if(hm){const rec=save.killhouse[hm.id]||(save.killhouse[hm.id]={});if(wave>(rec[run.difficulty]||0)){rec[run.difficulty]=wave;report.newBest=true;}}}
    const mult=D.reward;if(sub&&mult!==1){const extra=sub*(mult-1);report.lines.push({label:'DIFFICULTY / '+D.label,value:Math.round(extra),note:'×'+mult});sub+=extra;}
    report.xp=Math.round(sub);
    const scav=Math.min(3,save.upgrades.scavenger||0);if(scav&&sub){const extra=sub*.08*scav;report.lines.push({label:'SCAVENGER',value:Math.round(extra),note:'+'+8*scav+'%'});sub+=extra;}
    const qualifies=run.mode==='campaign'&&run.completed||run.mode==='holdout'&&(run.stats.wave||0)>=3;
    if(qualifies&&save.daily.day!==day){save.daily.streak=save.daily.day===day-1?save.daily.streak+1:1;save.daily.day=day;const bonus=150*Math.min(5,save.daily.streak);report.lines.push({label:'DAILY OPERATION',value:bonus,note:'STREAK '+save.daily.streak});sub+=bonus;}
    for(const c of refreshContracts(save,day)){if(c.done)continue;const v=c.stat(run),entry=save.contracts.list.find(x=>x.id===c.id);entry.progress=Math.min(c.goal,c.max?Math.max(entry.progress,v):entry.progress+v);if(entry.progress>=c.goal){entry.done=true;report.lines.push({label:'CONTRACT / '+c.text.toUpperCase(),value:c.reward});sub+=c.reward;}report.contracts.push({text:c.text,progress:entry.progress,goal:c.goal,done:entry.done,reward:c.reward});}
    report.credits=Math.round(sub);save.credits+=report.credits;save.xp+=report.xp;
    let after=rankOf(save.xp);for(let r=report.rankBefore.rank+1;r<=after.rank;r++){const bonus=150*r;save.credits+=bonus;report.credits+=bonus;const tier=World.tiers.indexOf(r)+1;report.rankUps.push({rank:r,title:rankOf(need(r)).title,bonus,tier});}
    report.rankAfter=after;report.goal=nextGoal(save);return report;}
  // A gun found in the field (picked up from a fallen enemy) is 25% off from then on. "kit" is a weapon's next part.
  function price(save,kind,key){if(kind==='weapon')return W[key]?Math.round(W[key].price*(save.found.includes(key)?1-FOUND_DISCOUNT:1)/10)*10:undefined;if(kind==='gear')return G[key]?.price;if(kind==='upgrade'){const lvl=save.upgrades[key]||0;return lvl>=3?null:U[key]?.prices[lvl];}
    if(kind==='kit'){const lvl=save.kit[key]||0;return lvl>=3||!W[key]?null:Math.round(Math.min(8000,Math.max(W[key].price,1500))*KIT[lvl].share/50)*50;}return null;}
  function owns(save,kind,key){return kind==='weapon'?save.owned.weapons.includes(key):kind==='gear'?save.owned.gear.includes(key):kind==='kit'?(save.kit[key]||0)>=3:(save.upgrades[key]||0)>=3;}
  // The armory tier an item (or an upgrade's next level) sits in, and the rank that tier opens at.
  const tierOf=(save,kind,key)=>kind==='upgrade'?World.upgradeTiers[Math.min(2,save.upgrades[key]||0)]:kind==='gear'?G[key]?.tier||1:W[key]?.tier||1,rankFor=tier=>World.tiers[tier-1]||1;
  // 0 when the item can be bought at the player's rank, otherwise the rank it needs.
  function locked(save,kind,key){const rank=rankFor(tierOf(save,kind,key));return rankOf(save.xp).rank>=rank?0:rank;}
  function buy(save,kind,key){const cost=price(save,kind,key);if(cost==null)return {ok:false,reason:'UNAVAILABLE'};if(owns(save,kind,key))return {ok:false,reason:'OWNED'};
    if(kind==='kit'){if(!save.owned.weapons.includes(key))return {ok:false,reason:'BUY THE WEAPON FIRST'};const lvl=save.kit[key]||0;if(masteryLevel(save.mastery[key]||0)<=lvl)return {ok:false,reason:'NEEDS MASTERY LEVEL '+(lvl+1)+' / '+MASTERY[lvl]+' KILLS WITH IT'};}
    const rank=locked(save,kind,key);if(rank)return {ok:false,reason:'REACH RANK '+rank+' TO UNLOCK'};if(save.credits<cost)return {ok:false,reason:'NEED '+(cost-save.credits)+' MORE CREDITS'};
    save.credits-=cost;if(kind==='weapon')save.owned.weapons.push(key);else if(kind==='gear')save.owned.gear.push(key);else if(kind==='kit')save.kit[key]=(save.kit[key]||0)+1;else save.upgrades[key]=(save.upgrades[key]||0)+1;return {ok:true,cost};}
  // Everything still for sale: each unowned gun and gadget, and the next level of each unfinished upgrade.
  function catalogue(save){return [...Object.keys(W).map(k=>['weapon',k]),...Object.keys(G).map(k=>['gear',k]),...Object.keys(U).map(k=>['upgrade',k])].filter(([kind,key])=>!owns(save,kind,key)&&price(save,kind,key)>0)
    .map(([kind,key])=>({kind,key,name:kind==='upgrade'?U[key].name+' LV '+((save.upgrades[key]||0)+1):kind==='gear'?G[key].name:W[key].short,cost:price(save,kind,key),rank:locked(save,kind,key)}));}
  // What to aim for next, shown after a run: the cheapest thing the player's rank allows but their credits do not yet
  // cover (or, if they can afford everything open to them, the best thing they can buy now), and the next armory tier.
  function nextGoal(save){const open=catalogue(save).filter(i=>!i.rank).sort((a,b)=>a.cost-b.cost),short=open.find(i=>i.cost>save.credits),afford=open.filter(i=>i.cost<=save.credits).pop(),r=rankOf(save.xp),tier=World.tiers.findIndex(t=>t>r.rank);
    return {item:short?{...short,need:short.cost-save.credits}:null,afford:afford||null,tier:tier<0?null:{tier:tier+1,rank:World.tiers[tier],ranks:World.tiers[tier]-r.rank,xp:need(World.tiers[tier])-save.xp}};}
  // The armory's "next up" marker: the cheapest unowned thing recommended for the next unfinished operation, or, when
  // the player already has all of that, the cheapest gun or gadget their rank lets them buy.
  function nextUp(save){const m=nextMission(save),rec=m?.rec?[...(m.rec.weapons||[]).map(k=>['weapon',k]),...(m.rec.gear||[]).map(k=>['gear',k])]:[];
    return rec.filter(([kind,key])=>!owns(save,kind,key)).map(([kind,key])=>({kind,key,cost:price(save,kind,key)})).sort((a,b)=>a.cost-b.cost)[0]||catalogue(save).filter(i=>!i.rank&&i.kind!=='upgrade').sort((a,b)=>a.cost-b.cost)[0]||null;}
  function loadout(save,lo=save.loadout){const ow=save.owned.weapons,og=save.owned.gear,pick=(k,slot,fb)=>k&&W[k]&&W[k].slot===slot&&ow.includes(k)?k:fb,gear=(k,slot)=>k&&G[k]&&G[k].slot===slot&&og.includes(k)?k:null;
    return {primary:pick(lo.primary,0,'rifle'),secondary:pick(lo.secondary,1,'pistol'),lethal:gear(lo.lethal,'lethal'),tactical:gear(lo.tactical,'tactical')};}
  const profile=save=>({upgrades:{...save.upgrades},kit:{...save.kit},mastery:Object.fromEntries(Object.entries(save.mastery).map(([k,v])=>[k,masteryLevel(v)]))});
  return {TITLES,rankOf,need,MASTERY,masteryLevel,MASTERY_PERKS,CONTRACTS,contractsFor,refreshContracts,medalsFor,mission,unlocked,nextMission,summarize,settle,price,owns,buy,loadout,profile,KIT,FOUND_DISCOUNT,tierOf,rankFor,locked,catalogue,nextGoal,nextUp};
});

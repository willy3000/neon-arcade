(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPMeta=api;})(globalThis,function(World){
  'use strict';
  // Progression and economy. Pure functions over the save object so the reward loop is testable without a browser.
  const W=World.weapons,G=World.gear,U=World.upgrades,ORDER=World.order;
  const TITLES=['RECRUIT','PRIVATE','CORPORAL','SERGEANT','STAFF SERGEANT','OPERATOR','SPECIALIST','VETERAN','ELITE','GHOST','PHANTOM','SPECTRE','WRAITH HUNTER','LEGEND','BLACKOUT'];
  const need=r=>r<=1?0:Math.round(350*Math.pow(r-1,1.5)/50)*50;
  function rankOf(xp){let r=1;while(need(r+1)<=xp&&r<99)r++;const base=need(r),next=need(r+1);return {rank:r,title:TITLES[Math.min(r-1,TITLES.length-1)]+(r>TITLES.length?' '+(r-TITLES.length+1):''),into:xp-base,span:next-base,next};}
  const MASTERY=[20,60,150],masteryLevel=k=>MASTERY.filter(n=>k>=n).length,MASTERY_PERKS=['+10% reserve ammunition','8% faster reload','+6% damage'];
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
    return {mode:sim.mission==='holdout'?'holdout':sim.training?'training':'campaign',mission:sim.mission,difficulty:r,completed:sim.completed,time:sim.time,stats:{...sim.stats},mastery:{...sim.mastery},rating:rate.rating,score:rate.score,deaths:0,...extra};}
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
    else if(run.mode==='holdout'){line('HOSTILE BOUNTIES + WAVES',run.stats.credits);const b=save.holdout[run.difficulty]||0;if((run.stats.wave||0)>b){save.holdout[run.difficulty]=run.stats.wave;report.newBest=true;if(b)line('NEW RECORD / WAVE '+run.stats.wave,100*run.stats.wave);}}
    const mult=D.reward;if(sub&&mult!==1){const extra=sub*(mult-1);report.lines.push({label:'DIFFICULTY / '+D.label,value:Math.round(extra),note:'×'+mult});sub+=extra;}
    report.xp=Math.round(sub);
    const scav=Math.min(3,save.upgrades.scavenger||0);if(scav&&sub){const extra=sub*.08*scav;report.lines.push({label:'SCAVENGER',value:Math.round(extra),note:'+'+8*scav+'%'});sub+=extra;}
    const qualifies=run.mode==='campaign'&&run.completed||run.mode==='holdout'&&(run.stats.wave||0)>=3;
    if(qualifies&&save.daily.day!==day){save.daily.streak=save.daily.day===day-1?save.daily.streak+1:1;save.daily.day=day;const bonus=150*Math.min(5,save.daily.streak);report.lines.push({label:'DAILY OPERATION',value:bonus,note:'STREAK '+save.daily.streak});sub+=bonus;}
    for(const c of refreshContracts(save,day)){if(c.done)continue;const v=c.stat(run),entry=save.contracts.list.find(x=>x.id===c.id);entry.progress=Math.min(c.goal,c.max?Math.max(entry.progress,v):entry.progress+v);if(entry.progress>=c.goal){entry.done=true;report.lines.push({label:'CONTRACT / '+c.text.toUpperCase(),value:c.reward});sub+=c.reward;}report.contracts.push({text:c.text,progress:entry.progress,goal:c.goal,done:entry.done,reward:c.reward});}
    report.credits=Math.round(sub);save.credits+=report.credits;save.xp+=report.xp;
    let after=rankOf(save.xp);for(let r=report.rankBefore.rank+1;r<=after.rank;r++){const bonus=150*r;save.credits+=bonus;report.credits+=bonus;report.rankUps.push({rank:r,title:rankOf(need(r)).title,bonus});}
    report.rankAfter=after;return report;}
  function price(save,kind,key){if(kind==='weapon')return W[key]?.price;if(kind==='gear')return G[key]?.price;if(kind==='upgrade'){const lvl=save.upgrades[key]||0;return lvl>=3?null:U[key]?.prices[lvl];}return null;}
  function owns(save,kind,key){return kind==='weapon'?save.owned.weapons.includes(key):kind==='gear'?save.owned.gear.includes(key):(save.upgrades[key]||0)>=3;}
  function buy(save,kind,key){const cost=price(save,kind,key);if(cost==null)return {ok:false,reason:'UNAVAILABLE'};if(owns(save,kind,key))return {ok:false,reason:'OWNED'};if(save.credits<cost)return {ok:false,reason:'NEED '+(cost-save.credits)+' MORE CREDITS'};
    save.credits-=cost;if(kind==='weapon')save.owned.weapons.push(key);else if(kind==='gear')save.owned.gear.push(key);else save.upgrades[key]=(save.upgrades[key]||0)+1;return {ok:true,cost};}
  function loadout(save,lo=save.loadout){const ow=save.owned.weapons,og=save.owned.gear,pick=(k,slot,fb)=>k&&W[k]&&W[k].slot===slot&&ow.includes(k)?k:fb,gear=(k,slot)=>k&&G[k]&&G[k].slot===slot&&og.includes(k)?k:null;
    return {primary:pick(lo.primary,0,'rifle'),secondary:pick(lo.secondary,1,'pistol'),lethal:gear(lo.lethal,'lethal'),tactical:gear(lo.tactical,'tactical')};}
  const profile=save=>({upgrades:{...save.upgrades},mastery:Object.fromEntries(Object.entries(save.mastery).map(([k,v])=>[k,masteryLevel(v)]))});
  return {TITLES,rankOf,need,MASTERY,masteryLevel,MASTERY_PERKS,CONTRACTS,contractsFor,refreshContracts,medalsFor,mission,unlocked,nextMission,summarize,settle,price,owns,buy,loadout,profile};
});

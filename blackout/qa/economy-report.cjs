'use strict';
// Economy report: what a holdout run pays, and roughly how long a player takes to own the whole armory.
//   node blackout/qa/economy-report.cjs
// The payout table is measured by running the real simulation. The time-to-catalogue figure is an ESTIMATE built on
// the assumptions in MODEL below (how long a wave takes, how far a player gets, how much they spend mid-run); change
// those and the answer moves. Use it to compare one set of prices against another, not as a promise.
const Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),Save=require('../save.js'),A=World.archetypes;
const MODEL={
  combo:.5,            // share of the possible combo bonus an average player actually collects
  waveSeconds:n=>18+3.5*n, // seconds to clear a wave of n hostiles
  restSeconds:9,       // the pause between waves (REST in core.js)
  menuSeconds:75,      // lobby, debrief and armory time around each run
  startWave:6,         // the wave a new player reaches
  wavePerHour:.6,      // how much further they get per hour played
  topWave:14,
  supplySpend:.25,     // share of a run's credits spent at the supply drop
  missionSeconds:540,  // one campaign operation
  dailyPerHour:1100,   // daily bonus and contracts, assuming about an hour a day
  found:.6             // share of droppable guns found (25% off) before they are bought
};
// Credits and hostiles per wave, from the simulation: a bot kills every hostile the moment it becomes active. "full"
// keeps the kill chain alive for the whole run, "none" never chains.
function payouts(difficulty='standard',waves=20,mission='holdout'){const s=Core.create({mission,difficulty,seed:1701}),rows=[];let base=0,kills=0,last=0,waveBonus=0;
  for(let i=0;i<120*60*30&&s.stats.wave<waves;i++){s.player.health=100;Core.step(s,{});
    for(const e of s.events)if(e.type==='waveclear')waveBonus+=e.bonus;s.events.length=0;
    for(const e of s.enemies){if(e.dead||!e.active)continue;base+=Math.round((A[e.type].bounty||15)*.6);kills++;Core.damageEnemy(s,e,99999,0,.1,'rifle',true,true);}
    if(s.stats.wave!==last){last=s.stats.wave;rows.push({wave:last,kills,none:base+waveBonus,full:s.stats.credits});}}
  return rows;}
function estimate(){const std=payouts('standard',MODEL.topWave),save=Save.defaults();let seconds=0,first=null;const tiers={},log=[];
  const earn=(credits,secs)=>{const before=Meta.rankOf(save.xp).rank;save.credits+=credits;save.xp+=credits;seconds+=secs;const after=Meta.rankOf(save.xp).rank;
    for(let r=before+1;r<=after;r++){save.credits+=150*r;const t=World.tiers.indexOf(r)+1;if(t)tiers[t]=seconds/3600;}
    for(;;){const open=Meta.catalogue(save).filter(i=>!i.rank).sort((a,b)=>a.cost-b.cost),item=open[0];if(!item)break;
      const cost=item.kind==='weapon'&&World.weapons[item.key].drop?Math.round(item.cost*(1-Meta.FOUND_DISCOUNT*MODEL.found)):item.cost;if(save.credits<cost)break;
      save.credits-=cost;Meta.grant(save,item.kind,item.key);
      if(first===null)first=seconds/60;log.push((seconds/3600).toFixed(1)+'h '+item.name);}};
  // The campaign first: each operation once, on Standard.
  for(const m of World.missions)earn(m.reward*2.5+700,MODEL.missionSeconds);
  // Then holdout until nothing is left to buy.
  for(let guard=0;guard<5000&&Meta.catalogue(save).length;guard++){const hours=seconds/3600,wave=Math.min(MODEL.topWave,Math.floor(MODEL.startWave+hours*MODEL.wavePerHour)),row=std[wave-1],prev=k=>k?std[k-1].kills:0;
    let secs=MODEL.menuSeconds;for(let n=1;n<=wave;n++)secs+=MODEL.waveSeconds(std[n-1].kills-prev(n-1))+MODEL.restSeconds;
    const run=(row.none+(row.full-row.none)*MODEL.combo)*(1-MODEL.supplySpend)*1.15;earn(run+MODEL.dailyPerHour*secs/3600,secs);}
  return {hours:seconds/3600,firstPurchaseMinutes:first,tiers,log};}
function catalogueTotal(){const sum=o=>Object.values(o).reduce((n,x)=>n+(x.price||0)+(x.prices?x.prices.reduce((a,b)=>a+b,0):0),0),kit=Object.keys(World.weapons).reduce((n,k)=>{const s={...Save.defaults(),kit:{}};let t=0;for(let l=0;l<3;l++){s.kit[k]=l;t+=Meta.price(s,'kit',k);}return n+t;},0);
  return {weapons:sum(World.weapons),gear:sum(World.gear),upgrades:sum(World.upgrades),kit};}
if(require.main===module){const c=catalogueTotal();
  console.log('CATALOGUE  weapons '+c.weapons+'  gadgets '+c.gear+'  upgrades '+c.upgrades+'  =  '+(c.weapons+c.gear+c.upgrades)+' CR   (weapon kit parts on top: '+c.kit+' CR)');
  console.log('RANKS      '+World.tiers.map((r,i)=>'tier '+(i+1)+' at rank '+r+' ('+Meta.need(r)+' XP)').join(', '));
  for(const d of World.order){const rows=payouts(d,15),mult=World.difficulties[d].reward;console.log('\nHOLDOUT / '+d.toUpperCase()+'  (debrief then multiplies by '+mult+')');console.table(rows.filter(r=>[3,5,8,10,15].includes(r.wave)).map(r=>({wave:r.wave,kills:r.kills,'no combo':r.none,'full combo':r.full})));}
  const e=estimate();console.log('\nESTIMATE (see MODEL): first purchase after '+e.firstPurchaseMinutes.toFixed(0)+' min, whole armory after '+e.hours.toFixed(1)+' hours');
  console.log('tiers open at: '+Object.entries(e.tiers).map(([t,h])=>'tier '+t+' '+h.toFixed(1)+'h').join(', '));console.log(e.log.join('\n'));}
module.exports={payouts,estimate,catalogueTotal,MODEL};

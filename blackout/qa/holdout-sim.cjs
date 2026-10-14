'use strict';
// Holdout balance check. An AI-driven operator (the brain an AI teammate uses, at full damage, with its stims and the
// basics bought from each supply drop) plays holdout. It does not slide, roll or vault, so it stands in for a careful
// but unspectacular player: use it to compare one tuning against another, not to predict where a person gets to.
//   node blackout/qa/holdout-sim.cjs [difficulty|all] [runs] [--partner] [--pressure] [--weapon=<primary>|--weapons]
// --weapons: one line per primary weapon, the same seeds each, to compare how far each gets.
// Default: runs to the death, and which wave each died on and what killed it.
// --pressure: the operator cannot die, and does not move: it stands at the start and shoots whatever it can see. For
// each wave, the damage it soaked and how long the wave took - how hard each wave pushes, wave by wave, measured the
// same way whatever the AI on either side is - and any wave that stalled (cleared by hand after four minutes).
const Core=require('../core.js'),World=require('../world.js'),A=World.archetypes;
function play(difficulty,seed,{partner=false,pressure=false,cap=40,weapon='rifle'}={}){
  const turret=s=>{const p=s.player;let foe=null,bd=1e9;for(const e of s.enemies){if(e.dead||e.gone>0)continue;const d=Core.distance(p,e);if(d<bd&&d<900&&Core.sees(s,p,e)){bd=d;foe=e;}}
    const k=p.slots[p.slot];return foe?{aimX:foe.x,aimY:foe.y,fire:p.ammo[k]>0,reload:p.ammo[k]===0}:{reload:p.ammo[k]<10};};
  const s=Core.create({mission:'holdout',difficulty,seed,mates:partner?[{bot:true}]:undefined,loadout:{primary:weapon,secondary:'pistol',lethal:'frag',tactical:'flash'},owned:Object.keys(World.weapons)});
  const out={wave:0,blame:null,revives:0,partnerKills:0,bought:[],waves:[],stalls:[]};let limit=Math.round(60*60*2/Core.DT),waveAt=0,dmgAt=0,last=0;
  while(!s.dead&&limit-->0&&s.stats.wave<cap){const p=s.player,input=p.dead?{}:Core.botInput(s,p,9,Core.DT);
    if(pressure){p.health=100;p.armor=0;for(const k of p.slots)p.reserve[k]=999;}else if(!p.dead&&p.health<50&&p.stims>0&&!(p.heal>0))input.gadget=true;
    // Shopping between waves: whichever basic the operator is short of, if the run can pay for it.
    if(s.director.phase==='rest'&&!p.dead&&!pressure){for(const q of s.pickups)if(!q.taken&&q.type==='offer'&&q.cost<=s.stats.credits&&(q.item==='health'&&p.health<70||q.item==='armor'&&p.armor<40||q.item==='ammo'||q.item==='stim'&&p.stims<2)){const x=p.x,y=p.y;p.x=q.x;p.y=q.y;Core.interact(s,{});p.x=x;p.y=y;if(q.taken)out.bought.push(q.item);}}
    Core.step(s,input);for(const e of s.events){if(e.type==='death')out.blame=e.blame;if(e.type==='revive')out.revives++;if(e.type==='kill'&&e.bot)out.partnerKills++;if(e.type==='wave'){waveAt=s.time;dmgAt=s.stats.damage;}}s.events.length=0;
    if(s.director.phase==='fight'&&s.time-waveAt>240){out.stalls.push({wave:s.director.wave,left:s.enemies.filter(e=>!e.dead).map(e=>e.type)});if(process.env.SIM_DEBUG)console.log('stall',s.director.wave,JSON.stringify(s.enemies.filter(e=>!e.dead).map(e=>({t:e.type,x:Math.round(e.x),y:Math.round(e.y),hp:Math.round(e.hp),act:e.active,seen:+e.seen.toFixed(1),rush:!!e.rush,z:e.zone,gone:e.gone,vis:Core.sees(s,s.player,e)}))),'P',Math.round(s.player.x),Math.round(s.player.y),'queue',s.director.queue.length,'warn',s.spawnWarnings.length);for(const e of s.enemies)if(!e.dead)Core.damageEnemy(s,e,1e6,0,.1,'rifle',true,true);s.director.queue=[];waveAt=s.time;}
    if(s.stats.wave!==last){last=s.stats.wave;out.waves.push({wave:last,damage:Math.round(s.stats.damage-dmgAt),seconds:Math.round(s.time-waveAt)});}}
  out.wave=s.stats.wave;return out;}
if(require.main===module&&process.argv.includes('--weapons')){const d=process.argv[2]||'standard',runs=+process.argv[3]||6;
  for(const [k,w] of Object.entries(World.weapons)){if(w.slot!==0)continue;const waves=[];for(let i=0;i<runs;i++)waves.push(play(d,1701+i*97,{weapon:k}).wave);waves.sort((a,b)=>a-b);console.log(k.padEnd(12),'median wave',waves[Math.floor(waves.length/2)],'| mean',(waves.reduce((a,b)=>a+b,0)/waves.length).toFixed(1),'|',waves.join(','));}}
else if(require.main===module){const arg=process.argv[2]||'standard',runs=+process.argv[3]||6,partner=process.argv.includes('--partner'),pressure=process.argv.includes('--pressure'),weapon=(process.argv.find(a=>a.startsWith('--weapon='))||'=rifle').split('=')[1],list=arg==='all'?World.order:[arg];
  for(const d of list){const rows=[];for(let i=0;i<runs;i++)rows.push(play(d,1701+i*97,{partner,pressure,weapon,cap:pressure?25:40}));
    if(pressure){const by=w=>rows.map(r=>r.waves[w-1]).filter(Boolean),avg=(l,k)=>Math.round(l.reduce((n,x)=>n+x[k],0)/Math.max(1,l.length));
      console.log(`${d.toUpperCase()}: damage soaked / seconds per wave`);console.log('  '+[1,3,5,7,9,10,12,15,18,20,22,25].map(w=>`w${w} ${avg(by(w),'damage')}/${avg(by(w),'seconds')}s`).join('  '));
      const stalls=rows.flatMap(r=>r.stalls);if(stalls.length)console.log('  STALLED: '+stalls.map(q=>'wave '+q.wave+' ('+q.left.join(',')+')').join('; '));continue;}
    const waves=rows.map(r=>r.wave).sort((a,b)=>a-b),blame={};for(const r of rows)if(r.blame)blame[A[r.blame]?.name||r.blame]=(blame[A[r.blame]?.name||r.blame]||0)+1;
    console.log(`${d.toUpperCase()}${partner?' + AI PARTNER':''}: cleared waves ${waves.join(', ')} (median ${waves[Math.floor(waves.length/2)]})`+(partner?` · revives ${rows.reduce((n,r)=>n+r.revives,0)} · partner kills ${rows.reduce((n,r)=>n+r.partnerKills,0)}`:''));
    console.log('  killed by: '+(Object.entries(blame).sort((a,b)=>b[1]-a[1]).map(([k,n])=>k+' ×'+n).join(', ')||'—'));
    const stalls=rows.flatMap(r=>r.stalls);if(stalls.length)console.log('  STALLED: '+stalls.map(q=>'wave '+q.wave+' ('+q.left.join(',')+')').join('; '));}}
module.exports={play};

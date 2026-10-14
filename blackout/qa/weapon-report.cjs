'use strict';
// Weapon balance report: every gun's numbers (Meta.weaponStats) and what it does against the situations the game
// throws at it. Damage figures run the real damage rules (core.js damageEnemy) on a stand-in target, then scale by the
// gun's sustained rate of fire, so armour, shield fronts, counter-shots, barriers and the rest count as they do in play.
//   node blackout/qa/weapon-report.cjs           the matrix
//   node blackout/qa/weapon-report.cjs --json    the same as JSON (used by the tests)
const Core=require('../core.js'),World=require('../world.js'),Meta=require('../meta.js'),W=World.weapons;
// One round of this gun into a stand-in hostile: how much of its per-shot damage lands.
function landed(k,type,extra={}){const s=Core.create({mission:'holdout',seed:1});s.director.timer=1e9;const t=World.archetypes[type];
  const e={id:'t',type,x:600,y:600,radius:t.radius||17,hp:1e6,maxHp:1e6,angle:Math.PI,hull:0,dead:false,zone:0,active:true,seen:4,cooldown:99,stagger:0,reload:0,vx:0,vy:0,spawned:true,...extra};s.enemies=[e];
  const w=W[k],blast=!!w.explosive;Core.damageEnemy(s,e,w.damage,0,.1,k,!!w.breach||blast,blast);return (1e6-e.hp)/w.damage;}
// Seconds from the first round to a 70-health rifleman being down, every round hitting (counting bursts and pellets).
function ttk(k){const w=W[k],per=w.damage*w.pellets;let hp=70,t=0,shot=0;while(hp>0&&shot<200){hp-=per;if(hp<=0)break;shot++;t+=w.burst&&shot%w.burst?w.gap:w.rate;}return t;}
// How many hostiles one shot can be expected to hurt in a packed group.
const groupFactor=w=>Math.min(3,w.explosive?3:w.chain?1+.6*w.chain:w.flame?2.5:w.pierce?1+Math.min(w.pierce,2)*.8:w.pellets>1?1.3:1);
function matrix(){return Object.keys(W).map(k=>{const w=W[k],st=Meta.weaponStats(k),sus=st.sustained;
  return {key:k,name:w.short,slot:w.slot?'secondary':'primary',cls:w.cls,role:w.role||'',tier:w.tier,price:w.price||(w.challenge?'challenge':0),
    perShot:st.per,rps:+st.rps.toFixed(2),burstDps:Math.round(st.dps),sustained:Math.round(sus),
    vsArmour:Math.round(sus*landed(k,'heavy')),vsShieldFront:Math.round(sus*landed(k,'shield')),vsTelegraph:Math.round(sus*landed(k,'infantry',{attack:1,attackAge:0})),
    vsVehicle:Math.round(sus*landed(k,'tank',{hull:Math.PI})),vsGroup:Math.round(sus*groupFactor(w)),ttk:+ttk(k).toFixed(3),accuracyMoving:+(1/(w.spread*(w.steady?1:1.5)+.004)).toFixed(1),vsBarrier:Math.round(sus*landed(k,'mech',{shieldMax:1e9,shieldHp:1e9})),range:w.range,mobility:w.mobility+(w.steady?.1:0),
    reload:w.reload,mag:w.capacity,traits:Meta.weaponTraits(k).join(', ')};});}
// The scenarios a gun can be better than the free MK18 in (or its own sidearm slot's free pistol).
const SCENARIOS=['sustained','vsArmour','vsVehicle','vsShieldFront','vsTelegraph','vsGroup','vsBarrier','range','mobility','accuracyMoving','ttk'];
const LOWER_IS_BETTER=['ttk'];
function reasons(rows){const base={0:rows.find(r=>r.key==='rifle'),1:rows.find(r=>r.key==='pistol')};
  return rows.map(r=>({key:r.key,price:r.price,beats:SCENARIOS.filter(sc=>{const b=base[r.slot==='primary'?0:1][sc];return LOWER_IS_BETTER.includes(sc)?r[sc]<b*.95:r[sc]>b*1.05;})}));}
if(require.main===module){const rows=matrix();if(process.argv.includes('--json')){console.log(JSON.stringify({rows,reasons:reasons(rows)}));return;}
  console.table(rows.map(({key,traits,slot,cls,role,...r})=>({gun:r.name,role,price:r.price,dps:r.burstDps,sus:r.sustained,armour:r.vsArmour,tank:r.vsVehicle,shield:r.vsShieldFront,ttk:r.ttk,telegraph:r.vsTelegraph,group:r.vsGroup,barrier:r.vsBarrier,range:r.range,mob:r.mobility.toFixed(2)})));
  for(const r of reasons(rows))if(r.key!=='rifle'&&r.key!=='pistol')console.log(r.key.padEnd(14),'better than the free '+(W[r.key].slot?'P226':'MK18')+' at:',r.beats.join(', ')||'NOTHING');}
module.exports={matrix,reasons,SCENARIOS};

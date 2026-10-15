'use strict';
// Checks for the Locker: the avatars an operator can wear (World.avatars), what they cost and what they ask for, how
// they are saved, and that every one of them can be drawn - in full, as a bust, and with any gun in hand.
const assert=require('node:assert/strict'),World=require('../world.js'),Save=require('../save.js'),Meta=require('../meta.js');
require('../icons.js');const Icons=globalThis.BPIcons;
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const AV=World.avatars,keys=Object.keys(AV);
const rich=(xp=Meta.need(99))=>Object.assign(Save.defaults(),{credits:1e6,xp});

test('every avatar has a name, a grade from standard issue to mythic, and a look drawn for it',()=>{
  for(const k of keys){const a=AV[k];assert(a.name&&a.desc,k);assert(Number.isInteger(a.tier)&&a.tier>=1&&a.tier<=6,k);assert(Icons.LOOKS[k],'a look for '+k);}
  for(const t of [1,2,3,4,5,6])assert(keys.some(k=>AV[k].tier===t),'something in grade '+t);
  assert.equal(Meta.RARITY[5],'MYTHIC');assert.equal(Meta.rarity(rich(),'avatar','sentinel'),6);});
test('the mythic ones are awarded, never sold; everything else has a price that climbs with its grade',()=>{
  for(const k of keys){const a=AV[k];if(a.tier===6){assert(a.challenge&&Meta.CHALLENGES[a.challenge],k);assert.equal(Meta.price(rich(),'avatar',k),null,k);}else if(k!=='regular')assert(a.price>0,k);}
  const top=t=>Math.max(...keys.filter(k=>AV[k].tier===t).map(k=>AV[k].price)),low=t=>Math.min(...keys.filter(k=>AV[k].tier===t).map(k=>AV[k].price));
  for(const t of [1,2,3,4])assert(top(t)<low(t+1),'grade '+(t+1)+' costs more than grade '+t);});
test('a new save wears the regular look and owns only it',()=>{const s=Save.defaults();assert.equal(s.avatar,'regular');assert.deepEqual(s.owned.avatars,['regular']);});
test('buying is paid in credits, gated by rank like the armory, and refused when it cannot be afforded',()=>{
  const s=Object.assign(Save.defaults(),{credits:500,xp:0});
  assert.equal(Meta.buy(s,'avatar','commando').reason,'REACH RANK '+World.tiers[1]+' TO UNLOCK');
  assert.equal(Meta.buy(s,'avatar','arctic').reason,'NEED 100 MORE CREDITS');
  assert.deepEqual(Meta.buy(s,'avatar','desert'),{ok:true,cost:400});assert.equal(s.credits,100);assert(s.owned.avatars.includes('desert'));
  assert.equal(Meta.buy(s,'avatar','desert').reason,'OWNED');assert.equal(Meta.buy(s,'avatar','sentinel').reason,'UNAVAILABLE');
  for(const k of keys)if(AV[k].tier<6)assert.equal(Meta.locked(s,'avatar',k),AV[k].tier===1?0:World.tiers[AV[k].tier-1],k);});
test('a mythic avatar is awarded at the end of the run that meets its challenge',()=>{
  const s=rich();s.tdm={standard:{played:30,wins:24}};assert(!Meta.claim(s).some(u=>u.key==='sentinel'));
  s.tdm.standard.wins=25;const got=Meta.claim(s);assert(got.some(u=>u.kind==='avatar'&&u.key==='sentinel'));assert(s.owned.avatars.includes('sentinel'));
  s.killhouse={'holdout-crash':{insane:25}};assert(Meta.claim(s).some(u=>u.key==='override'),'a wave reached in any killhouse counts');});
test('the save keeps what is owned and worn, and lets nothing in that is unknown or not owned',()=>{
  const d=Save.decode(JSON.stringify({version:3,owned:{avatars:['desert','spectre','bogus','__proto__']},avatar:'spectre'}));
  assert.deepEqual(d.owned.avatars,['regular','desert','spectre']);assert.equal(d.avatar,'spectre');
  assert.equal(Save.decode(JSON.stringify({version:3,owned:{avatars:['desert']},avatar:'spectre'})).avatar,'regular','cannot wear what is not owned');
  assert.equal(Save.decode(JSON.stringify({version:3,avatar:'bogus'})).avatar,'regular');
  assert.equal(Save.decode(JSON.stringify({version:2,owned:{avatars:['spectre']},avatar:'spectre'})).avatar,'regular','a pre-rebalance save starts again');
  const s=rich();Meta.buy(s,'avatar','ronin');s.avatar='ronin';assert.deepEqual(Save.decode(JSON.stringify(s)).owned.avatars,s.owned.avatars);assert.equal(Save.decode(JSON.stringify(s)).avatar,'ronin');});
test('every avatar draws in full with any gun, and as a bust; the regular look is the operator as he always was',()=>{
  for(const k of keys){for(const w of ['rifle','pistol','shotgun','lmg','rocket']){const svg=Icons.soldier(w,0,k);assert(/^<svg class="soldier[^"]*" viewBox="0 0 240 316"/.test(svg),k+' '+w);assert(!/NaN|undefined/.test(svg),k+' '+w);}
   const b=Icons.bust(k);assert(/^<svg class="face bust/.test(b)&&!/NaN|undefined/.test(b),k);}
  assert.equal(Icons.soldier('rifle',0,'regular'),Icons.soldier('rifle',0),'no avatar is the regular look');
  assert.equal(Icons.soldier('rifle',1,'regular'),Icons.soldier('rifle',1),'and keeps a squadmate kit colour');
  assert.equal(Icons.soldier('rifle',0,'nope'),Icons.soldier('rifle',0),'an unknown look falls back to the regular one');});
test('a save cannot slip in names that are not the game\'s own: __proto__, constructor and the like',()=>{
  const bad=['__proto__','constructor','toString','hasOwnProperty'],d=Save.decode(JSON.stringify({version:3,owned:{weapons:[...bad,'shotgun'],gear:bad,support:[...bad,'recon'],perks:bad,avatars:bad},found:bad,avatar:'__proto__',
    loadout:{primary:'__proto__',secondary:'constructor',lethal:'__proto__',tactical:'toString',support:'__proto__',perks:bad}}));
  assert.deepEqual(d.owned,{weapons:['rifle','pistol','shotgun'],gear:[],support:['recon'],perks:[],avatars:['regular']});assert.deepEqual(d.found,[]);assert.equal(d.avatar,'regular');
  assert.deepEqual(d.loadout,{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,support:null,perks:[null,null,null]});
  const s=Save.defaults();s.owned.support.push('__proto__');s.loadout.support='__proto__';assert.equal(Meta.loadout(s).support,null,'and a loadout built from a save never carries one');});
test('every avatar is drawn in the field as on the menus: its headgear and its build both have a top-down drawing',()=>{
  for(const k of keys){const L=Icons.LOOKS[k];assert(Icons.FIELD_HEADS.includes(L.head||'helmet'),k+' head '+L.head);assert(Icons.FIELD_BODIES.includes(L.body||''),k+' body '+L.body);}
  assert.equal(Object.values(Icons.FIELD_FRAMES).reduce((a,b)=>a+b,0),365,'every frame the field animates');});
test('every frame the field animates is posed from the reference (hands, gun or blade angle, boots)',()=>{
  const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../icons.js'),'utf8'),P=JSON.parse(src.match(/const FIELD_POSES=(\{.*?\});/)[1]);
  for(const [g,n] of Object.entries(Icons.FIELD_FRAMES))for(let i=0;i<n;i++){const p=P[g+'/'+i];assert(p,'no pose for '+g+'/'+i);const ok=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite);
   if(g.startsWith('feet'))assert(p.b.length===2&&p.b.every(ok),g+'/'+i);else{assert(p.h.length===2&&p.h.every(ok),g+'/'+i);assert(Number.isFinite(g.startsWith('knife')?p.k:p.a),g+'/'+i);}}});
console.log(`\n${passed} locker checks passed.`);

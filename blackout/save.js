(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPSave=api;})(globalThis,function(World){
  'use strict';
  const KEY='blackout-protocol-progress',VERSION=2;
  const bindings={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',roll:'Space',slide:'ControlLeft',interact:'KeyE',reload:'KeyR',swap:'KeyX',gadget:'KeyQ',melee:'KeyF',grenade:'KeyG',tactical:'KeyC',slot1:'Digit1',slot2:'Digit2'};
  // Y toggles weapons. X interacts/vaults and, when there is nothing to interact with, reloads; D-pad left is a dedicated reload.
  const padBindings={fire:'rt',aim:'lt',sprint:'lb',roll:'a',slide:'b',interact:'x',swap:'y',reload:'left',gadget:'down',melee:'rs',grenade:'rb',tactical:'up'},padButtons=['a','b','x','y','lb','rb','lt','rt','back','ls','rs','up','down','left','right'];
  const W=World.weapons,G=World.gear,U=World.upgrades,MISSIONS=World.missions.map(m=>m.id),DIFFS=World.order;
  function defaults(){return {version:VERSION,credits:0,xp:0,owned:{weapons:['rifle','pistol'],gear:[]},upgrades:{},loadout:{primary:'rifle',secondary:'pistol',lethal:null,tactical:null},missions:{},run:null,holdout:{},mastery:{},contracts:{day:-1,list:[]},daily:{day:-1,streak:0},stats:{kills:0,missions:0,deaths:0},seen:[],
    settings:{difficulty:'standard',volume:.65,music:true,shake:.45,flash:false,quality:'high',muted:false,gamepad:true,aimAssist:true,bindings:{...bindings},padBindings:{...padBindings}}};}
  const num=(v,lo,hi,d=0)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d,ids=(a,max=200)=>Array.isArray(a)?a.filter(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,24}$/.test(x)).slice(0,max):[];
  function checkpoint(c){if(!c||!Number.isInteger(c.stage)||c.stage<0||c.stage>9)return null;const out={stage:c.stage,time:num(c.time,0,86400),kills:num(c.kills,0,1e5),damage:num(c.damage,0,1e6),flows:num(c.flows,0,1e5),credits:num(c.credits,0,1e7),intel:num(c.intel,0,9),killed:ids(c.killed),dead:ids(c.dead,40)};
    if(Number.isFinite(c.x)&&Number.isFinite(c.y)){out.x=num(c.x,0,1e4);out.y=num(c.y,0,1e4);}if(Array.isArray(c.slots)&&c.slots.length===2&&W[c.slots[0]]?.slot===0&&W[c.slots[1]]?.slot===1)out.slots=[c.slots[0],c.slots[1]];
    for(const k of ['lethal','tactical'])if(c[k]===null||G[c[k]]?.slot===k)out[k]=c[k];return out;}
  function settings(d,s){for(const k of ['music','flash','muted','gamepad','aimAssist'])if(typeof s[k]==='boolean')d.settings[k]=s[k];
    for(const k of ['volume','shake'])if(Number.isFinite(s[k]))d.settings[k]=Math.max(0,Math.min(1,s[k]));
    if(DIFFS.includes(s.difficulty))d.settings.difficulty=s.difficulty;if(['high','low'].includes(s.quality))d.settings.quality=s.quality;
    const candidate={...bindings,...s.bindings};const seen=new Set();let valid=true;
    for(const k of Object.keys(bindings)){const code=candidate[k];if(typeof code!=='string'||!/^([A-Z][A-Za-z]+[A-Za-z0-9]*|Space|Digit[0-9])$/.test(code)||code==='Escape'||seen.has(code))valid=false;seen.add(code);}
    if(valid)d.settings.bindings=Object.fromEntries(Object.keys(bindings).map(k=>[k,candidate[k]]));
    const padCandidate={...padBindings,...s.padBindings},padSeen=new Set();let padValid=true;
    for(const k of Object.keys(padBindings)){const name=padCandidate[k];if(!padButtons.includes(name)||padSeen.has(name))padValid=false;padSeen.add(name);}
    if(padValid)d.settings.padBindings=Object.fromEntries(Object.keys(padBindings).map(k=>[k,padCandidate[k]]));}
  // Version 1 held one mission. Its checkpoint, completion, best result and unlocks become THE CRASH in the campaign; pad layouts reset because Y now swaps weapons.
  function migrate(a,d){if(a.checkpoint&&Number.isInteger(a.checkpoint.stage)&&a.checkpoint.stage>=0&&a.checkpoint.stage<=3)d.run={mode:'campaign',mission:'crash',difficulty:DIFFS.includes(a.settings?.difficulty)?a.settings.difficulty:'standard',floor:'story',deaths:0,checkpoint:checkpoint({...a.checkpoint,killed:[],dead:[]})};
    if(a.completed===true||a.best){d.missions.crash={done:true,best:a.best&&Number.isFinite(a.best.time)?{time:a.best.time,score:num(a.best.score,0,1e6),rating:['S','A','B','C'].includes(a.best.rating)?a.best.rating:'C',difficulty:'standard'}:null,medals:['complete'],diffs:['standard'],intel:false};}
    const unl=Array.isArray(a.unlocks)?a.unlocks:[];if(unl.includes('shotgun')||a.checkpoint?.stage>=2||a.completed)d.owned.weapons.push('shotgun');if(unl.includes('frag')||a.checkpoint?.stage>=2||a.completed)d.owned.gear.push('frag');
    for(const k of ['rifle','shotgun','pistol'])if(Number(a.mastery?.[k])>0)d.mastery[k]=num(a.mastery[k],0,1e7);
    const s={...(a.settings||{})};delete s.padBindings;if(s.bindings){s.bindings={...s.bindings};delete s.bindings.slot3;}settings(d,s);return d;}
  function decode(raw){const d=defaults();try{const a=JSON.parse(raw);if(!a||typeof a!=='object')return d;if(a.version===1)return migrate(a,d);if(a.version!==VERSION)return d;
    d.credits=Math.floor(num(a.credits,0,1e8));d.xp=Math.floor(num(a.xp,0,1e9));
    d.owned.weapons=Array.from(new Set(['rifle','pistol',...ids(a.owned?.weapons).filter(k=>W[k])]));d.owned.gear=Array.from(new Set(ids(a.owned?.gear).filter(k=>G[k])));
    for(const k of Object.keys(U))if(a.upgrades?.[k])d.upgrades[k]=Math.floor(num(a.upgrades[k],0,3));
    const lo=a.loadout||{};d.loadout={primary:W[lo.primary]?.slot===0&&d.owned.weapons.includes(lo.primary)?lo.primary:'rifle',secondary:W[lo.secondary]?.slot===1&&d.owned.weapons.includes(lo.secondary)?lo.secondary:'pistol',lethal:G[lo.lethal]?.slot==='lethal'&&d.owned.gear.includes(lo.lethal)?lo.lethal:null,tactical:G[lo.tactical]?.slot==='tactical'&&d.owned.gear.includes(lo.tactical)?lo.tactical:null};
    for(const id of MISSIONS){const m=a.missions?.[id];if(!m)continue;const b=m.best;d.missions[id]={done:m.done===true,best:b&&Number.isFinite(b.score)?{score:num(b.score,0,1e6),rating:['S','A','B','C'].includes(b.rating)?b.rating:'C',time:num(b.time,0,86400),difficulty:DIFFS.includes(b.difficulty)?b.difficulty:'standard'}:null,medals:ids(m.medals,5),diffs:ids(m.diffs,4).filter(x=>DIFFS.includes(x)),intel:m.intel===true};}
    const r=a.run;if(r&&(r.mode==='campaign'&&MISSIONS.includes(r.mission))&&DIFFS.includes(r.difficulty)){const cp=checkpoint(r.checkpoint);if(cp)d.run={mode:'campaign',mission:r.mission,difficulty:r.difficulty,floor:DIFFS.includes(r.floor)?r.floor:r.difficulty,deaths:Math.floor(num(r.deaths,0,999)),checkpoint:cp};}
    for(const k of DIFFS)if(a.holdout?.[k])d.holdout[k]=Math.floor(num(a.holdout[k],0,999));
    for(const k of Object.keys(W))if(a.mastery?.[k])d.mastery[k]=Math.floor(num(a.mastery[k],0,1e7));for(const k of ['melee','grenade','mine','incendiary'])if(a.mastery?.[k])d.mastery[k]=Math.floor(num(a.mastery[k],0,1e7));
    if(a.contracts&&Number.isInteger(a.contracts.day)&&Array.isArray(a.contracts.list))d.contracts={day:a.contracts.day,list:a.contracts.list.filter(c=>c&&typeof c.id==='string').slice(0,3).map(c=>({id:c.id,progress:Math.floor(num(c.progress,0,1e6)),done:c.done===true}))};
    if(a.daily&&Number.isInteger(a.daily.day))d.daily={day:a.daily.day,streak:Math.floor(num(a.daily.streak,0,9999))};
    for(const k of ['kills','missions','deaths'])d.stats[k]=Math.floor(num(a.stats?.[k],0,1e9));d.seen=ids(a.seen,80);
    settings(d,a.settings||{});
  }catch{}return d;}
  function load(storage){try{return decode(storage.getItem(KEY));}catch{return defaults();}}
  function write(storage,value){try{storage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
  return {KEY,VERSION,bindings,padBindings,padButtons,defaults,decode,load,write};
});

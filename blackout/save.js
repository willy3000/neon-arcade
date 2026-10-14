(function(root,factory){const api=factory(typeof module==='object'?require('./world.js'):root.BPWorld);if(typeof module==='object')module.exports=api;else root.BPSave=api;})(globalThis,function(World){
  'use strict';
  const KEY='blackout-protocol-progress',VERSION=3;
  const bindings={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',roll:'Space',slide:'ControlLeft',interact:'KeyE',reload:'KeyR',swap:'KeyX',gadget:'KeyQ',melee:'KeyF',grenade:'KeyG',tactical:'KeyC',support:'KeyV',slot1:'Digit1',slot2:'Digit2',order:'KeyT'};
  // Y toggles weapons. X interacts/vaults and, when there is nothing to interact with, reloads; D-pad up is a dedicated reload.
  // D-pad left injects a stim, D-pad right switches the selected gadget (lethal <-> tactical) and RB deploys whichever is selected.
  // D-pad down is deliberately unbound: rocker pads report it by accident while right is pressed. PAD_LAYOUT bumps reset saved pad bindings.
  // Left stick click gives the AI partner its next order in holdout.
  const padBindings={fire:'rt',aim:'lt',sprint:'lb',roll:'a',slide:'b',interact:'x',swap:'y',reload:'up',gadget:'left',melee:'rs',grenade:'rb',cycle:'right',support:'back',order:'ls'},padButtons=['a','b','x','y','lb','rb','lt','rt','back','ls','rs','up','down','left','right'];
  const PAD_LAYOUT=3,W=World.weapons,G=World.gear,U=World.upgrades,MISSIONS=World.missions.map(m=>m.id),DIFFS=World.order;
  function defaults(){return {version:VERSION,credits:0,xp:0,owned:{weapons:['rifle','pistol'],gear:[],support:[],perks:[]},upgrades:{},loadout:{primary:'rifle',secondary:'pistol',lethal:null,tactical:null,support:null,perks:[null,null,null]},missions:{},run:null,holdout:{},mastery:{},contracts:{day:-1,list:[]},daily:{day:-1,streak:0},stats:{kills:0,missions:0,deaths:0,flows:0},seen:[],found:[],kit:{},killhouse:{},tdm:{},challenges:{attempts:{},best:{},board:[]},intel:{},intelInit:0,presets:[0,1,2].map(()=>({primary:'rifle',secondary:'pistol',lethal:null,tactical:null,support:null,perks:[null,null,null]})),preset:0,drill:false,notice:'',
    settings:{difficulty:'standard',volume:.65,music:true,voice:true,shake:.45,flash:false,quality:'high',textScale:1,palette:'standard',sprintMode:'hold',aimMode:'hold',muted:false,gamepad:true,aimAssist:true,callsign:'',lastHost:'',lobbyMode:'holdout',lobbyMap:'holdout',fill:false,tdmLimit:30,tdmSupport:true,bindings:{...bindings},padBindings:{...padBindings},padLayout:PAD_LAYOUT}};}
  // LAN lobby identity: the callsign other players see, and the last host address joined (pre-filled next time).
  // lobbyMode, lobbyMap and fill are how the lobby was last left: its mode, its map and whether holdout's open slot has an AI teammate in it.
  const callsign=t=>String(t??'').toUpperCase().replace(/[^A-Z0-9 _-]/g,'').trim().slice(0,12);
  const num=(v,lo,hi,d=0)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d,ids=(a,max=200)=>Array.isArray(a)?a.filter(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,24}$/.test(x)).slice(0,max):[];
  function checkpoint(c){if(!c||!Number.isInteger(c.stage)||c.stage<0||c.stage>9)return null;const out={stage:c.stage,time:num(c.time,0,86400),kills:num(c.kills,0,1e5),damage:num(c.damage,0,1e6),flows:num(c.flows,0,1e5),credits:num(c.credits,0,1e7),intel:num(c.intel,0,9),killed:ids(c.killed),dead:ids(c.dead,40)};
    if(Number.isFinite(c.x)&&Number.isFinite(c.y)){out.x=num(c.x,0,1e4);out.y=num(c.y,0,1e4);}if(Array.isArray(c.slots)&&c.slots.length===2&&W[c.slots[0]]?.slot===0&&W[c.slots[1]]?.slot===1)out.slots=[c.slots[0],c.slots[1]];
    for(const k of ['lethal','tactical'])if(c[k]===null||G[c[k]]?.slot===k)out[k]=c[k];return out;}
  function settings(d,s){for(const k of ['music','voice','flash','muted','gamepad','aimAssist'])if(typeof s[k]==='boolean')d.settings[k]=s[k];
    for(const k of ['volume','shake'])if(Number.isFinite(s[k]))d.settings[k]=Math.max(0,Math.min(1,s[k]));
    if(DIFFS.includes(s.difficulty))d.settings.difficulty=s.difficulty;if(['high','low'].includes(s.quality))d.settings.quality=s.quality;
    // Accessibility: text size, the colour palette, and hold or toggle for sprint and steady aim.
    if([1,1.15,1.3].includes(s.textScale))d.settings.textScale=s.textScale;if(['standard','redgreen','blueyellow','contrast'].includes(s.palette))d.settings.palette=s.palette;for(const k of ['sprintMode','aimMode'])if(['hold','toggle'].includes(s[k]))d.settings[k]=s[k];
    if(['holdout','tdm'].includes(s.lobbyMode))d.settings.lobbyMode=s.lobbyMode;if(World.holdoutMaps.some(h=>h.id===s.lobbyMap))d.settings.lobbyMap=s.lobbyMap;if(typeof s.fill==='boolean')d.settings.fill=s.fill;if([5,10,15,20,30,50,75].includes(s.tdmLimit))d.settings.tdmLimit=s.tdmLimit;if(typeof s.tdmSupport==='boolean')d.settings.tdmSupport=s.tdmSupport;
    if(typeof s.callsign==='string')d.settings.callsign=callsign(s.callsign);if(typeof s.lastHost==='string'&&/^[A-Za-z0-9.:-]{0,64}$/.test(s.lastHost))d.settings.lastHost=s.lastHost;
    const candidate={...bindings,...s.bindings};const seen=new Set();let valid=true;
    for(const k of Object.keys(bindings)){const code=candidate[k];if(typeof code!=='string'||!/^([A-Z][A-Za-z]+[A-Za-z0-9]*|Space|Digit[0-9])$/.test(code)||code==='Escape'||seen.has(code))valid=false;seen.add(code);}
    if(valid)d.settings.bindings=Object.fromEntries(Object.keys(bindings).map(k=>[k,candidate[k]]));
    const padCandidate={...padBindings,...(s.padLayout===PAD_LAYOUT?s.padBindings:{})},padSeen=new Set();let padValid=true;
    for(const k of Object.keys(padBindings)){const name=padCandidate[k];if(!padButtons.includes(name)||padSeen.has(name))padValid=false;padSeen.add(name);}
    if(padValid)d.settings.padBindings=Object.fromEntries(Object.keys(padBindings).map(k=>[k,padCandidate[k]]));}
  // Version 1 held one mission. Its checkpoint, completion, best result and unlocks become THE CRASH in the campaign; pad layouts reset because Y now swaps weapons.
  function migrate(a,d){if(a.checkpoint&&Number.isInteger(a.checkpoint.stage)&&a.checkpoint.stage>=0&&a.checkpoint.stage<=3)d.run={mode:'campaign',mission:'crash',difficulty:DIFFS.includes(a.settings?.difficulty)?a.settings.difficulty:'standard',floor:'story',deaths:0,checkpoint:checkpoint({...a.checkpoint,killed:[],dead:[]})};
    if(a.completed===true||a.best){d.missions.crash={done:true,best:a.best&&Number.isFinite(a.best.time)?{time:a.best.time,score:num(a.best.score,0,1e6),rating:['S','A','B','C'].includes(a.best.rating)?a.best.rating:'C',difficulty:'standard'}:null,medals:['complete'],diffs:['standard'],intel:false};}
    const unl=Array.isArray(a.unlocks)?a.unlocks:[];if(unl.includes('shotgun')||a.checkpoint?.stage>=2||a.completed)d.owned.weapons.push('shotgun');if(unl.includes('frag')||a.checkpoint?.stage>=2||a.completed)d.owned.gear.push('frag');
    for(const k of ['rifle','shotgun','pistol'])if(Number(a.mastery?.[k])>0)d.mastery[k]=num(a.mastery[k],0,1e7);
    const s={...(a.settings||{})};delete s.padBindings;if(s.bindings){s.bindings={...s.bindings};delete s.bindings.slot3;}settings(d,s);d.drill=!!(a.completed||a.checkpoint);return d;}
  // A loadout can only name things the save owns, each in its own kind of slot.
  const kitOf=(lo,d)=>({primary:W[lo?.primary]?.slot===0&&d.owned.weapons.includes(lo.primary)?lo.primary:'rifle',secondary:W[lo?.secondary]?.slot===1&&d.owned.weapons.includes(lo.secondary)?lo.secondary:'pistol',lethal:G[lo?.lethal]?.slot==='lethal'&&d.owned.gear.includes(lo.lethal)?lo.lethal:null,tactical:G[lo?.tactical]?.slot==='tactical'&&d.owned.gear.includes(lo.tactical)?lo.tactical:null,
    support:World.support[lo?.support]&&d.owned.support.includes(lo.support)?lo.support:null,perks:[0,1,2].map(i=>{const k=Array.isArray(lo?.perks)?lo.perks[i]:null;return World.perks[k]?.slot===i&&d.owned.perks.includes(k)?k:null;})});
  function decode(raw){const d=defaults();try{const a=JSON.parse(raw);if(!a||typeof a!=='object')return d;if(a.version===1)return migrate(a,d);if(a.version!==VERSION&&a.version!==2)return d;
    // Version 2 predates the economy rebalance (new prices, rank-gated tiers, field drops no longer kept). Its credits,
    // rank, purchases and loadout start again; campaign progress, records, mastery, stats and settings carry over.
    const old=a.version===2;if(!old){
    d.credits=Math.floor(num(a.credits,0,1e8));d.xp=Math.floor(num(a.xp,0,1e9));d.seen=ids(a.seen,80);
    d.owned.weapons=Array.from(new Set(['rifle','pistol',...ids(a.owned?.weapons).filter(k=>W[k])]));d.owned.gear=Array.from(new Set(ids(a.owned?.gear).filter(k=>G[k])));d.owned.support=Array.from(new Set(ids(a.owned?.support).filter(k=>World.support[k])));d.owned.perks=Array.from(new Set(ids(a.owned?.perks).filter(k=>World.perks[k])));
    for(const k of Object.keys(U))if(a.upgrades?.[k])d.upgrades[k]=Math.floor(num(a.upgrades[k],0,3));
    d.found=ids(a.found).filter(k=>W[k]);for(const k of Object.keys(W))if(a.kit?.[k])d.kit[k]=Math.floor(num(a.kit[k],0,3));
    d.loadout=kitOf(a.loadout,d);d.preset=Math.floor(num(a.preset,0,2));d.presets=[0,1,2].map(i=>kitOf(a.presets?.[i]||d.loadout,d));d.drill=a.drill===true;d.notice=a.notice==='rebalance'?'rebalance':'';}
    for(const id of MISSIONS){const m=a.missions?.[id];if(!m)continue;const b=m.best;d.missions[id]={done:m.done===true,best:b&&Number.isFinite(b.score)?{score:num(b.score,0,1e6),rating:['S','A','B','C'].includes(b.rating)?b.rating:'C',time:num(b.time,0,86400),difficulty:DIFFS.includes(b.difficulty)?b.difficulty:'standard'}:null,medals:ids(m.medals,5),diffs:ids(m.diffs,4).filter(x=>DIFFS.includes(x)),intel:m.intel===true,opChallenge:m.opChallenge===true};}
    const r=a.run;if(r&&(r.mode==='campaign'&&MISSIONS.includes(r.mission))&&DIFFS.includes(r.difficulty)){const cp=checkpoint(r.checkpoint);if(cp)d.run={mode:'campaign',mission:r.mission,difficulty:r.difficulty,floor:DIFFS.includes(r.floor)?r.floor:r.difficulty,deaths:Math.floor(num(r.deaths,0,999)),checkpoint:cp};}
    for(const k of DIFFS)if(a.holdout?.[k])d.holdout[k]=Math.floor(num(a.holdout[k],0,999));
    for(const k of Object.keys(W))if(a.mastery?.[k])d.mastery[k]=Math.floor(num(a.mastery[k],0,1e7));for(const k of ['melee','grenade','mine','incendiary','c4','cluster','seeker'])if(a.mastery?.[k])d.mastery[k]=Math.floor(num(a.mastery[k],0,1e7));
    if(a.contracts&&Number.isInteger(a.contracts.day)&&Array.isArray(a.contracts.list))d.contracts={day:a.contracts.day,list:a.contracts.list.filter(c=>c&&typeof c.id==='string').slice(0,3).map(c=>({id:c.id,progress:Math.floor(num(c.progress,0,1e6)),done:c.done===true}))};
    if(a.daily&&Number.isInteger(a.daily.day))d.daily={day:a.daily.day,streak:Math.floor(num(a.daily.streak,0,9999))};
    for(const k of ['kills','missions','deaths','flows'])d.stats[k]=Math.floor(num(a.stats?.[k],0,1e9));
    for(const h of World.holdoutMaps){const r=a.killhouse?.[h.id];if(r&&typeof r==='object')for(const k of DIFFS)if(r[k])(d.killhouse[h.id]||(d.killhouse[h.id]={}))[k]=Math.floor(num(r[k],0,999));}
    // Intel files: known hostiles only, a sighting flag, a whole kill count, and whether the completion was paid (a paid
    // file must have the kills behind it, so it cannot be claimed twice by editing).
    if(a.intel&&typeof a.intel==='object')for(const k of Object.keys(World.intel||{})){const i=a.intel[k];if(!i||typeof i!=='object')continue;const kills=Math.floor(num(i.kills,0,1e6));d.intel[k]={seen:i.seen||kills>0?1:0,kills,paid:i.paid&&kills>0?1:0};}
    d.intelInit=a.intelInit?1:0;
    // Seeded challenge records: rebuilt field by field, the score worked out again from what it is made of (so a hand-
    // edited score does not stand), duplicates dropped, and the board cut to the best ten of each kind.
    {const c=a.challenges,KEY=/^(daily|weekly):\d{1,7}$/,entry=e=>{if(!e||typeof e!=='object'||!['daily','weekly'].includes(e.kind))return null;const wave=Math.floor(num(e.wave,0,999)),kills=Math.floor(num(e.kills,0,1e5)),combo=Math.floor(num(e.combo,0,999));
       return {id:String(e.id??'').slice(0,40),kind:e.kind,period:Math.floor(num(e.period,0,1e7)),seed:Math.floor(num(e.seed,0,1e9)),map:World.holdoutMaps.some(h=>h.id===e.map)?e.map:'holdout',score:wave*1000+kills*10+combo*25,wave,kills,combo,time:Math.floor(num(e.time,0,1e6)),rules:Math.floor(num(e.rules,0,99)),at:num(e.at,0,1e13)};};
     if(c&&typeof c==='object'){const seen=new Set(),board=(Array.isArray(c.board)?c.board:[]).map(entry).filter(e=>e&&e.id&&!seen.has(e.id)&&seen.add(e.id));
      d.challenges.board=['daily','weekly'].flatMap(kind=>board.filter(e=>e.kind===kind).sort((x,y)=>y.score-x.score).slice(0,10));
      for(const [k,v] of Object.entries(c.best&&typeof c.best==='object'?c.best:{}).slice(-60)){const e=entry(v);if(KEY.test(k)&&e)d.challenges.best[k]=e;}
      for(const [k,v] of Object.entries(c.attempts&&typeof c.attempts==='object'?c.attempts:{}).slice(-60))if(KEY.test(k))d.challenges.attempts[k]=Math.floor(num(v,0,999));}}
    for(const k of DIFFS){const r=a.tdm?.[k];if(r&&typeof r==='object')d.tdm[k]={played:Math.floor(num(r.played,0,1e6)),wins:Math.floor(num(r.wins,0,1e6))};}
    // The opening operation's supply cache is a story reward, so a reset save that has finished it keeps what it gave.
    if(old){if(d.missions.crash?.done){d.owned.weapons.push('shotgun');d.owned.gear.push('frag');}d.drill=true;d.notice='rebalance';}
    d.presets[d.preset]={...d.loadout};
    settings(d,a.settings||{});
  }catch{}return d;}
  function load(storage){try{return decode(storage.getItem(KEY));}catch{return defaults();}}
  function write(storage,value){try{storage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
  return {KEY,VERSION,bindings,padBindings,padButtons,defaults,decode,load,write,callsign};
});

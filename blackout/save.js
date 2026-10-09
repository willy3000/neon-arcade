(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BPSave=api;})(globalThis,function(){
  'use strict';
  const KEY='blackout-protocol-progress';
  const bindings={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',roll:'Space',slide:'ControlLeft',interact:'KeyE',reload:'KeyR',gadget:'KeyQ',melee:'KeyF',grenade:'KeyG',slot1:'Digit1',slot2:'Digit2',slot3:'Digit3'};
  const padBindings={fire:'rt',aim:'lt',sprint:'lb',roll:'a',slide:'b',interact:'x',reload:'y',gadget:'down',melee:'rs',grenade:'rb',slot1:'left',slot2:'up',slot3:'right'},padButtons=['a','b','x','y','lb','rb','lt','rt','back','ls','rs','up','down','left','right'];
  function defaults(){return {version:1,checkpoint:null,completed:false,best:null,unlocks:['rifle','pistol','stim'],mastery:{},settings:{difficulty:'standard',volume:.65,music:true,shake:.45,flash:false,quality:'high',muted:false,gamepad:true,aimAssist:true,bindings:{...bindings},padBindings:{...padBindings}}};}
  function decode(raw){const d=defaults();try{const a=JSON.parse(raw);if(!a||a.version!==1)return d;
    if(a.checkpoint&&Number.isInteger(a.checkpoint.stage)&&a.checkpoint.stage>=0&&a.checkpoint.stage<=3){d.checkpoint={stage:a.checkpoint.stage,time:Math.max(0,Math.min(86400,Number(a.checkpoint.time)||0)),kills:Math.max(0,Number(a.checkpoint.kills)||0),damage:Math.max(0,Number(a.checkpoint.damage)||0),flows:Math.max(0,Number(a.checkpoint.flows)||0)};}
    d.completed=a.completed===true;if(a.best&&Number.isFinite(a.best.time)&&a.best.time>=0)d.best={time:a.best.time,score:Math.max(0,Number(a.best.score)||0),rating:['S','A','B','C'].includes(a.best.rating)?a.best.rating:'C'};
    d.unlocks=Array.from(new Set([...d.unlocks,...(Array.isArray(a.unlocks)?a.unlocks.filter(x=>['shotgun','frag'].includes(x)):[])]));
    if(d.checkpoint?.stage>=2)d.unlocks=Array.from(new Set([...d.unlocks,'shotgun','frag']));
    for(const key of ['rifle','shotgun','pistol'])d.mastery[key]=Math.max(0,Math.min(1e7,Number(a.mastery?.[key])||0));
    const s=a.settings||{};for(const k of ['music','flash','muted','gamepad','aimAssist'])if(typeof s[k]==='boolean')d.settings[k]=s[k];
    for(const k of ['volume','shake'])if(Number.isFinite(s[k]))d.settings[k]=Math.max(0,Math.min(1,s[k]));
    if(['story','standard','intense'].includes(s.difficulty))d.settings.difficulty=s.difficulty;
    if(['high','low'].includes(s.quality))d.settings.quality=s.quality;
    const candidate={...bindings,...s.bindings};const seen=new Set();let valid=true;
    for(const k of Object.keys(bindings)){const code=candidate[k];if(typeof code!=='string'||!/^([A-Z][A-Za-z]+[A-Za-z0-9]*|Space|Digit[0-9])$/.test(code)||code==='Escape'||seen.has(code))valid=false;seen.add(code);}
    if(valid)d.settings.bindings=candidate;
    const padCandidate={...padBindings,...s.padBindings},padSeen=new Set();let padValid=true;
    for(const k of Object.keys(padBindings)){const name=padCandidate[k];if(!padButtons.includes(name)||padSeen.has(name))padValid=false;padSeen.add(name);}
    if(padValid)d.settings.padBindings=Object.fromEntries(Object.keys(padBindings).map(k=>[k,padCandidate[k]]));
  }catch{}return d;}
  function load(storage){try{return decode(storage.getItem(KEY));}catch{return defaults();}}
  function write(storage,value){try{storage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
  return {KEY,bindings,padBindings,padButtons,defaults,decode,load,write};
});

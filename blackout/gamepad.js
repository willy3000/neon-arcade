(function(root){'use strict';
 // Game-agnostic controller reader. Button names follow the W3C "standard" mapping (Xbox layout; PlayStation and Switch Pro pads report the same indices).
 const buttons=['a','b','x','y','lb','rb','lt','rt','back','start','ls','rs','up','down','left','right'];
 const XBOX={a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',back:'VIEW',start:'MENU',ls:'L3',rs:'R3',up:'D↑',down:'D↓',left:'D←',right:'D→'};
 const PS={a:'✕',b:'○',x:'□',y:'△',lb:'L1',rb:'R1',lt:'L2',rt:'R2',back:'SHARE',start:'OPTIONS',ls:'L3',rs:'R3',up:'D↑',down:'D↓',left:'D←',right:'D→'};
 const GENERIC={a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',back:'BACK',start:'START',ls:'L3',rs:'R3',up:'D↑',down:'D↓',left:'D←',right:'D→'};
 const DEADZONE=.22,TRIGGER=.35;
 // Browsers report the pad's raw HID product string in gamepad.id. There is no vendor-neutral "this is a PS5 pad" flag,
 // so this sniffs the common Windows/Chrome strings: Sony pads report their USB vendor id 054c or the generic firmware
 // name "Wireless Controller" (DualShock 4 and DualSense both use it); Microsoft pads say "Xbox" or vendor id 045e.
 function detectBrand(id){const s=(id||'').toLowerCase();
  if(/xbox|045e|xinput/.test(s))return 'xbox';
  if(/dualsense|dualshock|playstation|054c|wireless controller/.test(s))return 'ps';
  return 'generic';}
 function stick(x=0,y=0){const len=Math.hypot(x,y);if(len<DEADZONE)return {x:0,y:0,len:0};const scaled=Math.min(1,(len-DEADZONE)/(1-DEADZONE));return {x:x/len*scaled,y:y/len*scaled,len:scaled};}
 class Pad {
  constructor(){this.index=null;this.was=new Set();}
  static get supported(){return typeof navigator!=='undefined'&&typeof navigator.getGamepads==='function';}
  find(){if(!Pad.supported)return null;let pads;try{pads=Array.from(navigator.getGamepads()).filter(p=>p&&p.connected);}catch{return null;}
   const usable=p=>p.axes.length>=4&&p.buttons.length>=10,pad=pads.find(p=>p.index===this.index&&usable(p))||pads.find(p=>p.mapping==='standard'&&usable(p))||pads.find(usable)||null;this.index=pad?pad.index:null;return pad;}
  get name(){const pad=this.find();return pad?pad.id.replace(/\s*\(.*$/,'').trim()||'CONTROLLER':null;}
  get brand(){const pad=this.find();return pad?detectBrand(pad.id):null;}
  poll(){const pad=this.find();if(!pad){this.was.clear();return null;}
   const down=new Set(),tap=new Set();buttons.forEach((name,i)=>{const b=pad.buttons[i];if(b&&(b.pressed||b.value>TRIGGER))down.add(name);});
   for(const name of down)if(!this.was.has(name))tap.add(name);this.was=down;
   const move=stick(pad.axes[0],pad.axes[1]),aim=stick(pad.axes[2],pad.axes[3]);return {move,aim,down,tap,active:down.size>0||move.len>0||aim.len>0};}
 }
 Pad.labels=GENERIC;
 Pad.glyphs={xbox:XBOX,ps:PS,generic:GENERIC};
 Pad.brandName={xbox:'XBOX CONTROLLER',ps:'PLAYSTATION CONTROLLER',generic:'CONTROLLER'};
 Pad.detectBrand=detectBrand;
 root.BPGamepad=Pad;
})(globalThis);

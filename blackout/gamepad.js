(function(root){'use strict';
 // Game-agnostic controller reader. Button names follow the W3C "standard" mapping (Xbox layout; PlayStation and Switch Pro pads report the same indices).
 const buttons=['a','b','x','y','lb','rb','lt','rt','back','start','ls','rs','up','down','left','right'];
 const labels={a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',back:'BACK',start:'START',ls:'L3',rs:'R3',up:'D↑',down:'D↓',left:'D←',right:'D→'};
 const DEADZONE=.22,TRIGGER=.35;
 function stick(x=0,y=0){const len=Math.hypot(x,y);if(len<DEADZONE)return {x:0,y:0,len:0};const scaled=Math.min(1,(len-DEADZONE)/(1-DEADZONE));return {x:x/len*scaled,y:y/len*scaled,len:scaled};}
 class Pad {
  constructor(){this.index=null;this.was=new Set();}
  static get supported(){return typeof navigator!=='undefined'&&typeof navigator.getGamepads==='function';}
  find(){if(!Pad.supported)return null;let pads;try{pads=Array.from(navigator.getGamepads()).filter(p=>p&&p.connected);}catch{return null;}
   const usable=p=>p.axes.length>=4&&p.buttons.length>=10,pad=pads.find(p=>p.index===this.index&&usable(p))||pads.find(p=>p.mapping==='standard'&&usable(p))||pads.find(usable)||null;this.index=pad?pad.index:null;return pad;}
  get name(){const pad=this.find();return pad?pad.id.replace(/\s*\(.*$/,'').trim()||'CONTROLLER':null;}
  poll(){const pad=this.find();if(!pad){this.was.clear();return null;}
   const down=new Set(),tap=new Set();buttons.forEach((name,i)=>{const b=pad.buttons[i];if(b&&(b.pressed||b.value>TRIGGER))down.add(name);});
   for(const name of down)if(!this.was.has(name))tap.add(name);this.was=down;
   const move=stick(pad.axes[0],pad.axes[1]),aim=stick(pad.axes[2],pad.axes[3]);return {move,aim,down,tap,active:down.size>0||move.len>0||aim.len>0};}
 }
 Pad.labels=labels;root.BPGamepad=Pad;
})(globalThis);

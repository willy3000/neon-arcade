'use strict';
// node blackout/tools/make-mode-art.cjs  - writes blackout/assets/menu/mode-<mode id>.svg, the key art of each combat
// mode on the lobby's mode card and in the mode picker.
//
// The modes used to be shown by screenshots of each one in play (legacy/tools/mode-shots.cjs), which all look alike
// from above. These are drawn instead, in the hand of the lobby's operator and faces: the game's own soldier, heads,
// weapons and gadgets from blackout/icons.js, set in a scene that says what the mode is about at a glance.
// Every picture is 600 x 180 and shown cropped to fill its card, so what matters sits in the middle band, clear of the
// card's name (bottom left) and CHANGE (top right). Run this again after changing it, then refresh the entries of
// these files in blackout/assets/integrity.json (the script prints them).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'blackout/assets/menu');
require(path.join(root,'blackout/icons.js'));const I=globalThis.BPIcons;
const O='#0a0d09',AMBER='#dfad70',ALPHA='#8fc7e8',DELTA='#e39a82',W=600,H=180;
const helicopter=fs.readFileSync(path.join(root,'blackout/assets/helicopter.svg'),'utf8');

// Drawing helpers, in the same spirit as icons.js.
const r=(x,y,w,h,f,rx=0,a='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${a}/>`;
const c=(x,y,rad,f,a='')=>`<circle cx="${x}" cy="${y}" r="${rad}" fill="${f}"${a}/>`;
const p=(d,f,a='')=>`<path d="${d}" fill="${f}"${a}/>`;
const st=(d,s,w,a='')=>`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${a}/>`;
const g=(t,body,a='')=>`<g transform="${t}"${a}>${body}</g>`;
// An icon from icons.js placed into the scene as a nested picture.
const place=(svg,x,y,w,h,a='')=>svg.replace(/^<svg class="[^"]*"/,`<svg x="${x}" y="${y}" width="${w}" height="${h}"${a}`).replace(/ aria-hidden="true" focusable="false"/,'');
const weapon=(k,x,y,wd,a)=>{const s=I.size(k);return place(I.svg('weapon',k),x,y,wd,wd*s.h/s.w,a);};
const gear=(k,x,y,sz,a)=>place(I.svg('gear',k),x,y,sz,sz,a);
const soldier=(weapon,kit,x,y,h,a)=>place(I.soldier(weapon,kit),x,y,h*240/316,h,a);
const face=(kind,team,x,y,sz,a)=>place(I.face(kind,team),x,y,sz,sz*58/60,a);
const pressure=(level,x,y,h,a)=>{const s=I.pressure(level),w=+s.match(/viewBox="0 0 (\d+) 58"/)[1];return place(s,x,y,h*w/58,h,a);};
const grid=`<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#d3d8ba" stroke-opacity=".06"/></pattern>`;
// Every scene: its own sky, the faint grid of the lobby's cards over it, and a vignette that darkens the edges and the
// bottom left, where the card writes the mode's name.
function scene(id,sky,body,defs=''){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
 +`<defs>${grid}<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky.map((s,i)=>`<stop offset="${i/(sky.length-1)}" stop-color="${s}"/>`).join('')}</linearGradient>`
 +`<radialGradient id="vig" cx=".58" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`
 +`<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>${defs}</defs>`
 +r(0,0,W,H,'url(#sky)')+r(0,0,W,H,'url(#grid)')+body+r(0,0,W,H,'url(#vig)')+`</svg>\n`;}
const glow=(x,y,rad,col,op=.7)=>c(x,y,rad,col,` filter="url(#glow)" opacity="${op}"`);
const sandbag=(x,y)=>r(x,y,46,20,'#8a7b55',9,` stroke="${O}" stroke-width="2.5"`)+st(`M${x+10} ${y+6}Q${x+23} ${y+10} ${x+36} ${y+6}`,'#6f633f',2);
const flash=(x,y,k=1)=>g(`translate(${x} ${y}) scale(${k})`,glow(0,0,16,'#ffd27a',.9)+p('M0-14L4-4 16-6 6 1 14 10 2 5-4 15-4 4-16 2-6-4Z','#ffe7a8',` stroke="${O}" stroke-width="1.5"`));

const ART={
 // Holdout: the operator dug in behind sandbags at dusk, wave after wave of hostiles coming in from both sides.
 holdout:scene('holdout',['#5a4127','#2c2a1d','#171b14'],
  p('M0 128 Q150 112 300 122 T600 118 V180 H0Z','#1d2318')
  +[[18,96,.32],[78,92,.45],[430,90,.45],[500,94,.32],[548,100,.25]].map(([x,y,o])=>pressure('intense',x,y,30,` opacity="${o}"`)).join('')
  +[[120,102],[455,104]].map(([x,y])=>pressure('standard',x,y,36,' opacity=".75"')).join('')
  +soldier('lmg',0,250,18,150)+[0,1,2,3].map(i=>sandbag(214+i*44,140)).join('')+[0,1,2].map(i=>sandbag(236+i*44,124)).join('')
  +flash(352,98,1)+st('M368 96 L452 88','#ffe7a8',2,' opacity=".7"')+st('M368 101 L440 108','#ffe7a8',1.5,' opacity=".5"')),
 // Team deathmatch: Alpha against Delta, the field split down the middle, rifles crossed between them.
 tdm:scene('tdm',['#1b2420','#141a17'],
  p('M0 0H318L262 180H0Z','#2a4757',' opacity=".55"')+p('M338 0H600V180H282Z','#5a2f27',' opacity=".55"')+st('M330 -4 L272 184',AMBER,3,' opacity=".8"')
  +glow(300,92,40,AMBER,.35)
  +g('translate(300 92) rotate(-28)',weapon('rifle',-80,-26,160))+g('translate(300 92) rotate(28) scale(-1 1)',weapon('rifle',-80,-26,160))
  +face('player',0,96,26,128)+face('player',1,378,26,128)
  +[0,1,2].map(i=>face('ai',0,20+i*30,128,34,' opacity=".5"')).join('')+[0,1,2].map(i=>face('ai',1,520-i*30,128,34,' opacity=".5"')).join('')),
 // Arms race: a staircase of guns, a new one for every kill, and the knife waiting at the top.
 arms:scene('arms',['#1e2620','#121612'],
  ['smg','rifle','shotgun','battle','lmg','marksman','magnum','pistol'].map((k,i)=>{const x=40+i*58,y=140-i*13;return r(x-6,y+22,58,180-y,'#222a21',0,` stroke="${O}" stroke-width="2"`)+st(`M${x-6} ${y+22}h58`,AMBER,2,` opacity="${.35+i*.08}"`)+weapon(k,x-2,y-4,52+(i%2)*4,` opacity="${.6+i*.05}"`);}).join('')
  +glow(530,52,46,AMBER,.6)+r(498,72,66,110,'#2a3328',0,` stroke="${O}" stroke-width="2"`)+st('M498 72h66',AMBER,3)
  +g('translate(530 36) rotate(-12)',gear('knife',-46,-46,92))),
 // Uplink: three relays across the map - one held by Alpha, one by Delta, the middle one being taken.
 uplink:scene('uplink',['#16272a','#101a19'],
  p('M0 140 Q120 124 220 136 T420 132 T600 138 V180 H0Z','#16201c')
  +[[130,ALPHA,.5],[300,AMBER,1],[470,DELTA,.5]].map(([x,col,o])=>{const top=x===300?28:48;
   return [1,2,3].map(k=>st(`M${x-18*k} ${top+4-10*k} Q${x} ${top-18*k} ${x+18*k} ${top+4-10*k}`,col,3,` opacity="${o*(1-k*.22)}"`)).join('')
   +glow(x,top+6,x===300?22:12,col,x===300?.8:.5)
   +st(`M${x-22} 140 L${x} ${top+12} L${x+22} 140`,'#5f6a52',4)+st(`M${x-15} 112 L${x+15} 112 M${x-9} 84 L${x+9} 84 M${x-15} 112 L${x+9} 84 M${x+15} 112 L${x-9} 84`,'#5f6a52',2.5)
   +p(`M${x-16} ${top+10} Q${x} ${top-8} ${x+16} ${top+10}Z`,'#7a8566',` stroke="${O}" stroke-width="2"`)+c(x,top+6,4.5,col,` stroke="${O}" stroke-width="1.5"`)
   +r(x-30,138,60,8,'#2a3328',2,` stroke="${O}" stroke-width="2"`)+st(`M${x-30} 138h60`,col,2.5,` opacity="${o}"`);}).join('')
  +face('player',0,252,108,40,' opacity=".9"')+face('player',1,316,110,36,' opacity=".75"')),
 // Hunted: the squad's flashlights sweeping the dark, and the cloaked hunter they cannot quite see.
 hunted:scene('hunted',['#0d1218','#07090c'],
  c(560,28,16,'#cfd8dc',' opacity=".18"')
  +[[70,100,-8],[118,112,4],[166,98,-2]].map(([x,y,a])=>g(`rotate(${a} ${x+20} ${y+20})`,p(`M${x+36} ${y+18} L${x+250} ${y-34} L${x+250} ${y+84}Z`,'#f5e3a3',' opacity=".09"'))).join('')
  +[[70,100],[118,112],[166,98]].map(([x,y])=>face('player',0,x,y,44)).join('')
  +glow(440,80,60,'#ff3b2f',.18)
  +p('M380 180 Q384 92 420 52 Q440 30 462 52 Q498 92 502 180Z','#06080a',` stroke="#1d2730" stroke-width="2.5"`)+p('M404 76 Q441 40 478 76 Q470 98 441 100 Q412 98 404 76Z','#0e1216')
  +[[426,78],[456,78]].map(([x,y])=>glow(x,y,8,'#ff3b2f',.9)+c(x,y,3.6,'#ff3b2f')+c(x,y,1.3,'#ffd9d2')).join('')
  +st('M392 120 Q441 112 490 120','#1d2730',2,' opacity=".6"')),
 // Breach: an operator stacked up beside the door, the charge planted on it, its light blinking red.
 breach:scene('breach',['#2b2d28','#181a16'],
  r(0,0,W,140,'#3a3c34',0,' opacity=".55"')+[0,1,2,3,4,5,6].map(i=>st(`M0 ${16+i*20}H600`,'#2a2c26',2)).join('')+[...Array(14)].map((_,i)=>st(`M${(i%2?20:0)+i*44} ${16+(i%7)*20}v20`,'#2a2c26',2)).join('')
  +r(318,22,124,140,'#1c201b',2,` stroke="${O}" stroke-width="3"`)+r(330,34,100,128,'#4b5340',3,` stroke="${O}" stroke-width="2.5"`)+r(342,48,76,40,'#3d4535',2)+c(414,104,5,'#8a927f',` stroke="${O}" stroke-width="1.5"`)
  +[0,1,2,3,4,5].map(i=>p(`M${318+i*22} 162 l12 0 l-8 12 l-12 0Z`,AMBER,' opacity=".85"')).join('')
  +glow(380,112,26,'#ff3b2f',.55)+g('translate(380 112) rotate(-6)',gear('c4',-26,-26,52))+c(398,98,3.5,'#ff3b2f',` stroke="${O}" stroke-width="1"`)
  +soldier('shotgun',0,196,36,140)+[[452,64,40],[466,92,28],[448,126,34]].map(([x,y,l])=>st(`M${x} ${y}l${l} ${-l/4}`,'#ffd27a',2,' opacity=".6"')).join('')),
 // Extraction: the helicopter coming in over the landing zone, green smoke rising, the loot crate ready to go.
 extract:scene('extract',['#22301f','#141c13'],
  p('M0 136 Q300 120 600 134 V180 H0Z','#18221a')+c(300,150,38,'none',` stroke="${AMBER}" stroke-width="3" stroke-dasharray="10 8" opacity=".6"`)
  +[[300,120,22,.35],[290,92,28,.25],[312,62,34,.16],[296,30,40,.1]].map(([x,y,rad,o])=>c(x,y,rad,'#7fdc8a',` opacity="${o}"`)).join('')
  +glow(300,140,10,'#7fdc8a',.9)+c(300,141,4,'#bff5c4')
  +glow(178,132,30,AMBER,.4)+r(146,112,64,40,'#6b5a35',3,` stroke="${O}" stroke-width="2.5"`)+st('M146 124h64M146 140h64',O,2)+r(172,108,12,48,'#4a3d24',1,` stroke="${O}" stroke-width="2"`)+c(178,132,5,AMBER,` stroke="${O}" stroke-width="1.5"`)
  +soldier('rifle',0,64,52,112)+g('translate(452 70) rotate(-100) scale(.34) translate(-180 -235)',helicopter.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/id="g"/,'id="heli"').replace(/url\(#g\)/g,'url(#heli)'))
  +c(452,70,74,'none',' stroke="#c3cdb0" stroke-width="2" stroke-dasharray="3 9" opacity=".35"')),
 // Flow trials: a course of gates against the clock, run at full tilt.
 trials:scene('trials',['#1b2a29','#111a19'],
  p('M0 150 L600 118 V180 H0Z','#16211f')+st('M20 158 Q300 120 590 112','#8fe3f5',2.5,' stroke-dasharray="2 10" opacity=".55"')
  +[[150,1],[270,.82],[380,.66],[476,.52],[556,.4]].map(([x,k])=>{const h=86*k,w=46*k,y=150-(x/600)*32;return st(`M${x-w/2} ${y} V${y-h} H${x+w/2} V${y}`,AMBER,6*k+1,` opacity="${.45+k*.5}"`)+c(x,y-h,3*k+1,'#ffe7a8');}).join('')
  +g('translate(214 82)',c(0,0,13,'#c9b98f',` stroke="${O}" stroke-width="2"`)+c(0,0,8,'#9c5647')+c(0,0,3,'#ffe7a8'))
  +[0,1,2].map(i=>st(`M${60-i*14} ${86+i*14}h${-40+i*6}`,'#8fe3f5',3,` opacity="${.5-i*.12}"`)).join('')
  +soldier('smg',0,64,46,118,' transform="rotate(8 109 105)"')
  +g('translate(428 44) scale(.85)',c(0,0,26,'#e7e8de',` stroke="${O}" stroke-width="3"`)+r(-5,-34,10,8,'#e7e8de',2,` stroke="${O}" stroke-width="2.5"`)+st('M0 0 L0 -17',O,3)+st('M0 0 L12 6',AMBER,3)+c(0,0,2.5,O)))};

const lines=[];
for(const [id,svg] of Object.entries(ART)){const file=path.join(out,'mode-'+id+'.svg'),data=Buffer.from(svg);fs.writeFileSync(file,data);
 lines.push({file:'menu/mode-'+id+'.svg',bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}
console.log(JSON.stringify(lines,null,2));

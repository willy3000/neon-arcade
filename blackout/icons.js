(function(root){'use strict';
 // Project-original side-profile artwork for every weapon, gadget, pickup and upgrade. The same SVG is inlined in the
 // armory/HUD and rasterized into Phaser textures for items lying on the ground or in flight.
 const O='#0a0d09',G1='#4a5347',G2='#717b65',G3='#9aa58a',HL='#c3cdb0',WD='#8a6136',WD2='#64441f',TN='#a48c60',OD='#5d6a41',CY='#8fe3ff',BR='#c9a24f',RD='#c0503c',NS=' stroke="none"';
 const r=(x,y,w,h,f,rx=0,x2='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${x2}/>`;
 const p=(d,f,x2='')=>`<path d="${d}" fill="${f}"${x2}/>`,pg=(pts,f,x2='')=>`<polygon points="${pts}" fill="${f}"${x2}/>`,c=(x,y,R,f,x2='')=>`<circle cx="${x}" cy="${y}" r="${R}" fill="${f}"${x2}/>`;
 const ln=(x1,y1,x2,y2,s,w=1.5,o=1)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
 const st=(d,s,w=2,o=1)=>`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
 const guard=(x,y,w=10)=>st(`M${x} ${y} Q${x+2} ${y+8} ${x+w} ${y+3}`,G1,2.2);
 const vents=(x,y,n,step,w=6,h=3,f=G2)=>Array.from({length:n},(_,i)=>r(x+i*step,y,w,h,f,1,NS)).join('');
 const W={
  rifle:[160,56,pg('4,16 28,14 30,30 24,32 6,31',G1)+r(28,18,20,6,G2)+r(46,13,48,10,G2)+r(48,10,44,3,G1)+ln(49,11.5,91,11.5,HL,1,.5)+p('M46 23 H86 V30 H76 L72 34 H50 L46 30Z',G1)+pg('54,30 64,30 60,47 51,46',G1)+guard(64,31)+p('M76 31 H88 L91 46 Q85 49 78 47Z',G1)+r(94,13,36,11,G1,1)+vents(100,16,3,10)+r(130,16.5,20,4,G2)+r(148,15,9,7,G1)+pg('122,13 124,6 127,6 128,13',G1)+r(50,6,7,4,G1)+r(62,16,12,4,G1,0,NS)+ln(47,13.6,93,13.6,HL,1,.55)],
  shotgun:[172,50,p('M4 15 L42 17 L44 29 L8 38 Q2 28 4 15Z',WD)+r(2,14,5,25,G1,1)+r(42,14,34,15,G2,1)+r(52,18,12,5,G1,0,NS)+r(46,29,20,4,G1)+guard(50,30)+r(76,15,90,5,G2)+c(164,14.5,1.6,HL,NS)+r(76,21,70,5,G1)+r(144,20.5,5,6,G2)+r(92,19,34,11,WD,2)+Array.from({length:6},(_,i)=>ln(96+i*5,21.5,96+i*5,27.5,WD2,1.2)).join('')+ln(77,15.7,165,15.7,HL,1,.5)],
  pistol:[86,56,p('M6 10 H80 V22 H6Z',G2)+Array.from({length:5},(_,i)=>ln(10+i*3,12,10+i*3,20,G1,1)).join('')+r(38,12,12,5,G1,0,NS)+r(75,7,3,3,G1)+r(8,7,5,3,G1)+p('M10 22 H76 V27 H44 L40 33 H26 L22 27 H10Z',G1)+p('M12 25 H32 L30 52 H12 Q7 50 8 44Z',G1)+p('M14 30 H28 L27 48 H14Z',G2,NS)+guard(32,27)+r(80,13,3,6,G1)+ln(7,10.6,79,10.6,HL,1,.55)],
  smg:[112,56,r(2,12,6,16,G1,1)+r(8,16,16,4,G2)+pg('24,12 80,10 86,14 88,24 24,26',G1)+r(30,7,46,3,G2)+pg('42,26 54,26 53,40 52,52 41,52 42,40',G1)+r(40,51,14,3,G2)+pg('68,25 78,25 76,44 70,44',G1)+r(88,16,16,4,G2)+r(102,15,6,6,G1)+guard(54,27)+r(46,15,14,4,G2,0,NS)+ln(25,12.6,79,10.8,HL,1,.5)],
  marksman:[192,58,p('M4 16 L50 20 L52 33 L10 42 Q2 30 4 16Z M14 23 L40 25 L41 31 L16 35Z',WD,' fill-rule="evenodd"')+r(14,14,26,5,G1,2)+r(50,18,40,11,G2)+pg('50,30 60,29 57,45 48,44',WD)+p('M74 29 H85 L89 43 H77Z',G1)+r(90,18,40,10,WD,2)+vents(96,21,3,12,6,3,WD2)+r(130,21,54,3.5,G2)+r(182,19.5,9,6.5,G1)+pg('172,15 175,15 175,21 172,21',G1)+r(56,7,38,7,G1,3)+pg('94,6 104,4 104,16 94,15',G1)+r(50,8,6,5,G1)+r(68,14,10,4,G2)+r(72,3,6,4,G2)+r(102,6,2,8,CY,0,NS+' opacity=".55"')+ln(57,8,93,8,HL,1,.4)],
  battle:[172,56,pg('4,16 42,19 44,28 8,38 4,34',WD)+r(2,15,4,22,G1)+r(42,17,46,12,G2)+r(44,14,42,4,G1,2)+ln(50,22,70,22,G1,2)+pg('54,29 63,29 59,45 51,44',WD2)+p('M74 29 H87 Q90 39 98 46 L88 51 Q78 42 74 29Z',G1)+r(88,15,32,4,G2)+r(88,14.5,24,5,WD,2)+r(88,20,28,9,WD,2)+r(116,21.5,42,3,G2)+pg('148,15 152,15 153,21 147,21',G1)+r(156,19.5,10,6,G1)+r(88,11,6,4,G1)+ln(43,17.6,87,17.6,HL,1,.45)],
  precision:[204,60,p('M4 16 L42 18 L44 32 L36 36 L10 36 L4 30Z',TN)+r(14,12,22,5,TN,2)+r(2,15,4,22,G1)+r(42,18,52,11,TN)+p('M42 29 H88 V33 H44Z',TN)+pg('52,30 62,30 58,46 49,45',G1)+r(72,29,13,15,G1)+r(94,17,54,12,G1,1)+vents(100,21,4,12,7)+r(148,21,46,4,G2)+r(192,19.5,9,7,G1)+r(54,5,58,8,G1,4)+pg('112,4 124,2 124,16 112,14',G1)+pg('48,6 54,5 54,13 48,12',G1)+r(76,1,8,5,G2)+r(62,13,6,5,G2)+r(96,13,6,5,G2)+r(122,4,2,10,CY,0,NS+' opacity=".5"')+st('M140 29 L130 52 M142 29 L152 52',G1,3)+ln(55,6,111,6,HL,1,.4)],
  lmg:[192,62,pg('4,18 34,18 36,34 26,36 6,36',G1)+r(34,16,62,15,G1)+r(48,10,44,6,G2,1)+pg('48,31 58,31 55,47 46,46',G1)+r(58,31,26,20,OD,3)+ln(62,37,80,37,'#46512f',2)+r(86,27,3,5,BR,1,NS)+r(90,27,3,5,BR,1,NS)+r(94,27,3,5,BR,1,NS)+r(96,15,36,4,G1)+r(96,19,82,5,G2)+r(176,17,10,9,G1)+st('M104 15 V8 H126 V15',G1,3)+r(100,24,44,3,G1)+st('M158 24 L148 52 M160 24 L170 52',G1,3)+ln(35,16.6,95,16.6,HL,1,.4)],
  autoshotgun:[162,62,pg('4,14 30,14 30,32 22,34 6,34',G1)+r(30,11,98,17,G1,4)+r(32,12,94,3,G2,1,NS)+st('M52 11 V5 H96 V11',G1,3)+pg('44,28 54,28 51,46 42,45',G1)+c(74,41,14,G2)+c(74,41,8,G1)+c(74,41,3,G3)+r(128,16,26,6,G2)+r(152,14.5,7,9,G1)+vents(100,20,3,8,4,4)],
  launcher:[162,66,pg('4,18 30,18 30,30 22,34 6,34',G1)+r(30,16,32,11,G1)+pg('38,27 48,27 45,44 36,43',G1)+r(60,13,46,28,G2,7)+[68,76,84,92,100].map(x=>ln(x,16,x,38,G1,2)).join('')+r(104,14,4,26,G1)+r(108,17,44,13,G1,2)+r(150,15,7,17,G2)+pg('116,30 124,30 122,46 116,46',G1)+r(72,6,22,7,G1,1)+ln(62,15,104,15,HL,1,.45)],
  pulse:[160,58,pg('6,22 26,15 108,12 126,18 122,28 64,31 44,35 10,33',G1)+pg('28,15 106,13 112,16 30,18',G2,NS)+r(44,19,54,3,CY,1,NS)+c(70,25,8,CY,NS+' opacity=".28"')+c(70,25,4.5,CY,NS)+pg('48,31 58,31 54,47 46,46',G1)+r(76,30,13,12,G2,2)+r(79,33,7,6,CY,1,NS+' opacity=".85"')+pg('122,18 150,19.5 150,25.5 122,27',G2)+r(149,20,6,5,CY,1,NS)+r(66,5,24,7,G1,2)+r(88,6,2,5,CY,0,NS)],
  rail:[212,60,p('M4 18 L40 16 L44 34 L8 40Z M12 24 L34 23 L36 31 L14 34Z',G1,' fill-rule="evenodd"')+pg('40,16 104,14 108,32 62,33 44,36',G1)+pg('56,33 66,33 62,49 54,48',G1)+r(74,32,12,12,G2,2)+r(77,35,6,6,CY,1,NS)+r(104,13,98,4,G2)+r(104,27,98,4,G2)+r(106,18,94,8,CY,1,NS+' opacity=".45"')+Array.from({length:6},(_,i)=>r(112+i*14,11,7,22,G1,1)+ln(115.5+i*14,15,115.5+i*14,29,CY,1.2,.9)).join('')+r(200,12,8,20,G1,1)+r(54,5,40,7,G1,3)+r(92,6,2,5,CY,0,NS)],
  machinepistol:[112,56,st('M36 15 L8 15 L8 28 L36 24',G2,2.5)+r(5,13,5,17,G1,1)+r(36,13,54,12,G2,1)+r(52,15,12,4,G1,0,NS)+r(90,16,14,4,G1)+r(102,15,4,6,G2)+p('M66 25 H75 Q77 38 80 50 H71 Q68 38 66 25Z',G1)+pg('42,25 54,25 52,44 41,44',WD2)+guard(54,25)+r(84,10,3,3,G1)+ln(37,13.6,89,13.6,HL,1,.5)],
  magnum:[124,58,r(50,10,64,4,G1)+r(50,14,64,8,G2)+r(66,22,30,4,G2)+pg('108,6 112,6 112,10 108,10',G1)+p('M24 12 H50 V30 H30 L26 26Z',G2)+r(40,11,26,18,G1,3)+[46,52,58].map(x=>ln(x,13.5,x,26.5,G3,1.5)).join('')+pg('22,8 28,5 31,12 25,13',G1)+p('M26 26 H44 L40 52 Q30 56 22 50Z',WD)+c(33,38,2,BR,NS)+guard(44,29,12)+ln(51,14.6,113,14.6,HL,1,.5)],
  sawedoff:[112,58,p('M36 16 L12 26 Q4 38 12 48 L22 48 L30 31Z',WD)+r(34,12,16,17,G2,2)+c(48,27,2.5,G1)+r(50,12,54,7,G2)+r(50,19,54,7,G2)+c(104,15.5,3,G1)+c(104,22.5,3,G1)+r(54,25,28,7,WD,2)+guard(38,29)+ln(51,12.6,103,12.6,HL,1,.5)],
  thumper:[152,58,p('M4 14 L46 18 L48 30 L10 40 Q2 30 4 14Z',WD)+r(2,13,5,27,G1,1)+r(46,15,18,15,G2,1)+r(64,12,78,16,G2,2)+r(140,11,6,18,G1)+r(72,26,44,8,WD,2)+r(74,4,12,8,G1)+ln(76,6,84,6,HL,1,.6)+ln(76,9,84,9,HL,1,.6)+guard(52,30)+r(44,11,6,4,G1)+ln(65,13,141,13,HL,1,.5)],
  rocket:[214,56,r(10,14,188,16,OD,5)+r(30,14,4,16,G1,0,NS+' opacity=".7"')+r(150,14,4,16,G1,0,NS+' opacity=".7"')+r(166,14,7,16,'#c8a640',0,NS)+pg('2,11 12,14 12,30 2,33',G1)+r(196,13,10,18,G1,2)+pg('78,30 92,30 90,47 79,47',G1)+guard(84,30,8)+pg('120,30 128,30 128,42 121,42',G1)+r(104,7,6,7,G1)+r(66,8,9,6,G1)+r(44,30,22,4,G1)+ln(100,22,140,22,HL,1,.45)+ln(12,15,196,15,HL,1,.35)]};
 const S=64,GEAR={
  frag:c(32,38,17,OD)+st('M18 34 Q32 28 46 34',G1,2)+`<ellipse cx="26" cy="32" rx="5" ry="3" fill="${HL}" opacity=".35" stroke="none"/>`+r(26,15,12,9,G2,2)+st('M37 17 Q50 20 47 42',G3,4)+`<circle cx="22" cy="14" r="6" fill="none" stroke="${HL}" stroke-width="2"/>`,
  incendiary:r(19,18,26,38,'#7b6a4e',4)+r(19,30,26,7,RD,0)+r(25,9,14,10,G2,2)+st('M38 11 Q50 14 46 34',G3,4)+p('M32 54 Q24 47 30 41 Q31 45 34 44 Q32 38 37 35 Q42 44 37 52 Q35 54 32 54Z','#f0a24a',NS),
  mine:p('M6 26 Q32 14 58 26 L58 42 Q32 30 6 42Z',OD)+st('M10 29 Q32 19 54 29',HL,1.5,.35)+ln(14,40,9,58,G1,3)+ln(50,40,55,58,G1,3)+r(24,15,6,6,G2)+r(34,15,6,6,G2)+st('M27 15 Q24 6 14 6',RD,1.6)+`<text x="32" y="36" font-family="monospace" font-size="6" font-weight="700" fill="${HL}" text-anchor="middle" stroke="none" opacity=".75">FRONT</text>`,
  flash:r(20,16,24,40,'#8f978b',3)+[24,32,40,48].map(y=>[26,32,38].map(x=>c(x,y,2,G1,NS)).join('')).join('')+r(25,8,14,9,G1,2)+st('M38 10 Q50 13 46 32',G3,4)+`<circle cx="20" cy="9" r="5" fill="none" stroke="${HL}" stroke-width="2"/>`,
  smoke:r(19,20,26,36,'#6b7357',3)+r(19,26,26,5,'#cfd5c8',0,NS)+r(26,13,12,8,G2,2)+st('M30 12 Q22 6 28 2 M36 12 Q44 7 38 2',`#cfd5c8`,3)+`<text x="32" y="46" font-family="monospace" font-size="6" font-weight="700" fill="#cfd5c8" text-anchor="middle" stroke="none">SMK</text>`,
  emp:c(32,34,22,G1)+`<circle cx="32" cy="34" r="16" fill="none" stroke="${G2}" stroke-width="4"/>`+c(32,34,9,CY,NS+' opacity=".9"')+pg('34,20 26,36 32,36 29,48 39,30 33,30 36,20','#e9fbff',NS)+[[32,10],[54,34],[32,58],[10,34]].map(([x,y])=>r(x-3,y-3,6,6,G3,1)).join(''),
  decoy:`<ellipse cx="32" cy="56" rx="16" ry="5" fill="${G1}"/>`+r(26,49,12,7,G2,1)+pg('22,50 32,44 42,50',CY,NS+' opacity=".25"')+c(32,14,6,CY,NS+' opacity=".75"')+p('M22 44 Q22 26 32 23 Q42 26 42 44Z',CY,NS+' opacity=".55"')+[18,26,34,40].map(y=>ln(22,y,42,y,'#e9fbff',1,.35)).join(''),
  cover:r(8,20,48,28,'#55646a',2)+r(8,18,48,4,CY,1,NS+' opacity=".85"')+[14,26,38,50].map(x=>r(x,25,4,18,G1,1,NS+' opacity=".55"')).join('')+r(10,48,9,8,G1,1)+r(45,48,9,8,G1,1)};
 const PICK={
  health:r(7,18,50,38,'#c9cfb8',5)+st('M24 18 V12 H40 V18',G1,3)+r(28,24,8,26,RD,1,NS)+r(19,33,26,8,RD,1,NS),
  armor:p('M14 10 H24 Q32 16 40 10 H50 L54 20 V54 H10 V20Z','#4f6152')+r(18,22,28,22,'#6b7f6e',2)+r(16,46,32,5,G1,1)+[28,34,40].map(y=>ln(20,y,44,y,G1,1,.5)).join(''),
  ammo:[14,22,30,38].map(x=>r(x,6,5,16,BR,2.5)).join('')+r(8,24,48,32,OD,2)+r(6,20,52,7,'#4d5836',1)+r(24,15,16,5,G1,2)+r(16,36,32,3,'#d4c79b',1,NS+' opacity=".6"')+r(16,42,20,3,'#d4c79b',1,NS+' opacity=".6"'),
  intel:p('M6 16 H26 L30 20 H58 V54 H6Z','#b39a5e')+r(6,22,52,32,'#c8af72')+`<rect x="13" y="31" width="38" height="12" rx="1" fill="none" stroke="${RD}" stroke-width="2.5"/>`+`<text x="32" y="40" font-family="monospace" font-size="7" font-weight="700" fill="${RD}" text-anchor="middle" stroke="none">SECRET</text>`,
  cache:r(6,20,52,34,'#5e5034',4)+st('M24 20 V14 H40 V20',G1,3)+r(6,33,52,4,'#3e3422',0,NS)+c(32,35,8,'#e2b074')+`<text x="32" y="38" font-family="monospace" font-size="7" font-weight="700" fill="#3e3422" text-anchor="middle" stroke="none">CR</text>`,
  gadget:r(8,20,48,36,OD,3)+r(6,16,52,7,'#4d5836',1)+pg('34,26 24,40 31,40 28,52 40,36 33,36 37,26','#e9d48a',NS),
  stim:r(10,24,38,16,'#d9d4c0',5)+r(20,24,12,16,'#6fa36a',0)+r(24.5,28,3,8,'#f2f5ea',0,NS)+r(22,30.5,7,3,'#f2f5ea',0,NS)+r(4,27,7,10,G2,2)+ln(48,32,60,32,G3,2.5)};
 const UP={
  plating:PICK.armor+`<path d="M22 24 L42 42" stroke="#e9f2e2" stroke-width="2" opacity=".6"/>`,
  medic:PICK.stim+r(46,6,14,4,'#6fa36a',1,NS)+r(51,1,4,14,'#6fa36a',1,NS),
  pouch:r(12,22,40,34,OD,4)+r(12,22,40,10,'#4d5836',3)+r(22,6,9,22,G1,2)+r(34,6,9,22,G1,2)+c(32,27,2,BR,NS),
  bandolier:st('M6 10 L58 54',WD2,9)+[0,1,2].map(i=>c(18+i*14,20+i*12,7,OD)).join(''),
  reflex:r(22,14,14,40,G1,3)+r(24,10,10,6,BR,2)+st('M42 18 Q54 30 42 44 M48 14 Q62 30 48 48',CY,2.5),
  conditioning:p('M32 54 L10 32 Q2 20 14 13 Q24 8 32 18 Q40 8 50 13 Q62 20 54 32Z',RD)+st('M8 32 H22 L26 24 L32 40 L36 28 L40 32 H56','#f6e9e2',2.5),
  scavenger:[48,40,32,24].map((y,i)=>`<ellipse cx="32" cy="${y}" rx="18" ry="6" fill="${i%2?'#c9a24f':'#e2b074'}"/>`).join('')+`<text x="32" y="27" font-family="monospace" font-size="7" font-weight="700" fill="#5e5034" text-anchor="middle" stroke="none">CR</text>`};
   // Field support: what gets called in. Perks: an emblem for what each one changes.
  const ring=(x,y,R,s,w=1.5,o=1)=>`<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${s}" stroke-width="${w}" opacity="${o}"/>`,FR='#9fd08a';
  const SUP={
   recon:c(32,32,25,'#1f2a22')+ring(32,32,17,G2)+ring(32,32,9,G2)+p('M32 32 L32 7 A25 25 0 0 1 53.6 19.5Z',CY,NS+' opacity=".45"')+ln(32,32,32,7,CY,2)+c(43,23,3,RD,NS)+c(21,41,2.5,RD,NS)+c(32,32,2.5,HL,NS),
   turret:ln(32,40,13,58,G1,4)+ln(32,40,51,58,G1,4)+ln(32,40,32,59,G1,4)+r(18,23,26,19,G2,4)+r(42,28,18,8,G1,2)+r(58,27,4,10,G2,1)+r(21,19,10,5,G1,1)+c(27,33,4,FR,NS),
   dog:st('M13 33 Q5 27 7 18',G2,3.5)+ln(19,42,17,57,G1,4.5)+ln(27,44,27,58,G1,4.5)+ln(39,44,40,58,G1,4.5)+ln(45,40,48,57,G1,4.5)+`<ellipse cx="30" cy="36" rx="19" ry="9.5" fill="${G2}"/>`+r(23,28,13,16,OD,2)+pg('43,31 55,20 61,27 59,33 50,38',G2)+pg('51,22 53,12 58,21',G1)+r(57,28,5,4,G1,1)+c(54,26,1.9,CY,NS),
   airstrike:ring(32,45,13,RD,2.5)+ln(32,28,32,62,RD,1.5)+ln(15,45,49,45,RD,1.5)+p('M25 9 H39 L40 15 V25 Q32 36 24 25 V15Z',OD)+r(23,5,18,5,G1,1)+ln(28,14,36,14,HL,1.5,.5)};
  const PERK={
   regen:r(26,13,12,38,'#6fa36a',2)+r(13,26,38,12,'#6fa36a',2)+st('M8 46 Q12 59 28 58',HL,2.5)+pg('28,53 35,58 28,63',HL,NS),
   flak:PICK.armor+pg('46,4 49,12 57,12 51,17 53,25 46,20 39,25 41,17 35,12 43,12',RD),
   secondwind:p('M32 58 L13 39 Q6 28 16 22 Q25 18 32 27 Q39 18 48 22 Q58 28 51 39Z',RD)+pg('32,2 43,15 36,15 36,24 28,24 28,15 21,15',HL),
   scrounger:[10,20,30].map(x=>r(x,18,7,30,BR,3.5)+r(x,40,7,10,WD2,1)).join('')+r(47,16,5,19,FR,1,NS)+r(40,23,19,5,FR,1,NS),
   ambusher:st('M7 32 Q32 11 57 32 Q32 53 7 32Z',G3,3)+c(32,32,8,G1)+c(32,32,3,HL,NS)+ln(11,55,53,9,RD,3.5),
   executioner:p('M7 42 L43 15 L50 22 L14 46Z',HL)+ln(41,10,56,25,G1,4.5)+ln(51,15,60,6,WD,7)+c(13,55,4.5,RD),
   lowprofile:st('M8 28 Q32 48 56 28',G3,3.5)+ln(16,38,12,47,G3,2.5)+ln(26,43,24,52,G3,2.5)+ln(38,43,40,52,G3,2.5)+ln(48,38,52,47,G3,2.5),
   flowstate:st('M9 16 L25 32 L9 48',CY,6)+st('M25 16 L41 32 L25 48',CY,6,.65)+st('M41 16 L57 32 L41 48',CY,6,.35),
   hardline:ln(42,14,48,3,G1,3)+r(15,13,34,43,OD,4)+r(20,18,24,8,G1,1)+pg('35,29 25,43 32,43 29,53 40,39 33,39 37,29','#e9d48a',NS)};
  // The second wave of the armory. Two of the guns are built on an existing one, marked with what sets them apart.
  Object.assign(W,{
   burst:[W.rifle[0],W.rifle[1],W.rifle[2]+r(98,1,3.5,8,BR,1.5)+r(105,1,3.5,8,BR,1.5)+r(112,1,3.5,8,BR,1.5)],
   ricochet:[W.battle[0],W.battle[1],W.battle[2]+st('M118 46 L132 36 L144 48 L158 38',BR,2.6)],
   flamer:[152,62,r(6,34,44,20,'#8a3b2c',7)+r(14,30,10,6,G1,1)+r(46,20,58,12,G1,3)+r(50,22,50,3,G2,1,NS)+pg('58,32 68,32 65,50 56,49',G1)+r(104,23,32,6,G2,1)+r(134,21,6,10,G1,1)+p('M140 27 Q151 16 148 27 Q153 35 140 33Z','#f0a24a',NS)],
   minigun:[176,60,r(4,22,36,18,G1,4)+r(14,10,22,12,OD,2)+r(40,18,30,26,G2,4)+[20,26,32,38].map(y=>r(70,y,96,4,G1,1)).join('')+r(100,17,6,28,G2,1)+r(160,17,8,28,G2,2)+pg('48,44 60,44 57,58 46,57',G1)],
   arc:[W.pulse[0],W.pulse[1],W.pulse[2]+pg('136,4 126,20 133,20 128,36 144,16 136,16 141,4','#e9fbff',NS)]});
  Object.assign(GEAR,{
   knife:p('M10 50 L46 12 L52 18 L20 54Z',HL)+ln(14,44,24,54,G1,3.5)+ln(7,57,17,47,WD,7),
   cluster:[0,1,2,3,4].map(i=>c((32+Math.cos(i*1.257)*23).toFixed(1),(37+Math.sin(i*1.257)*23).toFixed(1),5.5,G2)).join('')+c(32,37,15,OD)+r(27,13,10,9,G2,2)+st('M36 15 Q48 18 45 34',G3,3.5),
   c4:r(11,23,42,27,'#b9a77a',3)+ln(11,36,53,36,G1,2)+ln(32,23,32,50,G1,2)+r(24,14,16,12,G1,2)+c(32,20,3,RD,NS)+st('M40 18 Q55 14 53 31',RD,1.8),
   seeker:c(32,37,19,G1)+ring(32,37,12,G2,3)+c(32,37,5,RD,NS)+ln(32,18,32,8,G2,2.5)+c(32,7,2.8,RD,NS),
   grapple:st('M9 55 L37 27',G3,3)+st('M37 27 Q29 10 46 8',G2,5)+st('M37 27 Q54 35 56 18',G2,5)+st('M37 27 L50 14',G2,5)+c(37,27,4.5,G1),
   sensor:ring(32,24,22,CY,1.2,.4)+ring(32,24,14,CY,1.5,.7)+pg('32,8 38,42 26,42',G2)+r(28,42,8,14,G1,1)+c(32,24,3.2,CY,NS),
   gas:r(20,18,24,38,'#7d8a5a',4)+r(20,28,24,6,'#d9d36a',0,NS)+r(26,10,12,9,G2,2)+st('M16 14 Q8 8 14 2 M48 14 Q56 8 50 2','#d9d36a',3),
   trophy:ln(18,54,12,61,G1,3)+ln(46,54,52,61,G1,3)+r(14,40,36,14,G1,3)+r(22,26,20,16,G2,3)+ln(32,26,32,11,G3,3)+ring(32,8,9,CY,1.5,.6)+c(32,8,4,CY,NS),
   ammobox:PICK.ammo});
  Object.assign(SUP,{
   supply:st('M10 22 Q32 -4 54 22',G3,3)+ln(10,22,24,40,G3,1.5)+ln(54,22,40,40,G3,1.5)+ln(32,9,32,40,G3,1.5)+r(18,38,28,21,OD,3)+r(29,42,6,13,'#f2f5ea',0,NS)+r(25.5,45.5,13,6,'#f2f5ea',0,NS),
   reinforce:p('M12 59 Q12 35 32 35 Q52 35 52 59Z','#6b7a4c')+r(26,41,12,10,'#39422f',2)+c(32,21,10,'#dcab80')+p('M20 17 Q32 2 44 17 L44 20 H20Z','#56633f'),
   gunship:ln(6,21,54,21,G3,2.5)+ln(30,21,30,28,G1,3)+`<ellipse cx="30" cy="36" rx="20" ry="9" fill="${OD}"/>`+pg('46,34 60,30 60,39',OD)+r(57,25,3,13,G1,1)+r(13,32,11,7,CY,2,NS)+ln(20,47,40,47,G1,2.5),
   blackout:c(32,32,25,'#11161a')+ring(32,32,25,CY,2.5)+pg('36,11 22,34 31,34 27,53 43,28 34,28 39,11','#e9fbff',NS)});
  function art(kind,key){if(kind==='weapon'){const d=W[key]||W.rifle;return {w:d[0],h:d[1],body:d[2]};}const set=kind==='gear'?GEAR:kind==='upgrade'?UP:kind==='support'?SUP:kind==='perk'?PERK:PICK;return {w:S,h:S,body:set[key]||PICK.gadget};}
 function svg(kind,key,cls=''){const a=art(kind,key);return `<svg class="icon icon-${kind} ${cls}" viewBox="0 0 ${a.w} ${a.h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke="${O}" stroke-width="1.3" stroke-linejoin="round">${a.body}</g></svg>`;}
 function uri(kind,key,scale=2){const a=art(kind,key),s=`<svg xmlns="http://www.w3.org/2000/svg" width="${a.w*scale}" height="${a.h*scale}" viewBox="0 0 ${a.w} ${a.h}"><g stroke="${O}" stroke-width="1.4" stroke-linejoin="round">${a.body}</g></svg>`;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);}
 // Cartoon operator for the co-op lobby: a stocky, front-facing soldier at low ready, holding whichever weapon art is
 // passed in. Each kit is one player's uniform colours, so squadmates read apart at a glance.
 const KITS=[{u:'#6b7a4c',ud:'#4d5937',v:'#39422f',vl:'#59664b',h:'#56633f',hh:'#7a8960',ac:'#dfad70'},{u:'#55707f',ud:'#3d5260',v:'#2b373e',vl:'#485b65',h:'#486070',hh:'#6a8394',ac:CY}];
 function soldier(weapon='rifle',kit=0){const k=KITS[kit%KITS.length],d=W[weapon]||W.rifle,w=d[0],h=d[1],s=Math.min(1.3,172/w),a=-16*Math.PI/180,cx=126,cy=200,SK='#dcab80',SKD='#b8845c',GL='#262b23',BT='#22261e',EYE='#191713';
  // Points along the gun (as fractions of its artwork) mapped into the figure, so the gloves land on the grip and fore-end.
  const at=(fx,fy)=>{const x=(fx-.5)*w*s,y=(fy-.5)*h*s;return [+(cx+x*Math.cos(a)-y*Math.sin(a)).toFixed(1),+(cy+x*Math.sin(a)+y*Math.cos(a)).toFixed(1)];};
  const small=w<130,rear=at(small?.26:.34,.8),fore=at(small?.4:.64,small?.84:.64),arm=path=>st(path,O,27)+st(path,k.u,21);
  const body=`<ellipse cx="120" cy="303" rx="76" ry="10" fill="#000" opacity=".38" stroke="none"/>`+
   r(84,222,32,62,k.ud,10)+r(124,222,32,62,k.ud,10)+r(87,243,26,17,k.v,6)+r(127,243,26,17,k.v,6)+r(77,275,42,25,BT,10)+r(121,275,42,25,BT,10)+
   r(72,136,96,96,k.u,24)+r(76,214,88,13,k.v,4)+r(112,214,16,13,k.ac,2)+
   r(81,146,78,62,k.v,13)+r(87,180,20,24,k.vl,4)+r(110,180,20,24,k.vl,4)+r(133,180,20,24,k.vl,4)+r(89,154,24,9,k.ac,2,NS)+r(141,144,13,22,k.vl,3)+ln(147,144,151,126,O,2.4)+
   arm(`M80 160 Q50 198 ${rear[0]} ${rear[1]}`)+arm(`M160 160 Q192 202 ${fore[0]} ${fore[1]}`)+
   `<g transform="translate(${cx} ${cy}) rotate(-16) scale(${s.toFixed(3)}) translate(${-w/2} ${-h/2})" stroke-width="${(2.2/s).toFixed(2)}">${d[2]}</g>`+
   c(rear[0],rear[1],12,GL)+c(fore[0],fore[1],12,GL)+
   r(107,120,26,24,SKD,8)+c(76,99,8,SK)+c(164,99,8,SK)+c(120,92,45,SK)+
   c(104,101,5.5,EYE,NS)+c(136,101,5.5,EYE,NS)+c(105.8,99,1.8,'#fff',NS)+c(137.8,99,1.8,'#fff',NS)+ln(93,88,111,92,O,4)+ln(147,88,129,92,O,4)+ln(95,111,110,112,'#4a3524',3,.5)+ln(145,111,130,112,'#4a3524',3,.5)+
   st('M120 105 Q117 111 121 112',SKD,2.4)+st('M110 120 Q121 126 132 118',O,2.8)+
   p('M72 97 Q62 35 120 35 Q178 35 168 97 Q146 78 120 78 Q94 78 72 97Z',k.h)+st('M86 62 Q98 47 118 44',k.hh,5,.9)+st('M73 82 Q120 62 167 82',k.v,6)+
   r(92,47,56,21,'#1b2220',10)+r(97,51,20,12,k.ac,6,NS+' opacity=".6"')+r(123,51,20,12,k.ac,6,NS+' opacity=".6"')+
   st('M78 105 Q84 133 106 138',k.v,3.5)+st('M162 105 Q156 133 134 138',k.v,3.5);
  return `<svg class="soldier" viewBox="0 0 240 316" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;}
 const keyOf=(kind,key)=>kind[0]+':'+key;
 // Rasterize every icon into a Phaser texture. Images decode asynchronously; the renderer falls back to drawn shapes until each texture exists.
 function load(scene){const jobs=[...Object.keys(W).map(k=>['weapon',k]),...Object.keys(GEAR).map(k=>['gear',k]),...Object.keys(PICK).map(k=>['pickup',k])];
  for(const [kind,key] of jobs){const id=keyOf(kind,key);if(scene.textures.exists(id))continue;const img=new Image();img.onload=()=>{if(!scene.textures.exists(id))scene.textures.addImage(id,img);};img.src=uri(kind,key,kind==='weapon'?2:2);}}
 // Enemy pressure, as faces: who you are up against at each tier. One easy-going soldier for Story, one steady
 // regular for Standard, two hard-eyed ones for High Intensity, and for Insane three masked figures in black with red
 // eyes. Drawn in the same hand as the lobby's operator, so they read as the same world.
 const MOODS={
  story:{helmet:'#6f9a62',rim:'#4d7245',skin:'#e6b98f',eye:'#1c1a16',band:'#35482f'},
  standard:{helmet:'#6b7a4c',rim:'#4d5937',skin:'#dcab80',eye:'#191713',band:'#39422f'},
  intense:{helmet:'#4b4a3a',rim:'#33322a',skin:'#b78763',eye:'#120f0c',band:'#24241d'},
  insane:{helmet:'#1b1e21',rim:'#0d0f11',skin:'#4c4340',eye:'#ff3b2f',band:'#7a1a14'}};
 function head(mood,dx=0,dy=0,k=1){const m=MOODS[mood],evil=mood==='insane',hard=mood==='intense';
  const brows=mood==='story'?st('M17 29 Q22 26 27 29',O,2.2)+st('M33 29 Q38 26 43 29',O,2.2):mood==='standard'?ln(17,29,27,29.5,O,2.4)+ln(43,29,33,29.5,O,2.4):ln(16,26.5,27,31.5,O,evil?3.4:3)+ln(44,26.5,33,31.5,O,evil?3.4:3);
  const eyes=evil?c(22.5,35,5,m.eye,NS+' opacity=".35"')+c(37.5,35,5,m.eye,NS+' opacity=".35"')+c(22.5,35,2.7,m.eye,NS)+c(37.5,35,2.7,m.eye,NS)+c(22.5,35,1,'#ffd9d2',NS)+c(37.5,35,1,'#ffd9d2',NS)
   :c(22.5,35,2.7,m.eye,NS)+c(37.5,35,2.7,m.eye,NS)+(mood==='story'?c(23.4,34,1,'#fff',NS)+c(38.4,34,1,'#fff',NS):'');
  const mouth=mood==='story'?st('M23 42 Q30 48.5 37 42',O,2.2):mood==='standard'?ln(25,43.5,35,43.5,O,2.2):hard?st('M24 45.5 Q30 41.5 36 45.5',O,2.4)+ln(14,38,19,44,'#6e4a32',1.6,.6)+ln(46,38,41,44,'#6e4a32',1.6,.6)
   :p('M13.5 38.5 Q30 45 46.5 38.5 L45 47 Q30 56 15 47Z','#101214')+ln(22,45,38,45,'#2c3036',1.4)+ln(24,48.5,36,48.5,'#2c3036',1.4);
  const body=c(13,34,3.6,m.skin)+c(47,34,3.6,m.skin)+c(30,33,17,m.skin)+(hard||evil?p('M13 33 Q30 27 47 33 L47 30 Q30 22 13 30Z','#000',NS+' opacity=".28"'):'')+eyes+brows+mouth
   +p('M11.5 33 Q7 8 30 8 Q53 8 48.5 33 Q40 25.5 30 25.5 Q20 25.5 11.5 33Z',m.helmet)+st('M12.5 28 Q30 19.5 47.5 28',m.band,3)+st('M17 17 Q23 11 31 10.5',m.rim,2.4,.8)+(evil?r(27,8.5,6,10,'#c1271d',1,NS):'');
  return `<g transform="translate(${dx} ${dy}) scale(${k})">${body}</g>`;}
 function pressure(level){const mood=MOODS[level]?level:'standard',n=mood==='insane'?3:mood==='intense'?2:1,w=n===1?60:n===2?92:118;
  const heads=n===1?head(mood):n===2?head(mood,34,3,.94)+head(mood,0,0):head(mood,0,6,.86)+head(mood,66,6,.86)+head(mood,29,0);
  return `<svg class="pressure-icon pressure-${mood}" viewBox="0 0 ${w} 58" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke="${O}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${heads}</g></svg>`;}
 root.BPIcons={svg,uri,art,load,keyOf,soldier,pressure,size:k=>W[k]?{w:W[k][0],h:W[k][1]}:{w:S,h:S}};
})(globalThis);

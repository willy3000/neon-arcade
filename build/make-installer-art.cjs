'use strict';
// Draws the pictures the Windows installer and portable exe show, from the game's own logo and typefaces:
//   build/installerSidebar.bmp  164 x 314  the panel down the left of the welcome and finish pages
//   build/installerHeader.bmp   150 x 57   the strip at the top right of the other pages
//   build/portableSplash.bmp    480 x 270  shown by the portable exe while it unpacks
// NSIS wants 24-bit BMP files of exactly those sizes. Run it again if build/icon.png changes:
//   node build/make-installer-art.cjs
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const b64=f=>fs.readFileSync(path.join(root,f)).toString('base64');
// A bottom-up, 24-bit BMP from top-down RGBA pixels. Rows are padded to a multiple of four bytes.
function bmp(width,height,rgba){const row=Math.ceil(width*3/4)*4,data=Buffer.alloc(row*height),head=Buffer.alloc(54);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=(y*width+x)*4,d=(height-1-y)*row+x*3;data[d]=rgba[s+2];data[d+1]=rgba[s+1];data[d+2]=rgba[s];}
 head.write('BM');head.writeUInt32LE(54+data.length,2);head.writeUInt32LE(54,10);head.writeUInt32LE(40,14);head.writeInt32LE(width,18);head.writeInt32LE(height,22);head.writeUInt16LE(1,26);head.writeUInt16LE(24,28);head.writeUInt32LE(data.length,34);head.writeInt32LE(2835,38);head.writeInt32LE(2835,42);
 return Buffer.concat([head,data]);}
(async()=>{const browser=await chromium.launch(),page=await browser.newPage();
 await page.setContent(`<style>@font-face{font-family:Display;font-weight:900;src:url(data:font/woff2;base64,${b64('blackout/assets/fonts/barlow-condensed-900.woff2')})}@font-face{font-family:Mono;font-weight:500;src:url(data:font/woff2;base64,${b64('blackout/assets/fonts/ibm-plex-mono-500.woff2')})}</style><img id="logo" src="data:image/png;base64,${b64('build/icon.png')}">`);
 const art=await page.evaluate(async()=>{await document.fonts.load('900 30px Display');await document.fonts.load('500 8px Mono');const logo=document.getElementById('logo');await logo.decode();
  const BG='#151915',PAPER='#e7e8de',AMBER='#dfad70',MUTED='#8d9781';
  const make=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';draw(g);return [...g.getImageData(0,0,w,h).data];};
  const backdrop=(g,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#1d241c');grad.addColorStop(1,'#0e130e');g.fillStyle=grad;g.fillRect(0,0,w,h);g.strokeStyle='rgba(168,181,155,.07)';g.lineWidth=1;for(let x=.5;x<w;x+=20){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=.5;y<h;y+=20){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}};
  const spaced=(g,text,x,y,gap)=>{let at=x;for(const ch of text){g.fillText(ch,at,y);at+=g.measureText(ch).width+gap;}};
  const sidebar=make(164,314,g=>{backdrop(g,164,314);g.drawImage(logo,26,34,112,112);
   g.textBaseline='alphabetic';g.textAlign='center';g.font='900 33px Display';g.fillStyle=PAPER;g.fillText('BLACKOUT',82,190);g.fillStyle=AMBER;g.fillText('PROTOCOL',82,219);
   g.fillStyle=AMBER;g.fillRect(62,232,40,2);g.textAlign='left';g.font='500 7px Mono';g.fillStyle=MUTED;spaced(g,'TACTICAL ACTION',39,251,1.6);
   g.fillStyle='rgba(211,216,186,.15)';g.fillRect(20,284,124,1);g.fillStyle=MUTED;spaced(g,'NEON ARCADE',50,300,1.6);});
  const header=make(150,57,g=>{backdrop(g,150,57);g.drawImage(logo,8,7,43,43);g.textBaseline='alphabetic';g.textAlign='left';g.font='900 19px Display';g.fillStyle=PAPER;g.fillText('BLACKOUT',58,27);g.fillStyle=AMBER;g.fillText('PROTOCOL',58,45);});
  // Shown by the portable exe while it unpacks itself, which takes a few seconds with nothing else on screen.
  const splash=make(480,270,g=>{backdrop(g,480,270);g.drawImage(logo,46,65,140,140);g.textBaseline='alphabetic';g.textAlign='left';g.font='900 54px Display';g.fillStyle=PAPER;g.fillText('BLACKOUT',214,128);g.fillStyle=AMBER;g.fillText('PROTOCOL',214,176);
   g.fillStyle=AMBER;g.fillRect(216,192,40,2);g.font='500 9px Mono';g.fillStyle=MUTED;spaced(g,'PREPARING FIELD EQUIPMENT',216,214,1.8);g.strokeStyle='rgba(211,216,186,.2)';g.lineWidth=1;g.strokeRect(.5,.5,479,269);});
  return {sidebar,header,splash};});
 fs.writeFileSync(path.join(__dirname,'installerSidebar.bmp'),bmp(164,314,art.sidebar));fs.writeFileSync(path.join(__dirname,'installerHeader.bmp'),bmp(150,57,art.header));fs.writeFileSync(path.join(__dirname,'portableSplash.bmp'),bmp(480,270,art.splash));
 // A PNG copy of each, only so the result can be looked at without a BMP viewer.
 await page.setContent(`<body style="margin:0;background:#888"><canvas id="a" width="164" height="314"></canvas> <canvas id="b" width="150" height="57"></canvas> <canvas id="c" width="480" height="270"></canvas>`);
 await page.evaluate(art=>{for(const [id,w,h,d] of [['a',164,314,art.sidebar],['b',150,57,art.header],['c',480,270,art.splash]])document.getElementById(id).getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d),w,h),0,0);},art);
 await page.setViewportSize({width:820,height:320});await page.screenshot({path:path.join(__dirname,'installer-art-preview.png')});
 await browser.close();console.log('wrote build/installerSidebar.bmp, installerHeader.bmp, portableSplash.bmp and a preview');})().catch(e=>{console.error(e);process.exit(1);});

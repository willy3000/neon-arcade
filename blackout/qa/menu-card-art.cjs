'use strict';
// Captures the pictures on two of the main menu's cards: COMBAT MODES (a holdout wave closing on the operator) and
// FIRING RANGE (the range). Unretouched screenshots of the game in play, HUD hidden, cropped to the cards' shape and
// scaled down. Writes blackout/assets/menu/holdout.jpg and training.jpg. Run it again if the look of the field changes,
// then refresh those entries in blackout/assets/integrity.json.
//   node blackout/qa/menu-card-art.cjs            both
//   node blackout/qa/menu-card-art.cjs holdout    only the ones named
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'blackout/assets/menu'),only=process.argv.slice(2);
const VIEW={width:1366,height:768},CROP={width:660,height:510},SIZE={width:440,height:340};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/blackout-protocol.html?qa`,browser=await chromium.launch(),scaler=await browser.newPage();
 const shoot=async(page,file)=>{const at=await page.evaluate(()=>{const s=BPQA.sim(),k=BPQA.camera();return {x:(s.player.x-k.worldView.x)*k.zoom,y:(s.player.y-k.worldView.y)*k.zoom};}),
   clip={x:Math.max(0,Math.min(VIEW.width-CROP.width,at.x-CROP.width*.42)),y:Math.max(0,Math.min(VIEW.height-CROP.height,at.y-CROP.height/2)),...CROP},png=await page.screenshot({clip,type:'png'});
  const jpg=await scaler.evaluate(async([b64,w,h])=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);return c.toDataURL('image/jpeg',.82).split(',')[1];},[png.toString('base64'),SIZE.width,SIZE.height]);
  fs.writeFileSync(path.join(out,file),Buffer.from(jpg,'base64'));console.log('shot '+file);};
 const open=async()=>{const page=await browser.newPage({viewport:VIEW});
  // Story pressure keeps the operator standing for the picture; the regular look is the one on the cards.
  await page.addInitScript(()=>{navigator.getGamepads=()=>[];localStorage.setItem('blackout-protocol-progress',JSON.stringify({version:3,drill:true,intelInit:1,settings:{volume:0,difficulty:'story',callsign:'ROOK',lobbyMode:'holdout',fill:false}}));});
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});
  await page.addStyleTag({content:'body.playing #hud,body.playing .topbar,body.playing .grain,#danger,#flashout,#toast,#banner,#radio{visibility:hidden!important}'});return page;};
 if(!only.length||only.includes('holdout')){const page=await open();
  await page.click('#holdout');await page.waitForFunction(()=>BPApp.snapshot().mode==='lobby');await page.click('#lobby-go');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');
  // The camera leads the aim, so the aim stays near the operator and the picture is centred on them.
  await page.mouse.move(VIEW.width-12,VIEW.height*.5);
  // A wave closing in: wait until at least three hostiles are inside the picture.
  await page.waitForFunction(([c])=>{const v=BPApp.inspect(),k=v.camera,cx=k.scrollX+k.width/2,cy=k.scrollY+k.height/2;return v.world.enemies.filter(e=>e.active&&!e.dead&&Math.abs(e.x-cx)<c.width/2/k.zoom-70&&Math.abs(e.y-cy)<c.height/2/k.zoom-60).length>=3;},[CROP],{timeout:40000,polling:100}).catch(()=>console.log('   (fewer than three hostiles in frame)'));
  await page.evaluate(()=>{const s=BPQA.sim(),p=s.player;s.enemies.filter(e=>e.active&&!e.dead).slice(0,5).forEach((e,i)=>{const a=-1.1+i*.55;e.x=p.x+Math.cos(a)*(170+i%2*40);e.y=p.y+Math.sin(a)*(150+i%2*30);});});await page.waitForTimeout(450);
  await shoot(page,'holdout.jpg');await page.close();}
 if(!only.length||only.includes('training')){const page=await open();
  // The range's dummies stand far from where the operator starts: the operator is put on the line facing them.
  await page.click('#training');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');
  await page.evaluate(()=>{const p=BPQA.sim().player;p.x=1060;p.y=680;});await page.mouse.move(VIEW.width-12,VIEW.height*.45);await page.waitForTimeout(1800);
  await shoot(page,'training.jpg');await page.close();}
 await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});

'use strict';
// Captures the pictures shown in the HOLDOUT killhouse picker: one unretouched screenshot of each killhouse in play,
// HUD hidden, cropped around the operator and scaled down. Writes blackout/assets/menu/killhouse-<map id>.jpg.
// Run it again if a map's look changes, then refresh those entries in blackout/assets/integrity.json.
//   node blackout/qa/killhouse-shots.cjs            every killhouse
//   node blackout/qa/killhouse-shots.cjs holdout-crash   only the ones named
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'blackout/assets/menu'),only=process.argv.slice(2);
const VIEW={width:1366,height:768},CROP={width:1120,height:440},SIZE={width:560,height:220};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/blackout-protocol.html`,browser=await chromium.launch(),page=await browser.newPage({viewport:VIEW}),scaler=await browser.newPage();
 // Every campaign operation marked done, so every killhouse is unlocked; story pressure keeps the operator alive for the picture.
 await page.addInitScript(()=>{navigator.getGamepads=()=>[];const done={done:true,medals:['complete'],diffs:['standard']};localStorage.setItem('blackout-protocol-progress',JSON.stringify({version:3,drill:true,missions:{crash:done,ruins:done,kestrel:done,underground:done,convoy:done,meridian:done,redline:done,citadel:done,blackout:done},settings:{volume:0,difficulty:'story',callsign:'ROOK'}}));});
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});
 await page.addStyleTag({content:'body.playing #hud,body.playing .topbar,body.playing .grain,#danger,#flashout{visibility:hidden!important}'});
 const maps=await page.evaluate(()=>BPWorld.holdoutMaps.map(h=>h.id)),clip={x:(VIEW.width-CROP.width)/2,y:(VIEW.height-CROP.height)/2,...CROP};
 for(const [i,id] of maps.entries()){if(only.length&&!only.includes(id))continue;
  await page.click('#holdout');await page.click('#lobby-map');await page.locator('#picker-list .pick').nth(i).click();await page.click('#lobby-go');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');await page.mouse.move(VIEW.width*.72,VIEW.height*.42);
  // Wait for hostiles to walk into the frame, so the picture shows a fight and not an empty yard: three if they come
  // quickly, two if that is all the map sends close in the time. The operator stands still, so the wait is kept short.
  const inFrame=(n,ms)=>page.waitForFunction(([c,n])=>{const v=BPApp.inspect(),k=v.camera,cx=k.scrollX+k.width/2,cy=k.scrollY+k.height/2;return v.world.enemies.filter(e=>e.active&&!e.dead&&Math.abs(e.x-cx)<c.width/2/k.zoom-30&&Math.abs(e.y-cy)<c.height/2/k.zoom-30).length>=n;},[CROP,n],{timeout:ms,polling:100});
  await inFrame(3,9000).catch(()=>inFrame(2,9000)).catch(()=>inFrame(1,14000)).catch(()=>console.log('   (no hostile in frame for '+id+')'));
  const png=await page.screenshot({clip,type:'png'});
  const jpg=await scaler.evaluate(async([b64,w,h])=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);return c.toDataURL('image/jpeg',.82).split(',')[1];},[png.toString('base64'),SIZE.width,SIZE.height]);
  fs.writeFileSync(path.join(out,'killhouse-'+id+'.jpg'),Buffer.from(jpg,'base64'));console.log('shot killhouse-'+id+'.jpg');
  await page.keyboard.press('Escape');await page.click('#exit');await page.waitForFunction(()=>BPApp.snapshot().mode==='menu');}
 await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});

'use strict';
// Captures the picture on the main menu's campaign card for an operation: an unretouched screenshot of its opening
// moments, HUD hidden, cropped to the card's shape. Writes blackout/assets/menu/campaign-<mission id>.jpg.
// Run it again if an operation's look changes, then refresh those entries in blackout/assets/integrity.json.
//   node blackout/qa/campaign-art.cjs redline citadel blackout
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'blackout/assets/menu'),ids=process.argv.slice(2);
const VIEW={width:1366,height:768},CROP={width:880,height:250};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
(async()=>{if(!ids.length){console.error('Name the operations to capture.');process.exit(1);}
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/blackout-protocol.html?qa`,browser=await chromium.launch(),scaler=await browser.newPage();
 for(const id of ids){const page=await browser.newPage({viewport:VIEW});
  // Every operation cleared, so any of them can be deployed; story pressure keeps the opening calm for the picture.
  await page.addInitScript(()=>{navigator.getGamepads=()=>[];const done={done:true,medals:['complete'],diffs:['standard']},missions={};for(const k of ['crash','ruins','kestrel','underground','convoy','meridian','redline','citadel','blackout'])missions[k]=done;localStorage.setItem('blackout-protocol-progress',JSON.stringify({version:3,drill:true,intelInit:1,missions,settings:{volume:0,difficulty:'story',callsign:'ROOK'}}));});
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});
  await page.addStyleTag({content:'body.playing #hud,body.playing .topbar,body.playing .grain,#danger,#flashout,#toast,#banner,#radio{visibility:hidden!important}'});
  await page.click('#continue');await page.waitForFunction(()=>BPApp.snapshot()?.mode==='ops');await page.click(`[data-mission="${id}"]`);await page.click('#deploy');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');
  await page.mouse.move(VIEW.width*.7,VIEW.height*.45);await page.waitForTimeout(2600);
  const clip={x:(VIEW.width-CROP.width)/2,y:(VIEW.height-CROP.height)/2,...CROP},png=await page.screenshot({clip,type:'png'});
  const jpg=await scaler.evaluate(async([b64,w,h])=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);return c.toDataURL('image/jpeg',.82).split(',')[1];},[png.toString('base64'),CROP.width,CROP.height]);
  fs.writeFileSync(path.join(out,'campaign-'+id+'.jpg'),Buffer.from(jpg,'base64'));console.log('shot campaign-'+id+'.jpg');await page.close();}
 await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});

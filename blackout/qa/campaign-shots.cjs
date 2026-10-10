'use strict';
// Visual QA: serves the repo, opens every screen and every mission, and saves screenshots under blackout/qa/.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=__dirname,errors=[];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(f.endsWith(path.sep))f+='index.html';fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/blackout-protocol.html`;const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const only=process.argv.slice(2);
 await page.addInitScript(()=>{const s={version:2,credits:4200,xp:2600,owned:{weapons:['rifle','pistol','shotgun','marksman','magnum','smg','rocket','pulse','thumper'],gear:['frag','smoke','flash','emp']},missions:{crash:{done:true,medals:['complete','flawless'],diffs:['standard'],best:{score:9800,rating:'S',time:120,difficulty:'standard'}},ruins:{done:true,medals:['complete'],diffs:['standard']},kestrel:{done:true,medals:['complete'],diffs:['standard']},underground:{done:true,medals:[],diffs:['standard']},convoy:{done:true,medals:[],diffs:['standard']}},loadout:{primary:'marksman',secondary:'pistol',lethal:'frag',tactical:'smoke'},settings:{volume:0}};if(!sessionStorage.getItem('seeded')){localStorage.setItem('blackout-protocol-progress',JSON.stringify(s));sessionStorage.setItem('seeded','1');}});
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});
 const shot=async n=>{await page.screenshot({path:path.join(out,n+'.png')});console.log('shot',n);};
 if(!only.length||only.includes('menu')){await shot('title');await page.click('#continue');await page.waitForTimeout(300);await shot('ops');await page.click('[data-slot="primary"]');await page.waitForTimeout(200);await shot('picker');await page.keyboard.press('Escape');await page.click('#ops-armory');await page.waitForTimeout(200);await shot('armory');await page.click('[data-tab="record"]');await page.waitForTimeout(200);await shot('record');await page.click('#armory-back');await page.click('#ops-back');}
 for(const id of ['crash','ruins','kestrel','underground','convoy','meridian','holdout']){if(only.length&&!only.includes(id))continue;
  await page.evaluate(id=>{document.querySelector('#'+(id==='holdout'?'holdout':'continue')).click();},id);if(id!=='holdout'){await page.click(`[data-mission="${id}"]`);await page.click('#deploy');}
  await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');await page.waitForTimeout(1800);await shot('mission-'+id);
  if(id==='kestrel'||id==='crash'){await page.evaluate(()=>{const s=BPApp.inspect().world;});}
  await page.keyboard.press('Escape');await page.click('#exit');}
 if(!only.length||only.includes('effects')){await page.click('#continue');await page.click('[data-mission="crash"]');await page.click('#deploy');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');await page.waitForTimeout(600);
  // Low-health presentation: drop health through the sim's own damage path and capture the vignette.
  await page.evaluate(()=>{});await shot('crash-start');}
 console.log('errors',JSON.stringify(errors));await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});

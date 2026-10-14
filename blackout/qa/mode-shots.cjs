'use strict';
// Captures the pictures on the lobby's mode tiles: one unretouched screenshot of each mode in play, HUD hidden,
// zoomed in on the fight and scaled down. Writes blackout/assets/menu/mode-<mode id>.jpg.
// Each picture is a real run that is arranged for the camera a moment before the shot (who stands where), then left
// to play: the operators, hostiles, tracers and name tags are the game's own.
// Run it again if the look of the game changes, then refresh those entries in blackout/assets/integrity.json.
//   node blackout/qa/mode-shots.cjs          every mode
//   node blackout/qa/mode-shots.cjs tdm      only the ones named
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'blackout/assets/menu'),only=process.argv.slice(2);
const VIEW={width:1366,height:768},CROP={width:1012,height:440},SIZE={width:460,height:200},ZOOM=1.75;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
// Where everyone stands, relative to the operator, who faces right. Spots that are not open ground with a clear view
// of the operator are nudged outwards until they are.
const SCENES={
 holdout:{mode:'holdout',wait:7000,settle:380,aim:[230,-30],
  hostiles:[['rusher',195,-72],['rusher',180,82],['infantry',300,-22],['infantry',285,92],['breacher',-170,-66],['rusher',-178,58],['scout',100,-100],['infantry',-205,0]]},
 tdm:{mode:'tdm',wait:1500,settle:300,aim:[200,0],
  mates:[[-50,-46],[-58,44],[-112,0]],
  hostiles:[['raider',168,-50],['striker',150,42],['deadeye',214,-4],['raider',192,86]]},
 // The newer modes are photographed at what makes them what they are: "at" centres the scene on a relay, the breach
 // site, a cache or a trial gate instead of the map's start.
 arms:{mode:'arms',wait:1500,settle:320,aim:[200,0],mates:[[-50,-46],[-112,0]],hostiles:[['raider',168,-50],['striker',150,42],['raider',214,-4]]},
 uplink:{mode:'uplink',at:'relay',wait:1500,settle:300,aim:[160,0],mates:[[-40,-40],[-60,40]],hostiles:[['raider',150,-50],['striker',170,42],['raider',230,0]]},
 hunted:{mode:'hunted',wait:1500,settle:420,aim:[220,-20],mates:[[-50,-46],[-58,44],[-112,0]],hostiles:[['raider',240,-20]]},
 breach:{mode:'breach',at:'site',wait:23000,settle:320,aim:[200,0],mates:[[-50,-46],[-58,44],[-112,0]],hostiles:[['raider',168,-50],['striker',150,42],['raider',214,-4],['striker',192,86]]},
 extract:{mode:'extract',at:'cache',wait:4000,settle:380,aim:[230,-30],hostiles:[['infantry',210,-60],['rusher',190,70],['scout',290,10],['infantry',-200,-40]]},
 trials:{mode:'trials',at:'gate',wait:1200,settle:600,aim:[150,40],hostiles:[]}};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/blackout-protocol.html?qa`,browser=await chromium.launch(),scaler=await browser.newPage();
 const clip={x:(VIEW.width-CROP.width)/2,y:(VIEW.height-CROP.height)/2,...CROP};
 for(const [id,sc] of Object.entries(SCENES)){if(only.length&&!only.includes(id))continue;
  const page=await browser.newPage({viewport:VIEW});
  // Story pressure keeps everyone standing for the picture; the lobby opens in the mode being photographed.
  await page.addInitScript(mode=>{navigator.getGamepads=()=>[];localStorage.setItem('blackout-protocol-progress',JSON.stringify({version:3,drill:true,settings:{volume:0,difficulty:'story',callsign:'ROOK',lobbyMode:mode,lobbyMap:'holdout',fill:false}}));},sc.mode);
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});
  await page.addStyleTag({content:'body.playing #hud,body.playing .topbar,body.playing .grain,#danger,#flashout,#toast,#banner{visibility:hidden!important}'});
  await page.click('#holdout');await page.click('#lobby-go');await page.waitForFunction(()=>BPApp.snapshot().mode==='playing');
  // Let the first hostiles arrive by themselves, then arrange the scene around the middle of the map.
  await page.waitForTimeout(sc.wait);
  await page.evaluate(([sc,zoom])=>{const s=BPQA.sim(),p=s.player,C=BPCore;BPQA.camera().setZoom(zoom);
   const focus=sc.at==='relay'?s.tdm?.relays?.[0]:sc.at==='site'?s.tdm?.site:sc.at==='cache'?s.pickups.find(q=>q.type==='loot'&&!q.taken):sc.at==='gate'?s.trial?.gates[2]:null;
   const home=focus?{x:focus.x-120,y:focus.y}:{x:s.map.start.x,y:s.map.start.y},spot=(dx,dy)=>{for(let k=1;k<2.2;k+=.08){const q={x:home.x+dx*k,y:home.y+dy*k};if(C.clearAt(s,q.x,q.y,20)&&C.lineOfSight(s,home,q))return q;}return null;};
   Object.assign(p,{x:home.x,y:home.y,vx:0,vy:0,health:100,dead:false,state:'idle'});
   // Team deathmatch: the scene's "mates" are the operators on Rook's team and its "hostiles" the other team's, all
   // of them AI operators from the match itself, stood in their places and left to fight.
   if(s.tdm){const side=t=>s.roster.filter(o=>o!==p&&o.team===t),place=(o,[dx,dy],a)=>{const q=o&&spot(dx,dy);if(q)Object.assign(o,{x:q.x,y:q.y,vx:0,vy:0,health:100,hp:100,dead:false,state:'idle',respawn:0,iframes:1.2,angle:a});};
    side(p.team).forEach((o,i)=>place(o,(sc.mates||[])[i]||[-90,i*40],0));side(1-p.team).forEach((o,i)=>place(o,(sc.hostiles[i]||[]).slice(1),Math.PI));return;}
   (sc.mates||[]).forEach(([dx,dy],i)=>{const m=s.mates[i],q=spot(dx,dy);if(m&&q)Object.assign(m,{x:q.x,y:q.y,vx:0,vy:0,health:100,dead:false,state:'idle',respawn:0,angle:0});});
   // The hostiles already in the run are stood in their places; any the scene still needs are added as the run itself would spawn them.
   if(sc.mode==='trials'){Object.assign(p,{state:'slide',age:.1,duration:.7,actionDir:0,slideSpeed:520,vx:520,vy:0});return;}
   const live=s.enemies.filter(e=>!e.dead);s.spawnWarnings.length=0;if(s.director.queue)s.director.queue.length=0;
   s.enemies=sc.hostiles.map(([type,dx,dy],i)=>{const q=spot(dx,dy);if(!q)return null;const e=live[i]||{...live[0],id:'shot'+i};
    return Object.assign(e,{type,gun:BPWorld.archetypes[type].gun||null,x:q.x,y:q.y,vx:0,vy:0,hp:400,maxHp:400,radius:17,dead:false,active:true,seen:4,lastX:home.x,lastY:home.y,spawned:true,hunt:true,stagger:0,reload:0,attack:0,burst:0,cooldown:.15+i*.12,angle:Math.atan2(home.y-q.y,home.x-q.x)});}).filter(Boolean);
  },[sc,ZOOM]);
  // The operator opens fire at the hostiles in front of him and the scene plays for a moment before the shot.
  const at=await page.evaluate(([dx,dy])=>{const cam=BPQA.camera();return {x:cam.width/2+dx*cam.zoom*.55,y:cam.height/2+dy*cam.zoom*.55};},sc.aim);
  await page.mouse.move(at.x,at.y);await page.mouse.down();await page.waitForTimeout(sc.settle);
  const png=await page.screenshot({clip,type:'png'});await page.mouse.up();
  const jpg=await scaler.evaluate(async([b64,w,h])=>{const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);return c.toDataURL('image/jpeg',.84).split(',')[1];},[png.toString('base64'),SIZE.width,SIZE.height]);
  fs.writeFileSync(path.join(out,'mode-'+id+'.jpg'),Buffer.from(jpg,'base64'));console.log('shot mode-'+id+'.jpg');await page.close();}
 await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});

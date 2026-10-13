'use strict';
// Plays the opening (blackout/intro.js) in the real desktop window and measures how it ran: how evenly the screen was
// redrawn in each part of the film, how long the page's main thread was held up, when the game finished loading
// behind it, and whether the film's sound was scheduled in time. Run it after changing the opening or what loads at
// start-up:
//   node blackout/qa/intro-check.cjs            in a 1366x768 window, sound off
//   node blackout/qa/intro-check.cjs --full     full screen, as the game is played
//   node blackout/qa/intro-check.cjs --sound    with its sound on
// Exits with status 1 if the film stuttered (more than 3% of a part's frames late, or a gap over a tenth of a second),
// if its sound was not all scheduled, or if the hand-over to the menu did not happen.
const {_electron:electron}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),full=process.argv.includes('--full'),loud=process.argv.includes('--sound');
// The game starts loading as the film goes dark for the explosions; the hold is not part of the film.
const PARTS=[['rain and lightning',.3,5.6],['explosions in the dark',5.6,8],['the swell and the wreck',8,10.8],['emblem and name',10.8,13.3],['hold (not judged)',13.3,15.8]];
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bp-intro-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[path.join(root,'electron','main.js'),...(full?[]:['--windowed']),'--intro','--disable-features=CalculateNativeWinOcclusion','--user-data-dir='+dir],cwd:root,env}),page=await app.firstWindow();let bad=0;
 // The window keeps drawing even if another one is in front of it, and nothing here waits on a frame being drawn.
 const wait=(fn,timeout=30000)=>page.waitForFunction(fn,null,{timeout,polling:100});
 try{
  await wait(()=>!!window.BPIntro);
  await page.evaluate(loud=>{localStorage.setItem('blackout-protocol-progress',JSON.stringify({version:3,drill:true,settings:{muted:!loud,music:false,voice:false}}));},loud);
  const cdp=await page.context().newCDPSession(page),events=[];cdp.on('Tracing.dataCollected',e=>events.push(...e.value));
  await cdp.send('Tracing.start',{transferMode:'ReportEvents',traceConfig:{includedCategories:['disabled-by-default-devtools.timeline.frame','devtools.timeline','blink.user_timing']}});
  await page.addInitScript(()=>{window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([e.startTime,e.duration]);}).observe({entryTypes:['longtask']});});
  await page.reload({waitUntil:'commit'});
  await wait(()=>!!window.BPIntro&&!!BPIntro.clock&&BPIntro.clock()>=0);
  const at=async s=>{for(;;){const t=await page.evaluate(()=>BPIntro.clock());if(t>=s)return;await page.waitForTimeout(Math.min(300,Math.max(20,(s-t)*1000)));}};
  await at(12.9);const heard=await page.evaluate(()=>BPIntro.heard());
  await at(15.8);const state=await page.evaluate(()=>({cls:document.getElementById('intro').className,loadedAt:window.__loadedAt}));
  const sync=await page.evaluate(()=>{performance.mark('bp-sync');return {clock:BPIntro.clock(),now:performance.now(),long:window.__long};});
  await page.keyboard.press('Enter');await wait(()=>!document.getElementById('intro'),5000).catch(()=>{});
  const after=await page.evaluate(()=>({gone:!document.getElementById('intro'),active:BPIntro.active,mode:window.BPApp&&BPApp.snapshot().mode,title:getComputedStyle(document.querySelector('.menu-content h1')).visibility}));
  const win=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return w.isMinimized()?'minimised':!w.isVisible()?'hidden':'';});
  const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;
  // Frames the compositor drew, placed on the film's clock by the mark made at a known moment of it.
  const mark=events.find(e=>e.name==='bp-sync'),t0=mark?mark.ts-sync.clock*1e6:0,draws=events.filter(e=>e.name==='DrawFrame').map(e=>(e.ts-t0)/1e6).sort((a,b)=>a-b);
  const size=await page.evaluate(()=>innerWidth+'x'+innerHeight+' at '+devicePixelRatio+'x');console.log(`\nOpening, ${size}, ${loud?'sound on':'sound off'}`);
  if(win){console.log('  the window was '+win+' during the run, so nothing was drawn: leave it on screen and run this again');bad++;}
  else if(!mark||draws.length<100){console.log('  no frame timings were recorded ('+draws.length+' frames, mark '+(mark?'found':'missing')+')');bad++;}
  else for(const [name,from,to] of PARTS){const f=draws.filter(t=>t>=from&&t<to),gaps=f.slice(1).map((t,i)=>(t-f[i])*1000),late=gaps.filter(g=>g>25).length,worst=Math.max(0,...gaps),fps=f.length/(to-from),ok=/not judged/.test(name)||f.length>10&&late<=gaps.length*.03&&worst<=100;if(!ok)bad++;
   console.log(`  ${name.padEnd(24)} ${fps.toFixed(0).padStart(3)} frames a second, ${String(late).padStart(3)} of ${String(gaps.length).padStart(3)} late, longest gap ${worst.toFixed(0).padStart(4)} ms  ${ok?'':'<- stutter'}`);}
  const filmStart=sync.now-sync.clock*1000,busy=sync.long.map(([s,d])=>[(s-filmStart)/1000,d]).filter(([s])=>s>0&&s<13);
  console.log(`  main thread held up ${busy.length} times in the film for ${Math.round(busy.reduce((n,x)=>n+x[1],0))} ms in all: ${busy.map(([s,d])=>s.toFixed(1)+'s '+Math.round(d)+'ms').join(', ')||'never'}`);
  console.log(`  sound: ${heard.audio}, ${heard.samples} of 11 samples decoded, ${heard.played} of ${heard.cues} cues scheduled by 12.9s`);if(loud&&(heard.audio!=='running'||heard.played<heard.cues)){console.log('  <- sound incomplete');bad++;}
  console.log(`  at 15.8s: ${/ready/.test(state.cls)?'game loaded, waiting for a button':'game still loading'} (${state.cls})`);if(!/ready/.test(state.cls))bad++;
  console.log(`  after the press: ${after.gone&&!after.active&&after.title==='visible'?'handed over to the '+after.mode:'DID NOT hand over '+JSON.stringify(after)}`);if(!(after.gone&&!after.active&&after.title==='visible'))bad++;
 }finally{await app.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});}
 console.log(bad?`\n${bad} problem${bad===1?'':'s'}`:'\nThe opening ran clean.');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});

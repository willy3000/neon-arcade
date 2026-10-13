'use strict';
// Measures how large every piece of interface text is actually drawn, screen by screen, and takes a picture of each.
// The interface is laid out for 1366x768 and zoomed to the window (see fitScreens in game.js), so the size that matters
// is the font size multiplied by that zoom: the height in real pixels on the display. The default window is 1920x1080,
// a television seen from a sofa, where text under about 18 real pixels is hard to read.
//   node blackout/qa/type-audit.cjs                     every screen, 1920x1080, pictures in blackout/qa/type-audit/
//   node blackout/qa/type-audit.cjs --out <dir>         pictures somewhere else
//   node blackout/qa/type-audit.cjs --size 1366x768     another window size
//   node blackout/qa/type-audit.cjs --min 18            the size in real pixels (at 1080p) below which text is reported
//   node blackout/qa/type-audit.cjs menu armory         only the screens whose names start that way
// Exits with status 1 if any text is under the minimum, is cut off, or runs outside the window.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),args=process.argv.slice(2),opt=(name,def)=>{const i=args.indexOf('--'+name);return i<0?def:args.splice(i,2)[1];};
const out=path.resolve(opt('out',path.join(root,'blackout/qa/type-audit'))),[W,H]=opt('size','1920x1080').split('x').map(Number),MIN=Number(opt('min',18)),only=args;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(d);});});
// Runs in the page: every element that draws text of its own and can be seen, with the size it is drawn at.
// Sizes are given as they would be on a 1920x1080 screen, so the report reads the same whatever window the audit ran in.
function measure([min,W,H]){
 const to1080=1/Math.min(W/1920,H/1080),vw=innerWidth,vh=innerHeight,small=new Map(),cut=[],outside=[];
 const name=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):'');
 const where=el=>{const p=el.parentElement;return (p&&p!==document.body?name(p)+' > ':'')+name(el);};
 const shown=el=>{if(!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;for(let n=el;n;n=n.parentElement)if(Number(getComputedStyle(n).opacity)<.05)return false;return true;};
 // The part of an element's box that its scrolling or clipping ancestors leave showing (null if none of it is).
 const visible=el=>{let {left,top,right,bottom}=el.getBoundingClientRect();for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){const s=getComputedStyle(n);if(s.overflowX==='visible'&&s.overflowY==='visible')continue;const b=n.getBoundingClientRect();left=Math.max(left,b.left);top=Math.max(top,b.top);right=Math.min(right,b.right);bottom=Math.min(bottom,b.bottom);if(right-left<1||bottom-top<1)return null;}return {left,top,right,bottom};};
 for(const el of document.querySelectorAll('body *')){
  if(el.closest('#game,script,style,noscript,[aria-hidden="true"]:not(#threats)')&&!el.closest('.map-art'))continue;
  const own=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');
  const field=el.matches('input[type=text],select')?(el.value||el.placeholder||''):'';const text=own||field;if(!text||!shown(el))continue;
  const r=el.getBoundingClientRect(),v=visible(el);if(r.width<1||r.height<1||!v)continue;
  const s=getComputedStyle(el),svg=el instanceof SVGElement,scale=svg?r.height/Math.max(1,el.getBBox().height):(el.currentCSSZoom||1),px=parseFloat(s.fontSize)*scale*to1080;
  if(px<min){const k=where(el),e=small.get(k)||{px,n:0,text};e.n++;e.px=Math.min(e.px,px);small.set(k,e);}
  // Cut off: an ellipsis or a hidden overflow is eating part of the words.
  if(!svg&&s.overflowX!=='visible'&&el.scrollWidth>el.clientWidth+1&&!el.matches('input'))cut.push(where(el)+'  "'+text.slice(0,40)+'"');
  if(v.right>vw+2||v.left<-2||v.bottom>vh+2||v.top<-2)outside.push(where(el)+'  "'+text.slice(0,40)+'"');}
 // Panels that have to be scrolled to be read in full: worth knowing, not a fault in themselves.
 const scrolls=[...document.querySelectorAll('body *')].filter(el=>shown(el)&&!el.closest('#game')&&/(auto|scroll)/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+2).map(el=>name(el)+' '+el.clientHeight+' of '+el.scrollHeight);
 return {small:[...small].map(([k,e])=>({where:k,px:Math.round(e.px*10)/10,n:e.n,text:e.text.slice(0,44)})).sort((a,b)=>a.px-b.px),cut:[...new Set(cut)],outside:[...new Set(outside)],scrolls};}
const SAVE={version:3,drill:true,settings:{volume:0,music:false,voice:false,difficulty:'standard',callsign:'ROOK',fill:true}};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/blackout-protocol.html?qa&credits=99999`,browser=await chromium.launch();fs.mkdirSync(out,{recursive:true});
 let bad=0;const totals=new Map();
 // lan: pretend the desktop build's LAN play is there, so the lobby shows its host and join controls as the game does.
 async function open(save={},lan=false){const ctx=await browser.newContext({viewport:{width:W,height:H}}),page=await ctx.newPage();if(lan)await page.addInitScript(()=>{window.BPNet=new Proxy({available:true,relayUrl:''},{get:(t,k)=>k in t?t[k]:()=>new Promise(()=>{})});});
  await page.addInitScript(s=>{navigator.getGamepads=()=>[];if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('blackout-protocol-progress',JSON.stringify(s));}},{...SAVE,...save,settings:{...SAVE.settings,...(save.settings||{})}});
  await page.goto(base);await page.waitForFunction(()=>document.getElementById('loading')?.hidden,{timeout:30000});await page.evaluate(()=>document.fonts.ready);return page;}
 async function shot(page,id){if(only.length&&!only.some(o=>id.startsWith(o)))return;await page.waitForTimeout(350);
  const m=await page.evaluate(measure,[MIN,W,H]);await page.screenshot({path:path.join(out,id+'.png')});
  const faults=m.small.length+m.cut.length+m.outside.length;bad+=faults;
  console.log(`\n== ${id}  ${faults?faults+' to fix':'ok'}`);
  for(const s of m.small){console.log(`   ${String(s.px).padStart(5)}px  x${s.n}  ${s.where}  "${s.text}"`);totals.set(s.where,Math.min(s.px,totals.get(s.where)||99));}
  for(const c of m.cut)console.log('   CUT OFF  '+c);for(const c of m.outside)console.log('   OUTSIDE  '+c);for(const c of m.scrolls)console.log('   scrolls  '+c);}
 const mode=(page,m)=>page.waitForFunction(m=>BPApp.snapshot().mode===m,m),want=(...ids)=>!only.length||ids.some(id=>only.some(o=>id.startsWith(o)));

 // Title screen, with and without the notice strip.
 let page;
 if(want('menu','ops','picker-weapon','settings','armory')){page=await open();await shot(page,'menu');
 await page.evaluate(()=>{document.getElementById('menu-notice').hidden=false;});await shot(page,'menu-notice');await page.evaluate(()=>{document.getElementById('menu-notice').hidden=true;});
 // Campaign board, the weapon picker over it, and settings (both control tabs).
 await page.click('#continue');await mode(page,'ops');await shot(page,'ops');
 await page.evaluate(()=>{document.getElementById('ops-bootcamp').hidden=false;});await shot(page,'ops-bootcamp');await page.evaluate(()=>{document.getElementById('ops-bootcamp').hidden=true;});
 await page.click('#loadout .slot');await page.waitForSelector('#picker[open]');await shot(page,'picker-weapon');await page.click('#picker-close');
 await page.click('#ops-settings');await page.waitForSelector('#settings[open]');await shot(page,'settings-keys');
 await page.evaluate(()=>{document.getElementById('settings').scrollTop=1e5;});await shot(page,'settings-keys-end');
 await page.click('#tab-pad');await page.evaluate(()=>{document.getElementById('settings').scrollTop=0;});await shot(page,'settings-pad');
 await page.evaluate(()=>{document.getElementById('settings').scrollTop=1e5;});await shot(page,'settings-pad-end');await page.click('#settings .close');
 // Armory, every tab.
 await page.click('#ops-armory');await mode(page,'armory');
 for(const tab of ['weapons','gear','support','perks','upgrades','record']){await page.click(`#armory-tabs [data-tab="${tab}"]`);await shot(page,'armory-'+tab);}
 await page.close();}
 // Lobbies: Holdout alone, then team deathmatch with its two teams, and the map picker.
 if(want('lobby-holdout','picker-maps')){page=await open({settings:{lobbyMode:'holdout',lobbyMap:'holdout'}});await page.click('#holdout');await mode(page,'lobby');await shot(page,'lobby-holdout');
 await page.click('#lobby-map');await page.waitForSelector('#picker[open]');await shot(page,'picker-maps');await page.click('#picker-close');await page.close();}
 if(want('lobby-holdout-lan')){page=await open({settings:{lobbyMode:'holdout',lobbyMap:'holdout'}},true);await page.click('#holdout');await mode(page,'lobby');await shot(page,'lobby-holdout-lan');await page.close();}
 // The fullest lobby there is: deathmatch on a desktop build, with the squad chat a linked match adds.
 if(want('lobby-tdm-lan')){page=await open({settings:{lobbyMode:'tdm',lobbyMap:'holdout'}},true);await page.click('#holdout');await mode(page,'lobby');await shot(page,'lobby-tdm-lan');
  await page.evaluate(()=>{document.getElementById('lobby-comms').hidden=false;document.getElementById('lobby-feed').innerHTML='<p class="sys">VIPER JOINED THE LOBBY</p><p><b>VIPER</b>ready when you are, taking the shotgun this time</p>';});await shot(page,'lobby-tdm-lan-chat');await page.close();}
 if(want('lobby-tdm','hud-tdm','ending-tdm')){page=await open({settings:{lobbyMode:'tdm',lobbyMap:'holdout'}});await page.click('#holdout');await mode(page,'lobby');await shot(page,'lobby-tdm');
 // Team deathmatch in play: score, kill feed, then its debrief.
 await page.click('#lobby-go');await mode(page,'playing');await page.waitForTimeout(9000);await shot(page,'hud-tdm');
 // The operator stood in the bottom corners of the map, where the readouts are: he has to stay in plain view.
 for(const side of ['left','right']){await page.evaluate(side=>{const s=BPQA.sim(),p=s.player,C=BPCore;for(let d=40;d<400;d+=20){const x=side==='left'?d:s.map.width-d,y=s.map.height-d;if(C.clearAt(s,x,y,20)){Object.assign(p,{x,y,vx:0,vy:0,health:100,dead:false});break;}}},side);await page.waitForTimeout(1500);await shot(page,'hud-tdm-corner-'+side);}
 await page.evaluate(()=>BPQA.end({type:'complete',tdm:true,winner:0,score:[30,21]}));await page.waitForSelector('#ending:not([hidden])');await page.waitForTimeout(2500);await shot(page,'ending-tdm');await page.close();}
 // A campaign run: the HUD as it opens, every transient message at once, pause, and both endings.
 if(want('hud','hud-messages','hud-banner','pause','ending-debrief')&&!(only.length&&only.every(o=>o.startsWith('hud-tdm')))){page=await open();await page.click('#continue');await mode(page,'ops');await page.click('#deploy');await mode(page,'playing');await page.waitForTimeout(2500);await shot(page,'hud');
 await page.evaluate(()=>{const $=id=>document.getElementById(id),s=BPQA.sim();
  $('radio-speaker').textContent='COMMAND';$('radio-text').textContent='Rook, your beacon is live. Hostiles are converging on the wreck. Get to the radio before they do.';$('radio').hidden=false;
  $('interact-prompt').hidden=false;$('boss').hidden=false;$('boss-name').textContent='THE WARDEN';$('boss-note').textContent='ARMOR PLATING INTACT';
  $('toast').textContent='CHECKPOINT SECURED';$('toast').style.opacity='1';$('combo-mult').textContent='x3 COMBO';$('flow').textContent='PERFECT FLOW';
  $('support-name').textContent='UAV SWEEP';$('support-key').textContent='V';$('net-ping').textContent='PING 24 MS';});
 // The game hides these again on its next frame, so they are held open with a style for the picture.
 const held=await page.addStyleTag({content:'#boss[hidden],#support-row[hidden],#objective-progress[hidden],#net-ping[hidden]{display:block!important}#support-row[hidden]{display:grid!important}#interact-prompt[hidden]{display:flex!important}#toast{opacity:1!important}'});
 await shot(page,'hud-messages');
 await held.evaluate(el=>el.remove());
 await page.evaluate(()=>{const $=id=>document.getElementById(id);$('banner-eyebrow').textContent='OBJECTIVE COMPLETE';$('banner-title').textContent='RADIO RECOVERED';$('banner-sub').textContent='+250 CR · NO DAMAGE TAKEN';$('banner').classList.add('show');});
 await shot(page,'hud-banner');await page.evaluate(()=>document.getElementById('banner').classList.remove('show'));
 await page.keyboard.press('Escape');await page.waitForSelector('#pause:not([hidden])');await shot(page,'pause');await page.click('#resume');
 await page.evaluate(()=>BPQA.end({type:'complete',rating:'A',score:4200,time:312}));await page.waitForSelector('#ending:not([hidden])');await page.waitForTimeout(4000);await shot(page,'ending-debrief');await page.close();}
 if(want('ending-dead')){page=await open();await page.click('#continue');await mode(page,'ops');await page.click('#deploy');await mode(page,'playing');await page.waitForTimeout(1500);
 await page.evaluate(()=>BPQA.end({type:'dead'}));await page.waitForSelector('#ending:not([hidden])');await page.waitForTimeout(1500);await shot(page,'ending-dead');await page.close();}

 console.log(`\n${W}x${H}, minimum ${MIN}px at 1080p: ${bad?bad+' findings':'all text passes'}`);
 if(totals.size){console.log('\nSmallest text, all screens:');for(const [k,v] of [...totals].sort((a,b)=>a[1]-b[1]).slice(0,400))console.log(`   ${String(v).padStart(5)}px  ${k}`);}
 await browser.close();server.close();process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});

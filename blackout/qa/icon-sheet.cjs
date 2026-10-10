'use strict';
// Renders every BPIcons drawing on dark and ground-coloured tiles for visual review.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const b=await chromium.launch(),page=await b.newPage({viewport:{width:1400,height:900}});const src=fs.readFileSync(path.join(__dirname,'../icons.js'),'utf8'),world=fs.readFileSync(path.join(__dirname,'../world.js'),'utf8'),missions=fs.readFileSync(path.join(__dirname,'../missions.js'),'utf8');
 await page.setContent(`<html><body style="margin:0;background:#151915;color:#ddd;font:10px monospace"><div id="o" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px"></div><script>${missions}${world}${src}
 const o=document.getElementById('o');const add=(kind,key,big)=>{const d=document.createElement('div');d.style.cssText='width:'+(big?220:96)+'px;padding:6px;background:'+(o.children.length%2?'#343b36':'#1d241d')+';text-align:center';d.innerHTML='<div style="height:'+(big?70:56)+'px;display:flex;align-items:center;justify-content:center">'+BPIcons.svg(kind,key).replace('<svg','<svg style="max-width:100%;height:100%"')+'</div>'+key;o.append(d);};
 for(const k of Object.keys(BPWorld.weapons))add('weapon',k,true);for(const k of Object.keys(BPWorld.gear))add('gear',k);for(const k of ['health','armor','ammo','intel','cache','gadget','stim'])add('pickup',k);for(const k of Object.keys(BPWorld.upgrades))add('upgrade',k);</script></body></html>`);
 await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'icon-sheet.png'),fullPage:true});await b.close();})();

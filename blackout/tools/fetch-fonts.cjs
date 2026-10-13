'use strict';
// Downloads the three typefaces the game uses (latin subset, woff2) from Google Fonts into blackout/assets/fonts/ and
// writes blackout/fonts.css with matching @font-face rules. Needs an internet connection. Usage: node blackout/tools/fetch-fonts.cjs
const fs=require('fs'),path=require('path'),repo=process.argv[2]||path.resolve(__dirname,'../..'),out=path.join(repo,'blackout/assets/fonts');
const URL_='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
(async()=>{const css=await (await fetch(URL_,{headers:{'User-Agent':UA}})).text();
 // Each block is preceded by a comment naming its subset; keep only "latin".
 const blocks=[...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face\s*\{([^}]+)\}/g)].filter(m=>m[1]==='latin').map(m=>m[2]);
 if(!blocks.length)throw new Error('no latin blocks in the stylesheet:\n'+css.slice(0,400));
 fs.mkdirSync(out,{recursive:true});const rules=[],seen=new Map();
 for(const b of blocks){const get=k=>(b.match(new RegExp(k+':\\s*([^;]+);'))||[])[1],family=get('font-family').replace(/['"]/g,''),weight=get('font-weight'),style=get('font-style'),url=b.match(/url\(([^)]+)\)/)[1],range=get('unicode-range');
  // Inter and other variable fonts serve one file for every weight: download it once and reuse it.
  let name=seen.get(url);if(!name){name=family.toLowerCase().replace(/\s+/g,'-')+'-'+(css.split(url).length>2?'variable':weight)+'.woff2';const buf=Buffer.from(await (await fetch(url,{headers:{'User-Agent':UA}})).arrayBuffer());if(buf.length<2000||buf.toString('latin1',0,4)!=='wOF2')throw new Error('not a woff2: '+url);fs.writeFileSync(path.join(out,name),buf);seen.set(url,name);console.log('saved',name,buf.length,'bytes');}
  rules.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('assets/fonts/${name}') format('woff2');unicode-range:${range}}`);}
 fs.writeFileSync(path.join(repo,'blackout/fonts.css'),'/* The game\'s three typefaces, bundled so it looks the same with no internet connection. Latin subset, from Google Fonts;\n   all three are under the SIL Open Font License 1.1 (see assets/licenses/fonts-OFL.txt). Regenerate with the script named in ASSET_MANIFEST.md. */\n'+rules.join('\n')+'\n');
 console.log(rules.length,'rules,',seen.size,'files');})().catch(e=>{console.error('FAILED',e.message);process.exit(1);});

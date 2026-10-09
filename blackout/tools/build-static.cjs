'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('./verify-static.cjs');
const root=path.resolve(__dirname,'../..'),output=path.resolve(root,'dist'),marker=path.join(output,'.blackout-static-build');
assert(output===path.join(root,'dist')&&output.startsWith(root+path.sep),'Output must remain inside this workspace');
if(fs.existsSync(output)){assert(fs.existsSync(marker),'Refusing to replace an unrelated dist directory');fs.rmSync(output,{recursive:true,force:true});}
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(marker,'Generated static NEON ARCADE site; safe to rebuild.\n');
let count=0,bytes=0;const skipped=new Set(['source','qa','tools','tests','node_modules','.git']);
const extensions=new Set(['.html','.css','.js','.json','.png','.jpg','.svg','.ogg','.wav','.mp3','.woff','.woff2','.txt','.md','.glb','.gltf','.bin']);
function copy(relative){const source=path.join(root,relative),dest=path.join(output,relative),stat=fs.statSync(source);if(stat.isDirectory()){if(skipped.has(path.basename(source)))return;for(const item of fs.readdirSync(source))copy(path.join(relative,item));}else if(extensions.has(path.extname(source))){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);count++;bytes+=stat.size;}}
for(const name of fs.readdirSync(root)){if(/\.(html|css|js)$/.test(name))copy(name);}
for(const folder of ['blackout','bloodoath','wildfall','afterstrike','riftbreakers','phasebound','gravity','echo'])copy(folder);
for(const game of ['blood-oath','wildfall','blackout-protocol','afterstrike','riftbreakers','phasebound','gravity-heist','echo-forge','neon-rush'])assert(fs.existsSync(path.join(output,game+'.html')),`Missing legacy route: ${game}`);
assert(!fs.existsSync(path.join(output,'node_modules')));assert(!fs.existsSync(path.join(output,'blackout/assets/source')));assert(fs.existsSync(path.join(output,'wildfall/vendor/three.bundle.min.js')));assert(fs.existsSync(path.join(output,'wildfall/assets/characters/hero-anims.glb')));assert(!fs.existsSync(path.join(output,'wildfall/tests')));assert(fs.existsSync(path.join(output,'bloodoath/main.js')));assert(fs.existsSync(path.join(output,'bloodoath/assets/music/battle-theme-a.mp3')));assert(!fs.existsSync(path.join(output,'bloodoath/tests')));
console.log(`Static site prepared in dist/: ${count} files, ${(bytes/1024/1024).toFixed(2)} MiB. All nine game URLs preserved. Deploy this folder with Netlify or any static host.`);

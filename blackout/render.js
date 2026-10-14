(function(root){'use strict';
 const C={asphalt:0x343b36,curb:0x727568,concrete:0x60665a,roof:0x4b5547,edge:0x879078,shadow:0x111b15,amber:0xe2b074,red:0xd3846c,paper:0xd4debf,cyan:0x8fe3ff};
 const THEMES={
  city:{ground:0x343b36,specks:[0x91a38a,0x19261e],road:0x28332c,alt:0x3a4436,mark:0x2f3a31,roof:0x4b5547,edge:0x879078,curb:0x727568,wall:0x313f31,rock:0x4a5145,rockTop:0x6a7362,water:0x2c3a3c},
  ruins:{ground:0x3a3631,specks:[0xa39a8a,0x1d1a17],road:0x2c2925,alt:0x4a4339,mark:0x34302a,roof:0x554e45,edge:0x8e8474,curb:0x7a7266,wall:0x3a342e,rock:0x5a5148,rockTop:0x7d7365,water:0x2d3330,tint:[0xc06a3a,.07]},
  snow:{ground:0x6b7880,specks:[0xc9d5da,0x48545c],road:0x56626a,alt:0x7d8b93,mark:0x5f6b73,roof:0x48525a,edge:0xa9bac2,curb:0x8c9aa2,wall:0x384147,rock:0x3b444a,rockTop:0xc4d0d6,water:0x9fb7c4,tint:[0x6c86a8,.08]},
  subway:{ground:0x2b2c2f,specks:[0x6b6d72,0x141517],road:0x202124,alt:0x37383c,mark:0x2a2b2e,roof:0x1a1b1d,edge:0x46484c,curb:0x55575c,wall:0x161719,rock:0x3c3e42,rockTop:0x5d5f64,water:0x1f3238},
  desert:{ground:0x76644a,specks:[0xb39d74,0x4e412c],road:0x3b3934,alt:0x86724f,mark:0x45413b,roof:0x6b5b42,edge:0xa89069,curb:0x8d7a5b,wall:0x5c4d37,rock:0x6b573d,rockTop:0x9c8460,water:0x3e5550,tint:[0xd39a52,.06]},
  rain:{ground:0x2e3740,specks:[0x7d8fa0,0x161d24],road:0x232b33,alt:0x343e48,mark:0x2a333c,roof:0x3a4550,edge:0x6f8496,curb:0x5c6d7c,wall:0x222a31,rock:0x3d4852,rockTop:0x627382,water:0x1d2c38,tint:[0x4a6a90,.1]},
  citadel:{ground:0x33302f,specks:[0x8a8380,0x191716],road:0x272423,alt:0x3e3a38,mark:0x2d2a29,roof:0x1f1d1c,edge:0x6b625e,curb:0x5a5350,wall:0x1a1817,rock:0x403b39,rockTop:0x6c6461,water:0x22292b,accent:0xc0473a,tint:[0x9a3a30,.05]},
  facility:{ground:0x384047,specks:[0x8d9aa4,0x1d2328],road:0x2c3339,alt:0x434c54,mark:0x30373d,roof:0x272e33,edge:0x6f8290,curb:0x5f6f7a,wall:0x20272c,rock:0x45515a,rockTop:0x6f7f8a,water:0x24363f,accent:0x6fd0e8}};
 // Supply crates by grade (Meta.RARITY order), what each sells shown as, and its short name.
 const RARITY_COL=[0xb9c2a8,0x8fd07a,0x6fb4f0,0xb68cf0,0xf4c04e],RARITY_HEX=['#d3dbc7','#b3e6a4','#a9d3f8','#d4b8f8','#f8d784'];
 const OFFER_ICON={ammo:'p:ammo',armor:'p:armor',health:'p:health',stim:'p:stim',gadgets:'p:gadget',sentry:'s:turret',barricade:'g:cover',partner:'s:reinforce',hollow:'u:bandolier',charge:'s:blackout',repair:'u:plating',thermal:'g:sensor'};
 const OFFER_NAME={ammo:'AMMO',armor:'ARMOUR',health:'HEALTH',stim:'STIM',gadgets:'GADGETS',sentry:'SENTRY',barricade:'FORTIFY',partner:'PARTNER KIT',hollow:'HOLLOW POINTS',charge:'SUPPORT CHARGE',repair:'REBUILD COVER',thermal:'THERMAL'};
 // What each kind of hostile wears on its head, seen from above: the first thing that tells a medic from a rifleman.
 // Shape does as much of the work as colour (a brim, a visor, a stripe, a cross, a ghillie hood), so it reads for
 // colour-blind players too. Drawn in the body's frame (facing +x), on the helmet.
 const HEAD={voss:{c:0x26292f,r:7.5,beret:true,badge:0xd8ac4a},infantry:{c:0x5d6646,r:7},rusher:{band:0xc0473a},scout:{c:0xb4a36f,r:6.2,brim:true},breacher:{c:0x2f332c,r:8,visor:0x8fa3ad},sniper:{ghillie:true},deadeye:{ghillie:true},
  shield:{c:0x39434d,r:8,visor:0x9fb4c0},grenadier:{c:0x5d6646,r:7,stripe:0xe08a3c},gunner:{c:0x34382c,r:8.5},rocketeer:{c:0x5d6646,r:7,stripe:0xe08a3c},medic:{c:0xeeebe2,r:7.5,cross:0xc8463a},
  mortar:{c:0x5d6646,r:7,stripe:0xe08a3c},engineer:{c:0xe3b544,r:7,brim:true},jammer:{c:0x3c4650,r:7,headset:0x8fe3ff},heavy:{c:0x1d1f1e,r:9.5,visor:0xd8503e},elite:{c:0x5c6a73,r:7.5,visor:0x8fe3ff},
  commander:{c:0x7a2f2c,r:7.5,beret:true,badge:0xe2b074},ghost:{c:0x2a3136,r:7}};
 // A small sign above the hostiles that change a fight, so they can be picked out of a crowd and dealt with first:
 // a cross for the medic, a scope for marksmen, a fused bomb for anything that lobs explosives, a hexagon for the
 // engineer, a zigzag for anything that jams or spots, a diamond for the juggernaut, and a chevron for a veteran.
 // How much room each hostile's drawing takes, so its portrait fills the frame (soldiers are about 60 across).
 const PORTRAIT_SPAN={shield:70,gunner:66,rocketeer:96,heavy:74,mortar:78,commander:66,drone:66,bomber:46,spotter:50,turret:78,apc:138,mech:96,tank:132,wraith:66,ghost:58};
 const BADGE={medic:'cross',sniper:'scope',deadeye:'scope',grenadier:'blast',mortar:'blast',rocketeer:'blast',engineer:'hex',jammer:'signal',spotter:'signal',heavy:'diamond'};
 // Gameplay colours that must stay distinct: C.red (hostiles, their marks and the warnings of a locked-on attack),
 // C.amber (your own marks and an ordinary wind-up) and C.cyan (machines, EMP, allies' devices). Each palette in
 // settings swaps the three in place (Render.palette), so everything drawn with them follows. The colour-safe sets are
 // from the Okabe-Ito palette; telegraphs also differ by shape and thickness, so none relies on colour alone.
 const PALETTES={standard:{red:0xd3846c,amber:0xe2b074,cyan:0x8fe3ff},redgreen:{red:0xd55ec8,amber:0xf0e442,cyan:0x56b4e9},blueyellow:{red:0xff4b5c,amber:0xff9ec8,cyan:0x2bd9c1},contrast:{red:0xff3b30,amber:0xffd60a,cyan:0x64d2ff}};
 const TINTS={infantry:0xb2a797,rusher:0xb8a58e,sniper:0x8dafa1,shield:0xaaa58e,commander:0xc9aa89,scout:0x9fb08a,breacher:0x8e8d84,grenadier:0xa69278,gunner:0x9a8c7a,rocketeer:0x9e9c82,elite:0x8aa8b8,ghost:0x6f7d84,wraith:0x5a6670,medic:0xc9c4b8,mortar:0x9a9178,heavy:0x7b766c,engineer:0xbba66c,jammer:0x8c99a6,raider:0xc59a86,striker:0xc9a078,deadeye:0xb98f9a,voss:0x8d919c};
 const PICKUP={health:0x5c7155,armor:0x526559,ammo:0x797153,lethal:0x6b6a4a,tactical:0x4f6670,intel:0x8a7340,cache:0x9a8240,supply:0x5c7155};
 class Render {
  constructor(scene){this.scene=scene;this.staticObjects=[];this.actors=new Map();this.props=new Map();this.particles=Array.from({length:360},()=>({active:false}));this.flashes=[];this.decals=[];this.cameraX=0;this.cameraY=0;this.lastMap=null;this.hurt=[];this.hitMark=0;this.killMark=0;this.weather=[];
   this.effects=scene.add.graphics().setDepth(11000);this.lines=scene.add.graphics().setDepth(10900);this.decalsGraphics=scene.add.graphics().setDepth(2);this.smoke=scene.add.graphics().setDepth(11500);this.uiGraphics=scene.add.graphics().setScrollFactor(0).setDepth(20000);
   this.crosshair=scene.add.graphics().setScrollFactor(0).setDepth(20010);this.brush=scene.make.graphics({x:0,y:0,add:false});this.dark=null;
   this.sprites=new Map();this.landed=new Set();this.frame=0;this.labels=Array.from({length:6},()=>scene.add.text(0,0,'',{fontFamily:'IBM Plex Mono, Consolas, monospace',fontSize:'13px',fontStyle:'600',color:'#f4cf8e',stroke:'#0b0f0a',strokeThickness:3}).setOrigin(.5,1).setDepth(12001).setVisible(false));
   // Squads: a callsign over each operator, and the caption under the revive station.
   const small=(size,color)=>scene.add.text(0,0,'',{fontFamily:'IBM Plex Mono, Consolas, monospace',fontSize:size,fontStyle:'600',color,stroke:'#0b0f0a',strokeThickness:3}).setDepth(12001).setVisible(false);
   this.nameTags=Array.from({length:8},()=>small('13px','#8fe3ff').setOrigin(.5,1));this.stationLabel=small('13px','#9fd08a').setOrigin(.5,0).setText('REVIVE STATION');
   this.texts=Array.from({length:14},()=>({obj:scene.add.text(0,0,'',{fontFamily:'IBM Plex Mono, Consolas, monospace',fontSize:'15px',fontStyle:'600',color:'#e2b074',stroke:'#10150f',strokeThickness:3}).setOrigin(.5).setDepth(12000).setVisible(false),life:0}));
   this.textK=1;this.areaLabels=[];
  }
  // Text on the battlefield is sized for the 1366x768 the interface is drawn for and grows with a larger window, as the
  // HUD does (game.js passes its --hud-scale), so a callsign or a price can be read on a television.
  // The camera may travel past the top and bottom of the map by the height of the HUD strips there, so the edge of a
  // map can be brought clear of them and an operator standing at it is never underneath.
  bounds(){const map=this.map,cam=this.scene.cameras.main;if(!map)return;const k=this.textK/cam.zoom,top=Math.round(66*k),bottom=Math.round(96*k);cam.setBounds(0,-top,map.width,map.height+top+bottom);}
  textScale(k){this.textK=k;this.bounds();const set=(t,px)=>t.setFontSize(Math.round(px*k)+'px').setStroke(t.style.stroke,Math.round(3*k));
   for(const t of [...this.labels,...this.nameTags,this.stationLabel])set(t,13);for(const q of this.texts)set(q.obj,15);for(const t of this.areaLabels)t.setFontSize(Math.round(13*k)+'px');}
  clear(){for(const obj of this.staticObjects)obj.destroy();this.staticObjects=[];for(const a of this.actors.values())for(const obj of Object.values(a))if(obj?.destroy)obj.destroy();this.actors.clear();this.props.clear();this.decals=[];this.flashes=[];this.hurt=[];for(const p of this.particles)p.active=false;for(const t of this.texts){t.life=0;t.obj.setVisible(false);}for(const o of this.sprites.values())o.destroy();this.sprites.clear();for(const l of [...this.labels,...this.nameTags,this.stationLabel])l.setVisible(false);this.decalsGraphics.clear();this.effects.clear();this.lines.clear();this.smoke.clear();this.uiGraphics.clear();this.crosshair.clear();if(this.dark){this.dark.destroy();this.dark=null;}}
  static preload(scene){scene.load.atlas('characters','blackout/assets/characters.png','blackout/assets/characters.json');scene.load.atlas('props','blackout/assets/props.png','blackout/assets/props.json');scene.load.svg('helicopter','blackout/assets/helicopter.svg');if(root.BPIcons)BPIcons.load(scene);}
  // Pooled images for icon-textured world items; unused ones are destroyed at the end of each frame.
  sprite(id,key){if(!this.scene.textures.exists(key))return null;let o=this.sprites.get(id);if(!o){o=this.scene.add.image(0,0,key).setDepth(6);this.sprites.set(id,o);}else if(o.texture.key!==key)o.setTexture(key);o.used=this.frame;o.setVisible(true);return o;}
  sweep(){for(const [id,o] of this.sprites)if(o.used!==this.frame){o.destroy();this.sprites.delete(id);}}
  build(s,self=s.player){this.clear();this.lastMap=s.map.id;const scene=this.scene,g=scene.add.graphics().setDepth(0);this.staticObjects.push(g);const map=s.map,T=this.T=THEMES[map.theme]||THEMES.city;g.fillStyle(map.theme==='range'?C.asphalt:T.ground).fillRect(0,0,map.width,map.height);
   // Permanent wear is deterministic, baked once, and is not a frame-time effect.
   let seed=4103;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const specks=T.specks||[0x91a38a,0x19261e];for(let i=0;i<Math.round(map.width*map.height/1240);i++){const x=rand()*map.width,y=rand()*map.height;g.fillStyle(rand()>.5?specks[0]:specks[1],.1+rand()*.1).fillRect(x,y,1+rand()*4,1+rand()*2);}
   if(map.id==='crash'){
    g.fillStyle(0x28332c).fillRect(565,40,163,1730);g.fillStyle(0x28332c).fillRect(1300,40,335,1560);g.fillStyle(0x28332c).fillRect(40,390,2520,140);g.fillStyle(0x28332c).fillRect(520,1000,1795,185);g.fillStyle(0x3a4436).fillRect(1655,1310,660,470);
    g.lineStyle(2,0xa59d72,.4);for(let y=40;y<1800;y+=65){g.lineBetween(643,y,643,y+28);g.lineBetween(650,y,650,y+28);}for(let x=60;x<2500;x+=70)g.lineBetween(x,457,x+32,457);for(let y=80;y<1350;y+=80)g.lineBetween(1450,y,1450,y+35);
    g.lineStyle(2,0xb3b29a,.28);for(let x=1690;x<2290;x+=90){g.strokeRect(x,1350,75,100);g.strokeRect(x,1660,75,95);}
    for(const [x,y,vertical] of [[565,895,true],[1305,550,false],[1620,1005,true]]){g.fillStyle(0xb8b99c,.33);for(let i=0;i<6;i++)if(vertical)g.fillRect(x+i*23,y,13,98);else g.fillRect(x,y+i*22,125,12);}
    g.fillStyle(0x626750).fillRect(1288,420,27,160);g.fillStyle(0x454e35).fillRect(1294,426,15,145);g.fillStyle(0x656a51).fillRect(2290,1360,22,365);g.fillStyle(0x424e34).fillRect(2295,1365,13,350);
    for(let i=0;i<16;i++){const x=1297+rand()*10,y=430+rand()*145;g.fillStyle(0x7c8854,.6).fillCircle(x,y,3+rand()*8);}
    // Crashed aircraft, scorched rotor path, shattered street signs.
    g.fillStyle(0x15221a,.65).fillEllipse(345,570,375,290);g.fillStyle(0x282d20,.7).fillEllipse(355,575,280,215);g.lineStyle(8,0x202a21,.8);g.lineBetween(95,590,480,495);g.lineBetween(275,745,385,480);
    const heli=scene.add.image(260,570,'helicopter').setScale(.57).setRotation(-.7).setDepth(4).setTint(0xa1aa88);this.staticObjects.push(heli);
   }else if(map.id==='range'){
    g.fillStyle(0x4c5548).fillRect(60,300,840,840);g.lineStyle(1,0xa6b394,.13);for(let x=60;x<1740;x+=90)g.lineBetween(x,300,x,1200);for(let y=300;y<1200;y+=90)g.lineBetween(60,y,1740,y);
    g.lineStyle(3,C.amber,.35);g.strokeRect(1040,180,650,900);g.lineStyle(2,0x959d82,.5);for(let y=240;y<1100;y+=180){g.lineBetween(1050,y,1090,y);g.lineBetween(1050,y+90,1090,y+90);}g.fillStyle(0x242d23).fillRect(345,915,105,68);
   }else this.floors(g,map,T,rand);
   this.fires=map.fires||[];
   for(const b of s.walls){if(b.kind==='building')this.building(g,b,rand,T,map.theme);else if(b.kind==='rock')this.rock(g,b,rand,T,map.theme);else if(b.kind==='water')this.water(g,b,T,map.theme);else if(b.kind==='fence')this.fence(g,b);else this.prop(b);}
   for(const l of map.lights||[]){g.fillStyle(0xe8d9a2,.08).fillCircle(l.x,l.y,90);g.fillStyle(0xe8d9a2,.5).fillCircle(l.x,l.y,6);}
   for(let i=0;i<(s.training?100:300);i++){const x=rand()*map.width,y=rand()*map.height;if(s.walls.some(w=>(w.kind==='building'||w.kind==='rock')&&x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h))continue;g.fillStyle(specks[0],.2).fillRect(x,y,3+rand()*9,2+rand()*4);if(i%6===0){g.lineStyle(1,specks[1],.4);g.lineBetween(x,y,x+rand()*15,y+rand()*8);}}
   if(T.tint)g.fillStyle(T.tint[0],T.tint[1]).fillRect(0,0,map.width,map.height);
   // Bake thousands of floor/roof marks to one texture; keep interactive props separate.
   if(scene.textures.exists('battlefield'))scene.textures.remove('battlefield');
   g.generateTexture('battlefield',map.width,map.height);g.destroy();this.staticObjects=this.staticObjects.filter(o=>o!==g);
   this.staticObjects.push(scene.add.image(0,0,'battlefield').setOrigin(0).setDepth(0));
   this.areaLabels=[];for(const a of map.areas||[]){const text=scene.add.text(a.x,a.y,a.label,{fontFamily:'monospace',fontSize:Math.round(13*this.textK)+'px',color:map.theme==='snow'||map.theme==='desert'?'#2c3330':'#a9b499'}).setAlpha(.48).setDepth(1);this.staticObjects.push(text);this.areaLabels.push(text);}
   this.weather=[];const count=map.weather==='snow'?140:map.weather==='dust'?70:map.theme==='ruins'?45:0;for(let i=0;i<count;i++)this.weather.push({x:Math.random(),y:Math.random(),z:.4+Math.random()*.8,p:Math.random()*6});
   const cam=scene.cameras.main;cam.setBackgroundColor(map.theme==='subway'?'#0e0f11':'#252d24');this.map=map;this.bounds();this.cameraX=self.x;this.cameraY=self.y;cam.centerOn(this.cameraX,this.cameraY);
  }
  floors(g,map,T,rand){const color={road:T.road,alt:T.alt,mark:T.mark};
   for(const f of map.floors){g.fillStyle(color[f.type]||T.road).fillRect(f.x,f.y,f.w,f.h);
    if(f.type==='road'){if(map.theme==='subway'){const horiz=f.w>=f.h;g.fillStyle(0x3b3a37,.9);if(horiz){for(let x=f.x+8;x<f.x+f.w;x+=26)g.fillRect(x,f.y+f.h*.25,10,f.h*.5);g.lineStyle(3,0x7d7f84,.7).lineBetween(f.x,f.y+f.h*.35,f.x+f.w,f.y+f.h*.35).lineBetween(f.x,f.y+f.h*.65,f.x+f.w,f.y+f.h*.65);}else{for(let y=f.y+8;y<f.y+f.h;y+=26)g.fillRect(f.x+f.w*.25,y,f.w*.5,10);g.lineStyle(3,0x7d7f84,.7).lineBetween(f.x+f.w*.35,f.y,f.x+f.w*.35,f.y+f.h).lineBetween(f.x+f.w*.65,f.y,f.x+f.w*.65,f.y+f.h);}}
     else if(map.theme==='facility'){g.lineStyle(1,0x9fb6c4,.12);for(let x=f.x;x<f.x+f.w;x+=40)g.lineBetween(x,f.y,x,f.y+f.h);for(let y=f.y;y<f.y+f.h;y+=40)g.lineBetween(f.x,y,f.x+f.w,y);g.lineStyle(2,T.accent,.25).strokeRect(f.x+4,f.y+4,f.w-8,f.h-8);}
     else{g.lineStyle(2,map.theme==='desert'?0xd6c48e:0xa59d72,map.theme==='snow'?.18:.38);if(f.w>=f.h*1.5&&f.h>=120){const y=f.y+f.h/2;for(let x=f.x+20;x<f.x+f.w-30;x+=80)g.lineBetween(x,y,x+40,y);if(map.theme==='desert'){g.lineStyle(3,0xd6c48e,.35).lineBetween(f.x,f.y+10,f.x+f.w,f.y+10).lineBetween(f.x,f.y+f.h-10,f.x+f.w,f.y+f.h-10);}}else if(f.h>=f.w*1.5&&f.w>=120){const x=f.x+f.w/2;for(let y=f.y+20;y<f.y+f.h-30;y+=80)g.lineBetween(x,y,x,y+40);}}}
    if(f.type==='alt'){if(map.theme==='facility'||map.theme==='subway'){g.lineStyle(1,0xaab4bd,.08);for(let x=f.x;x<f.x+f.w;x+=40)g.lineBetween(x,f.y,x,f.y+f.h);for(let y=f.y;y<f.y+f.h;y+=40)g.lineBetween(f.x,y,f.x+f.w,y);}
     else if(map.theme==='desert'){g.lineStyle(2,0xa58e64,.25);for(let y=f.y+14;y<f.y+f.h;y+=22){g.beginPath();g.moveTo(f.x,y);for(let x=f.x;x<=f.x+f.w;x+=40)g.lineTo(x,y+Math.sin(x/60+y)*5);g.strokePath();}}
     else if(map.theme==='ruins'){for(let i=0;i<f.w*f.h/2600;i++)g.fillStyle(0x6a6052,.35).fillRect(f.x+rand()*f.w,f.y+rand()*f.h,3+rand()*10,2+rand()*6);}}}
   if(map.theme==='snow'){for(let i=0;i<70;i++){const x=rand()*map.width,y=rand()*map.height;g.fillStyle(0xd8e2e6,.12).fillEllipse(x,y,80+rand()*160,30+rand()*50);}}
   if(map.theme==='desert'){for(let i=0;i<60;i++){const x=rand()*map.width,y=rand()*map.height;g.fillStyle(0x9b8460,.18).fillEllipse(x,y,120+rand()*220,40+rand()*70);}}
   if(map.theme==='ruins'){for(let i=0;i<40;i++){const x=rand()*map.width,y=rand()*map.height;g.fillStyle(0x1a1714,.25).fillEllipse(x,y,40+rand()*90,20+rand()*40);}}}
  building(g,b,rand,T=THEMES.city,theme='city'){const big=b.w>240&&b.h>180;if(big){g.fillStyle(C.shadow,.55).fillRect(b.x+22,b.y+29,b.w,b.h);g.fillStyle(T.curb).fillRect(b.x-13,b.y-13,b.w+26,b.h+26);g.fillStyle(T.wall).fillRect(b.x,b.y,b.w,b.h);g.fillStyle(T.roof).fillRect(b.x+5,b.y+5,b.w-10,b.h-10);g.lineStyle(4,T.edge,.5).strokeRect(b.x+5,b.y+5,b.w-10,b.h-10);g.lineStyle(1,0xa6b59a,.13);for(let y=b.y+16;y<b.y+b.h-10;y+=15)g.lineBetween(b.x+12,y,b.x+b.w-12,y);
     const inner=b.w>600?3:2;if(theme!=='subway')for(let i=0;i<inner;i++){const x=b.x+35+(b.w-90)*i/inner,y=b.y+35;g.fillStyle(0x26352b,.6).fillRect(x+5,y+8,80,45);g.fillStyle(theme==='city'?0x68745f:T.curb).fillRect(x,y,80,42);g.lineStyle(2,T.edge,.45).strokeRect(x,y,80,42);g.fillStyle(T.wall).fillCircle(x+22,y+21,13);g.fillCircle(x+57,y+21,13);g.lineStyle(2,T.edge,.6);g.lineBetween(x+22,y+10,x+22,y+32);g.lineBetween(x+10,y+21,x+34,y+21);g.lineBetween(x+57,y+10,x+57,y+32);}
     if(b.h>300&&theme!=='subway'){g.fillStyle(T.wall).fillRect(b.x+40,b.y+b.h-150,b.w-90,100);g.lineStyle(2,T.edge,.4).strokeRect(b.x+40,b.y+b.h-150,b.w-90,100);g.lineStyle(1,0xa0ac88,.15);for(let y=b.y+b.h-141;y<b.y+b.h-55;y+=10)g.lineBetween(b.x+50,y,b.x+b.w-60,y);}
     g.fillStyle(0x1f3026,.5);for(let x=b.x+18;x<b.x+b.w-30;x+=50)g.fillRect(x,b.y+b.h-8,24,6);
     for(let i=0;i<12;i++)g.fillStyle(0x1c2e22,.18).fillRect(b.x+rand()*b.w,b.y+rand()*b.h,10+rand()*25,4+rand()*12);
     if(b.id==='b5'||b.id==='b9'||theme==='ruins'&&rand()>.4){g.lineStyle(4,0x203124,.7);g.beginPath();g.moveTo(b.x+b.w-80,b.y+2);g.lineTo(b.x+b.w-105,b.y+54);g.lineTo(b.x+b.w-60,b.y+95);g.lineTo(b.x+b.w-80,b.y+140);g.strokePath();}
     if(theme==='ruins')for(let i=0;i<3;i++){const x=b.x+20+rand()*(b.w-80),y=b.y+20+rand()*(b.h-80);g.fillStyle(0x15120f,.65).fillEllipse(x,y,40+rand()*60,30+rand()*40);g.fillStyle(0x6b5f50,.5).fillRect(x-10,y-4,20+rand()*16,8);}
     if(theme==='facility'){g.lineStyle(2,T.accent,.35).strokeRect(b.x+16,b.y+16,b.w-32,b.h-32);for(let x=b.x+40;x<b.x+b.w-40;x+=120)g.fillStyle(T.accent,.4).fillRect(x,b.y+b.h-20,30,4);}
     if(theme==='snow'){g.fillStyle(0xd3dde2,.55).fillRect(b.x+5,b.y+5,b.w-10,18);g.fillStyle(0xd3dde2,.25).fillRect(b.x+5,b.y+5,18,b.h-10);}
   }else{g.fillStyle(theme==='subway'?T.roof:0x212e23).fillRect(b.x,b.y,b.w,b.h);if(theme!=='city'&&theme!=='range')g.fillStyle(T.wall).fillRect(b.x,b.y,b.w,b.h);g.lineStyle(3,T.edge,.5).strokeRect(b.x,b.y,b.w,b.h);if(theme==='snow')g.fillStyle(0xd3dde2,.45).fillRect(b.x+2,b.y+2,b.w-4,Math.min(14,b.h-4));}}
  rock(g,b,rand,T,theme){if(theme==='subway'||theme==='facility'){g.fillStyle(C.shadow,.5).fillRect(b.x+6,b.y+8,b.w,b.h);g.fillStyle(T.rock).fillRect(b.x,b.y,b.w,b.h);g.lineStyle(2,T.edge,.6).strokeRect(b.x+3,b.y+3,b.w-6,b.h-6);if(b.w<=80&&b.h<=80){g.fillStyle(T.rockTop,.5).fillRect(b.x+8,b.y+8,b.w-16,b.h-16);}return;}
   const edge=b.w*b.h>40000;g.fillStyle(theme==='snow'?0x2b3237:0x1e1a14,.45).fillRect(b.x+7,b.y+9,b.w,b.h);g.fillStyle(T.rock).fillRect(b.x,b.y,b.w,b.h);
   const n=Math.max(2,Math.round(b.w*b.h/2600));for(let i=0;i<Math.min(n,160);i++){const x=b.x+rand()*b.w,y=b.y+rand()*b.h,r=8+rand()*(edge?40:16);g.fillStyle(rand()>.5?T.rockTop:T.rock,edge?.25:.55).fillCircle(x,y,Math.min(r,b.w/2,b.h/2));}
   g.lineStyle(2,T.rockTop,.35).strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);if(theme==='snow'){g.fillStyle(0xe1e9ec,.6).fillRect(b.x+3,b.y+3,b.w-6,Math.min(12,b.h/3));}}
  water(g,b,T,theme){g.fillStyle(T.water).fillRect(b.x,b.y,b.w,b.h);g.lineStyle(2,theme==='snow'?0xe6f0f4:0x6f8f96,.5).strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);g.lineStyle(1,theme==='snow'?0xffffff:0x8fb3b9,.25);for(let y=b.y+12;y<b.y+b.h;y+=18)for(let x=b.x+10;x<b.x+b.w-20;x+=46)g.lineBetween(x,y,x+(theme==='snow'?30:18),y+(theme==='snow'?8:0));}
  fence(g,b){g.fillStyle(0x10140f,.35).fillRect(b.x+3,b.y+4,b.w,b.h);g.lineStyle(1,0xb7c0b0,.45);const cx=b.x+b.w/2,cy=b.y+b.h/2;if(b.w>=b.h){for(let x=b.x;x<b.x+b.w;x+=10){g.lineBetween(x,cy-6,x+10,cy+6);g.lineBetween(x,cy+6,x+10,cy-6);}g.lineStyle(3,0x8a917e,.9).lineBetween(b.x,cy-7,b.x+b.w,cy-7).lineBetween(b.x,cy+7,b.x+b.w,cy+7);for(let x=b.x;x<=b.x+b.w;x+=80)g.fillStyle(0x5d6556).fillRect(x-3,cy-9,6,18);}
   else{for(let y=b.y;y<b.y+b.h;y+=10){g.lineBetween(cx-6,y,cx+6,y+10);g.lineBetween(cx+6,y,cx-6,y+10);}g.lineStyle(3,0x8a917e,.9).lineBetween(cx-7,b.y,cx-7,b.y+b.h).lineBetween(cx+7,b.y,cx+7,b.y+b.h);for(let y=b.y;y<=b.y+b.h;y+=80)g.fillStyle(0x5d6556).fillRect(cx-9,y-3,18,6);}}
  prop(b){const scene=this.scene,container=scene.add.container(b.x+b.w/2,b.y+b.h/2).setDepth(5);this.staticObjects.push(container);const g=scene.add.graphics();container.add(g);g.fillStyle(C.shadow,.5).fillRect(-b.w/2+6,-b.h/2+9,b.w,b.h);
   if(b.kind==='crate'){container.add(scene.add.image(0,0,'props','crate').setDisplaySize(b.w,b.h));g.lineStyle(2,0x373c26,.8).strokeRect(-b.w/2,-b.h/2,b.w,b.h);}
   else if(b.kind==='barrel'){g.fillStyle(0x5a5a3c).fillRoundedRect(-15,-19,30,38,5);g.lineStyle(3,0x97936c).lineBetween(-15,-10,15,-10).lineBetween(-15,10,15,10);g.fillStyle(0xc19c64).fillTriangle(0,-6,-7,7,7,7);g.fillStyle(0x303528).fillCircle(0,3,2);g.lineStyle(1,0xb0ad82,.4).strokeRoundedRect(-15,-19,30,38,5);}
   else if(b.kind==='barrier'||b.kind==='underpass'){const deployed=b.deployed;g.fillStyle(b.kind==='underpass'?0x363d32:deployed?0x55646a:0x69705b).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,deployed?C.cyan:0xa5ac8c,.6).lineBetween(-b.w/2,-b.h/2+3,b.w/2,-b.h/2+3);g.fillStyle(0x384532,.5).fillRect(-b.w/2+3,b.h/2-7,b.w-6,7);g.lineStyle(2,0x242f25,.6);if(b.w>b.h)for(let x=-b.w/2+20;x<b.w/2;x+=30)g.lineBetween(x,-b.h/2,x,b.h/2);else for(let y=-b.h/2+20;y<b.h/2;y+=30)g.lineBetween(-b.w/2,y,b.w/2,y);if(b.kind==='underpass'){g.lineStyle(3,C.amber,.7).lineBetween(-b.w/2,-b.h/2,b.w/2,b.h/2);}if(deployed){g.lineStyle(2,C.cyan,.5).strokeRect(-b.w/2,-b.h/2,b.w,b.h);}}
   else if(b.kind==='glass'){g.fillStyle(0x96b8b0,.3).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,0xafc0b0,.6).strokeRect(-b.w/2,-b.h/2,b.w,b.h);g.lineBetween(-b.w/2+4,-b.h/2+10,b.w/2-4,b.h/2-10);}
   else if(b.kind==='console'){container.add(scene.add.image(0,0,'props','console').setDisplaySize(b.w,b.h).setTint(0xa0b18d));g.fillStyle(C.amber,.8).fillRect(-8,-5,16,4);}
   else if(b.kind==='jammer'){g.fillStyle(0x2c332c).fillRect(-23,-23,46,46);g.fillStyle(0x4c5649).fillRect(-19,-19,38,38);g.lineStyle(2,0xb0b897,.6).strokeRect(-19,-19,38,38);g.lineStyle(3,0x9aa38a).lineBetween(0,-19,0,-44).lineBetween(-10,-36,10,-36).lineBetween(-6,-28,6,-28);g.fillStyle(C.red).fillCircle(0,-46,4);g.fillStyle(0x161b16).fillRect(-12,-6,24,14);for(let i=0;i<4;i++)g.fillStyle(C.red,.6+i*.1).fillRect(-10+i*6,-2,4,6);container.blink=true;}
   else if(b.kind==='generator'){g.fillStyle(0x1f282e).fillRect(-25,-25,50,50);g.lineStyle(3,0x6f8290).strokeRect(-25,-25,50,50);g.fillStyle(C.cyan,.25).fillCircle(0,0,19);g.fillStyle(C.cyan,.85).fillCircle(0,0,9);g.lineStyle(2,C.cyan,.7).strokeCircle(0,0,19);container.pulse=true;}
   else if(b.kind==='gate'){g.fillStyle(0x3a3f36).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(6,C.amber,.75);const vertical=b.h>b.w;for(let i=-Math.max(b.w,b.h)/2;i<Math.max(b.w,b.h)/2;i+=22){if(vertical)g.lineBetween(-b.w/2,i,b.w/2,i+14);else g.lineBetween(i,-b.h/2,i+14,b.h/2);}g.lineStyle(2,0x1d211b).strokeRect(-b.w/2,-b.h/2,b.w,b.h);}
   else if(b.kind==='vehicle'||b.kind==='fuel'){const horizontal=b.w>=b.h,fuel=b.kind==='fuel';g.fillStyle(0x1c2b22).fillRoundedRect(-b.w/2,-b.h/2,b.w,b.h,9);g.fillStyle(fuel?0x8a7b52:0x646751).fillRoundedRect(-b.w/2+5,-b.h/2+5,b.w-10,b.h-10,8);g.fillStyle(0x35483b);
    if(fuel){if(horizontal){g.fillStyle(0xb7a675).fillRoundedRect(-b.w/2+34,-b.h/2+7,b.w-44,b.h-14,14);g.lineStyle(2,0x5b5136,.8);for(let x=-b.w/2+50;x<b.w/2-10;x+=22)g.lineBetween(x,-b.h/2+8,x,b.h/2-8);g.fillStyle(0x35483b).fillRect(-b.w/2+8,-b.h/2+8,22,b.h-16);}g.fillStyle(C.red,.9).fillTriangle(0,-8,-8,6,8,6);}
    else if(horizontal){g.fillRect(-b.w/2+18,-b.h/2+8,30,b.h-16);g.fillRect(b.w/2-45,-b.h/2+8,25,b.h-16);g.lineStyle(2,0xa3a684,.5).strokeRect(-b.w/2+57,-b.h/2+10,Math.max(4,b.w-108),b.h-20);}else{g.fillRect(-b.w/2+8,-b.h/2+20,b.w-16,25);g.fillRect(-b.w/2+8,b.h/2-40,b.w-16,18);g.lineStyle(2,0xa3a684,.5).strokeRect(-b.w/2+10,-b.h/2+58,b.w-20,Math.max(4,b.h-105));}g.fillStyle(0xb6b597,.7).fillRect(-b.w/2+5,-b.h/2+5,7,5);}
   else{g.fillStyle(0x737962).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,0x343e2c);for(let y=-b.h/2;y<b.h/2;y+=15)g.lineBetween(-b.w/2,y,b.w/2,y);}
   this.props.set(b.id,{container,b});
  }
  actor(id){let a=this.actors.get(id);if(a)return a;const scene=this.scene;a={shadow:scene.add.ellipse(0,0,40,24,C.shadow,.5),feet:scene.add.sprite(0,0,'characters','feet/idle/0'),ghost:scene.add.sprite(0,0,'characters','rifle/idle/0').setVisible(false),body:scene.add.sprite(0,0,'characters','rifle/idle/0'),gear:scene.add.graphics(),phase:0,lastFrame:'',lastSeq:'',blend:0};this.actors.set(id,a);return a;}
  hide(a){for(const obj of [a.body,a.ghost,a.feet,a.gear,a.shadow])obj.setVisible(false);}
  // An actor whose hostile has left the simulation (a corpse cleared away) is taken down for good, not just hidden.
  drop(id){const a=this.actors.get(id);if(!a)return;for(const obj of [a.body,a.ghost,a.feet,a.gear,a.shadow])obj.destroy();this.actors.delete(id);}
  // Intel portraits for the armory: a hostile drawn exactly as the field draws it (body, kit, headgear, or a machine's
  // own drawing), posed facing up and to the right, scaled to fill a square and snapshotted to an image. The actor is
  // taken down again before the frame is drawn, so nothing of it ever shows in the world.
  portrait(type,size=176){const meta=BPWorld.archetypes[type];if(!meta||!this.scene.make?.renderTexture)return Promise.resolve(null);
   const id='__intel_'+type,e={id,type,x:0,y:0,vx:0,vy:0,angle:-.55,hull:-.4,state:'idle',gun:meta.gun,hp:meta.hp,maxHp:meta.hp,attack:0,attackAge:0,shotAge:9,dead:false,moveTime:0,stagger:0,spawned:false},
    s={time:.37,recon:1,player:{x:-1e5,y:-1e5},tdm:false,dark:0},big=size*2,k=big*.42/(PORTRAIT_SPAN[type]||62);
   try{this.drawActor(e,s,0,false);const a=this.actors.get(id);a.blend=0;a.ghost.setVisible(false);if(!meta.machine)a.body.setAlpha(1);const parts=[a.shadow,a.feet,a.body,a.gear].filter(o=>o.visible);
    for(const o of parts){o.setPosition(o.x*k,o.y*k);o.setScale(o.scaleX*k,o.scaleY*k);}
    const rt=this.scene.make.renderTexture({x:0,y:0,width:big,height:big},false);rt.draw(parts,big/2,big/2);this.drop(id);
    // Drawn large, then cut to what was drawn and fitted to the square, so a long rifle or a tank's barrel is never cut off.
    return new Promise(res=>rt.snapshot(img=>{rt.destroy();if(!img){res(null);return;}const c=document.createElement('canvas');c.width=c.height=big;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
     const d=x.getImageData(0,0,big,big).data;let l=big,t=big,r=-1,b=-1;for(let yy=0;yy<big;yy++)for(let xx=0;xx<big;xx++)if(d[(yy*big+xx)*4+3]>24){if(xx<l)l=xx;if(xx>r)r=xx;if(yy<t)t=yy;if(yy>b)b=yy;}
     if(r<0){res(null);return;}const w=r-l+1,h=b-t+1,f=Math.min(size*.9/w,size*.9/h),o=document.createElement('canvas');o.width=o.height=size;const ox=o.getContext('2d');ox.imageSmoothingQuality='high';
     ox.drawImage(c,l,t,w,h,(size-w*f)/2,(size-h*f)/2,w*f,h*f);res(o.toDataURL('image/png'));}));}
   catch(err){this.drop(id);return Promise.resolve(null);}}
  // Field support in the field. Both are drawn in code, like the drones and the mech: the sentry in the squad's green
  // with a ring that runs down as its time does, the hound nose-first along the way it is running. Each flickers in its last two seconds.
  drawAlly(al,s,dt){
   // A reinforcement is a soldier like any other, in the squad's grey-blue.
   if(al.kind==='gunner'){this.drawActor({id:al.id,ally:true,team:al.team,x:al.x,y:al.y,vx:al.vx,vy:al.vy,angle:al.angle,moveAngle:al.angle,slots:['rifle','pistol'],slot:0,state:Math.hypot(al.vx,al.vy)>20?'run':'idle',shotAge:al.shotAge,age:0,duration:1,reload:0,heal:0},s,dt,true);return;}
   const a=this.actor(al.id),g=a.gear,t=s.time,dog=al.kind==='dog',fade=al.life<2?.35+.65*Math.abs(Math.sin(t*13)):1;a.body.setVisible(false);a.feet.setVisible(false);a.ghost.setVisible(false);
   a.shadow.setVisible(true).setPosition(al.x+5,al.y+8).setDepth(4).setScale(dog?.75:1).setAlpha(.45*fade);g.clear().setVisible(true).setAlpha(fade).setPosition(al.x,al.y).setDepth(al.y+52);
   // The seeker rolls; the trophy system shows the ground it covers; the gunship flies above everything, its shadow on the ground beneath.
   if(al.kind==='seeker'){g.setRotation((al.moveTime||0)*2.2);g.fillStyle(0x2b3136).fillCircle(0,0,9);g.lineStyle(2.5,0x8796a0).strokeCircle(0,0,9);g.lineStyle(2,0x8796a0).lineBetween(-9,0,9,0);g.fillStyle(C.red,Math.sin(t*18)>0?1:.35).fillCircle(0,0,3);return;}
   if(al.kind==='trophy'){g.setRotation(0);g.fillStyle(0x2c3338).fillRect(-11,-7,22,14);g.lineStyle(2,0x8796a0).strokeRect(-11,-7,22,14);g.fillStyle(C.cyan,.9).fillCircle(0,0,4);g.lineStyle(1,C.cyan,.16+.08*Math.sin(t*4)).strokeCircle(0,0,250);
    g.lineStyle(2,C.cyan,.55);g.beginPath();g.arc(0,0,17,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,al.life/(al.total||20)));g.strokePath();return;}
   if(al.kind==='gunship'){a.shadow.setPosition(al.x+26,al.y+46).setScale(1.9).setAlpha(.28*fade);g.setDepth(14000).setRotation(al.angle);g.fillStyle(0x3d4733).fillRect(-46,-3,22,6).fillRect(-50,-9,5,18);g.fillStyle(0x4d5a41).fillEllipse(0,0,56,22);g.fillStyle(0x8fe3ff,.8).fillEllipse(17,0,13,11);
    g.lineStyle(3,0x1d2327).lineBetween(22,-6,34,-6).lineBetween(22,6,34,6);const q=t*38-al.angle;g.lineStyle(3,0xc3cdb0,.55);for(const o of [0,Math.PI/2])g.lineBetween(Math.cos(q+o)*38,Math.sin(q+o)*38,-Math.cos(q+o)*38,-Math.sin(q+o)*38);return;}
   if(!dog){g.setRotation(0);const c=Math.cos(al.angle),sn=Math.sin(al.angle),k=al.shotAge<.06?3:0;g.fillStyle(0x2c3830).fillCircle(0,0,18);g.lineStyle(3,0x9fd08a,.9).strokeCircle(0,0,18);g.fillStyle(0x4a5e52).fillCircle(0,0,11);
    g.lineStyle(7,0x1d2723).lineBetween(c*4,sn*4,c*(32-k),sn*(32-k));g.lineStyle(3,0x9fb5a0).lineBetween(c*6,sn*6,c*(30-k),sn*(30-k));g.fillStyle(0x9fd08a,.95).fillCircle(c*8,sn*8,3);
    g.lineStyle(2,0x9fd08a,.55);g.beginPath();g.arc(0,0,25,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,al.life/(al.total||30)));g.strokePath();return;}
   // The hound, drawn facing right and turned to its heading: legs that swing with its stride, and a lunge on each bite.
   const run=Math.hypot(al.vx,al.vy)>20,sw=run?Math.sin((al.moveTime||0)*9)*6:0,bite=(al.biteAge??9)<.18?5:0;g.setRotation(al.angle);
   g.lineStyle(4,0x2b3136);for(const [x,y,d] of [[9,-7,1],[9,7,-1],[-10,-7,-1],[-10,7,1]])g.lineBetween(x,y,x+sw*d,y+(y<0?-7:7));
   g.lineStyle(3,0x596670).lineBetween(-15,0,-24,-4+Math.sin(t*9)*3);g.fillStyle(0x596670).fillEllipse(0,0,34,15);g.fillStyle(0x5d6a41).fillRect(-7,-8,11,16);
   g.fillStyle(0x6b7a85).fillCircle(17+bite,0,7.5);g.fillStyle(0x2b3136).fillRect(21+bite,-3,8,6).fillTriangle(13+bite,-6,17+bite,-12,19+bite,-5).fillTriangle(13+bite,6,17+bite,12,19+bite,5);g.fillStyle(0x8fe3ff).fillCircle(19+bite,-3,1.5).fillCircle(19+bite,3,1.5);}
  drawActor(e,s,dt,isPlayer){const a=this.actor(isPlayer&&e.id==='player'?'rook':e.id||'rook'),type=e.type,meta=BPWorld.archetypes[type],w=isPlayer?BPWorld.weapons[e.slots[e.slot]]:BPWorld.weapons[e.gun]||BPWorld.weapons.rifle;
   if(e.vanished||e.gone>0){this.hide(a);return;}
   if(meta?.machine){this.drawMachine(a,e,s,dt,meta);return;}
   const speed=Math.hypot(e.vx,e.vy),state=e.state||'idle';a.phase+=speed*dt/95;const face=e.angle||0;let feetSeq='idle',seq='idle',bodyTime=s.time*10,footTime=a.phase*20,angle=face,scaleX=1,scaleY=1,lift=0;
   const melee=meta?.melee,tint=isPlayer?(e.decoy?C.cyan:s.tdm&&this.self&&e.team!==undefined&&e.team!==this.self.team?0xe6a38a:e.ally?0x9fb4bd:0xc4cfad):TINTS[type]||0xb2a797;
   // The fallen: a quarter-second fall to the ground, then flat, grey and without their kit, on a dark stain, so a body
   // can never be read as someone still standing. A hostile's body fades over the last moments before it is cleared.
   if(e.dead||state==='death'){const age=isPlayer?9:e.deathAge||0,k=Math.min(1,age/.25),life=BPCore.CORPSE,fade=isPlayer||!e.spawned?1:Math.max(0,Math.min(1,(life.life-age)/life.fade));
    a.shadow.setVisible(false);a.feet.setVisible(false);a.ghost.setVisible(false);
    a.body.setVisible(true).setFrame((melee?'knife':w.sprite)+'/idle/8').setPosition(e.x+6*k,e.y).setRotation(face+.6*k).setScale(1-.14*k,1-.5*k).setTint(k<1?tint:isPlayer?0x747761:0x4b4d45).setDepth(k<1?e.y+51:3).setAlpha((k<1?1:isPlayer?.65:.5)*fade);
    a.gear.clear().setVisible(true).setPosition(e.x,e.y).setRotation(0).setDepth(2).setAlpha(fade);if(!isPlayer)a.gear.fillStyle(0x1a120e,.42*k).fillEllipse(5,3,40*k,24*k);return;}
   if(speed>8){feetSeq=state==='sprint'?'run':'walk';seq='move';bodyTime=a.phase*20;const moveAngle=isPlayer?e.moveAngle:Math.atan2(e.vy,e.vx),relative=Math.atan2(Math.sin(moveAngle-face),Math.cos(moveAngle-face));if(Math.abs(relative)>.6&&Math.abs(relative)<2.5)feetSeq=relative>0?'strafe_right':'strafe_left';if(Math.abs(relative)>2.5)footTime=-a.phase*20;}
   let count=20,group=melee?'knife':w.sprite;if(isPlayer&&e.reload>0){seq='reload';bodyTime=(1-e.reload/e.reloadTotal)*(group==='handgun'?15:20);count=group==='handgun'?15:20;}
   else if(state==='melee'||melee&&e.attack>0){group='knife';seq='meleeattack';const t=state==='melee'?e.age/e.duration:e.attackAge/e.attack;bodyTime=t*15;count=15;angle+=Math.sin(t*Math.PI)*.18;}
   else if(e.shotAge<.12&&!melee){seq='shoot';count=3;bodyTime=e.shotAge/.12*3;}
   if(state==='slide'){feetSeq='strafe_right';footTime=e.age*23;seq='move';bodyTime=e.age*17;scaleY=.72;angle=e.angle+Math.sin(e.age*5)*.08;}
   if(state==='roll'){feetSeq='run';footTime=e.age*75;seq='move';bodyTime=e.age*60;const t=e.age/e.duration;angle=e.actionDir+Math.sin(t*Math.PI)*1.45;scaleY=.5+.5*Math.abs(Math.cos(t*Math.PI));scaleX=.82;lift=Math.sin(t*Math.PI)*8;}
   if(state==='dive'){feetSeq='run';footTime=e.age*50;seq='move';bodyTime=e.age*30;angle=e.actionDir;scaleX=1.18;scaleY=.64;lift=Math.sin(e.age/e.duration*Math.PI)*12;}
   if(state==='vault'){feetSeq='run';footTime=e.age*48;seq='move';bodyTime=e.age*35;scaleX=.9;scaleY=.88;lift=Math.sin(e.age/e.duration*Math.PI)*19;}
   if(a.hitTime>0){a.hitTime=Math.max(0,a.hitTime-dt);angle+=Math.sin(a.hitTime/.14*Math.PI)*.18;scaleX*=1-a.hitTime*.7;}
   if(isPlayer&&e.heal>0){group='handgun';seq='reload';count=15;bodyTime=(1-e.heal/e.healTotal)*15;}
   if(group==='knife'&&seq==='reload')seq='idle';
   const index=Math.max(0,Math.min(count-1,Math.floor(((bodyTime%count)+count)%count))),frame=group+'/'+seq+'/'+index;
   if(a.lastSeq!==group+'/'+seq){a.ghost.setFrame(a.lastFrame||frame).setVisible(true);a.blend=.07;a.lastSeq=group+'/'+seq;}
   a.blend=Math.max(0,a.blend-dt);a.lastFrame=frame;
   // Ghosts are only clearly visible up close, mid-strike, when hit or flashed; the Wraith shimmers.
   let alpha=1;if(e.cloak&&this.self&&e.team!==this.self.team&&BPCore.veiled(s,e,this.self))alpha=.05+.05*Math.sin(s.time*11+e.x*.01);
   else if(meta?.cloak&&!(s.recon>0)){const d=Math.hypot(e.x-s.player.x,e.y-s.player.y);alpha=e.attack>0||e.flashed>0||a.hitTime>0||d<170?1:Math.max(.1,.55-(d-170)/500);alpha*=.85+.15*Math.sin(s.time*13+e.x);}if(type==='wraith')alpha=.8+.2*Math.sin(s.time*9);if(e.decoy)alpha=.55+.25*Math.sin(s.time*20);
   const feetFrame=feetSeq==='idle'?0:Math.floor(((footTime%20)+20)%20);
   a.shadow.setPosition(e.x+5,e.y+9).setVisible(true).setScale(1-lift/55).setDepth(4).setAlpha(alpha*.5);
   a.feet.setFrame('feet/'+feetSeq+'/'+feetFrame).setPosition(e.x,e.y-lift*.45).setRotation(face).setScale(state==='dive'?1.2:1,state==='roll'?.72:1).setTint(tint).setVisible(true).setDepth(e.y+50).setAlpha(alpha);
   const recoil=e.shotAge<.12?(1-e.shotAge/.12)*(w.cls==='shotgun'?5:2):0,big=type==='heavy'?1.4:type==='voss'?1.16:type==='commander'||type==='gunner'?1.12:type==='scout'?.94:1;
   a.body.setVisible(true).setFrame(frame).setPosition(e.x-Math.cos(face)*recoil,e.y-lift-Math.sin(face)*recoil).setRotation(angle).setScale(scaleX*big,scaleY*big).setTint(tint).setAlpha((a.blend>0?1-a.blend/.07:1)*alpha).setDepth(e.y+51);
   a.ghost.setPosition(e.x,e.y-lift).setRotation(angle).setScale(scaleX*big,scaleY*big).setTint(tint).setAlpha(a.blend/.07*alpha).setDepth(e.y+50.5).setVisible(a.blend>0);
   a.gear.setVisible(true).clear().setPosition(e.x,e.y-lift).setRotation(angle).setDepth(e.y+53).setAlpha(alpha);const g=a.gear;
   if(isPlayer){g.lineStyle(4,e.decoy?C.cyan:0xd1b170,.95).lineBetween(-8,-15,-2,-13);g.lineStyle(2,0x272e21,.7).lineBetween(-11,-18,-9,-7);g.fillStyle(0xa89c76,.7).fillRect(-14,-8,4,6);}
   else{g.lineStyle(4,type==='elite'?C.cyan:0x9a705b,.9).lineBetween(-8,-15,-2,-13);}
   if(type==='shield'){const down=e.shieldDown>0;g.fillStyle(0x677064,down?.35+.2*Math.sin(s.time*30):.95).fillRoundedRect(20,-28,10,56,3);g.lineStyle(2,down?C.cyan:0xa8ad90,.7).strokeRoundedRect(20,-28,10,56,3);g.lineStyle(3,0xe0b572,.6).lineBetween(21,-7,28,-7);}
   if(type==='commander'){g.lineStyle(3,C.amber,.9).lineBetween(-9,-18,-1,-16);}
   // Voss: an officer's long coat over his armour and a red armband.
   if(type==='voss'){g.fillStyle(0x22252b,.95).fillRoundedRect(-18,-16,20,32,6);g.lineStyle(1.5,0x5b606b,.8).strokeRoundedRect(-18,-16,20,32,6);g.lineStyle(3,0xc0473a,.95).lineBetween(-6,-16,-6,-10);g.fillStyle(0xd8ac4a).fillCircle(-12,-9,1.8).fillCircle(-12,9,1.8);}
   if(type==='breacher'){g.fillStyle(0x4b4c44,.95).fillRect(-6,-13,14,26);g.lineStyle(2,0x8a8a7c,.7).strokeRect(-6,-13,14,26);}
   if(type==='grenadier'){g.lineStyle(3,0x5e5a3f,.9).lineBetween(-12,-12,8,12);for(let i=0;i<3;i++)g.fillStyle(0x8a8a58).fillCircle(-8+i*7,-8+i*7,3);}
   if(type==='gunner'){g.fillStyle(0x4a4639,.95).fillRect(-16,6,14,12);g.fillStyle(0x6a6450).fillCircle(-4,-17,7).fillCircle(-4,17,7);}
   if(type==='rocketeer'){g.fillStyle(0x4f5a45).fillRect(-14,-20,58,9);g.fillStyle(0x2b3125).fillRect(40,-21,8,11);if(e.attack>0)g.fillStyle(C.red,.6+.4*Math.sin(s.time*30)).fillCircle(48,-16,3);}
   if(type==='elite'){g.lineStyle(2,C.cyan,.9).lineBetween(8,-6,12,6);g.fillStyle(C.cyan,.8).fillCircle(-4,-16,2.5).fillCircle(-4,16,2.5);}
   if(type==='scout'){g.lineStyle(2,0xb9c48d,.7).lineBetween(-10,-12,-10,12);}
   if(type==='wraith'){g.lineStyle(2,C.red,.95).lineBetween(9,-5,13,5);g.lineStyle(1,0xb8c8d0,.35).strokeCircle(0,0,22+Math.sin(s.time*6)*2);}
   if(type==='ghost'){g.lineStyle(2,0xc9d6dc,.35*alpha).strokeCircle(0,0,19);}
   // Holdout's later threats, each with something to pick it out of a crowd at a glance.
   if(type==='medic'){g.fillStyle(0xe9e6dc,.95).fillRect(-13,7,10,10);g.fillStyle(0xc8463a).fillRect(-9.5,8,3,8).fillRect(-12,10.5,8,3);}
   if(type==='mortar'){g.fillStyle(0x3d4434).fillRect(-21,-7,20,12);g.lineStyle(6,0x5a6248).lineBetween(-12,-1,-32,-1);g.lineStyle(2,0x8c9474).lineBetween(-12,-4,-32,-4);}
   if(type==='heavy'){g.fillStyle(0x3b3c37,.95).fillRoundedRect(-13,-15,22,30,4);g.lineStyle(2,0x8a8d80,.8).strokeRoundedRect(-13,-15,22,30,4);g.fillStyle(0x23241f).fillCircle(-2,-17,6).fillCircle(-2,17,6);g.fillStyle(0x9b3d2e,.9).fillRect(-6,-3,6,6);}
   if(type==='engineer'){g.fillStyle(0xd7a63a,.95).fillRect(-15,-7,9,14);g.lineStyle(2,0x5b4a22,.9).strokeRect(-15,-7,9,14);g.lineStyle(2,0xd7a63a,.8).lineBetween(-10,-15,-10,15);}
   if(type==='jammer'){g.lineStyle(2,0x9fb0bd,.9).lineBetween(-10,-8,-24,-22);g.fillStyle(C.cyan,.55+.45*Math.sin(s.time*9)).fillCircle(-24,-22,3.5);g.fillStyle(0x3a444c).fillRect(-16,-6,8,12);}
   // A veteran: a gold chevron on the shoulder.
   if(e.vet){g.lineStyle(2.5,0xe0b04a,.95).lineBetween(-16,-5,-11,-10).lineBetween(-11,-10,-6,-5);g.lineStyle(2.5,0xe0b04a,.7).lineBetween(-16,0,-11,-5).lineBetween(-11,-5,-6,0);}
   if(!isPlayer)this.headgear(g,type);
   if(e.flashed>0){g.lineStyle(2,0xffffff,.6);for(let i=0;i<3;i++){const t=s.time*6+i*2.1;g.strokeCircle(Math.cos(t)*14,Math.sin(t)*14-10,3);}}
  }
  get palette(){return {hostile:C.red,team:C.cyan,self:C.amber,warn:C.red};}
  headgear(g,type){const h=HEAD[type];if(!h)return;const x=-3,y=0;
   if(h.ghillie){for(let i=0;i<7;i++){const q=i/7*Math.PI*2;g.fillStyle(i%2?0x55693c:0x73844a,.95).fillCircle(x+Math.cos(q)*5.5,y+Math.sin(q)*5.5,3.6);}g.fillStyle(0x4a5c34).fillCircle(x,y,5);return;}
   if(h.band){g.lineStyle(3,h.band,.95).strokeCircle(x,y,6);g.lineStyle(2,h.band,.95).lineBetween(x-6,y+1,x-12,y+4);return;}
   const cx=h.beret?x-1:x,cy=h.beret?y-2:y;if(h.brim)g.fillStyle(h.c,.5).fillCircle(cx,cy,h.r+3.5);
   g.fillStyle(h.c,1).fillCircle(cx,cy,h.r);g.lineStyle(1.5,0x101410,.85).strokeCircle(cx,cy,h.r);
   if(h.visor){g.lineStyle(3,h.visor,.95).beginPath();g.arc(cx,cy,h.r-1.5,-.95,.95);g.strokePath();}
   if(h.stripe)g.lineStyle(2.5,h.stripe,.95).lineBetween(cx-h.r+1.5,cy,cx+h.r-1.5,cy);
   if(h.cross)g.fillStyle(h.cross).fillRect(cx-1.7,cy-5,3.4,10).fillRect(cx-5,cy-1.7,10,3.4);
   if(h.headset)g.fillStyle(h.headset).fillCircle(cx,cy-h.r,2.2).fillCircle(cx,cy+h.r,2.2);
   if(h.badge)g.fillStyle(h.badge).fillCircle(cx+3,cy-2.5,2.2);}
  // The sign above a hostile (see BADGE), upright whichever way it faces, on a dark disc so it reads on any ground.
  badge(l,e,meta,t){const kind=BADGE[e.type]||(e.vet?'chevron':null);if(!kind)return;const x=e.x,y=e.y-(meta.radius||17)*(meta.heavy?1.4:1)-17,P=this.palette;
   l.fillStyle(0x0b0f0a,.72).fillCircle(x,y,8);l.lineStyle(1,0xd3d8ba,.4).strokeCircle(x,y,8);
   if(kind==='cross')l.fillStyle(0xf2eee4).fillRect(x-1.6,y-5,3.2,10).fillRect(x-5,y-1.6,10,3.2);
   else if(kind==='scope'){l.lineStyle(1.5,P.hostile,1).strokeCircle(x,y,4.2);l.lineBetween(x-6.5,y,x+6.5,y);l.lineBetween(x,y-6.5,x,y+6.5);}
   else if(kind==='blast'){l.fillStyle(0xe8913c).fillCircle(x-.5,y+1.2,3.8);l.lineStyle(1.5,0xf1d27d).lineBetween(x+2,y-2,x+4.5,y-5.2);}
   else if(kind==='hex'){const pts=[0,1,2,3,4,5].map(i=>({x:x+Math.cos(i*Math.PI/3)*5,y:y+Math.sin(i*Math.PI/3)*5}));l.lineStyle(2,0xe3b544).strokePoints(pts,true);}
   else if(kind==='signal'){l.lineStyle(1.8,0x8fe3ff).beginPath();l.moveTo(x-5.5,y+2);l.lineTo(x-2.5,y-3);l.lineTo(x,y+2.5);l.lineTo(x+2.5,y-3);l.lineTo(x+5.5,y+2);l.strokePath();}
   else if(kind==='diamond'){l.fillStyle(P.hostile).fillPoints([{x,y:y-5.5},{x:x+5,y},{x,y:y+5.5},{x:x-5,y}],true);}
   else if(kind==='chevron'){l.lineStyle(2.2,0xe0b04a).beginPath();l.moveTo(x-4.5,y+2.5);l.lineTo(x,y-2.5);l.lineTo(x+4.5,y+2.5);l.strokePath();}}
  drawMachine(a,e,s,dt,meta){a.body.setVisible(false);a.feet.setVisible(false);a.ghost.setVisible(false);const g=a.gear;g.clear().setVisible(true).setAlpha(1).setRotation(0).setPosition(e.x,e.y);const t=s.time,dead=e.dead,off=e.disabled>0;
   a.shadow.setVisible(!dead).setPosition(e.x+6,e.y+10).setDepth(4).setScale(meta.radius?meta.radius/17:1).setAlpha(.45);g.setDepth(e.y+52);
   if(dead){if(e.spawned)g.setAlpha(Math.max(0,Math.min(1,(BPCore.CORPSE.life-(e.deathAge||0))/BPCore.CORPSE.fade)));g.fillStyle(0x1a1e18,.85).fillCircle(0,0,(meta.radius||17)*.9);g.lineStyle(2,0x3a3d33,.8).strokeCircle(0,0,(meta.radius||17)*.9);if(e.type==='apc'||e.type==='mech'||e.type==='tank')g.fillStyle(0xb36c35,.3+.2*Math.sin(t*9)).fillCircle(Math.sin(t)*6,0,10);return;}
   if(e.type==='drone'){g.fillStyle(0x556b5a).fillRect(-15,-12,30,24);g.lineStyle(3,0x899f80,.8).lineBetween(-22,-18,22,18).lineBetween(-22,18,22,-18);g.lineStyle(2,0x314b3b,.7);for(const [x,y] of [[-22,-18],[22,-18],[-22,18],[22,18]])g.strokeEllipse(x,y,20,8);g.fillStyle(C.amber).fillRect(9,-3,9,6);g.setPosition(e.x,e.y-12-Math.sin(t*4)*3);}
   else if(e.type==='bomber'){const blink=e.attack>0?Math.sin(t*50)>0:Math.sin(t*10)>0;g.fillStyle(0x5e5a48).fillCircle(0,0,11);g.lineStyle(2,0x8f8a6b,.8).lineBetween(-16,-12,16,12).lineBetween(-16,12,16,-12);g.lineStyle(1,0x3d3a2c,.8);for(const [x,y] of [[-16,-12],[16,-12],[-16,12],[16,12]])g.strokeEllipse(x,y,14,6);g.fillStyle(C.red,blink?1:.3).fillCircle(0,0,4);if(e.attack>0)g.lineStyle(2,C.red,.8).strokeCircle(0,0,95*(e.attackAge/e.attack));g.setPosition(e.x,e.y-10-Math.sin(t*6)*2);}
   else if(e.type==='turret'){g.fillStyle(0x2c3338).fillCircle(0,0,20);g.lineStyle(3,off?C.cyan:0x7d8c96,.9).strokeCircle(0,0,20);g.fillStyle(0x4a565e).fillCircle(0,0,12);const c=Math.cos(e.angle),sn=Math.sin(e.angle);g.lineStyle(7,0x1d2327).lineBetween(c*4,sn*4,c*34,sn*34);g.lineStyle(3,0x8796a0).lineBetween(c*6,sn*6,c*32,sn*32);g.fillStyle(off?0x334047:C.red,.9).fillCircle(c*8,sn*8,3);
    g.lineStyle(10,0x6c7880,.5);g.beginPath();g.arc(0,0,24,e.angle-.85,e.angle+.85);g.strokePath();}
   else if(e.type==='apc'){g.fillStyle(0x10140f,.6).fillRoundedRect(-58,-38,122,84,10);g.fillStyle(0x4d5440).fillRoundedRect(-60,-40,120,80,10);g.fillStyle(0x5f674f).fillRoundedRect(-52,-32,104,64,8);g.lineStyle(2,0x8b9273,.6).strokeRoundedRect(-52,-32,104,64,8);for(let x=-48;x<50;x+=16){g.fillStyle(0x2b3025).fillRect(x,-44,10,8).fillRect(x,36,10,8);}
    const c=Math.cos(e.angle),sn=Math.sin(e.angle);g.fillStyle(0x3d4433).fillCircle(0,0,22);g.lineStyle(2,0x8b9273).strokeCircle(0,0,22);g.lineStyle(9,0x23281e).lineBetween(c*10,sn*10,c*58,sn*58);g.lineStyle(4,0x7d846a).lineBetween(c*12,sn*12,c*56,sn*56);if(off){g.lineStyle(2,C.cyan,.8);for(let i=0;i<4;i++){const q=t*13+i;g.lineBetween(Math.cos(q)*40,Math.sin(q)*25,Math.cos(q+1)*20,Math.sin(q+1.7)*30);}}
    if(e.attack>0&&e.mode==='mortar'){g.lineStyle(3,C.red,.5+.4*Math.sin(t*20)).strokeCircle(0,0,30);}}
   else if(e.type==='mech'){const c=Math.cos(e.angle),sn=Math.sin(e.angle),step=Math.sin(e.moveTime*3)*6,px=-sn,py=c;g.fillStyle(0x2c3236).fillCircle(px*16+c*step,py*16+sn*step,11).fillCircle(-px*16-c*step,-py*16-sn*step,11);g.fillStyle(0x495359).fillCircle(0,0,24);g.lineStyle(3,0x8796a0,.9).strokeCircle(0,0,24);
    g.fillStyle(0x6a7a85).fillRect(-10+px*24-6,py*24-6,12,12).fillRect(-10-px*24-6,-py*24-6,12,12);g.lineStyle(6,0x1d2327).lineBetween(c*6+px*20,sn*6+py*20,c*40+px*20,sn*40+py*20);g.fillStyle(C.cyan,.9).fillCircle(c*12,sn*12,4);
    const shield=!(e.shieldDown>0)&&!e.barrierOff;if(shield){g.lineStyle(3,C.cyan,.35+.15*Math.sin(t*5));g.strokeCircle(0,0,40);g.lineStyle(1,C.cyan,.3);for(let i=0;i<6;i++){const q=i/6*Math.PI*2+t*.4;g.lineBetween(Math.cos(q)*40,Math.sin(q)*40,Math.cos(q+1.05)*40,Math.sin(q+1.05)*40);}}else if(!e.barrierOff){g.lineStyle(1,C.cyan,.25*Math.abs(Math.sin(t*20))).strokeCircle(0,0,40);}
    if(e.attack>0&&e.mode==='stomp'){g.lineStyle(3,C.red,.8).strokeCircle(0,0,130*(e.attackAge/e.attack));}if(off){g.lineStyle(2,C.cyan,.8);for(let i=0;i<4;i++){const q=t*13+i;g.lineBetween(Math.cos(q)*30,Math.sin(q)*20,Math.cos(q+1)*14,Math.sin(q+1.7)*24);}}}
   // The spotter: a small quad drone with a red eye that burns bright while it is marking someone.
   else if(e.type==='spotter'){g.fillStyle(0x4d5a60).fillCircle(0,0,10);g.lineStyle(2,0x8fa2ab,.8).lineBetween(-18,0,18,0).lineBetween(0,-18,0,18);g.lineStyle(1,0x3d4a50,.8);for(const [x,y] of [[-18,0],[18,0],[0,-18],[0,18]])g.strokeCircle(x,y,7);g.fillStyle(C.red,e.marking?1:.35+.25*Math.sin(t*5)).fillCircle(0,0,4);g.setPosition(e.x,e.y-14-Math.sin(t*4)*3);}
   // The tank: tracks and hull turned to the way it drives, a turret turned to its aim. The engine deck at the back
   // glows - that is where it is weak - and the gun's muzzle glows red while the main gun is winding up.
   else if(e.type==='tank'){const h=e.hull||0,box=(w,hh,ox,oy,col,al=1)=>{const c=Math.cos(h),sn=Math.sin(h);g.fillStyle(col,al).fillPoints([[-w/2,-hh/2],[w/2,-hh/2],[w/2,hh/2],[-w/2,hh/2]].map(([x,y])=>({x:(x+ox)*c-(y+oy)*sn,y:(x+ox)*sn+(y+oy)*c})),true);};
    box(92,66,3,4,0x10140f,.55);box(90,14,0,-26,0x23271f);box(90,14,0,26,0x23271f);const tr=(e.moveTime||0)*14%12;for(let x=-42;x<44;x+=12){box(3,14,x+tr-6,-26,0x3a3f33);box(3,14,x+tr-6,26,0x3a3f33);}
    box(80,46,0,0,0x4f5a3c);box(62,34,2,0,0x5f6b48);box(10,30,-36,0,0xb36c35,.55+.25*Math.sin(t*6));
    const c=Math.cos(e.angle),sn=Math.sin(e.angle),k=e.shotAge<.1?4:0,wind=e.attack>0&&e.mode==='cannon';g.lineStyle(9,0x1f241a).lineBetween(c*8,sn*8,c*(60-k),sn*(60-k));g.lineStyle(5,0x6f7a58).lineBetween(c*10,sn*10,c*(58-k),sn*(58-k));
    g.fillStyle(0x3f4832).fillCircle(0,0,18);g.lineStyle(2,0x8b9273).strokeCircle(0,0,18);g.fillStyle(0x2a3022).fillCircle(-c*6,-sn*6,6);if(wind)g.fillStyle(C.red,.6+.4*Math.sin(t*30)).fillCircle(c*60,sn*60,6);
    if(off){g.lineStyle(2,C.cyan,.8);for(let i=0;i<4;i++){const q=t*13+i;g.lineBetween(Math.cos(q)*38,Math.sin(q)*24,Math.cos(q+1)*18,Math.sin(q+1.7)*28);}}}
   if(e.type==='mech'&&e.attack>0&&e.mode==='missiles'){const c=Math.cos(e.angle),sn=Math.sin(e.angle),px=-sn,py=c;g.fillStyle(C.red,.6+.4*Math.sin(t*25)).fillCircle(-10+px*24,py*24,5).fillCircle(-10-px*24,-py*24,5);}
   if(off&&e.type!=='apc'&&e.type!=='mech'&&e.type!=='tank'){g.lineStyle(2,C.cyan,.85);for(let i=0;i<3;i++){const q=t*15+i*2;g.lineBetween(Math.cos(q)*16,Math.sin(q)*16,Math.cos(q+.8)*6,Math.sin(q+1.4)*6);}}}
  emit(x,y,count,kind='spark',angle=null){const max=this.scene.settings.quality==='low'?Math.ceil(count/2):count;for(let i=0;i<max;i++){const p=this.particles.find(p=>!p.active);if(!p)break;const a=angle===null?Math.random()*Math.PI*2:angle+(Math.random()-.5)*1.8;const speed=kind==='smoke'?15+Math.random()*35:kind==='ember'?20+Math.random()*40:70+Math.random()*190;Object.assign(p,{active:true,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(kind==='ember'?30:0),life:kind==='smoke'?1.4+Math.random()*1.4:.2+Math.random()*.6,total:kind==='smoke'?2:.8,kind,size:kind==='smoke'?7+Math.random()*14:1+Math.random()*4,color:kind==='spark'?0xddb170:kind==='glass'?0xa8c5b7:kind==='cloth'?0x987c62:kind==='dust'?0xa7a087:kind==='casing'?0xad9b64:kind==='emp'?C.cyan:kind==='ember'?0xe58f45:0x596457});}}
  popup(x,y,text,color='#e2b074'){const t=this.texts.find(q=>q.life<=0)||this.texts[0];t.life=.95;t.x=x;t.y=y;t.obj.setText(text).setColor(color).setPosition(x,y).setVisible(true).setAlpha(1).setScale(1.25);}
  event(e){const sim=this.scene.sim;switch(e.type){case 'shot':{const tr=BPWorld.weapons[e.weapon]?.tracer;this.emit(e.x,e.y,e.weapon==='shotgun'||e.weapon==='sawedoff'||e.weapon==='autoshotgun'?13:4,tr?'emp':'spark',e.angle);this.emit(e.x,e.y,2,'smoke',e.angle);if(!tr)this.emit(e.x-Math.cos(e.angle)*16,e.y-Math.sin(e.angle)*16,1,'casing',e.angle+Math.PI/2);this.flashes.push({x:e.x,y:e.y,angle:e.angle,life:.055,big:['shotgun','sawedoff','autoshotgun','rail','rocket','magnum'].includes(e.weapon),color:tr});if(!e.enemy&&['shotgun','sawedoff','autoshotgun','rail','rocket'].includes(e.weapon))this.shake(.045,.002);break;}
    case 'hit':{this.emit(e.x,e.y,5,'cloth',e.angle);const actor=this.actors.get(e.id);if(actor)actor.hitTime=.14;if(e.player&&(e.by||'player')===(this.scene.selfId||'player'))this.hitMark=.12;break;}
    case 'kill':if(e.credits&&(!sim.tdm||e.by===(this.scene.selfId||'player')))this.popup(e.x,e.y-26,'+'+e.credits+(e.combo>1?'  ×'+e.combo:''),e.combo>=3?'#f1c27d':'#e2b074');if((e.by||'player')===(this.scene.selfId||'player'))this.killMark=.24;if(e.boss)this.shake(.4,.01);break;
    case 'cache':this.popup(e.x,e.y-20,'+'+e.credits+' CR','#f1d27d');break;
    case 'blink':this.emit(e.from.x,e.from.y,10,'smoke');this.emit(e.x,e.y,10,'smoke');this.flashes.push({x:e.x,y:e.y,ring:true,radius:60,color:C.cyan,life:.3});break;
    case 'sweep':this.flashes.push({x:e.x,y:e.y,ring:true,radius:140,color:C.red,life:.8});break;
    case 'relay':this.popup(e.x,e.y-40,'RELAY '+e.id,e.team===(this.self?.team??0)?'#8fe3ff':'#ff7b6b');break;
    case 'planted':this.popup(e.x,e.y-40,'CHARGE PLANTED','#ff7b6b');break;
    case 'defused':this.popup(e.x,e.y-40,'DEFUSED','#8fe3ff');this.flashes.push({x:e.x,y:e.y,ring:true,radius:90,color:C.cyan,life:.5});break;
    case 'detonated':this.shake(.6,.012);this.emit(e.x,e.y,30,'ember');break;
    case 'countershot':this.popup(e.x,e.y-40,'COUNTER','#f1d27d');this.emit(e.x,e.y,8,'spark');break;
    // A perfect flow: an amber ring off the operator and a spray of sparks (no flash, so reduced-flash play keeps it).
    case 'flow':this.flashes.push({x:e.x,y:e.y,ring:true,radius:95,color:C.amber,life:.4});this.emit(e.x,e.y,12,'spark');break;case 'intel':this.popup(e.x,e.y-20,'INTEL','#f1d27d');break;
    case 'weaponfound':this.popup(e.x,e.y-24,'NEW WEAPON','#f1d27d');this.emit(e.x,e.y,18,'spark');break;
    case 'bulletimpact':this.emit(e.x,e.y,5,'spark');this.decals.push({x:e.x,y:e.y,size:2});break;
    case 'meleeimpact':this.emit(e.x,e.y,12,'dust');this.shake(.075,.0025);break;
    case 'destroy':this.emit(e.x,e.y,25,e.kind==='glass'?'glass':e.kind==='generator'||e.kind==='jammer'?'emp':'dust');this.emit(e.x,e.y,5,'smoke');this.decals.push({x:e.x,y:e.y,size:Math.max(e.w,e.h)*.48});break;
    case 'explosion':{this.emit(e.x,e.y,45,'spark');this.emit(e.x,e.y,35,'dust');this.emit(e.x,e.y,18,'smoke');this.decals.push({x:e.x,y:e.y,size:e.radius*.4});this.flashes.push({x:e.x,y:e.y,life:.32,explosion:true,radius:e.radius});const p=sim.player;this.shake(.22,.008*Math.max(.15,1-Math.hypot(p.x-e.x,p.y-e.y)/900));break;}
    case 'emp':this.flashes.push({x:e.x,y:e.y,life:.5,ring:true,radius:320,color:C.cyan});this.emit(e.x,e.y,30,'emp');break;
    case 'flash':this.flashes.push({x:e.x,y:e.y,life:.25,ring:true,radius:300,color:0xffffff,fill:true});break;
    case 'smoke':this.emit(e.x,e.y,10,'smoke');break;case 'stomp':this.shake(.25,.01);break;
    case 'blink':case 'blinkin':this.emit(e.x,e.y,16,'smoke');this.flashes.push({x:e.x,y:e.y,life:.3,ring:true,radius:60,color:0xb8c8d0});break;
    case 'deploy':this.emit(e.x,e.y,10,'dust');break;case 'gate':this.emit(e.x,e.y,20,'dust');this.shake(.1,.003);break;
    case 'action':if(['slide','roll','dive','vault'].includes(e.action))this.emit(e.x,e.y,7,'dust');break;
    case 'damage':if(!this.scene.settings.flash)this.damageFlash=.17;this.shake(.09,.002);if(Number.isFinite(e.fromX)){const p=this.self||sim.player;this.hurt.push({angle:Math.atan2(e.fromY-p.y,e.fromX-p.x),life:.9});if(this.hurt.length>6)this.hurt.shift();}break;
    case 'armorbreak':this.flashes.push({x:sim.player.x,y:sim.player.y,life:.3,ring:true,radius:70,color:0xb7d7e8});break;
    case 'pickup':this.emit(e.x,e.y,8,'dust');break;
    case 'down':this.emit(e.x,e.y,14,'dust');if(!e.tdm||e.who===(this.scene.selfId||'player'))this.shake(.2,.006);break;
    case 'support':if(e.key==='recon')this.flashes.push({x:e.x,y:e.y,life:.9,ring:true,radius:1100,color:C.cyan});else if(e.key==='airstrike')this.shake(.35,.005);else this.emit(e.x,e.y,14,'dust');break;
    case 'arc':(this.bolts=this.bolts||[]).push({x:e.x,y:e.y,x2:e.x2,y2:e.y2,life:.16,color:C.cyan,w:3});this.emit(e.x2,e.y2,10,'emp');break;
    case 'strafe':(this.bolts=this.bolts||[]).push({x:e.x,y:e.y,x2:e.x2,y2:e.y2,life:.06,color:0xf6d99a,w:1.5});this.emit(e.x2,e.y2,2,'spark');break;
    case 'intercept':(this.bolts=this.bolts||[]).push({x:e.x2,y:e.y2,x2:e.x,y2:e.y,life:.14,color:C.cyan,w:2});this.emit(e.x,e.y,12,'emp');break;
    case 'grapple':(this.bolts=this.bolts||[]).push({x:e.x,y:e.y,x2:e.x+Math.cos(e.angle)*e.d,y2:e.y+Math.sin(e.angle)*e.d,life:.24,color:0xc3cdb0,w:1.5});break;
    case 'ricochet':this.emit(e.x,e.y,7,'spark');break;case 'sensor':this.flashes.push({x:e.x,y:e.y,life:.6,ring:true,radius:420,color:C.cyan});break;
    case 'bite':this.emit(e.x,e.y,9,'cloth');break;case 'allygone':this.emit(e.x,e.y,10,'smoke');break;
    case 'secondwind':this.flashes.push({x:e.x,y:e.y,life:.5,ring:true,radius:120,color:0xffffff});break;
    case 'respawn':this.flashes.push({x:e.x,y:e.y,life:.45,ring:true,radius:70,color:0x9fd08a});if(e.who===this.self?.id)this.beacon=1.6;this.emit(e.x,e.y,10,'spark');break;case 'tags':this.emit(e.x,e.y,8,'spark');break;
    case 'revive':this.flashes.push({x:e.x,y:e.y,life:.5,ring:true,radius:90,color:0x9fd08a});this.emit(e.x,e.y,18,'spark');break;
   }if(this.decals.length>160)this.decals.splice(0,this.decals.length-160);}
  shake(duration,intensity){const strength=this.scene.settings.shake;if(strength>0)this.scene.cameras.main.shake(duration*1000,intensity*strength);}
  update(s,dt,pointer,self=s.player){if(this.lastMap!==s.map.id)this.build(s,self);this.frame++;this.self=self;const g=this.effects,l=this.lines,cam=this.scene.cameras.main,p=self,t=s.time;g.clear();l.clear();this.smoke.clear();this.uiGraphics.clear();
   // Your own redeployment: two amber rings close in on the operator, so the eye finds him at once.
   if(this.beacon>0){this.beacon-=dt;const k=Math.max(0,this.beacon/1.6),a=Math.min(1,k*2.5);g.lineStyle(5,0xf4cf8e,.9*a).strokeCircle(p.x,p.y,34+260*k);g.lineStyle(2,0xf4cf8e,.5*a).strokeCircle(p.x,p.y,34+430*k);}
   // The camera leads the aim, and further when steadying a long gun: a marksman rifle sees more ahead than a pistol.
   const ahead=p.aiming?115*Math.max(.85,Math.min(1.7,(BPWorld.weapons[p.slots?.[p.slot]]?.range||940)/940)):65,aimX=Math.cos(p.angle)*ahead,aimY=Math.sin(p.angle)*ahead,targetX=p.x+p.vx*.14+aimX,targetY=p.y+p.vy*.14+aimY,lerp=1-Math.exp(-dt*6);
   this.cameraX+=(targetX-this.cameraX)*lerp;this.cameraY+=(targetY-this.cameraY)*lerp;cam.centerOn(this.cameraX,this.cameraY);
   for(const b of s.walls)if((b.deployed||b.fort)&&!this.props.has(b.id))this.prop(b);
   for(const {container,b} of this.props.values()){container.setVisible(!b.dead);if(!b.dead&&Number.isFinite(b.hp)&&b.hp<b.maxHp)container.setAlpha(.6+.4*b.hp/b.maxHp);if(container.blink&&!b.dead)container.list[0].setAlpha(Math.sin(t*6)>0?1:.85);if(container.pulse&&!b.dead)container.setScale(1+.04*Math.sin(t*5));}
   this.drawActor(s.player,s,dt,true);
   for(const id of ['guest','m2','m3','m4','m5','m6','m7']){const m=(s.mates||[]).find(o=>o.id===id);if(m&&!m.vanished)this.drawActor(m,s,dt,true);else{const a=this.actors.get(id);if(a)this.hide(a);}}
   // Their ids change with every call, so the drawing of one that has gone is put away.
   // A hostile is "sensed" while a recon sweep is up or it stands in a sensor dart's ground: boxed, and marked at the screen edge.
   const mind=s.tdm&&self.ctx||s,foe=q=>!!s.tdm&&q.team!==undefined&&q.team!==self.team,sides=s.tdm?Object.fromEntries(s.roster.map(o=>[o.id,o.team])):null;
   const sensed=e=>mind.recon>0||s.zones.some(z=>z.kind==='sensor'&&(!s.tdm||z.team===self.team)&&BPCore.distance(z,e)<z.r);
   const allies=s.allies||[];for(const al of allies){this.drawAlly(al,s,dt);if(foe(al)&&al.kind!=='gunner'){const a=this.actors.get(al.id);if(a)a.gear.lineStyle(2,C.red,.85).strokeCircle(0,0,al.kind==='gunship'?36:al.kind==='trophy'?20:25);}}for(const [id,a] of this.actors)if(id.startsWith('ally')&&!allies.some(al=>al.id===id))this.hide(a);
   if(s.decoy)this.drawActor({id:'decoy',decoy:true,x:s.decoy.x,y:s.decoy.y,vx:0,vy:0,angle:Math.sin(t*1.3)*1.4,slots:p.slots,slot:p.slot,state:'idle',shotAge:10,age:0,duration:1,reload:0,heal:0},s,dt,true);else{const a=this.actors.get('decoy');if(a)this.hide(a);}
   if(s.tdm)for(const o of s.roster){const d=o.ctx&&o.ctx.decoy,id='decoy-'+o.id;if(d)this.drawActor({id,decoy:true,x:d.x,y:d.y,vx:0,vy:0,angle:Math.sin(t*1.3)*1.4,slots:o.slots,slot:o.slot,state:'idle',shotAge:10,age:0,duration:1,reload:0,heal:0},s,dt,true);else{const a=this.actors.get(id);if(a)this.hide(a);}
    if(foe(o)&&!o.dead&&sensed(o)){l.lineStyle(1.5,C.red,.45+.3*Math.sin(t*8)).strokeRect(o.x-21,o.y-21,42,42);this.marker(o,C.red,cam,true);}}
   {const ids=new Set(s.enemies.map(e=>e.id));for(const id of this.enemyIds||[])if(!ids.has(id))this.drop(id);this.enemyIds=ids;}
   for(const e of s.enemies){const visible=e.x>cam.worldView.x-120&&e.x<cam.worldView.right+120&&e.y>cam.worldView.y-120&&e.y<cam.worldView.bottom+120;if(visible)this.drawActor(e,s,dt,false);else{const a=this.actors.get(e.id);if(a)this.hide(a);}
    // A recon sweep boxes every hostile in view, noticed or not.
    if(visible&&!e.dead&&!(e.gone>0)&&sensed(e)){const k=.45+.3*Math.sin(t*8);l.lineStyle(1.5,C.red,k).strokeRect(e.x-21,e.y-21,42,42);}
    if(visible&&!e.dead&&!(e.gone>0)&&!BPWorld.archetypes[e.type]?.cloak&&!s.tdm)this.badge(l,e,BPWorld.archetypes[e.type]||{},t);
    if(visible&&e.active&&!e.dead&&!(e.gone>0)){const meta=BPWorld.archetypes[e.type];if(e.attack>0){const k=Math.min(1,e.attackAge/e.attack),d=Math.min(meta.range||950,BPCore.distance(e,p)+40),aim=meta.turn?e.angle:e.aim;
      if(e.mode==='missiles'&&e.salvo){for(const q of e.salvo){l.lineStyle(2,C.red,.25+.6*k).strokeCircle(q.x,q.y,95*(.4+.6*k));l.lineBetween(q.x-8,q.y,q.x+8,q.y);l.lineBetween(q.x,q.y-8,q.x,q.y+8);}}
      else if(e.mode==='flash'){l.lineStyle(2,0xffffff,.3+.5*k).strokeCircle(e.targetX,e.targetY,40+30*k);}
      else if(meta.shell){const z=s.spotted>0?.6:1;for(const [dx,dy] of [[0,0],[90,-55],[-85,60]])l.lineStyle(2,C.red,.25+.6*k).strokeCircle(e.targetX+dx*z,e.targetY+dy*z,110*(.4+.6*k));}
      else if(meta.lob||e.mode==='mortar'){const pts=e.mode==='mortar'?[[0,0],[110,-60],[-100,70]]:[[0,0]];for(const [dx,dy] of pts){l.lineStyle(2,C.red,.25+.6*k).strokeCircle(e.targetX+dx,e.targetY+dy,meta.lob?130*(.4+.6*k):120*(.4+.6*k));}}
      else if(!meta.melee&&!meta.kamikaze&&e.mode!=='stomp'){const sniper=meta.locked||e.mode==='cannon';l.lineStyle(sniper?2+(meta.rocket||e.mode==='cannon'?2:0):1,sniper?C.red:C.amber,.2+.6*k);l.lineBetween(e.x,e.y,e.x+Math.cos(aim)*d,e.y+Math.sin(aim)*d);}
      l.lineStyle(2,C.red,.8).strokeCircle(e.x,e.y,(meta.radius||17)+7+4*k);}
     if(e.marking){const o=BPCore.ops(s).find(q=>q.id===e.marking);if(o){l.lineStyle(1.5,C.red,.45+.35*Math.sin(t*12)).lineBetween(e.x,e.y-14,o.x,o.y);l.lineStyle(2,C.red,.6).strokeCircle(o.x,o.y,26+3*Math.sin(t*8));}}
     if(e.healing>0&&e.patient){const b=s.enemies.find(q=>q.id===e.patient);if(b){l.lineStyle(2,0x9fd08a,.75).lineBetween(e.x,e.y,b.x,b.y);l.lineStyle(3,0x9fd08a,.9).beginPath();l.arc(b.x,b.y,20,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,e.healing/2));l.strokePath();}}
     if(e.building>0){l.lineStyle(3,0xd7a63a,.9).beginPath();l.arc(e.x,e.y,24,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.building/2.2));l.strokePath();}
     // Suppressed: two small grey arcs over the head while the rattle lasts.
     if(e.suppressed>0){const k=Math.min(1,e.suppressed);l.lineStyle(1.5,0xb8bfb2,.7*k).beginPath();l.arc(e.x,e.y-6,24,-2.3,-1.9);l.strokePath();l.beginPath();l.arc(e.x,e.y-6,24,-1.25,-.85);l.strokePath();}
     if(meta.jams){const q=(t*.8)%1;l.lineStyle(1.5,C.cyan,.4*(1-q)).strokeCircle(e.x,e.y,20+90*q);}
     if(e.vet)l.lineStyle(1.5,0xe0b04a,.45).strokeCircle(e.x,e.y,(meta.radius||17)*(meta.heavy?1.4:1)+6);
     if(e.hp<e.maxHp&&!meta.boss){l.fillStyle(0x111d16,.8).fillRect(e.x-22,e.y-38,44,3);l.fillStyle(0xb1b99b).fillRect(e.x-22,e.y-38,44*Math.max(0,e.hp/e.maxHp),3);}if(e.type==='commander'){l.fillStyle(0x111d16,.8).fillRect(e.x-22,e.y-38,44,3);l.fillStyle(C.amber).fillRect(e.x-22,e.y-38,44*Math.max(0,e.hp/e.maxHp),3);}}}
   for(const b of s.projectiles){if(!b.active)continue;const tr=BPWorld.weapons[b.weapon]?.tracer,hostile=b.enemy||!!sides&&sides[b.owner]!==undefined&&sides[b.owner]!==self.team;if(b.weapon==='rail'&&!b.enemy){g.lineStyle(5,tr,.35).lineBetween(b.x,b.y,b.x-b.vx*.03,b.y-b.vy*.03);g.lineStyle(2,0xffffff,.95).lineBetween(b.x,b.y,b.x-b.vx*.03,b.y-b.vy*.03);continue;}
    g.lineStyle(b.explosive?4:2,tr&&!b.enemy?tr:hostile?(b.weapon==='pulse'?C.cyan:0xe39a82):0xe0caa0,.9).lineBetween(b.x,b.y,b.x-b.vx*.013,b.y-b.vy*.013);if(b.explosive){g.fillStyle(hostile?0xff9a6a:0xf6d99a,.85).fillCircle(b.x,b.y,hostile?5:4);this.emit(b.x,b.y,1,'smoke');}}
   for(const grenade of s.grenades){const gfoe=grenade['enemy']||foe(grenade),k=Math.min(1,grenade.age/grenade.duration),lift=Math.sin(k*Math.PI)*45,kind=grenade.kind||'frag',col=gfoe?C.red:kind==='emp'?C.cyan:kind==='smoke'?0xb8bfb2:kind==='flash'?0xffffff:kind==='incendiary'?0xe58f45:0xaeb78c;g.fillStyle(0x1c271c,.8).fillEllipse(grenade.x+3,grenade.y+4,12,7);if(gfoe&&(grenade.missile||grenade.shell)&&k<1)l.lineStyle(2,C.red,.3+.5*k).strokeCircle(grenade.tx,grenade.ty,(grenade.radius||100)*(.5+.5*k));
    if(grenade.missile&&k<1){const a=Math.atan2(grenade.ty-grenade.sy,grenade.tx-grenade.sx),y=grenade.y-lift;g.lineStyle(4,0xd8d2bf).lineBetween(grenade.x-Math.cos(a)*9,y-Math.sin(a)*9,grenade.x+Math.cos(a)*7,y+Math.sin(a)*7);g.fillStyle(0xf0a050,.9).fillCircle(grenade.x-Math.cos(a)*11,y-Math.sin(a)*11,3);if(Math.random()<.5)this.emit(grenade.x,y,1,'smoke');continue;}
    const gs=this.sprite('gr'+s.grenades.indexOf(grenade),'g:'+(kind==='frag'||!BPWorld.gear[kind]?'frag':kind));if(gs)gs.setPosition(grenade.x,grenade.y-lift).setDisplaySize(19,19).setRotation(k<1?grenade.age*11:.3).setDepth(11001);else g.fillStyle(col).fillCircle(grenade.x,grenade.y-lift,5);if(gfoe)g.lineStyle(2,C.red,.9).strokeCircle(grenade.x,grenade.y-lift,11);
    if(grenade.age>=grenade.duration&&(kind==='frag')){const r=grenade.radius||155;l.lineStyle(1,gfoe?C.red:C.amber,.65).strokeCircle(grenade.x,grenade.y,r);l.lineStyle(2,gfoe?C.red:C.amber,.9);l.beginPath();l.arc(grenade.x,grenade.y,13,-Math.PI/2,-Math.PI/2+(grenade.age/grenade.fuse)*Math.PI*2);l.strokePath();if(gfoe)this.marker(grenade,C.red,cam,false);}}
   for(const z of s.zones){
    if(z.kind==='sensor'){const k=(t*1.1)%1;l.lineStyle(1.5,C.cyan,.5*(1-k)).strokeCircle(z.x,z.y,z.r*k);l.lineStyle(1,C.cyan,.22).strokeCircle(z.x,z.y,z.r);g.fillStyle(C.cyan,.95).fillCircle(z.x,z.y,4);continue;}
    if(z.kind==='gas'){const fade=Math.min(1,z.life/1.2);for(let i=0;i<8;i++){const q=i*.8+t*.2;this.smoke.fillStyle(i%2?0xc9c86a:0xa9a850,.2*fade).fillCircle(z.x+Math.cos(q)*z.r*.45,z.y+Math.sin(q)*z.r*.45,z.r*(.42+.2*Math.sin(i+t*.4)));}continue;}
    if(z.kind==='smoke'){const fade=Math.min(1,z.life/1.5,(10.5-z.life)/.6+.2);for(let i=0;i<9;i++){const q=i*.7+t*.15,r=z.r*(.45+.25*Math.sin(i*1.7+t*.3));this.smoke.fillStyle(i%2?0xb3b9ad:0x9ca394,.32*fade).fillCircle(z.x+Math.cos(q)*z.r*.42,z.y+Math.sin(q)*z.r*.42,r);}this.smoke.fillStyle(0xa9afa1,.5*fade).fillCircle(z.x,z.y,z.r*.7);}
    else{const f=Math.min(1,z.life);g.fillStyle(0xb5562a,.18*f).fillCircle(z.x,z.y,z.r);for(let i=0;i<7;i++){const a=i/7*Math.PI*2+t,r=z.r*(.3+.4*((i*37)%10)/10);g.fillStyle(0xe8914a,.55*f).fillTriangle(z.x+Math.cos(a)*r-7,z.y+Math.sin(a)*r,z.x+Math.cos(a)*r+7,z.y+Math.sin(a)*r,z.x+Math.cos(a)*r,z.y+Math.sin(a)*r-14-6*Math.sin(t*14+i));}if(Math.random()<dt*14)this.emit(z.x+(Math.random()-.5)*z.r,z.y+(Math.random()-.5)*z.r,1,'ember');}}
   for(const m of s.mines){const ms=this.sprite('mine'+m.id,'g:mine');if(ms)ms.setPosition(m.x,m.y).setDisplaySize(26,26).setRotation(0).setDepth(6);else{g.fillStyle(0x2a3022).fillCircle(m.x,m.y,8);g.lineStyle(2,0x6b7552).strokeCircle(m.x,m.y,8);}g.fillStyle(m.arm<=0?C.red:C.amber,Math.sin(t*(m.arm<=0?8:20))>0?1:.25).fillCircle(m.x,m.y,2.5);}
   for(const h of s.hazards){const vertical=h.h>h.w,on=h.on;if(on){g.fillStyle(C.red,.18).fillRect(h.x,h.y-(vertical?0:6),h.w+(vertical?0:0),h.h+(vertical?0:12));g.lineStyle(3,0xff6a5a,.9);if(vertical)g.lineBetween(h.x+h.w/2,h.y,h.x+h.w/2,h.y+h.h);else g.lineBetween(h.x,h.y+h.h/2,h.x+h.w,h.y+h.h/2);g.lineStyle(1,0xffd2c8,.9);if(vertical)g.lineBetween(h.x+h.w/2,h.y,h.x+h.w/2,h.y+h.h);else g.lineBetween(h.x,h.y+h.h/2,h.x+h.w,h.y+h.h/2);}
    else{g.lineStyle(1,h.off>0?C.cyan:C.red,.25);if(vertical)g.lineBetween(h.x+h.w/2,h.y,h.x+h.w/2,h.y+h.h);else for(let x=h.x;x<h.x+h.w;x+=12)g.lineBetween(x,h.y+h.h/2,x+5,h.y+h.h/2);}
    g.fillStyle(0x3a4248).fillRect(vertical?h.x+h.w/2-6:h.x-4,vertical?h.y-4:h.y+h.h/2-6,vertical?12:8,vertical?8:12).fillRect(vertical?h.x+h.w/2-6:h.x+h.w-4,vertical?h.y+h.h-4:h.y+h.h/2-6,vertical?12:8,vertical?8:12);}
   for(const w of s.spawnWarnings){l.lineStyle(2,C.red,.65).strokeRect(w.x-25,w.y-25,50,50);l.lineBetween(w.x-9,w.y-9,w.x+9,w.y+9);l.lineBetween(w.x-9,w.y+9,w.x+9,w.y-9);this.marker(w,C.red,cam,true);}
   // Holdout's supply uplink: a beacon with its ring and how far it has been secured, marked at the screen edge.
   const up=BPCore.arena(s)&&s.director?.uplink;if(up&&up.x!==undefined&&!up.done){const k=up.progress||0,beat=1+.05*Math.sin(t*5);g.fillStyle(0x0b0f0a,.5).fillEllipse(up.x+3,up.y+14,40,14);g.fillStyle(0x24302a).fillRoundedRect(up.x-15,up.y-15,30,30,4);g.lineStyle(2,0x9fd08a,.9).strokeRoundedRect(up.x-15,up.y-15,30,30,4);
    g.lineStyle(2,0x9fd08a).lineBetween(up.x,up.y-15,up.x,up.y-36);g.fillStyle(0x9fd08a,.5+.5*Math.sin(t*8)).fillCircle(up.x,up.y-38,4);l.lineStyle(1.5,0x9fd08a,.45).strokeCircle(up.x,up.y,80*beat);
    if(k>0){l.lineStyle(5,0xd6f2c4,.95).beginPath();l.arc(up.x,up.y,80,-Math.PI/2,-Math.PI/2+Math.PI*2*k);l.strokePath();}this.marker(up,0x9fd08a,cam);}
   this.objectives(s,g,l,t,cam,self);
   // A partner told to hold: where.
   if(s.order==='hold'&&s.orderAt){l.lineStyle(1.5,0x9fb4bd,.6).strokeCircle(s.orderAt.x,s.orderAt.y,30);l.lineBetween(s.orderAt.x,s.orderAt.y-30,s.orderAt.x,s.orderAt.y-52);l.fillStyle(0x9fb4bd,.8).fillTriangle(s.orderAt.x,s.orderAt.y-52,s.orderAt.x+14,s.orderAt.y-47,s.orderAt.x,s.orderAt.y-42);}
   this.drawPickups(s,g,t);
   if(!s.training&&!BPCore.arena(s)){const obj=s.goal,pulse=1+Math.sin(t*2)*.05;l.lineStyle(2,C.amber,.65).strokeRect(obj.x-22*pulse,obj.y-22*pulse,44*pulse,44*pulse);l.lineStyle(1,C.amber,.25).strokeCircle(obj.x,obj.y,58);l.lineBetween(obj.x-8,obj.y,obj.x+8,obj.y);l.lineBetween(obj.x,obj.y-8,obj.x,obj.y+8);this.marker(obj,C.amber,cam);}
   this.decalsGraphics.clear();for(const d of this.decals)this.decalsGraphics.fillStyle(0x18241b,.55).fillEllipse(d.x,d.y,d.size*1.5,d.size);
   this.squad(s,g,l,cam,t);
   for(const fire of this.fires){const sz=fire.size;g.fillStyle(0xac713b,.16).fillCircle(fire.x,fire.y,sz*1.9);g.fillStyle(0xb88446,.65).fillEllipse(fire.x,fire.y,sz+Math.sin(t*11)*3,sz*.7);g.fillStyle(0xe6bc76,.8).fillTriangle(fire.x-sz*.35,fire.y,fire.x+sz*.35,fire.y,fire.x+Math.sin(t*6)*5,fire.y-sz*(.8+.15*Math.sin(t*8)));if(Math.random()<dt*9&&this.scene.settings.quality==='high')this.emit(fire.x,fire.y-10,1,'smoke');}
   for(const part of this.particles){if(!part.active)continue;part.life-=dt;if(part.life<=0){part.active=false;continue;}part.x+=part.vx*dt;part.y+=part.vy*dt;const fade=Math.min(1,part.life/(part.kind==='smoke'?.9:.3));if(part.kind==='smoke'){part.size+=dt*8;part.vx*=Math.exp(-dt);part.vy-=dt*6;g.fillStyle(part.color,.24*fade).fillCircle(part.x,part.y,part.size);}else{part.vx*=Math.exp(-dt*4);part.vy*=Math.exp(-dt*4);g.fillStyle(part.color,fade).fillRect(part.x,part.y,part.size,part.kind==='casing'?2:part.size);}}
   // Short-lived lines: an arc caster's jump, a gunship's burst, a trophy system's intercept, a grapple line.
   this.bolts=(this.bolts||[]).filter(b=>{b.life-=dt;if(b.life<=0)return false;g.lineStyle(b.w,b.color,Math.min(1,b.life*12)).lineBetween(b.x,b.y,b.x2,b.y2);return true;});
   this.flashes=this.flashes.filter(f=>{f.life-=dt;if(f.life<=0)return false;if(f.ring){const k=1-f.life/(f.total||(f.total=f.life+dt));if(f.fill&&!this.scene.settings.flash)g.fillStyle(f.color,.5*(1-k)).fillCircle(f.x,f.y,f.radius*.6*k+20);g.lineStyle(4,f.color,.8*(1-k)).strokeCircle(f.x,f.y,f.radius*k);return true;}if(f.explosion){const k=1-f.life/.32;g.fillStyle(0xb36c35,.18*(1-k)).fillCircle(f.x,f.y,f.radius*.8*k+15);g.fillStyle(0xe4ac5a,.55*(1-k)).fillCircle(f.x,f.y,15+f.radius*.35*k);if(!this.scene.settings.flash)g.fillStyle(0xf3d599,.6*(1-k)).fillCircle(f.x,f.y,10+f.radius*.13*k);}else{const size=f.big?24:14;g.fillStyle(f.color||0xedbe78,.9).fillTriangle(f.x+Math.cos(f.angle)*size,f.y+Math.sin(f.angle)*size,f.x+Math.cos(f.angle+1.5)*5,f.y+Math.sin(f.angle+1.5)*5,f.x+Math.cos(f.angle-1.5)*5,f.y+Math.sin(f.angle-1.5)*5);}return true;});
   for(const q of this.texts){if(q.life<=0)continue;q.life-=dt;q.y-=dt*44;q.obj.setPosition(q.x,q.y).setAlpha(Math.min(1,q.life*2.2)).setScale(1+Math.max(0,q.life-.75));if(q.life<=0)q.obj.setVisible(false);}
   if(p.aiming){l.lineStyle(1,0xc3cbb0,.3).lineBetween(p.x+Math.cos(p.angle)*40,p.y+Math.sin(p.angle)*40,p.x+Math.cos(p.angle)*500,p.y+Math.sin(p.angle)*500);}
   if(p.state==='melee'){const k=p.age/p.duration;l.lineStyle(p.heavy?5:3,0xd6d3ac,.35);l.beginPath();l.arc(p.x,p.y,p.heavy?68:52,p.angle-1+k*2,p.angle-.3+k*2);l.strokePath();}
   this.darkness(s,cam,self);this.drawWeather(s,cam,dt);
   for(const e of s.enemies)if(!e.dead&&!(e.gone>0)&&(e.active&&BPCore.distance(p,e)<1000||sensed(e)||e.rush))this.marker(e,C.red,cam,true);
   // Damage direction: a red arc on the side the hit came from, so cover can be chosen without guessing.
   this.hurt=this.hurt.filter(h=>(h.life-=dt)>0);for(const h of this.hurt){const r=Math.min(cam.width,cam.height)*.32;this.uiGraphics.lineStyle(10,C.red,.55*Math.min(1,h.life*1.6));this.uiGraphics.beginPath();this.uiGraphics.arc(cam.width/2,cam.height/2,r,h.angle-.32,h.angle+.32);this.uiGraphics.strokePath();}
   this.hitMark=Math.max(0,this.hitMark-dt);this.killMark=Math.max(0,this.killMark-dt);
   this.crosshair.clear();if(pointer){const x=pointer.x,y=pointer.y,spread=6+p.recoil*70;this.crosshair.lineStyle(1,C.paper,.8).strokeCircle(x,y,2);for(const [dx,dy] of [[-1,0],[1,0],[0,1],[0,-1]])this.crosshair.lineBetween(x+dx*spread,y+dy*spread,x+dx*(spread+6),y+dy*(spread+6));
    const mark=this.killMark>0?[C.red,9+this.killMark*20,2.5]:this.hitMark>0?[0xffffff,7,1.5]:null;if(mark){this.crosshair.lineStyle(mark[2],mark[0],.95);for(const [dx,dy] of [[-1,-1],[1,1],[1,-1],[-1,1]])this.crosshair.lineBetween(x+dx*mark[1]*.45,y+dy*mark[1]*.45,x+dx*mark[1],y+dy*mark[1]);}}
   if(this.damageFlash>0){this.damageFlash-=dt;this.uiGraphics.lineStyle(15,C.red,this.damageFlash*.8).strokeRect(5,5,cam.width-10,cam.height-10);}
   this.sweep();
   if(s.cinematic>0){this.uiGraphics.fillStyle(0x10170f,.95).fillRect(0,0,cam.width,38).fillRect(0,cam.height-38,cam.width,38);}
  }
  // Squads only. Callsigns ride above every operator (yours amber, another player's blue, an AI teammate's grey-blue;
  // in team deathmatch a fallen operator's tag counts down to their return). The revive station is a pad
  // on the ground that wakes up while someone is down and fills with colour, clockwise, as a revive is held; dog tags
  // lie where an operator fell, then ride with whoever picked them up. Whatever the survivor needs next - the tags, then the station - gets an arrow at the screen edge.
  squad(s,g,l,cam,t){const names=this.scene.names,ops=BPCore.ops(s),tags=s.tags||[],shown=names&&ops.some((o,i)=>i&&!o.vanished),me=names&&ops.find(o=>o.id===names.self)||s.player;
   if(s.tdm)for(const e of ops){if(e.dead||e.vanished)continue;const col=e===me?0xe2b074:e.team!==me.team?0xe39a82:0x8fc7e8;l.lineStyle(1.5,col,.5).strokeCircle(e.x,e.y+2,22);
    if(e!==me&&e.health<100){l.fillStyle(0x111d16,.8).fillRect(e.x-22,e.y-33,44,3);l.fillStyle(col).fillRect(e.x-22,e.y-33,44*Math.max(0,e.health/100),3);}}
   this.nameTags.forEach((tag,i)=>{const e=ops[i],name=shown&&e&&!e.vanished&&!(e.cloak&&this.self&&e.team!==this.self.team&&BPCore.veiled(s,e,this.self))?names[e.id]:null;if(!name){tag.setVisible(false);return;}
    tag.setText(e.dead?name+(s.tdm?' / '+Math.max(1,Math.ceil(e.respawn||0)):' / DOWN'):name).setColor(names.self===e.id?'#e2b074':s.tdm&&e.team!==me.team?'#e39a82':e.bot?'#9fb4bd':'#8fe3ff').setAlpha(e.dead?.6:.95).setPosition(e.x,e.y-(e.dead?22:34)).setVisible(true);});
   const st=s.station;this.stationLabel.setVisible(!!st);if(!st)return;const need=tags.length>0,fill=Math.min(1,Math.max(0,...tags.map(q=>q.progress||0))),col=need?0x9fd08a:0x6f8a66,beat=need&&!fill?1+Math.sin(t*5)*.07:1,d=this.decalsGraphics,top=-Math.PI/2;
   d.fillStyle(0x16241a,.6).fillCircle(st.x,st.y,42);
   if(fill>0){d.fillStyle(0x9fd08a,.5).slice(st.x,st.y,42,top,top+Math.PI*2*fill).fillPath();l.lineStyle(4,0xd6f2c4,.95).beginPath();l.arc(st.x,st.y,42,top,top+Math.PI*2*fill);l.strokePath();}
   d.fillStyle(fill>0?0xe9f7df:col,need?.9:.45).fillRect(st.x-5,st.y-16,10,32).fillRect(st.x-16,st.y-5,32,10);
   l.lineStyle(2,col,need?.9:.4).strokeCircle(st.x,st.y,42*beat);if(need&&!fill)l.lineStyle(1,col,.35).strokeCircle(st.x,st.y,60*beat);
   this.stationLabel.setText(fill>0?'REVIVING '+Math.round(fill*100)+'%':'REVIVE STATION').setPosition(st.x,st.y+48).setAlpha(need?1:.55);if(tags.some(q=>q.carrier))this.marker(st,0x9fd08a,cam);
   for(const q of tags){const k=q.carrier?.75:1,x=q.carrier?q.x+15:q.x,y=q.carrier?q.y-30:q.y;
    g.lineStyle(1.5,0x8e9484,.9).strokeCircle(x,y-7*k,5*k);for(const dx of [-8,1]){g.fillStyle(0xd9d3b8,1).fillRoundedRect(x+dx*k,y-3*k,7*k,11*k,2);g.lineStyle(1,0x5f6455,.9).strokeRoundedRect(x+dx*k,y-3*k,7*k,11*k,2);}
    if(!q.carrier){l.lineStyle(2,C.amber,.5+.4*Math.sin(t*6)).strokeCircle(q.x,q.y,22+Math.sin(t*6)*3);this.marker(q,C.amber,cam);}}}
  // Pickups use the shared icon art. Dropped guns lie on their side inside a pulsing amber outline with a name label as Rook closes in;
  // lethal/tactical refills show the gadget they will actually top up.
  // Labels over pickups never sit on one another: one that would overlap a label already placed this frame is lifted
  // clear of it, up to four times. Pickups are labelled nearest first, so the ones within reach always get theirs.
  placeLabel(lab,x,y){lab.setPosition(x,y);const w=lab.width,h=lab.height;for(let i=0;i<4;i++){const hit=this.placed.find(r=>x-w/2<r.x+r.w/2&&x+w/2>r.x-r.w/2&&y-h<r.y&&y>r.y-r.h);if(!hit)break;y=hit.y-hit.h-2;lab.setPosition(x,y);}this.placed.push({x,y,w,h});return lab;}
  drawPickups(s,g,t){this.placed=[];const p=this.self||s.player,RING={health:0xd4846c,supply:0xd4846c,armor:0x9fc0d0,ammo:0xd4c79b,lethal:0xc9d09a,tactical:C.cyan,intel:0xf1d27d,cache:0xf1d27d};let labels=0;
   for(const pick of [...s.pickups].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))){if(pick.taken)continue;const x=pick.x,y=pick.y,bob=Math.sin(t*3+x*.01)*2;
    if(pick.type==='weapon'){const w=BPWorld.weapons[pick.weapon],sz=BPIcons.size(pick.weapon),dw=sz.w*.47,dh=sz.h*.47,pulse=.5+.5*Math.sin(t*4),fresh=!pick.owned,rot=((Math.floor(x)*7+Math.floor(y)*3)%50-25)/100;
     g.fillStyle(C.amber,fresh?.13+.08*pulse:.05).fillEllipse(x,y,dw*1.3,dh*2);g.lineStyle(2,C.amber,fresh?.5+.4*pulse:.28).strokeEllipse(x,y,dw*1.2+4*pulse,dh*1.8+3*pulse);g.fillStyle(0x0b0f0a,.45).fillEllipse(x+3,y+5,dw*.92,dh*.55);
     const o=this.sprite(pick.id,'w:'+pick.weapon);if(o)o.setPosition(x,y).setDisplaySize(dw,dh).setRotation(rot).setDepth(6);else{g.fillStyle(0x23281d).fillRect(x-dw/2,y-3,dw,6);g.fillStyle(0x8b8a6e).fillRect(x-dw/2+2,y-2,dw-4,3);}
     const d=Math.hypot(p.x-x,p.y-y);if(d<240&&labels<this.labels.length){const lab=this.labels[labels++];this.placeLabel(lab.setText((fresh?'NEW · ':'')+w.short+(fresh?'':' · SWAP')),x,y-dh*.9-6).setColor(fresh?'#f4cf8e':'#d3dbc7').setAlpha(Math.min(1,(240-d)/60)).setVisible(true);}
     continue;}
    // Supply-drop crates. Each comes down on a parachute in the colour of its grade (Meta.RARITY: standard issue to
    // legendary), lands with a puff of smoke, and projects a hologram of what it sells over the lid, with the price.
    // A legendary crate also throws a column of gold light into the sky, so it can be found from across the map.
    if(pick.type==='offer'){const near=Math.hypot(p.x-x,p.y-y)<70,pulse=.5+.5*Math.sin(t*4),gun=pick.item==='weapon',r=Math.max(0,Math.min(4,pick.rarity??(gun?2:0))),col=RARITY_COL[r],
      key=gun?'w:'+pick.weapon:OFFER_ICON[pick.item]||'p:ammo',fall=Math.max(0,1-(s.time-(pick.at??-9))/.8),drop=fall*fall*340,cy=y-drop;
     if(fall>0){g.fillStyle(0x0b0f0a,.4*(1-fall)).fillEllipse(x+3,y+20,58*(1-fall*.5),18*(1-fall*.5));g.lineStyle(1,0xd8d2bf,.7).lineBetween(x-24,cy-18,x-4,cy-62).lineBetween(x+24,cy-18,x+4,cy-62);g.fillStyle(col,.85).slice(x,cy-62,30,Math.PI,0,false).fillPath();g.lineStyle(1.5,0x1a1f17,.6).strokeCircle(x,cy-62,1);}
     else{if(!this.landed.has(pick.id+'@'+pick.at)){this.landed.add(pick.id+'@'+pick.at);this.emit(x,y+12,10,'dust');this.emit(x,y,4,'smoke');if(r===4)this.emit(x,y,20,'spark');}g.fillStyle(0x0b0f0a,.5).fillEllipse(x+3,y+20,60,18);}
     if(r===4&&fall<.5){g.fillStyle(col,.07+.05*pulse).fillRect(x-16,cy-420,32,420);g.fillStyle(col,.1+.06*pulse).fillRect(x-6,cy-420,12,420);for(let i=0;i<6;i++){const q=t*.7+i*Math.PI/3;g.lineStyle(2,col,.16).lineBetween(x+Math.cos(q)*24,cy+Math.sin(q)*14,x+Math.cos(q)*70,cy+Math.sin(q)*42);}}
     g.fillStyle(0x262c22,.97).fillRoundedRect(x-28,cy-18,56,38,3);g.fillStyle(0x394131).fillRect(x-28,cy-18,56,9);g.fillStyle(0x1a1f17).fillRect(x-28,cy-18,7,38).fillRect(x+21,cy-18,7,38);
     g.fillStyle(col,.9).fillRect(x-21,cy+1,42,4);g.lineStyle(2,col,near?1:.5+.35*pulse).strokeRoundedRect(x-28,cy-18,56,38,3);if(near)g.lineStyle(1,col,.5).strokeRoundedRect(x-33,cy-23,66,48,5);
     // The hologram: a cone of light off the lid, the item floating in it, and a scan line running through it.
     const hy=cy-46+Math.sin(t*2.4+x*.01)*3;g.fillStyle(col,.09+.05*pulse).fillPoints([{x:x-9,y:cy-18},{x:x+9,y:cy-18},{x:x+24,y:hy+14},{x:x-24,y:hy+14}],true);g.lineStyle(1,col,.55).strokeEllipse(x,hy+14,48,8);
     const o=this.sprite(pick.id,key);if(o){if(gun){const sz=BPIcons.size(pick.weapon),k=Math.min(66/sz.w,34/sz.h);o.setDisplaySize(sz.w*k,sz.h*k);}else o.setDisplaySize(36,36);o.setPosition(x,hy).setRotation(0).setDepth(6).setAlpha(.82+.18*Math.sin(t*9+x));}
     const sl=hy-14+((t*26)%28);g.lineStyle(1,col,.35).lineBetween(x-22,sl,x+22,sl);
     if(labels<this.labels.length){const lab=this.labels[labels++];this.placeLabel(lab.setText((r===4?'★ LEGENDARY · ':'')+(gun?BPWorld.weapons[pick.weapon].short:OFFER_NAME[pick.item]||'SUPPLY')+' · '+pick.cost+' CR'),x,hy-30).setColor(RARITY_HEX[r]).setAlpha(near?1:.85).setVisible(true);}
     continue;}
    const key=pick.type==='lethal'?'g:'+(p.lethal||'frag'):pick.type==='tactical'?(p.tactical?'g:'+p.tactical:'p:gadget'):'p:'+(pick.type==='supply'?'health':pick.type),size=pick.type==='supply'?36:27;
    g.fillStyle(0x0b0f0a,.5).fillEllipse(x+3,y+10,size,size*.42);g.lineStyle(1.5,RING[pick.type]||0xb6bf99,.3+.25*Math.sin(t*4+x)).strokeCircle(x,y+bob,size*.66);
    const o=this.sprite(pick.id,key);if(o){o.setPosition(x,y-2+bob).setDisplaySize(size,size).setRotation(0).setDepth(6).setAlpha(pick.until&&pick.until-t<5?.35+.65*Math.abs(Math.sin(t*6)):1);continue;}
    g.fillStyle(PICKUP[pick.type]||0x797153).fillRoundedRect(x-11,y-9+bob,22,18,2);if(pick.type==='health'||pick.type==='supply'){g.fillStyle(0xd4d8b7,.9).fillRect(x-2,y-6+bob,4,12).fillRect(x-6,y-2+bob,12,4);}}
   for(let i=labels;i<this.labels.length;i++)this.labels[i].setVisible(false);}
  // Blacked-out maps: a full-screen dark layer with a forward flashlight cone, a small personal glow, lamps, gunfire and explosions erased out of it.
  darkness(s,cam,self=s.player){const level=s.dark||0;if(!level){if(this.dark)this.dark.setVisible(false);return;}const w=cam.width,h=cam.height;if(!this.dark){this.dark=this.scene.add.renderTexture(0,0,w,h).setOrigin(0).setScrollFactor(0).setDepth(15000);}if(this.dark.width!==w||this.dark.height!==h)this.dark.resize(w,h);
   const rt=this.dark,b=this.brush,p=self,ox=cam.scrollX,oy=cam.scrollY,light=(x,y,r,steps=4)=>{for(let i=0;i<steps;i++)b.fillStyle(0xffffff,.28).fillCircle(x-ox,y-oy,r*(1-i*.18));};rt.setVisible(true).clear().fill(0x05070a,level);b.clear();
   light(p.x,p.y,135);const a=p.angle,len=p.aiming?560:470,spread=p.aiming?.32:.46;for(let i=0;i<4;i++){const k=1-i*.16,sp=spread*k,L=len*k;b.fillStyle(0xffffff,.27).fillTriangle(p.x-ox,p.y-oy,p.x+Math.cos(a-sp)*L-ox,p.y+Math.sin(a-sp)*L-oy,p.x+Math.cos(a+sp)*L-ox,p.y+Math.sin(a+sp)*L-oy);b.fillCircle(p.x+Math.cos(a)*L*.82-ox,p.y+Math.sin(a)*L*.82-oy,L*Math.tan(sp)*.8);}
   for(const l of s.map.lights||[])light(l.x,l.y,level<.7?190:130,3);for(const f of this.flashes)light(f.x,f.y,f.explosion?f.radius*1.1:f.ring?f.radius*.5:85,2);for(const z of s.zones)if(z.kind==='fire')light(z.x,z.y,z.r*1.6,3);
   for(const e of s.enemies)if(!e.dead&&(s.recon>0||e.attack>0&&BPWorld.archetypes[e.type].locked))light(e.x,e.y,s.recon>0?46:40,2);for(const al of s.allies||[])light(al.x,al.y,60,2);for(const g of s.grenades)if(g.enemy&&g.age>=g.duration)light(g.x,g.y,70,2);
   rt.erase(b,0,0);}
  drawWeather(s,cam,dt){if(!this.weather.length)return;const ui=this.uiGraphics,w=cam.width,h=cam.height,kind=s.map.weather||'ash',dx=(this.lastCamX===undefined?0:cam.scrollX-this.lastCamX),dy=(this.lastCamY===undefined?0:cam.scrollY-this.lastCamY);this.lastCamX=cam.scrollX;this.lastCamY=cam.scrollY;
   for(const q of this.weather){if(kind==='snow'){q.y+=dt*(.05+.07*q.z);q.x+=dt*(.015*Math.sin(s.time+q.p))-dx/w*q.z;q.y-=dy/h*q.z;}else if(kind==='dust'){q.x+=dt*(.25+.3*q.z)-dx/w*q.z;q.y+=dt*.02*Math.sin(s.time+q.p)-dy/h*q.z;}else{q.y-=dt*(.02+.03*q.z);q.x+=dt*.01*Math.sin(s.time*.7+q.p)-dx/w*q.z;q.y-=dy/h*q.z;}
    q.x=(q.x%1+1)%1;q.y=(q.y%1+1)%1;const x=q.x*w,y=q.y*h;if(kind==='snow')ui.fillStyle(0xf2f6f8,.35+.4*q.z).fillCircle(x,y,1+q.z*1.6);else if(kind==='dust')ui.lineStyle(1,0xd8c49a,.15+.2*q.z).lineBetween(x,y,x+18*q.z,y);else ui.fillStyle(q.p>3?0xe58f45:0xa49d92,.25+.3*q.z).fillRect(x,y,1.5,1.5);}}
  // Versus objectives. Uplink's relays: a ring in the colour of whoever holds it (blue yours, red theirs, pale for
  // nobody's), the way it is being turned as an arc, a flicker while it is contested, and its letter. Breach's site: an
  // amber ring with the plant (or, once planted, the fuse and the defuse) drawn round it.
  objectives(s,g,l,t,cam,self){this.coopObjectives(s,g,l,t,cam);const T=s.tdm,labels=this.objLabels||(this.objLabels=Array.from({length:4},()=>this.scene.add.text(0,0,'',{fontFamily:'IBM Plex Mono, monospace',fontSize:'15px',color:'#e7e8de',stroke:'#0b0f0a',strokeThickness:4}).setOrigin(.5).setDepth(10960)));
   labels.forEach(q=>q.setVisible(false));if(!T)return;const mine=self?.team??0,team=x=>x<0?0xc9d0b6:x===mine?C.cyan:C.red;
   (T.relays||[]).forEach((z,i)=>{const col=team(z.owner),k=Math.abs(z.progress),by=z.progress>0?0:1,flick=z.contested?.45+.45*Math.abs(Math.sin(t*9)):1;
    g.fillStyle(col,.07*flick).fillCircle(z.x,z.y,z.r);l.lineStyle(2,col,.75*flick).strokeCircle(z.x,z.y,z.r);
    if(k>0&&k<1){l.lineStyle(5,team(by),.95).beginPath();l.arc(z.x,z.y,z.r,-Math.PI/2,-Math.PI/2+Math.PI*2*k);l.strokePath();}
    g.fillStyle(0x1b221b,.9).fillCircle(z.x,z.y,15);g.lineStyle(2,col,.95).strokeCircle(z.x,z.y,15);labels[i].setVisible(true).setText(z.id).setPosition(z.x,z.y).setColor('#'+col.toString(16).padStart(6,'0'));
    if(z.owner!==mine)this.marker(z,col,cam);});
   if(T.site&&T.phase!=='over'){const z=T.site,armed=T.planted,col=armed?C.red:C.amber,beat=armed?.6+.4*Math.abs(Math.sin(t*(T.fuse<8?14:6))):1;
    g.fillStyle(col,.08*beat).fillCircle(z.x,z.y,z.r);l.lineStyle(2.5,col,.85*beat).strokeCircle(z.x,z.y,z.r);
    const k=armed?(T.defuse>0?T.defuse/5:1-T.fuse/30):T.plant/4,arc=armed&&T.defuse>0?C.cyan:col;if(k>0){l.lineStyle(5,arc,.95).beginPath();l.arc(z.x,z.y,z.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*k);l.strokePath();}
    g.fillStyle(0x1b221b,.9).fillRoundedRect(z.x-14,z.y-10,28,20,3);g.lineStyle(2,col,.95).strokeRoundedRect(z.x-14,z.y-10,28,20,3);if(armed)g.fillStyle(C.red,beat).fillCircle(z.x,z.y,4);
    labels[3].setVisible(true).setText(armed?'CHARGE · '+Math.max(0,Math.ceil(T.fuse))+'s':'SITE').setPosition(z.x,z.y-z.r-14).setColor(armed?'#ff7b6b':'#e2b074');this.marker(z,col,cam);}}
  // A flow-trial ghost: the best run's operator, drawn pale and see-through beside the player.
  drawGhost(gs,dt){const p=gs.player;this.drawActor({...p,id:'ghost-run'},gs,dt,true);const a=this.actors.get('ghost-run');if(!a)return;for(const o of [a.body,a.feet,a.gear])o.setAlpha(.32).setTint?.(0x9fe0ff);a.shadow.setAlpha(.12);}
  // Extraction: the caches (a crate with a pulsing amber ring) and the landing zone, with the hold drawn round it.
  // Flow trials: the gates in order - the next one bright with its number, the rest faint - and a marker to the next.
  coopObjectives(s,g,l,t,cam){const tl=this.trialLabels||(this.trialLabels=Array.from({length:12},()=>this.scene.add.text(0,0,'',{fontFamily:'IBM Plex Mono, monospace',fontSize:'15px',color:'#e7e8de',stroke:'#0b0f0a',strokeThickness:4}).setOrigin(.5).setDepth(10960)));tl.forEach(q=>q.setVisible(false));
   const X=s.extract;if(X){for(const q of s.pickups){if(q.type!=='loot'||q.taken)continue;const beat=1+.08*Math.sin(t*5+q.x);g.fillStyle(0x0b0f0a,.5).fillEllipse(q.x+3,q.y+12,38,12);g.fillStyle(0x3d3424).fillRoundedRect(q.x-15,q.y-11,30,22,3);g.lineStyle(2,C.amber,.95).strokeRoundedRect(q.x-15,q.y-11,30,22,3);g.lineStyle(2,C.amber,.6).lineBetween(q.x-15,q.y-2,q.x+15,q.y-2);l.lineStyle(1.5,C.amber,.45).strokeCircle(q.x,q.y,34*beat);if(!X.called)this.marker(q,C.amber,cam);}
    const z=X.lz,k=Math.min(1,X.hold/X.need),col=0x9fd08a;g.fillStyle(col,.07).fillCircle(z.x,z.y,z.r);l.lineStyle(2,col,X.called?.95:.6).strokeCircle(z.x,z.y,z.r);l.lineStyle(2,col,.5).lineBetween(z.x-18,z.y,z.x+18,z.y).lineBetween(z.x,z.y-18,z.x,z.y+18);
    if(k>0){l.lineStyle(5,0xd6f2c4,.95).beginPath();l.arc(z.x,z.y,z.r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*k);l.strokePath();}tl[0].setVisible(true).setText(X.called?'HOLD · '+Math.max(0,Math.ceil(X.need-X.hold))+'s':'LANDING ZONE').setPosition(z.x,z.y-z.r-14).setColor('#9fd08a');this.marker(z,col,cam);}
   const T=s.trial;if(T){T.gates.forEach((q,i)=>{if(i===0&&T.started)return;const next=i===T.next,done=i<T.next,col=next?C.amber:0xc9d0b6;if(done)return;
     l.lineStyle(next?3:1.5,col,next?.95:.35).strokeCircle(q.x,q.y,q.r);if(next){g.fillStyle(col,.08).fillCircle(q.x,q.y,q.r);this.marker(q,col,cam);}if(i<tl.length-1)tl[i+1].setVisible(true).setText(i===0?'START':i===T.gates.length-1?'FINISH':String(i)).setPosition(q.x,q.y).setColor(next?'#e2b074':'#9aa58c').setAlpha(next?1:.55);});}}
  marker(obj,col,cam,enemy=false){const x=(obj.x-cam.scrollX)*cam.zoom,y=(obj.y-cam.scrollY)*cam.zoom,w=cam.width,h=cam.height;if(x>40&&x<w-40&&y>90&&y<h-100)return;const dx=x-w/2,dy=y-h/2,a=Math.atan2(dy,dx),radius=Math.min((w/2-40)/(Math.abs(Math.cos(a))||.01),(h/2-105)/(Math.abs(Math.sin(a))||.01)),sx=w/2+Math.cos(a)*radius,sy=h/2+Math.sin(a)*radius;const g=this.uiGraphics;g.fillStyle(col,enemy?.65:.95).fillTriangle(sx+Math.cos(a)*7,sy+Math.sin(a)*7,sx+Math.cos(a+2.2)*6,sy+Math.sin(a+2.2)*6,sx+Math.cos(a-2.2)*6,sy+Math.sin(a-2.2)*6);}
 }
 Render.palette=k=>Object.assign(C,PALETTES[k]||PALETTES.standard);
 root.BPRender=Render;
})(globalThis);

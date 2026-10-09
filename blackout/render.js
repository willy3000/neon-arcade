(function(root){'use strict';
 const C={asphalt:0x343b36,curb:0x727568,concrete:0x60665a,roof:0x4b5547,edge:0x879078,shadow:0x111b15,amber:0xe2b074,red:0xd3846c,paper:0xd4debf};
 function color(hex){return Number.parseInt(hex.replace('#',''),16);}
 class Render {
  constructor(scene){this.scene=scene;this.staticObjects=[];this.actors=new Map();this.props=new Map();this.particles=Array.from({length:320},()=>({active:false}));this.flashes=[];this.decals=[];this.cameraX=0;this.cameraY=0;this.lastMap=null;
   this.effects=scene.add.graphics().setDepth(11000);this.lines=scene.add.graphics().setDepth(10900);this.decalsGraphics=scene.add.graphics().setDepth(2);this.uiGraphics=scene.add.graphics().setScrollFactor(0).setDepth(20000);
   this.crosshair=scene.add.graphics().setScrollFactor(0).setDepth(20010);
  }
  clear(){for(const obj of this.staticObjects)obj.destroy();this.staticObjects=[];for(const a of this.actors.values())for(const obj of Object.values(a))if(obj?.destroy)obj.destroy();this.actors.clear();this.props.clear();this.decals=[];this.flashes=[];for(const p of this.particles)p.active=false;this.decalsGraphics.clear();this.effects.clear();this.lines.clear();this.uiGraphics.clear();this.crosshair.clear();}
  static preload(scene){scene.load.atlas('characters','blackout/assets/characters.png','blackout/assets/characters.json');scene.load.atlas('props','blackout/assets/props.png','blackout/assets/props.json');scene.load.svg('helicopter','blackout/assets/helicopter.svg');}
  build(s){this.clear();this.lastMap=s.map.id;const scene=this.scene,g=scene.add.graphics().setDepth(0);this.staticObjects.push(g);const map=s.map;g.fillStyle(C.asphalt).fillRect(0,0,map.width,map.height);
   // Permanent wear is deterministic, baked once, and is not a frame-time effect.
   let seed=4103;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<4500;i++){const x=rand()*map.width,y=rand()*map.height;g.fillStyle(rand()>.5?0x91a38a:0x19261e,.1+rand()*.1).fillRect(x,y,1+rand()*4,1+rand()*2);}
   if(!s.training){
    g.fillStyle(0x28332c).fillRect(565,40,163,1730);g.fillStyle(0x28332c).fillRect(1300,40,335,1560);g.fillStyle(0x28332c).fillRect(40,390,2520,140);g.fillStyle(0x28332c).fillRect(520,1000,1795,185);g.fillStyle(0x3a4436).fillRect(1655,1310,660,470);
    g.lineStyle(2,0xa59d72,.4);for(let y=40;y<1800;y+=65){g.lineBetween(643,y,643,y+28);g.lineBetween(650,y,650,y+28);}for(let x=60;x<2500;x+=70)g.lineBetween(x,457,x+32,457);for(let y=80;y<1350;y+=80)g.lineBetween(1450,y,1450,y+35);
    g.lineStyle(2,0xb3b29a,.28);for(let x=1690;x<2290;x+=90){g.strokeRect(x,1350,75,100);g.strokeRect(x,1660,75,95);}
    for(const [x,y,vertical] of [[565,895,true],[1305,550,false],[1620,1005,true]]){g.fillStyle(0xb8b99c,.33);for(let i=0;i<6;i++)if(vertical)g.fillRect(x+i*23,y,13,98);else g.fillRect(x,y+i*22,125,12);}
    g.fillStyle(0x626750).fillRect(1288,420,27,160);g.fillStyle(0x454e35).fillRect(1294,426,15,145);g.fillStyle(0x656a51).fillRect(2290,1360,22,365);g.fillStyle(0x424e34).fillRect(2295,1365,13,350);
    for(let i=0;i<16;i++){const x=1297+rand()*10,y=430+rand()*145;g.fillStyle(0x7c8854,.6).fillCircle(x,y,3+rand()*8);}
    // Crashed aircraft, scorched rotor path, shattered street signs.
    g.fillStyle(0x15221a,.65).fillEllipse(345,570,375,290);g.fillStyle(0x282d20,.7).fillEllipse(355,575,280,215);g.lineStyle(8,0x202a21,.8);g.lineBetween(95,590,480,495);g.lineBetween(275,745,385,480);
    const heli=scene.add.image(260,570,'helicopter').setScale(.57).setRotation(-.7).setDepth(4).setTint(0xa1aa88);this.staticObjects.push(heli);
    this.fires=[{x:220,y:542,size:26},{x:310,y:637,size:19},{x:1640,y:400,size:13}];
   }else{
    this.fires=[];g.fillStyle(0x4c5548).fillRect(60,300,840,840);g.lineStyle(1,0xa6b394,.13);for(let x=60;x<1740;x+=90)g.lineBetween(x,300,x,1200);for(let y=300;y<1200;y+=90)g.lineBetween(60,y,1740,y);
    g.lineStyle(3,C.amber,.35);g.strokeRect(1040,180,650,900);g.lineStyle(2,0x959d82,.5);for(let y=240;y<1100;y+=180){g.lineBetween(1050,y,1090,y);g.lineBetween(1050,y+90,1090,y+90);}g.fillStyle(0x242d23).fillRect(345,915,105,68);
   }
   for(const b of s.walls){if(b.kind==='building')this.building(g,b,rand);else this.prop(b);}
   for(let i=0;i<(s.training?100:300);i++){const x=rand()*map.width,y=rand()*map.height;if(s.walls.some(w=>w.kind==='building'&&x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h))continue;g.fillStyle(0x939b80,.2).fillRect(x,y,3+rand()*9,2+rand()*4);if(i%6===0){g.lineStyle(1,0x17271c,.4);g.lineBetween(x,y,x+rand()*15,y+rand()*8);}}
   // Bake thousands of floor/roof marks to one texture; keep interactive props separate.
   if(scene.textures.exists('battlefield'))scene.textures.remove('battlefield');
   g.generateTexture('battlefield',map.width,map.height);g.destroy();this.staticObjects=this.staticObjects.filter(o=>o!==g);
   this.staticObjects.push(scene.add.image(0,0,'battlefield').setOrigin(0).setDepth(0));
   for(const a of map.areas){const text=scene.add.text(a.x,a.y,a.label,{fontFamily:'monospace',fontSize:'10px',color:'#a9b499'}).setAlpha(.48).setDepth(1);this.staticObjects.push(text);}
   const cam=scene.cameras.main;cam.setBounds(0,0,map.width,map.height);this.cameraX=s.player.x;this.cameraY=s.player.y;cam.centerOn(this.cameraX,this.cameraY);
  }
  building(g,b,rand){if(b.w>240&&b.h>180){g.fillStyle(C.shadow,.55).fillRect(b.x+22,b.y+29,b.w,b.h);g.fillStyle(C.curb).fillRect(b.x-13,b.y-13,b.w+26,b.h+26);g.fillStyle(0x313f31).fillRect(b.x,b.y,b.w,b.h);g.fillStyle(C.roof).fillRect(b.x+5,b.y+5,b.w-10,b.h-10);g.lineStyle(4,C.edge,.5).strokeRect(b.x+5,b.y+5,b.w-10,b.h-10);g.lineStyle(1,0xa6b59a,.13);for(let y=b.y+16;y<b.y+b.h-10;y+=15)g.lineBetween(b.x+12,y,b.x+b.w-12,y);
     const inner=b.w>600?3:2;for(let i=0;i<inner;i++){const x=b.x+35+(b.w-90)*i/inner,y=b.y+35;g.fillStyle(0x26352b,.6).fillRect(x+5,y+8,80,45);g.fillStyle(0x68745f).fillRect(x,y,80,42);g.lineStyle(2,0x89917c,.45).strokeRect(x,y,80,42);g.fillStyle(0x2d3a2e).fillCircle(x+22,y+21,13);g.fillCircle(x+57,y+21,13);g.lineStyle(2,0x818a70,.6);g.lineBetween(x+22,y+10,x+22,y+32);g.lineBetween(x+10,y+21,x+34,y+21);g.lineBetween(x+57,y+10,x+57,y+32);}
     if(b.h>300){g.fillStyle(0x303d30).fillRect(b.x+40,b.y+b.h-150,b.w-90,100);g.lineStyle(2,0x819174,.4).strokeRect(b.x+40,b.y+b.h-150,b.w-90,100);g.lineStyle(1,0xa0ac88,.15);for(let y=b.y+b.h-141;y<b.y+b.h-55;y+=10)g.lineBetween(b.x+50,y,b.x+b.w-60,y);}
     g.fillStyle(0x1f3026,.5);for(let x=b.x+18;x<b.x+b.w-30;x+=50)g.fillRect(x,b.y+b.h-8,24,6);
     for(let i=0;i<12;i++)g.fillStyle(0x1c2e22,.18).fillRect(b.x+rand()*b.w,b.y+rand()*b.h,10+rand()*25,4+rand()*12);
     if(b.id==='b5'||b.id==='b9'){g.lineStyle(4,0x203124,.7);g.beginPath();g.moveTo(b.x+b.w-80,b.y+2);g.lineTo(b.x+b.w-105,b.y+54);g.lineTo(b.x+b.w-60,b.y+95);g.lineTo(b.x+b.w-80,b.y+140);g.strokePath();}
   }else{g.fillStyle(0x212e23).fillRect(b.x,b.y,b.w,b.h);g.lineStyle(3,0x6c7859,.5).strokeRect(b.x,b.y,b.w,b.h);}}
  prop(b){const scene=this.scene,container=scene.add.container(b.x+b.w/2,b.y+b.h/2).setDepth(5);this.staticObjects.push(container);const g=scene.add.graphics();container.add(g);g.fillStyle(C.shadow,.5).fillRect(-b.w/2+6,-b.h/2+9,b.w,b.h);
   if(b.kind==='crate'){container.add(scene.add.image(0,0,'props','crate').setDisplaySize(b.w,b.h));g.lineStyle(2,0x373c26,.8).strokeRect(-b.w/2,-b.h/2,b.w,b.h);}
   else if(b.kind==='barrel'){g.fillStyle(0x5a5a3c).fillRoundedRect(-15,-19,30,38,5);g.lineStyle(3,0x97936c).lineBetween(-15,-10,15,-10).lineBetween(-15,10,15,10);g.fillStyle(0xc19c64).fillTriangle(0,-6,-7,7,7,7);g.fillStyle(0x303528).fillCircle(0,3,2);g.lineStyle(1,0xb0ad82,.4).strokeRoundedRect(-15,-19,30,38,5);}
   else if(b.kind==='barrier'||b.kind==='underpass'){g.fillStyle(b.kind==='underpass'?0x363d32:0x69705b).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,0xa5ac8c,.6).lineBetween(-b.w/2,-b.h/2+3,b.w/2,-b.h/2+3);g.fillStyle(0x384532,.5).fillRect(-b.w/2+3,b.h/2-7,b.w-6,7);g.lineStyle(2,0x242f25,.6);if(b.w>b.h)for(let x=-b.w/2+20;x<b.w/2;x+=30)g.lineBetween(x,-b.h/2,x,b.h/2);else for(let y=-b.h/2+20;y<b.h/2;y+=30)g.lineBetween(-b.w/2,y,b.w/2,y);if(b.kind==='underpass'){g.lineStyle(3,C.amber,.7).lineBetween(-b.w/2,-b.h/2,b.w/2,b.h/2);}}
   else if(b.kind==='glass'){g.fillStyle(0x96b8b0,.3).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,0xafc0b0,.6).strokeRect(-b.w/2,-b.h/2,b.w,b.h);g.lineBetween(-b.w/2+4,-b.h/2+10,b.w/2-4,b.h/2-10);}
   else if(b.kind==='console'){container.add(scene.add.image(0,0,'props','console').setDisplaySize(b.w,b.h).setTint(0xa0b18d));g.fillStyle(C.amber,.8).fillRect(-8,-5,16,4);}
   else if(b.kind==='vehicle'){const horizontal=b.w>b.h;g.fillStyle(0x1c2b22).fillRoundedRect(-b.w/2,-b.h/2,b.w,b.h,9);g.fillStyle(0x646751).fillRoundedRect(-b.w/2+5,-b.h/2+5,b.w-10,b.h-10,8);g.fillStyle(0x35483b);if(horizontal){g.fillRect(-b.w/2+18,-b.h/2+8,30,b.h-16);g.fillRect(b.w/2-45,-b.h/2+8,25,b.h-16);g.lineStyle(2,0xa3a684,.5).strokeRect(-b.w/2+57,-b.h/2+10,b.w-108,b.h-20);}else{g.fillRect(-b.w/2+8,-b.h/2+20,b.w-16,25);g.fillRect(-b.w/2+8,b.h/2-40,b.w-16,18);g.lineStyle(2,0xa3a684,.5).strokeRect(-b.w/2+10,-b.h/2+58,b.w-20,b.h-105);}g.fillStyle(0xb6b597,.7).fillRect(-b.w/2+5,-b.h/2+5,7,5);}
   else{g.fillStyle(0x737962).fillRect(-b.w/2,-b.h/2,b.w,b.h);g.lineStyle(2,0x343e2c);for(let y=-b.h/2;y<b.h/2;y+=15)g.lineBetween(-b.w/2,y,b.w/2,y);}
   this.props.set(b.id,{container,b});
  }
  actor(id){let a=this.actors.get(id);if(a)return a;const scene=this.scene;a={shadow:scene.add.ellipse(0,0,40,24,C.shadow,.5),feet:scene.add.sprite(0,0,'characters','feet/idle/0'),ghost:scene.add.sprite(0,0,'characters','rifle/idle/0').setVisible(false),body:scene.add.sprite(0,0,'characters','rifle/idle/0'),gear:scene.add.graphics(),phase:0,lastFrame:'',lastSeq:'',blend:0};this.actors.set(id,a);return a;}
  drawActor(e,s,dt,isPlayer){const a=this.actor(e.id||'rook'),w=isPlayer?BPWorld.weapons[e.slots[e.slot]]:BPWorld.weapons.rifle;const speed=Math.hypot(e.vx,e.vy),state=e.state||'idle';a.phase+=speed*dt/95;const face=e.angle||0;let feetSeq='idle',seq='idle',bodyTime=s.time*10,footTime=a.phase*20,angle=face,scaleX=1,scaleY=1,lift=0;
   if(e.dead||state==='death'){a.shadow.setVisible(false);a.feet.setVisible(false);a.body.setVisible(true).setFrame(w.sprite+'/idle/8').setPosition(e.x+6,e.y).setRotation(face+.6).setScale(.86,.55).setTint(0x747761).setDepth(3).setAlpha(.65);a.gear.clear();a.ghost.setVisible(false);return;}
   if(speed>8){feetSeq=state==='sprint'?'run':'walk';seq='move';bodyTime=a.phase*20;const moveAngle=isPlayer?e.moveAngle:Math.atan2(e.vy,e.vx),relative=Math.atan2(Math.sin(moveAngle-face),Math.cos(moveAngle-face));if(Math.abs(relative)>.6&&Math.abs(relative)<2.5)feetSeq=relative>0?'strafe_right':'strafe_left';if(Math.abs(relative)>2.5)footTime=-a.phase*20;}
   let count=20,group=w.sprite;if(isPlayer&&e.reload>0){seq='reload';bodyTime=(1-e.reload/e.reloadTotal)*(group==='handgun'?15:20);count=group==='handgun'?15:20;}
   else if(state==='melee'){group='knife';seq='meleeattack';bodyTime=e.age/e.duration*15;count=15;angle+=Math.sin(e.age/e.duration*Math.PI)*.18;}
   else if(e.shotAge<.12){seq='shoot';count=3;bodyTime=e.shotAge/.12*3;}
   if(state==='slide'){feetSeq='strafe_right';footTime=e.age*23;seq='move';bodyTime=e.age*17;scaleY=.72;angle=e.angle+Math.sin(e.age*5)*.08;}
   if(state==='roll'){feetSeq='run';footTime=e.age*75;seq='move';bodyTime=e.age*60;const t=e.age/e.duration;angle=e.actionDir+Math.sin(t*Math.PI)*1.45;scaleY=.5+.5*Math.abs(Math.cos(t*Math.PI));scaleX=.82;lift=Math.sin(t*Math.PI)*8;}
   if(state==='dive'){feetSeq='run';footTime=e.age*50;seq='move';bodyTime=e.age*30;angle=e.actionDir;scaleX=1.18;scaleY=.64;lift=Math.sin(e.age/e.duration*Math.PI)*12;}
   if(state==='vault'){feetSeq='run';footTime=e.age*48;seq='move';bodyTime=e.age*35;scaleX=.9;scaleY=.88;lift=Math.sin(e.age/e.duration*Math.PI)*19;}
   if(a.hitTime>0){a.hitTime=Math.max(0,a.hitTime-dt);angle+=Math.sin(a.hitTime/.14*Math.PI)*.18;scaleX*=1-a.hitTime*.7;}
   if(isPlayer&&e.heal>0){group='handgun';seq='reload';count=15;bodyTime=(1-e.heal/e.healTotal)*15;}
   const index=Math.max(0,Math.min(count-1,Math.floor(((bodyTime%count)+count)%count))),frame=group+'/'+seq+'/'+index;
   if(a.lastSeq!==group+'/'+seq){a.ghost.setFrame(a.lastFrame||frame).setVisible(true);a.blend=.07;a.lastSeq=group+'/'+seq;}
   a.blend=Math.max(0,a.blend-dt);a.lastFrame=frame;
   const feetFrame=feetSeq==='idle'?0:Math.floor(((footTime%20)+20)%20);const tint=isPlayer?0xc4cfad:e.type==='shield'?0xaaa58e:e.type==='sniper'?0x8dafa1:e.type==='commander'?0xc9aa89:0xb2a797;
   a.shadow.setPosition(e.x+5,e.y+9).setVisible(true).setScale(1-lift/55).setDepth(4);
   a.feet.setFrame('feet/'+feetSeq+'/'+feetFrame).setPosition(e.x,e.y-lift*.45).setRotation(face).setScale(state==='dive'?1.2:1,state==='roll'?.72:1).setTint(tint).setVisible(true).setDepth(e.y+50);
   const recoil=e.shotAge<.12?(1-e.shotAge/.12)*(w.sprite==='shotgun'?5:2):0;
   a.body.setVisible(true).setFrame(frame).setPosition(e.x-Math.cos(face)*recoil,e.y-lift-Math.sin(face)*recoil).setRotation(angle).setScale(scaleX,scaleY).setTint(tint).setAlpha(a.blend>0?1-a.blend/.07:1).setDepth(e.y+51);
   a.ghost.setPosition(e.x,e.y-lift).setRotation(angle).setScale(scaleX,scaleY).setTint(tint).setAlpha(a.blend/.07).setDepth(e.y+50.5).setVisible(a.blend>0);
   a.gear.setVisible(true).clear().setPosition(e.x,e.y-lift).setRotation(angle).setDepth(e.y+53);const g=a.gear;
   if(isPlayer){g.lineStyle(4,0xd1b170,.95).lineBetween(-8,-15,-2,-13);g.lineStyle(2,0x272e21,.7).lineBetween(-11,-18,-9,-7);g.fillStyle(0xa89c76,.7).fillRect(-14,-8,4,6);}
   else{g.lineStyle(4,0x9a705b,.9).lineBetween(-8,-15,-2,-13);}
   if(e.type==='shield'){g.fillStyle(0x677064,.95).fillRoundedRect(20,-28,10,56,3);g.lineStyle(2,0xa8ad90,.7).strokeRoundedRect(20,-28,10,56,3);g.lineStyle(3,0xe0b572,.6).lineBetween(21,-7,28,-7);}
   if(e.type==='commander'){g.lineStyle(3,C.amber,.9).lineBetween(-9,-18,-1,-16);}
   if(e.type==='drone'){a.body.setVisible(false);a.feet.setVisible(false);a.ghost.setVisible(false);g.fillStyle(0x556b5a).fillRect(-15,-12,30,24);g.lineStyle(3,0x899f80,.8).lineBetween(-22,-18,22,18).lineBetween(-22,18,22,-18);g.lineStyle(2,0x314b3b,.7);for(const [x,y] of [[-22,-18],[22,-18],[-22,18],[22,18]])g.strokeEllipse(x,y,20,8);g.fillStyle(C.amber).fillRect(9,-3,9,6);g.setPosition(e.x,e.y-12-Math.sin(s.time*4)*3);}
  }
  emit(x,y,count,kind='spark',angle=null){const max=this.scene.settings.quality==='low'?Math.ceil(count/2):count;for(let i=0;i<max;i++){const p=this.particles.find(p=>!p.active);if(!p)break;const a=angle===null?Math.random()*Math.PI*2:angle+(Math.random()-.5)*1.8;const speed=kind==='smoke'?15+Math.random()*35:70+Math.random()*190;Object.assign(p,{active:true,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:kind==='smoke'?1.4+Math.random()*1.4:.2+Math.random()*.6,total:kind==='smoke'?2:.8,kind,size:kind==='smoke'?7+Math.random()*14:1+Math.random()*4,color:kind==='spark'?0xddb170:kind==='glass'?0xa8c5b7:kind==='cloth'?0x987c62:kind==='dust'?0xa7a087:kind==='casing'?0xad9b64:0x596457});}}
  event(e){switch(e.type){case 'shot':this.emit(e.x,e.y,e.weapon==='shotgun'?13:4,'spark',e.angle);this.emit(e.x,e.y,2,'smoke',e.angle);this.emit(e.x-Math.cos(e.angle)*16,e.y-Math.sin(e.angle)*16,1,'casing',e.angle+Math.PI/2);this.flashes.push({x:e.x,y:e.y,angle:e.angle,life:.055,big:e.weapon==='shotgun'});if(!e.enemy&&e.weapon==='shotgun')this.shake(.045,.002);break;
    case 'hit':{this.emit(e.x,e.y,5,'cloth',e.angle);const actor=this.actors.get(e.id);if(actor)actor.hitTime=.14;break;}
    case 'bulletimpact':this.emit(e.x,e.y,5,'spark');this.decals.push({x:e.x,y:e.y,size:2});break;
    case 'meleeimpact':this.emit(e.x,e.y,12,'dust');this.shake(.075,.0025);break;
    case 'destroy':this.emit(e.x,e.y,25,e.kind==='glass'?'glass':'dust');this.emit(e.x,e.y,5,'smoke');this.decals.push({x:e.x,y:e.y,size:Math.max(e.w,e.h)*.48});break;
    case 'explosion':this.emit(e.x,e.y,45,'spark');this.emit(e.x,e.y,35,'dust');this.emit(e.x,e.y,18,'smoke');this.decals.push({x:e.x,y:e.y,size:e.radius*.4});this.flashes.push({x:e.x,y:e.y,life:.32,explosion:true,radius:e.radius});const p=this.scene.sim.player;this.shake(.22,.008*Math.max(.15,1-Math.hypot(p.x-e.x,p.y-e.y)/900));break;
    case 'action':if(['slide','roll','dive','vault'].includes(e.action))this.emit(e.x,e.y,7,'dust');break;
    case 'damage':if(!this.scene.settings.flash)this.damageFlash=.17;this.shake(.09,.002);break;
    case 'pickup':this.emit(e.x,e.y,8,'dust');break;
  }if(this.decals.length>160)this.decals.splice(0,this.decals.length-160);}
  shake(duration,intensity){const strength=this.scene.settings.shake;if(strength>0)this.scene.cameras.main.shake(duration*1000,intensity*strength);}
  update(s,dt,pointer){if(this.lastMap!==s.map.id)this.build(s);const g=this.effects,l=this.lines,cam=this.scene.cameras.main,p=s.player;g.clear();l.clear();this.uiGraphics.clear();
   const aimX=Math.cos(p.angle)*(p.aiming?115:65),aimY=Math.sin(p.angle)*(p.aiming?115:65),targetX=p.x+p.vx*.14+aimX,targetY=p.y+p.vy*.14+aimY,lerp=1-Math.exp(-dt*6);
   this.cameraX+=(targetX-this.cameraX)*lerp;this.cameraY+=(targetY-this.cameraY)*lerp;cam.centerOn(this.cameraX,this.cameraY);
   for(const {container,b} of this.props.values()){container.setVisible(!b.dead);if(!b.dead&&Number.isFinite(b.hp)&&b.hp<b.maxHp)container.setAlpha(.6+.4*b.hp/b.maxHp);}
   this.drawActor(p,s,dt,true);for(const e of s.enemies){const visible=e.x>cam.worldView.x-120&&e.x<cam.worldView.right+120&&e.y>cam.worldView.y-120&&e.y<cam.worldView.bottom+120;if(visible)this.drawActor(e,s,dt,false);else{const a=this.actors.get(e.id);if(a)for(const obj of [a.body,a.ghost,a.feet,a.gear,a.shadow])obj.setVisible(false);}if(visible&&e.active&&!e.dead){if(e.attack>0){const t=Math.min(1,e.attackAge/e.attack);l.lineStyle(e.type==='sniper'?2:1,e.type==='sniper'?C.red:C.amber,.2+.6*t);l.lineBetween(e.x,e.y,e.x+Math.cos(e.aim)*Math.min(950,BPCore.distance(e,p)),e.y+Math.sin(e.aim)*Math.min(950,BPCore.distance(e,p)));l.lineStyle(2,C.red,.8).strokeCircle(e.x,e.y,24+4*t);}if(e.hp<e.maxHp||e.type==='commander'){l.fillStyle(0x111d16,.8).fillRect(e.x-22,e.y-38,44,3);l.fillStyle(e.type==='commander'?C.amber:0xb1b99b).fillRect(e.x-22,e.y-38,44*Math.max(0,e.hp/e.maxHp),3);}}}
   for(const b of s.projectiles){if(!b.active)continue;g.lineStyle(b.explosive?4:2,b.enemy?0xd5a385:0xe0caa0,.9).lineBetween(b.x,b.y,b.x-b.vx*.013,b.y-b.vy*.013);if(b.explosive){g.fillStyle(0xf6d99a,.8).fillCircle(b.x,b.y,4);this.emit(b.x,b.y,1,'smoke');}}
   for(const grenade of s.grenades){const t=Math.min(1,grenade.age/grenade.duration),lift=Math.sin(t*Math.PI)*45;g.fillStyle(0x1c271c,.8).fillEllipse(grenade.x+3,grenade.y+4,12,7);g.fillStyle(grenade.enemy?C.red:0xaeb78c).fillCircle(grenade.x,grenade.y-lift,5);if(grenade.age>=grenade.duration){l.lineStyle(1,grenade.enemy?C.red:C.amber,.65).strokeCircle(grenade.x,grenade.y,155);l.lineStyle(2,grenade.enemy?C.red:C.amber,.9);l.beginPath();l.arc(grenade.x,grenade.y,13,-Math.PI/2,-Math.PI/2+(grenade.age/grenade.fuse)*Math.PI*2);l.strokePath();}}
   for(const w of s.spawnWarnings){l.lineStyle(2,C.red,.65).strokeRect(w.x-25,w.y-25,50,50);l.lineBetween(w.x-9,w.y-9,w.x+9,w.y+9);l.lineBetween(w.x-9,w.y+9,w.x+9,w.y-9);}
   for(const pick of s.pickups){if(pick.taken)continue;const x=pick.x,y=pick.y,bob=Math.sin(s.time*3)*2;g.fillStyle(0x162417,.65).fillEllipse(x+3,y+7,24,12);g.fillStyle(pick.type==='health'?0x5c7155:pick.type==='armor'?0x526559:0x797153).fillRoundedRect(x-11,y-9+bob,22,18,2);g.lineStyle(1,0xb6bf99,.7).strokeRoundedRect(x-11,y-9+bob,22,18,2);if(pick.type==='health'||pick.type==='supply'){g.fillStyle(0xd4d8b7,.9).fillRect(x-2,y-6+bob,4,12).fillRect(x-6,y-2+bob,12,4);}else{g.lineStyle(2,0xd4c79b);for(let i=0;i<3;i++)g.lineBetween(x-5+i*5,y-4+bob,x-5+i*5,y+4+bob);}}
   if(!s.training){const obj=s.map.objectives[Math.min(s.stage,4)],pulse=1+Math.sin(s.time*2)*.05;l.lineStyle(2,C.amber,.65).strokeRect(obj.x-22*pulse,obj.y-22*pulse,44*pulse,44*pulse);l.lineStyle(1,C.amber,.25).strokeCircle(obj.x,obj.y,58);l.lineBetween(obj.x-8,obj.y,obj.x+8,obj.y);l.lineBetween(obj.x,obj.y-8,obj.x,obj.y+8);this.marker(obj,C.amber,cam);}
   this.decalsGraphics.clear();for(const d of this.decals)this.decalsGraphics.fillStyle(0x18241b,.55).fillEllipse(d.x,d.y,d.size*1.5,d.size);
   for(const fire of this.fires){const t=s.time,sz=fire.size;g.fillStyle(0xac713b,.16).fillCircle(fire.x,fire.y,sz*1.9);g.fillStyle(0xb88446,.65).fillEllipse(fire.x,fire.y,sz+Math.sin(t*11)*3,sz*.7);g.fillStyle(0xe6bc76,.8).fillTriangle(fire.x-sz*.35,fire.y,fire.x+sz*.35,fire.y,fire.x+Math.sin(t*6)*5,fire.y-sz*(.8+.15*Math.sin(t*8)));if(Math.random()<dt*9&&this.scene.settings.quality==='high')this.emit(fire.x,fire.y-10,1,'smoke');}
   for(const part of this.particles){if(!part.active)continue;part.life-=dt;if(part.life<=0){part.active=false;continue;}part.x+=part.vx*dt;part.y+=part.vy*dt;const fade=Math.min(1,part.life/(part.kind==='smoke'?.9:.3));if(part.kind==='smoke'){part.size+=dt*8;part.vx*=Math.exp(-dt);part.vy-=dt*6;g.fillStyle(part.color,.24*fade).fillCircle(part.x,part.y,part.size);}else{part.vx*=Math.exp(-dt*4);part.vy*=Math.exp(-dt*4);g.fillStyle(part.color,fade).fillRect(part.x,part.y,part.size,part.kind==='casing'?2:part.size);}}
   this.flashes=this.flashes.filter(f=>{f.life-=dt;if(f.life<=0)return false;if(f.explosion){const t=1-f.life/.32;g.fillStyle(0xb36c35,.18*(1-t)).fillCircle(f.x,f.y,f.radius*.8*t+15);g.fillStyle(0xe4ac5a,.55*(1-t)).fillCircle(f.x,f.y,15+f.radius*.35*t);if(!this.scene.settings.flash)g.fillStyle(0xf3d599,.6*(1-t)).fillCircle(f.x,f.y,10+f.radius*.13*t);}else{const size=f.big?24:14;g.fillStyle(0xedbe78,.9).fillTriangle(f.x+Math.cos(f.angle)*size,f.y+Math.sin(f.angle)*size,f.x+Math.cos(f.angle+1.5)*5,f.y+Math.sin(f.angle+1.5)*5,f.x+Math.cos(f.angle-1.5)*5,f.y+Math.sin(f.angle-1.5)*5);}return true;});
   if(p.aiming){l.lineStyle(1,0xc3cbb0,.3).lineBetween(p.x+Math.cos(p.angle)*40,p.y+Math.sin(p.angle)*40,p.x+Math.cos(p.angle)*500,p.y+Math.sin(p.angle)*500);}
   if(p.state==='melee'){const t=p.age/p.duration;l.lineStyle(p.heavy?5:3,0xd6d3ac,.35);l.beginPath();l.arc(p.x,p.y,p.heavy?68:52,p.angle-1+t*2,p.angle-.3+t*2);l.strokePath();}
   for(const e of s.enemies)if(e.active&&!e.dead&&BPCore.distance(p,e)<1000)this.marker(e,C.red,cam,true);
   this.crosshair.clear();if(pointer){const x=pointer.x,y=pointer.y,spread=6+p.recoil*70;this.crosshair.lineStyle(1,C.paper,.8).strokeCircle(x,y,2);for(const [dx,dy] of [[-1,0],[1,0],[0,1],[0,-1]])this.crosshair.lineBetween(x+dx*spread,y+dy*spread,x+dx*(spread+6),y+dy*(spread+6));}
   if(this.damageFlash>0){this.damageFlash-=dt;this.uiGraphics.lineStyle(15,C.red,this.damageFlash*.8).strokeRect(5,5,cam.width-10,cam.height-10);}
   if(s.cinematic>0){this.uiGraphics.fillStyle(0x10170f,.95).fillRect(0,0,cam.width,38).fillRect(0,cam.height-38,cam.width,38);}
  }
  marker(obj,col,cam,enemy=false){const x=(obj.x-cam.scrollX)*cam.zoom,y=(obj.y-cam.scrollY)*cam.zoom,w=cam.width,h=cam.height;if(x>40&&x<w-40&&y>90&&y<h-100)return;const dx=x-w/2,dy=y-h/2,a=Math.atan2(dy,dx),radius=Math.min((w/2-40)/(Math.abs(Math.cos(a))||.01),(h/2-105)/(Math.abs(Math.sin(a))||.01)),sx=w/2+Math.cos(a)*radius,sy=h/2+Math.sin(a)*radius;const g=this.uiGraphics;g.fillStyle(col,enemy?.65:.95).fillTriangle(sx+Math.cos(a)*7,sy+Math.sin(a)*7,sx+Math.cos(a+2.2)*6,sy+Math.sin(a+2.2)*6,sx+Math.cos(a-2.2)*6,sy+Math.sin(a-2.2)*6);}
 }
 root.BPRender=Render;
})(globalThis);

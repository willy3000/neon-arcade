(function (root, factory) { const api = factory(); if (typeof module === 'object') module.exports = api; else root.BPWorld = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const box = (id,x,y,w,h,kind='building',hp=Infinity,low=false) => ({id,x,y,w,h,kind,hp,maxHp:hp,low,dead:false});
  const enemy = (id,type,x,y,zone) => ({id,type,x,y,zone});
  const weapons = {
    rifle:{name:'MK18 / ASSAULT RIFLE',sprite:'rifle',capacity:30,reserve:150,rate:.105,reload:1.65,damage:24,speed:1500,range:940,spread:.024,recoil:.012,pellets:1,stagger:.11,mobility:1,sound:'rifle'},
    shotgun:{name:'M870 / BREACH SHOTGUN',sprite:'shotgun',capacity:6,reserve:36,rate:.72,reload:2.15,damage:18,speed:1350,range:470,spread:.18,recoil:.06,pellets:8,stagger:.5,mobility:.92,sound:'shotgun'},
    pistol:{name:'P226 / SERVICE PISTOL',sprite:'handgun',capacity:15,reserve:90,rate:.25,reload:1.1,damage:31,speed:1600,range:790,spread:.013,recoil:.02,pellets:1,stagger:.16,mobility:1.08,sound:'pistol'},
    smg:{name:'MP7 / SUBMACHINE GUN',sprite:'handgun',capacity:40,reserve:200,rate:.065,reload:1.45,damage:14,speed:1400,range:620,spread:.05,recoil:.009,pellets:1,stagger:.06,mobility:1.04,sound:'smg'},
    precision:{name:'M110 / PRECISION RIFLE',sprite:'rifle',capacity:8,reserve:48,rate:.85,reload:2.1,damage:105,speed:2400,range:1600,spread:.003,recoil:.05,pellets:1,stagger:.6,mobility:.86,sound:'precision',pierce:2},
    lmg:{name:'M249 / LIGHT MACHINE GUN',sprite:'rifle',capacity:75,reserve:225,rate:.09,reload:3,damage:27,speed:1700,range:1100,spread:.04,recoil:.022,pellets:1,stagger:.13,mobility:.76,sound:'lmg'},
    launcher:{name:'M32 / GRENADE LAUNCHER',sprite:'shotgun',capacity:6,reserve:24,rate:.8,reload:2.6,damage:95,speed:650,range:700,spread:.02,recoil:.04,pellets:1,stagger:.6,mobility:.82,sound:'launcher',explosive:125},
    rocket:{name:'AT4 / ROCKET LAUNCHER',sprite:'rifle',capacity:1,reserve:8,rate:1.1,reload:2.8,damage:190,speed:900,range:1300,spread:.004,recoil:.08,pellets:1,stagger:.8,mobility:.72,sound:'rocket',explosive:180}
  };
  const archetypes = {
    infantry:{hp:70,speed:130,range:530,rate:1.15,damage:9,windup:.36},
    rusher:{hp:55,speed:235,range:46,rate:.85,damage:14,windup:.34},
    sniper:{hp:60,speed:110,range:950,rate:2.3,damage:22,windup:1.15},
    shield:{hp:110,speed:95,range:400,rate:1.5,damage:10,windup:.55},
    drone:{hp:45,speed:170,range:390,rate:1.3,damage:7,windup:.5},
    commander:{hp:420,speed:120,range:630,rate:1.2,damage:12,windup:.6}
  };
  function campaign() {
    const walls = [
      box('north',0,0,2600,40),box('west',0,0,40,2150),box('east',2560,0,40,2150),box('south',0,2110,2600,40),
      box('b1',40,40,520,320),box('b2',40,920,480,730),box('b3',40,1810,1010,300),
      box('b4',725,40,575,350),box('b5',755,765,480,220),box('b6',735,1195,500,360),
      box('b7',1490,40,1070,350),box('b8',1645,575,620,230),box('b9',1700,1065,350,225),
      box('b10',1460,1800,1100,310),box('b11',2330,500,230,800),
      box('radio-cover',805,515,120,32,'barrier',110,true),box('street-cover',595,835,135,30,'barrier',120,true),
      box('park-cover',1315,820,32,145,'barrier',120,true),box('alley-cover',1435,1250,155,32,'barrier',110,true),
      box('court-cover1',1830,1490,145,32,'barrier',130,true),box('court-cover2',2110,1440,32,135,'barrier',130,true),
      box('glass',1235,1018,28,125,'glass',40,true),box('weak-wall',1290,1410,35,120,'weakwall',150),
      box('crate1',630,495,56,56,'crate',50,true),box('crate2',1170,540,56,56,'crate',50,true),box('crate3',1395,1070,56,56,'crate',50,true),
      box('crate4',2260,1650,56,56,'crate',50,true),box('crate5',1730,1380,56,56,'crate',50,true),
      box('barrel1',705,575,30,38,'barrel',25),box('barrel2',1375,710,30,38,'barrel',25),box('barrel3',1600,1370,30,38,'barrel',25),box('barrel4',2170,1580,30,38,'barrel',25),
      box('console',985,620,44,44,'console',55),box('van',510,620,75,160,'vehicle',250),
      box('truck',1960,905,190,86,'vehicle',300),box('car',1750,890,70,138,'vehicle',180)
    ];
    const enemies = [enemy('c1','infantry',625,410,0),enemy('c2','infantry',820,725,0),enemy('c3','rusher',1090,540,0),
      enemy('a1','infantry',1350,505,1),enemy('a2','infantry',1460,945,1),enemy('a3','rusher',1500,1080,1),enemy('a4','sniper',1610,840,1),
      enemy('x1','infantry',1765,1550,2),enemy('x2','shield',2270,1440,2),enemy('x3','rusher',2245,1090,2),enemy('x4','sniper',2200,1770,2)];
    return {id:'crash',width:2600,height:2150,start:{x:385,y:570},walls,enemies,
      objectives:[{x:970,y:545,name:'Recover the emergency radio',hint:'Radio ahead. Clear the patrol, then interact.'},{x:1470,y:1150,name:'Search the abandoned supply cache',hint:'Cross the city. Recover breaching equipment.'},{x:1990,y:1625,name:'Reach the extraction courtyard',hint:'Clear the perimeter, then activate the beacon.'},{x:1990,y:1625,name:'Hold the extraction zone',hint:'Reinforcements inbound. Survive and stop the commander.'},{x:1990,y:1625,name:'Signal the extraction helicopter',hint:'The courtyard is clear. Interact with the beacon.'}],
      pickups:[{id:'med1',x:450,y:830,type:'health'},{id:'ammo1',x:915,y:1080,type:'ammo'},{id:'armor1',x:1560,y:525,type:'armor'},{id:'med2',x:1595,y:1510,type:'health'}],
      checkpointSpawns:[{x:385,y:570},{x:990,y:525},{x:1470,y:1150},{x:1910,y:1650}],
      areas:[{x:345,y:475,label:'CRASH SITE'},{x:870,y:480,label:'EMERGENCY RELAY'},{x:1325,y:1050,label:'SUPPLY ALLEY'},{x:1800,y:1525,label:'EXTRACTION COURTYARD'}]};
  }
  function training() {
    return {id:'range',width:1800,height:1250,start:{x:390,y:625},
      walls:[box('n',0,0,1800,50),box('s',0,1200,1800,50),box('w',0,0,50,1250),box('e',1750,0,50,1250),box('range-wall',50,50,550,240),box('slide-cover',650,440,150,32,'barrier',150,true),box('vault-cover',650,770,150,32,'barrier',150,true),box('underpass',890,850,160,30,'underpass',Infinity,true),box('crate',1100,650,56,56,'crate',55,true),box('glass',900,340,28,110,'glass',45,true),box('barrel',1310,565,30,38,'barrel',25),box('panel',1510,850,44,44,'console',55)],
      enemies:[enemy('t1','infantry',1200,400,0),enemy('t2','rusher',1340,700,0),enemy('t3','shield',1480,1030,0),enemy('t4','sniper',1500,280,0),enemy('t5','drone',1100,960,0)],
      objectives:[{x:390,y:625,name:'Build your own perfect flow',hint:'All equipment unlocked. Settings select the range weapon.'}],
      pickups:[{id:'range-kit',x:400,y:950,type:'supply'}],checkpointSpawns:[{x:390,y:625}],
      areas:[{x:270,y:420,label:'MOVEMENT LAB'},{x:1050,y:230,label:'LIVE FIRE'},{x:900,y:825,label:'SLIDE UNDER'},{x:295,y:1010,label:'RESUPPLY'}]};
  }
  return {campaign,training,weapons,archetypes};
});

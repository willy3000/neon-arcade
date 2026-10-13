(function (root, factory) { const api = factory(typeof module === 'object' ? require('./missions.js') : root.BPMissions); if (typeof module === 'object') module.exports = api; else root.BPWorld = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function (Missions) {
  'use strict';
  // slot 0 = primary, slot 1 = secondary. "drop" names the enemy that carries the gun into the field; "price" is its armory cost
  // and "tier" the armory tier it sits in (each tier opens at a rank: see "tiers" below).
  const weapons = {
    rifle:{name:'MK18 / ASSAULT RIFLE',short:'MK18',slot:0,cls:'rifle',sprite:'rifle',capacity:30,reserve:150,rate:.105,reload:1.65,damage:24,speed:1500,range:940,spread:.024,recoil:.012,pellets:1,stagger:.11,mobility:1,sound:'rifle',tier:1,price:0,desc:'Reliable automatic rifle. Controlled bursts at every range.'},
    shotgun:{name:'M870 / BREACH SHOTGUN',short:'M870',slot:0,cls:'shotgun',sprite:'shotgun',capacity:6,reserve:36,rate:.72,reload:2.15,damage:18,speed:1350,range:470,spread:.18,recoil:.06,pellets:8,stagger:.5,mobility:.92,sound:'shotgun',tier:1,price:600,drop:'supply cache',desc:'Eight pellets that stop anything at a doorway.'},
    pistol:{name:'P226 / SERVICE PISTOL',short:'P226',slot:1,cls:'sidearm',sprite:'handgun',capacity:15,reserve:90,rate:.25,reload:1.1,damage:31,speed:1600,range:790,spread:.013,recoil:.02,pellets:1,stagger:.16,mobility:1.08,sound:'pistol',tier:1,price:0,desc:'Accurate, quick, light. Never empty for long.'},
    smg:{name:'MP7 / SUBMACHINE GUN',short:'MP7',slot:0,cls:'smg',sprite:'handgun',capacity:40,reserve:200,rate:.065,reload:1.45,damage:14,speed:1400,range:620,spread:.05,recoil:.009,pellets:1,stagger:.06,mobility:1.04,sound:'smg',tier:2,price:1600,drop:'Scouts (Dead Frequency on)',desc:'Torrent of fire and the fastest feet in the armory.'},
    marksman:{name:'SVK-9 / MARKSMAN RIFLE',short:'SVK-9',slot:0,cls:'precision',sprite:'rifle',capacity:10,reserve:60,rate:.34,reload:1.9,damage:58,speed:2000,range:1300,spread:.006,recoil:.035,pellets:1,stagger:.35,mobility:.94,sound:'precision',tier:2,price:2000,drop:'Marksmen',desc:'Semi-automatic reach. Two hits drop most soldiers.'},
    battle:{name:'KV-15 / BATTLE RIFLE',short:'KV-15',slot:0,cls:'rifle',sprite:'rifle',capacity:25,reserve:125,rate:.135,reload:1.9,damage:36,speed:1650,range:1050,spread:.03,recoil:.02,pellets:1,stagger:.16,mobility:.95,sound:'battle',tier:3,price:4500,drop:'Riflemen (Dead Frequency on)',desc:'Heavy rounds and real recoil. Hits like a hammer.'},
    precision:{name:'M110 / PRECISION RIFLE',short:'M110',slot:0,cls:'precision',sprite:'rifle',capacity:8,reserve:48,rate:.85,reload:2.1,damage:105,speed:2400,range:1600,spread:.003,recoil:.05,pellets:1,stagger:.6,mobility:.86,sound:'precision',pierce:2,tier:3,price:6000,drop:'Marksmen (Iron Convoy)',desc:'One shot, one kill, and the round keeps going through two.'},
    lmg:{name:'M249 / LIGHT MACHINE GUN',short:'M249',slot:0,cls:'heavy',sprite:'rifle',capacity:75,reserve:225,rate:.09,reload:3,damage:27,speed:1700,range:1100,spread:.04,recoil:.022,pellets:1,stagger:.13,mobility:.76,sound:'lmg',tier:3,price:6500,drop:'Machine gunners',desc:'Seventy-five rounds of suppression. Shreds cover.'},
    autoshotgun:{name:'AS-12 / AUTO SHOTGUN',short:'AS-12',slot:0,cls:'shotgun',sprite:'shotgun',capacity:12,reserve:60,rate:.26,reload:2.6,damage:13,speed:1350,range:430,spread:.15,recoil:.05,pellets:7,stagger:.35,mobility:.88,sound:'shotgun',tier:4,price:12000,drop:'Breachers (Iron Convoy)',desc:'A shotgun that does not stop. Owns every corridor.'},
    launcher:{name:'M32 / GRENADE LAUNCHER',short:'M32',slot:0,cls:'explosive',sprite:'shotgun',capacity:6,reserve:24,rate:.8,reload:2.6,damage:95,speed:650,range:700,spread:.02,recoil:.04,pellets:1,stagger:.6,mobility:.82,sound:'launcher',explosive:125,tier:4,price:15000,desc:'Six-round drum of area denial. Breaks armour and walls.'},
    pulse:{name:'XR-9 / PULSE CARBINE',short:'XR-9',slot:0,cls:'rifle',sprite:'rifle',capacity:36,reserve:180,rate:.085,reload:1.5,damage:29,speed:2600,range:1100,spread:.012,recoil:.006,pellets:1,stagger:.12,mobility:1,sound:'pulse',pierce:1,tracer:0x8fe3ff,tier:5,price:60000,drop:'Halcyon elites',desc:'Prototype energy carbine. Near-zero recoil, pierces one target.'},
    rail:{name:'ARC-7 / RAIL RIFLE',short:'ARC-7',slot:0,cls:'precision',sprite:'rifle',capacity:4,reserve:24,rate:1,reload:2.4,damage:240,speed:4200,range:1900,spread:0,recoil:.09,pellets:1,stagger:.9,mobility:.8,sound:'rail',pierce:6,breach:true,tracer:0xb7f4ff,tier:5,price:85000,desc:'Magnetic slug that passes through cover, shields and armour.'},
    machinepistol:{name:'VZ-61 / MACHINE PISTOL',short:'VZ-61',slot:1,cls:'sidearm',sprite:'handgun',capacity:20,reserve:120,rate:.058,reload:1.2,damage:12,speed:1350,range:480,spread:.07,recoil:.012,pellets:1,stagger:.05,mobility:1.1,sound:'smg',tier:1,price:500,drop:'Scouts',desc:'Fully automatic sidearm for when they get close.'},
    magnum:{name:'.44 / MAGNUM REVOLVER',short:'.44',slot:1,cls:'sidearm',sprite:'handgun',capacity:6,reserve:36,rate:.42,reload:1.9,damage:88,speed:1900,range:900,spread:.008,recoil:.06,pellets:1,stagger:.5,mobility:1.05,sound:'magnum',pierce:1,tier:2,price:2200,drop:'Commanders',desc:'Six heavy rounds. Staggers anything that walks.'},
    sawedoff:{name:'SUPER-SHORTY / SAWED-OFF',short:'SHORTY',slot:1,cls:'shotgun',sprite:'handgun',capacity:2,reserve:20,rate:.3,reload:1.5,damage:17,speed:1250,range:300,spread:.28,recoil:.07,pellets:10,stagger:.7,mobility:1.06,sound:'shotgun',tier:1,price:600,drop:'Breachers',desc:'Two barrels, ten pellets each. Point blank problem-solver.'},
    thumper:{name:'M79 / THUMPER',short:'M79',slot:1,cls:'explosive',sprite:'shotgun',capacity:1,reserve:9,rate:.6,reload:1.9,damage:110,speed:720,range:640,spread:.01,recoil:.05,pellets:1,stagger:.7,mobility:1,sound:'launcher',explosive:120,tier:3,price:5000,drop:'Grenadiers',desc:'Single-shot grenade launcher. Armour hates it.'},
    // The second wave: each of these brings a mechanic of its own ("burst", "bounce", "flame", "spin", "chain": see
    // stepPlayer and stepProjectiles in core.js). One with a "challenge" is awarded, never sold (Meta.CHALLENGES).
    burst:{name:'FR-9 / BURST RIFLE',short:'FR-9',slot:0,cls:'rifle',sprite:'rifle',capacity:30,reserve:150,rate:.4,reload:1.8,damage:27,speed:1650,range:1000,spread:.016,recoil:.01,pellets:1,stagger:.12,mobility:.98,sound:'rifle',burst:3,gap:.06,tier:2,price:2600,desc:'Three rounds every pull. Tight at range, hungry up close.'},
    ricochet:{name:'RX-4 / RICOCHET CARBINE',short:'RX-4',slot:0,cls:'rifle',sprite:'rifle',capacity:24,reserve:120,rate:.17,reload:1.7,damage:30,speed:1500,range:1300,spread:.02,recoil:.014,pellets:1,stagger:.14,mobility:1,sound:'rifle',bounce:2,tracer:0xf1d27d,tier:3,price:5500,desc:'Rounds that come off a wall twice. Shoot round the corner.'},
    flamer:{name:'M2 / FLAMETHROWER',short:'M2',slot:0,cls:'heavy',sprite:'shotgun',capacity:100,reserve:200,rate:.05,reload:2.8,damage:7,speed:560,range:250,spread:.13,recoil:0,pellets:1,stagger:.05,mobility:.86,sound:'flamer',pierce:4,flame:true,tracer:0xf08a3c,tier:4,challenge:'burn',desc:'A stream of fire that passes through a crowd and leaves the ground burning.'},
    minigun:{name:'M134 / MINIGUN',short:'M134',slot:0,cls:'heavy',sprite:'rifle',capacity:200,reserve:400,rate:.042,reload:4,damage:17,speed:1700,range:1000,spread:.055,recoil:.004,pellets:1,stagger:.07,mobility:.68,sound:'minigun',spin:.7,tier:4,challenge:'wave',desc:'Takes a moment to spin up. Then two hundred rounds of nothing left standing.'},
    arc:{name:'TESLA-3 / ARC CASTER',short:'TESLA-3',slot:0,cls:'heavy',sprite:'rifle',capacity:12,reserve:60,rate:.5,reload:2.2,damage:72,speed:2400,range:760,spread:.008,recoil:.03,pellets:1,stagger:.5,mobility:.94,sound:'arc',chain:2,tracer:0x8fe3ff,tier:4,price:16000,desc:'A bolt that jumps to two more hostiles. Punishes anything bunched up.'},
    rocket:{name:'AT4 / ROCKET LAUNCHER',short:'AT4',slot:1,cls:'explosive',sprite:'rifle',capacity:1,reserve:6,rate:1.1,reload:2.8,damage:190,speed:900,range:1300,spread:.004,recoil:.08,pellets:1,stagger:.8,mobility:.72,sound:'rocket',explosive:180,tier:4,price:13000,drop:'Rocketeers',desc:'Anti-armour rocket. Ends vehicles and arguments.'}
  };
  // Enemy attack profile (damage/rate/windup are the soldier, not their gun). gun = what drops. front/armor/barrier = damage multipliers.
  const archetypes = {
    infantry:{name:'RIFLEMAN',hp:70,speed:130,range:530,rate:1.15,damage:9,windup:.36,gun:'rifle',bounty:20,cover:true},
    rusher:{name:'RUSHER',hp:55,speed:235,range:46,rate:.85,damage:14,windup:.34,melee:true,bounty:15},
    sniper:{name:'MARKSMAN',hp:60,speed:110,range:950,sight:1000,rate:2.3,damage:22,windup:1.15,gun:'marksman',locked:true,bounty:35},
    shield:{name:'SHIELD',hp:110,speed:95,range:400,rate:1.5,damage:10,windup:.55,gun:'pistol',front:.15,bounty:35,drop:'armor'},
    drone:{name:'DRONE',hp:45,speed:170,range:390,rate:1.3,damage:7,windup:.5,machine:true,flying:true,orbit:true,bounty:20},
    commander:{name:'COMMANDER',hp:420,speed:120,range:630,rate:1.2,damage:12,windup:.6,gun:'magnum',radius:25,boss:true,bounty:250},
    scout:{name:'SCOUT',hp:50,speed:190,range:380,rate:1,damage:6,windup:.3,gun:'machinepistol',burst:4,gap:.075,spread:.06,bounty:22,cover:true},
    breacher:{name:'BREACHER',hp:95,speed:155,range:230,rate:1.3,damage:7,windup:.42,gun:'sawedoff',pellets:5,spread:.15,push:true,bounty:30},
    grenadier:{name:'GRENADIER',hp:80,speed:115,range:520,minRange:170,rate:3.4,damage:80,windup:.75,gun:'thumper',lob:true,bounty:40,drop:'lethal',cover:true},
    gunner:{name:'MACHINE GUNNER',hp:190,speed:80,range:620,rate:2.6,damage:7,windup:.85,gun:'lmg',burst:9,gap:.085,spread:.05,clip:3,bounty:60,drop:'armor'},
    rocketeer:{name:'ROCKETEER',hp:90,speed:100,range:820,rate:4.4,damage:60,windup:1.4,gun:'rocket',rocket:130,bullet:520,locked:true,bounty:60,cover:true},
    turret:{name:'SENTRY GUN',hp:170,speed:0,range:600,rate:1.6,damage:7,windup:.5,burst:5,gap:.09,machine:true,static:true,turn:1.6,front:.2,radius:20,clip:99,bounty:45},
    ghost:{name:'GHOST',hp:65,speed:225,range:52,rate:1.1,damage:22,windup:.3,melee:true,cloak:true,bounty:35},
    elite:{name:'HALCYON ELITE',hp:130,speed:140,range:580,rate:1.05,damage:10,windup:.3,gun:'pulse',burst:3,gap:.09,bullet:900,bounty:55,cover:true,drop:'tactical'},
    bomber:{name:'BOMB DRONE',hp:30,speed:255,range:44,rate:1,damage:55,windup:.25,machine:true,flying:true,kamikaze:true,bounty:18},
    wraith:{name:'WRAITH',hp:340,speed:150,range:1400,sight:1500,rate:1.6,damage:34,windup:.9,gun:'precision',boss:true,blink:true,locked:true,bullet:1100,radius:19,clip:99,bounty:400},
    apc:{name:'BULWARK',hp:1500,speed:0,range:780,rate:1.4,damage:7,windup:.7,burst:10,gap:.08,machine:true,static:true,turn:2.2,armor:.12,radius:46,boss:true,mortar:true,clip:99,bounty:600},
    // The hostile fireteam in team deathmatch: operators rather than rank and file. They carry more health, shoot in
    // quick bursts that lead a moving target ("lead") and take far less time to open fire. "standoff" keeps its distance.
    raider:{name:'ASSAULT',hp:170,speed:185,range:560,rate:.8,damage:12,windup:.3,gun:'battle',burst:4,gap:.12,spread:.04,bullet:1000,lead:.55,clip:4,bounty:45,cover:true},
    striker:{name:'POINTMAN',hp:140,speed:220,range:330,rate:.6,damage:9,windup:.22,gun:'smg',burst:5,gap:.08,spread:.07,bullet:950,lead:.45,clip:4,push:true,bounty:40},
    deadeye:{name:'SHARPSHOOTER',hp:120,speed:150,range:900,sight:950,rate:1.9,damage:40,windup:.85,gun:'marksman',bullet:1300,locked:true,standoff:true,clip:6,bounty:55},
    // Any operator in team deathmatch, player or AI, as the other team's gadgets and field support see them.
    operator:{name:'OPERATOR',hp:100,speed:250,range:0,rate:1,damage:0,windup:0,bounty:50},
    mech:{name:'WARDEN',hp:1200,speed:105,range:640,rate:1.3,damage:10,windup:.5,gun:'pulse',burst:4,gap:.08,bullet:880,machine:true,barrier:.08,radius:30,boss:true,stomp:true,clip:99,bounty:800}
  };
  // Gadgets: lethal (G / RB) and tactical (C / D-pad up). count = charges per mission before upgrades.
  const gear = {
    frag:{name:'M67 FRAG',slot:'lethal',count:3,tier:1,price:450,desc:'Cooked 1.15s fuse. 155 radius. Flushes cover.'},
    incendiary:{name:'AN-M14 INCENDIARY',slot:'lethal',count:2,tier:2,price:1100,desc:'Burns a doorway shut for six seconds.'},
    mine:{name:'M18 PROX MINE',slot:'lethal',count:3,tier:3,price:2200,desc:'Planted at your feet. Rushers, ghosts and armour regret it.'},
    flash:{name:'M84 FLASHBANG',slot:'tactical',count:3,tier:1,price:450,desc:'Stuns everyone who can see the blast for three seconds.'},
    smoke:{name:'M18 SMOKE',slot:'tactical',count:2,tier:2,price:900,desc:'Ten seconds of cover anywhere. Enemies cannot see through it.'},
    emp:{name:'EMP CHARGE',slot:'tactical',count:2,tier:4,price:4500,desc:'Kills drones, blinds sentries, drops shields and barriers.'},
    decoy:{name:'HOLO DECOY',slot:'tactical',count:2,tier:3,price:2500,desc:'A hologram of Rook that draws fire for seven seconds.'},
    cover:{name:'DEPLOYABLE COVER',slot:'tactical',count:2,tier:3,price:2800,desc:'Slams down a ballistic barrier where you aim.'},
    // The second wave (useLethal, useTactical and detonate in core.js).
    knife:{name:'THROWING KNIVES',slot:'lethal',count:3,tier:2,price:1400,desc:'Thrown flat and fast. Drops most soldiers in one, and can be picked up again.'},
    cluster:{name:'CLUSTER GRENADE',slot:'lethal',count:2,tier:3,price:3200,desc:'One blast, then five bomblets scattered round it.'},
    c4:{name:'C4 CHARGE',slot:'lethal',count:2,tier:3,challenge:'explosive',desc:'Plant it, walk away, and press again to set it off. One charge down at a time.'},
    seeker:{name:'SEEKER',slot:'lethal',count:2,tier:4,price:5200,desc:'A rolling charge that hunts the nearest hostile for eight seconds.'},
    grapple:{name:'GRAPPLE HOOK',slot:'tactical',count:3,tier:2,challenge:'flows25',desc:'Pulls you across open ground towards your aim in a blink. Counts as a flow.'},
    sensor:{name:'SENSOR DART',slot:'tactical',count:3,tier:1,price:700,desc:'Marks every hostile near where it lands for twelve seconds.'},
    gas:{name:'TEAR GAS',slot:'tactical',count:2,tier:3,price:2600,desc:'Nine seconds of gas. Soldiers standing in it cannot fight.'},
    trophy:{name:'TROPHY SYSTEM',slot:'tactical',count:2,tier:4,price:4800,desc:'Knocks down hostile grenades, shells and rockets near it for twenty seconds.'},
    ammobox:{name:'AMMO BOX',slot:'tactical',count:2,tier:1,price:600,desc:'Drops ammunition for you and your squad.'}
  };
  const upgrades = {
    plating:{name:'CERAMIC PLATING',desc:'+20 starting armor and +15 armor capacity per level.',prices:[500,2000,8000]},
    medic:{name:'FIELD MEDIC',desc:'+1 stim injector per level.',prices:[600,2400,9000]},
    pouch:{name:'AMMO POUCH',desc:'+20% reserve ammunition per level.',prices:[400,1600,6000]},
    bandolier:{name:'BANDOLIER',desc:'+1 lethal and +1 tactical charge per level.',prices:[700,2600,10000]},
    reflex:{name:'FAST HANDS',desc:'8% faster reloads per level.',prices:[500,2000,8000]},
    conditioning:{name:'CONDITIONING',desc:'Per level: 15% faster stamina recovery, 10% longer sprints, 10% shorter wait before it refills.',prices:[400,1600,7000]},
    scavenger:{name:'SCAVENGER',desc:'+8% mission credits per level.',prices:[800,3000,11000]}
  };
  // Field support: one is carried into a run and called in when its meter is full (callSupport in core.js). The meter
  // fills with score - bounties, flows, objectives - and starts again from empty after every call; "cost" is the
  // score one call takes. An item with a "challenge" is never sold: it is awarded when that career challenge is met
  // (Meta.CHALLENGES). "tier" grades it and, for the ones with a price, sets the rank it is sold at.
  const support = {
    recon:{name:'RECON SWEEP',short:'RECON',cost:450,tier:2,price:2500,desc:'Marks every hostile on the map for 20 seconds. Cloaks and darkness hide nothing.'},
    turret:{name:'SENTRY TURRET',short:'SENTRY',cost:800,tier:3,price:7000,desc:'Sets a sentry gun in front of you. It covers that ground for 30 seconds.'},
    dog:{name:'K9 UNIT',short:'K9',cost:900,tier:3,challenge:'kills',desc:'A combat hound that runs down the nearest hostile and does not let go. 25 seconds.'},
    airstrike:{name:'AIRSTRIKE',short:'STRIKE',cost:1200,tier:4,price:12000,desc:'Six shells walked along your line of aim. Mark it, then get clear.'},
    supply:{name:'SUPPLY DROP',short:'SUPPLY',cost:600,tier:1,price:1800,desc:'Health, armour, ammunition and a gadget refill, dropped round your feet.'},
    reinforce:{name:'REINFORCEMENT',short:'BACKUP',cost:1000,tier:3,price:9000,desc:'A rifleman who stays at your side and shoots what he can see for 45 seconds.'},
    gunship:{name:'GUNSHIP',short:'GUNSHIP',cost:1400,tier:4,price:15000,desc:'Circles overhead for 20 seconds, firing down over walls at anything near you.'},
    blackout:{name:'BLACKOUT',short:'BLACKOUT',cost:1600,tier:5,challenge:'campaign',desc:'An EMP across the whole map. Drones fall, machines go dark, every soldier is blinded.'}
  };
  // Perks: one per slot, and three slots - survival, combat, movement - that open at the ranks in perkSlots. A perk
  // changes how a run plays rather than raising a number; the upgrades above do that.
  const perks = {
    regen:{name:'FIELD DRESSING',short:'DRESSING',slot:0,tier:2,price:3000,desc:'After six seconds without being hit, health climbs back to 60.'},
    flak:{name:'FLAK VEST',short:'FLAK',slot:0,tier:2,price:2500,desc:'Blasts and fire do 40% less to you.'},
    secondwind:{name:'SECOND WIND',short:'2ND WIND',slot:0,tier:3,challenge:'flawless',desc:'Once per run, a killing blow leaves you standing on 30 health.'},
    scrounger:{name:'SCROUNGER',short:'SCROUNGE',slot:1,tier:1,price:2000,desc:'Every kill with a gun puts a quarter of a magazine back in its reserve.'},
    ambusher:{name:'AMBUSHER',short:'AMBUSH',slot:1,tier:3,price:4500,desc:'35% more damage to hostiles that have not noticed you.'},
    executioner:{name:'EXECUTIONER',short:'EXECUTE',slot:1,tier:2,challenge:'knife',desc:'A knife kill gives back 20 health.'},
    lowprofile:{name:'LOW PROFILE',short:'LOW PRO',slot:2,tier:2,price:3500,desc:'Hostiles have to be a quarter closer before they spot you.'},
    flowstate:{name:'FLOW STATE',short:'FLOW',slot:2,tier:3,challenge:'flows',desc:'A perfect flow gives three seconds of 30% more damage.'},
    hardline:{name:'HARDLINE',short:'HARDLINE',slot:2,tier:4,challenge:'tdm',desc:'Field support charges 25% faster.'}
  };
  const perkSlots = [2,5,8], perkSlotNames = ['SURVIVAL','COMBAT','MOVEMENT'];
  // story/standard/intense keep their original damage and cadence; insane is the skill tier.
  const difficulties = {
    story:{label:'STORY',dmg:.55,rate:1.2,windup:1,bullet:1,spread:1,lead:0,iframes:.32,reward:.6,drops:1.2,heal:70,med:true},
    standard:{label:'STANDARD',dmg:1,rate:1,windup:1,bullet:1,spread:1,lead:0,iframes:.32,reward:1,drops:1,heal:70,med:true},
    intense:{label:'HIGH INTENSITY',dmg:1.22,rate:.8,windup:1,bullet:1,spread:1,lead:.2,iframes:.32,reward:1.4,drops:1,heal:70,med:true,camp:7,nadeCd:11},
    insane:{label:'INSANE',dmg:1.85,rate:.62,windup:.8,bullet:1.3,spread:.7,lead:.6,iframes:.14,reward:2.2,drops:.55,heal:55,med:false,camp:3.2,nadeCd:6,suppress:true,hunt:true,extra:1,waveExtra:.5,burst:2}
  };
  // Armory tiers 1-5 open at these ranks. Upgrade levels 1, 2 and 3 sit in tiers 1, 2 and 4. A tier is also how an
  // item is graded wherever it is shown (Meta.RARITY): standard issue, field grade, specialist, elite, legendary.
  // Tier 5 is the legendary pair, the XR-9 and the ARC-7: priced several times over anything else and held back to
  // rank 15, so they are the last things a player earns.
  const tiers = [1,4,7,10,15], upgradeTiers = [1,2,4];
  const order = ['story','standard','intense','insane'];
  // How the armory files its guns: one tab per category, each taking one or more weapon classes ("cls" above).
  const categories = [{id:'rifle',name:'ASSAULT RIFLES',cls:['rifle']},{id:'smg',name:'SMGS',cls:['smg']},{id:'shotgun',name:'SHOTGUNS',cls:['shotgun']},{id:'precision',name:'PRECISION RIFLES',cls:['precision']},{id:'heavy',name:'HEAVY WEAPONS',cls:['heavy','explosive']},{id:'sidearm',name:'PISTOLS',cls:['sidearm']}];
  const mission = id => Missions.build(id);
  return {weapons,archetypes,gear,upgrades,support,perks,perkSlots,perkSlotNames,difficulties,order,categories,tiers,upgradeTiers,missions:Missions.list,mission,campaign:()=>mission('crash'),training:()=>mission('range'),holdoutMaps:Missions.holdoutMaps};
});

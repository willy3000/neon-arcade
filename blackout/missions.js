(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BPMissions=api;})(globalThis,function(){
  'use strict';
  // Mission geometry and scripting. THE CRASH and the range are hand-placed boxes; later maps are painted on a 40px grid
  // (canvas/parse below) so every corridor, cover piece and spawn snaps to cells the simulation can validate.
  const CELL=40;
  const box=(id,x,y,w,h,kind='building',hp=Infinity,low=false,extra={})=>({id,x,y,w,h,kind,hp,maxHp:hp,low,dead:false,...extra});
  const enemy=(id,type,x,y,zone,extra={})=>({id,type,x,y,zone,...extra});
  const radio=(speaker,text,duration=6)=>({speaker,text,duration});
  const at=p=>({x:p.x,y:p.y});

  function canvas(w,h,ch='#'){const g=Array.from({length:h},()=>Array(w).fill(ch)),marks={},zones=[];
    const api={w,h,g,marks,zones,
      fill(c0,r0,c1,r1,v){for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)if(g[r]&&c>=0&&c<w)g[r][c]=v;return api;},
      put(c,r,str){for(let i=0;i<str.length;i++)if(str[i]!==' '&&g[r]&&c+i<w)g[r][c+i]=str[i];return api;},
      down(c,r,str){for(let i=0;i<str.length;i++)if(str[i]!==' '&&g[r+i])g[r+i][c]=str[i];return api;},
      mark(name,c,r){const p={x:c*CELL+CELL/2,y:r*CELL+CELL/2};if(['spawn','light','perch'].includes(name))(marks[name]=marks[name]||[]).push(p);else marks[name]=p;return api;},
      zone(z,c0,r0,c1,r1){zones.push([c0,r0,c1,r1,z]);return api;}};
    return api;}
  const ENEMY={i:'infantry',r:'rusher',s:'sniper',h:'shield',d:'drone',b:'breacher',k:'scout',g:'grenadier',m:'gunner',q:'rocketeer',t:'turret',z:'ghost',e:'elite',x:'bomber',A:'raider',P:'striker',D:'deadeye',y:'heavy'};
  const PICK={a:'ammo',p:'armor',f:'health',n:'lethal',u:'tactical',$:'cache','?':'intel'};
  const AREA={'#':['building'],X:['rock'],W:['weakwall',150],V:['vehicle',250],U:['fuel',200],'~':['water',Infinity,{pass:true}],F:['fence',Infinity,{pass:true}]};
  const SINGLE={C:['crate',44,44,50,true],O:['barrel',30,38,25,false],T:['console',44,44,55,true],J:['jammer',46,46,140,false],S:['generator',50,50,170,false]};
  const FLOOR=',:;';
  function parse(p){const {w,h,g}=p,walls=[],enemies=[],pickups=[],count={};let n=0;
    const zoneAt=(c,r)=>{for(const [c0,r0,c1,r1,z] of p.zones)if(c>=c0&&c<=c1&&r>=r0&&r<=r1)return z;return 0;};
    const isGate=ch=>ch>='1'&&ch<='9',blocking=ch=>AREA[ch]&&!AREA[ch][2]||isGate(ch);
    const floor=g.map(row=>row.slice());
    for(let r=0;r<h;r++)for(let c=0;c<w;c++){const ch=g[r][c];if(ch==='.'||FLOOR.includes(ch))continue;if(blocking(ch)){floor[r][c]=null;continue;}const left=c>0?floor[r][c-1]:null;floor[r][c]=left&&FLOOR.includes(left)?left:'.';}
    function merge(grid,test){const out=[];let prev=new Map();for(let r=0;r<h;r++){const now=new Map();let c=0;while(c<w){const ch=grid[r][c];if(!test(ch)){c++;continue;}let e=c;while(e+1<w&&grid[r][e+1]===ch)e++;const key=ch+':'+c+':'+e,old=prev.get(key);if(old){old.h++;now.set(key,old);}else{const rect={ch,c,r,w:e-c+1,h:1};out.push(rect);now.set(key,rect);}c=e+1;}prev=now;}return out;}
    function runs(ch,vertical){const out=[],outer=vertical?w:h,len=vertical?h:w;for(let a=0;a<outer;a++){let b=0;const cell=i=>vertical?g[i][a]:g[a][i];while(b<len){if(cell(b)!==ch){b++;continue;}let e=b;while(e+1<len&&cell(e+1)===ch)e++;out.push(vertical?{c:a,r:b,len:e-b+1}:{c:b,r:a,len:e-b+1});b=e+1;}}return out;}
    for(const q of merge(g,ch=>!!AREA[ch]||isGate(ch))){const gate=isGate(q.ch),[kind,hp=Infinity,extra={}]=gate?['gate']:AREA[q.ch];walls.push(box((gate?'gate'+q.ch+'-':kind.slice(0,2))+(++n),q.c*CELL,q.r*CELL,q.w*CELL,q.h*CELL,kind,hp,false,gate?{gate:+q.ch}:{...extra}));}
    for(const q of runs('=',false))walls.push(box('cv'+(++n),q.c*CELL,q.r*CELL+4,q.len*CELL,32,'barrier',120,true));
    for(const q of runs('|',true))walls.push(box('cv'+(++n),q.c*CELL+4,q.r*CELL,32,q.len*CELL,'barrier',120,true));
    for(const q of runs('-',false))walls.push(box('gl'+(++n),q.c*CELL,q.r*CELL+12,q.len*CELL,16,'glass',40,true));
    for(const q of runs('G',true))walls.push(box('gl'+(++n),q.c*CELL+12,q.r*CELL,16,q.len*CELL,'glass',40,true));
    for(let r=0;r<h;r++)for(let c=0;c<w;c++){const ch=g[r][c],cx=c*CELL+CELL/2,cy=r*CELL+CELL/2;
      if(SINGLE[ch]){const [kind,bw,bh,hp,low]=SINGLE[ch];count[kind]=(count[kind]||0)+1;walls.push(box(kind==='jammer'?'J'+count[kind]:kind==='generator'?'S'+count[kind]:kind+count[kind],cx-bw/2,cy-bh/2,bw,bh,kind,hp,low));}
      else if(ENEMY[ch]){count[ch]=(count[ch]||0)+1;enemies.push(enemy(ch+count[ch],ENEMY[ch],cx,cy,zoneAt(c,r)));}
      else if(PICK[ch]){pickups.push({id:'pk'+(++n),x:cx,y:cy,type:PICK[ch]});}}
    const floors=merge(floor,ch=>!!ch&&FLOOR.includes(ch)).map(q=>({x:q.c*CELL,y:q.r*CELL,w:q.w*CELL,h:q.h*CELL,type:q.ch===','?'road':q.ch===':'?'alt':'mark'}));
    return {width:w*CELL,height:h*CELL,walls,enemies,pickups,floors,marks:p.marks,ascii:g.map(row=>row.join(''))};}
  const hazard=(c0,r0,c1,r1,period,duty,phase=0)=>({x:c0*CELL,y:r0*CELL+(r0===r1?14:0),w:(c1-c0+1)*CELL,h:r0===r1?12:(r1-r0+1)*CELL,period,duty,phase,off:0});

  // Shared mission scaffolding. Stages: clear (clear zone then interact), reach, destroy (targets of a kind), hold (scripted waves),
  // survive (timer with waves), boss, extract (interact; optional cinematic), endless (HOLDOUT).
  function finish(map){map.objectives=map.stages;map.checkpointSpawns=map.stages.map(st=>st.spawn||null);map.spawnPoints=map.spawnPoints||[];map.hazards=map.hazards||[];map.areas=map.areas||[];map.fires=map.fires||[];map.lights=map.lights||[];map.perches=map.perches||[];map.floors=map.floors||[];return map;}

  function crash(){
    const walls=[
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
    const enemies=[enemy('c1','infantry',625,410,0),enemy('c2','infantry',820,725,0),enemy('c3','rusher',1090,540,0),
      enemy('a1','infantry',1350,505,1),enemy('a2','infantry',1460,945,1),enemy('a3','rusher',1500,1080,1),enemy('a4','sniper',1610,840,1),enemy('a5','grenadier',1600,1180,1),
      enemy('x1','infantry',1765,1550,2),enemy('x2','shield',2270,1440,2),enemy('x3','rusher',2245,1090,2),enemy('x4','sniper',2200,1770,2)];
    const court={x:1990,y:1625};
    return finish({id:'crash',theme:'city',width:2600,height:2150,start:{x:385,y:570},walls,enemies,threat:1,
      guns:{infantry:'rifle',sniper:'marksman',shield:'pistol',commander:'magnum'},insane:['scout','grenadier'],
      intro:radio('ROOK','Mayday. This is Rook. Bird is down. No survivors on comms. I need a radio.',7),resume:radio('ROOK','Rook, stay off the main streets. Your last position is compromised.',7),
      stages:[
        {kind:'clear',zone:0,x:970,y:545,name:'Recover the emergency radio',hint:'Radio ahead. Clear the patrol, then interact.',spawn:{x:385,y:570}},
        {kind:'clear',zone:1,x:1470,y:1150,name:'Search the abandoned supply cache',hint:'A marksman covers the street: when the red laser lights, break line of sight or roll through it. Grenades land in red rings - get out.',spawn:{x:990,y:525},enter:{checkpoint:true,radio:radio('CONTROL / UNKNOWN','Rook. You weren’t supposed to survive. Get off this frequency. There’s a supply cache in the south alley.',7)}},
        {kind:'clear',zone:2,...court,name:'Reach the extraction courtyard',hint:'Clear the perimeter. A frag (G) breaks a shield; sprint, slide and vault low cover to close in.',spawn:{x:1470,y:1150},restoreDead:['glass'],
          enter:{grants:{weapons:['shotgun'],lethal:'frag',lethalCount:3,health:85,armor:45,stims:2,refill:true},checkpoint:true,unlock:['shotgun','frag'],radio:radio('ROOK','Breaching shotgun. Frags. Someone left this for me. Control, I’m moving to the courtyard.',6)}},
        {kind:'hold',zone:2,...court,name:'Hold the extraction zone',hint:'Fight from the low walls. Move out of red rings. Stop the commander.',spawn:{x:1910,y:1650},
          enter:{checkpoint:true,radio:radio('OVERWATCH','Beacon received. Two minutes out. Multiple contacts closing on your position. Hold that courtyard.',6)},
          waves:[{entries:[{id:'w1',type:'rusher',x:1670,y:1640},{id:'w2',type:'infantry',x:2250,y:1240},{id:'w2g',type:'grenadier',story:'infantry',x:2300,y:1745},{id:'w1i',type:'scout',x:1490,y:1450,min:'insane'}]},
            {after:9,max:4,med:{x:1900,y:1740},entries:[{id:'boss',type:'commander',x:2250,y:1150},{id:'w3',type:'shield',story:'infantry',x:1460,y:1560},{id:'w3i',type:'grenadier',x:2300,y:1745,min:'insane'},{id:'w4i',type:'infantry',x:1660,y:1640,min:'insane'}]}],
          leave:{radio:radio('OVERWATCH','Perimeter clear. Signal the beacon. We’re coming down to you now.',5),toast:'EXTRACTION AVAILABLE'}},
        {kind:'extract',zone:2,...court,name:'Signal the extraction helicopter',hint:'The courtyard is clear. Interact with the beacon.',
          start:radio('OVERWATCH','Rook, we have you. Wait… that launch signature is ours. They fired on us. ROOK, MOVE!',7),
          cinematic:{duration:6,beats:[{at:2.1,explode:[130,-170,180],radio:radio('ROOK','They knew our callsigns. Our route. Our extraction. This wasn’t a crash. This was a cleanup.',7)}]}}],
      pickups:[{id:'med1',x:450,y:830,type:'health'},{id:'ammo1',x:915,y:1080,type:'ammo'},{id:'armor1',x:1560,y:525,type:'armor'},{id:'med2',x:1595,y:1510,type:'health'},{id:'intel1',x:200,y:1730,type:'intel'}],
      spawnPoints:[{x:2250,y:1150},{x:1660,y:1640},{x:2300,y:1745},{x:1490,y:1450}],
      areas:[{x:345,y:475,label:'CRASH SITE'},{x:870,y:480,label:'EMERGENCY RELAY'},{x:662,y:888,label:'SPRINT · SLIDE · VAULT'},{x:1325,y:1050,label:'SUPPLY ALLEY'},{x:1800,y:1525,label:'EXTRACTION COURTYARD'}],
      fires:[{x:220,y:542,size:26},{x:310,y:637,size:19},{x:1640,y:400,size:13}]});
  }

  function ruins(){const g=canvas(60,42,'#');
    g.fill(2,1,57,3,',').fill(2,1,5,39,',').fill(19,1,22,39,',').fill(40,1,43,39,',').fill(2,19,57,22,',').fill(2,36,43,39,',').fill(55,1,57,22,',');
    g.fill(7,5,17,17,':').fill(18,9,18,10,':').fill(11,18,12,18,':').down(6,12,'WW');
    g.put(12,10,'J').put(9,8,'C').put(15,13,'C').put(11,13,'==').put(8,6,'i').put(16,7,'i').put(14,15,'k').put(16,16,'a');
    g.fill(24,5,38,17,':').fill(30,4,31,4,':').down(23,12,'::').put(27,18,'WW').put(33,18,'--').fill(24,11,28,11,'#').fill(31,11,34,11,'#');
    g.put(35,8,'J').put(37,9,'O').put(26,8,'b').put(33,6,'i').put(36,14,'g').put(27,14,'r').put(30,15,'k').put(32,14,'C').put(25,15,'C').put(25,6,'f').put(37,16,'n');
    g.fill(45,5,53,17,'.').down(44,10,'...').fill(48,18,50,18,'.').down(54,7,'..');
    g.put(47,8,'XX').put(47,9,'X').put(51,13,'XX').put(52,14,'X').put(48,15,'==').put(51,7,'J').put(53,5,'s').put(46,6,'i').put(52,16,'i').put(49,11,'h').put(45,16,'p');
    g.put(10,20,'VV').put(30,21,'VV').down(47,20,'VV').put(14,21,'==').put(34,19,'==').put(33,21,'O').put(25,20,'i').put(37,21,'r').put(51,20,'k');
    g.fill(6,28,18,29,':').put(12,28,'C').put(9,29,'$');
    g.fill(24,24,38,34,':').fill(31,24,31,27,'#').fill(31,30,31,34,'#').put(27,23,'WW').fill(34,35,35,35,':').down(39,28,'::').down(23,31,'::');
    g.put(26,26,'b').put(28,32,'r').put(35,26,'i').put(36,32,'k').put(25,33,'?').put(37,24,'p').put(33,33,'f').put(29,25,'C').put(33,30,'C');
    g.fill(45,24,56,38,'.').down(44,30,'11').put(49,23,'11').fill(52,37,55,37,'X');
    g.put(47,28,'===').down(51,31,'||').put(48,34,'C').put(54,29,'C').put(46,36,'O').put(46,25,'a').put(55,25,'f').put(56,38,'n');
    g.put(12,37,'VV').put(26,38,'==').put(24,37,'i').put(33,38,'k').put(3,34,'a').put(3,26,'i').put(4,14,'r').put(27,2,'VV').put(15,2,'C').put(36,2,'i').put(47,2,'k');
    g.mark('start',4,37).mark('metro',53,35).mark('cp1',41,21).mark('cp2',50,31).mark('spawn',42,26).mark('spawn',42,37).mark('spawn',49,21).mark('spawn',56,21);
    const m=parse(g),k=m.marks;
    return finish({id:'ruins',theme:'ruins',...m,start:at(k.start),threat:1.05,guns:{infantry:'rifle',scout:'machinepistol',breacher:'sawedoff',grenadier:'thumper',sniper:'marksman'},insane:['grenadier','breacher'],
      intro:radio('LARK','Still breathing, Rook? Good. Call me Lark. The people who shot you down are jamming this whole district. Kill their three jammers and I can actually help you.',8),resume:radio('LARK','Hunter teams are sweeping the Old Quarter. Keep moving.',5),
      spawnPoints:k.spawn,
      stages:[
        {kind:'destroy',zone:0,targets:'jammer',...at(k.metro),name:'Destroy the three signal jammers',hint:'Any order. Shoot them, frag them, or cook a barrel beside one.',spawn:at(k.start)},
        {kind:'reach',zone:1,...at(k.metro),radius:150,name:'Reach the metro plaza',hint:'The south-east shutter. Hunter teams are converging.',spawn:at(k.cp1),enter:{opens:[1],checkpoint:true,radio:radio('LARK','That’s all three. I have your beacon. Halcyon hunter teams are converging — the old metro shutter, south-east plaza. Move.',7)}},
        {kind:'survive',zone:1,...at(k.metro),time:55,name:'Hold while Lark bridges the shutter',hint:'Stay alive. They are coming from every street.',spawn:at(k.cp2),enter:{checkpoint:true,radio:radio('LARK','Shutter’s on a dead circuit. I can bridge it from here. Sixty seconds. They know exactly where you are.',6)},
          waves:[{after:0,entries:[{type:'scout',at:0},{type:'infantry',at:1},{type:'rusher',at:2,min:'insane'}]},{after:12,entries:[{type:'breacher',at:2},{type:'grenadier',at:0},{type:'scout',at:3,min:'intense'}]},
            {after:26,entries:[{type:'infantry',at:1},{type:'rusher',at:3},{type:'breacher',at:0,min:'insane'}]},{after:38,entries:[{type:'gunner',story:'infantry',at:2},{type:'scout',at:1},{type:'grenadier',at:3,min:'insane'}]}]},
        {kind:'extract',zone:1,...at(k.metro),name:'Get below',hint:'The shutter is open. Interact to descend.',enter:{radio:radio('LARK','It’s open. Get below — now.',4)},
          start:radio('ROOK','Halcyon. A private army carrying our hardware. Who pays them, Lark?',6),cinematic:{duration:4.5,beats:[{at:2,radio:radio('LARK','Get me to the Kestrel relay and I’ll show you the launch log. Then you tell me who to trust.',6)}]}}],
      areas:[{x:330,y:240,label:'THE OLD QUARTER'},{x:960,y:780,label:'CHAPEL COURT'},{x:1160,y:240,label:'GALLERIA'},{x:1880,y:240,label:'MARKET PLAZA'},{x:1920,y:1000,label:'METRO / LINE 6'}],
      fires:[{x:430,y:810,size:18},{x:1240,y:860,size:14},{x:1900,y:300,size:12},{x:2050,y:1450,size:16}]});}

  function kestrel(){const g=canvas(70,44,'X');
    g.fill(1,5,68,42,'.').fill(8,21,61,21,'F').down(8,5,'F'.repeat(16)).down(61,5,'F'.repeat(16)).put(34,21,'11').down(8,12,'22').down(61,12,'22').fill(9,5,60,20,':');
    g.fill(29,5,41,6,'#').fill(14,8,19,11,'#').fill(50,8,55,11,'#').fill(21,14,26,16,'#').fill(43,14,48,16,'#');
    g.put(32,10,'C').put(38,10,'C').put(30,13,'==').put(38,13,'==').put(12,16,'C').put(57,16,'C').put(35,17,'O').put(24,9,'|').put(45,9,'|').put(33,7,'T');
    g.put(12,6,'i').put(57,6,'i').put(27,12,'i').put(42,12,'i').put(35,15,'h').put(20,18,'h').put(30,9,'d').put(40,9,'d').put(52,18,'d').put(36,11,'m').put(17,13,'k').put(53,13,'k');
    g.put(14,19,'s').put(55,19,'s').put(40,19,'s').put(25,19,'x').put(46,19,'x');
    g.fill(31,28,38,30,'~').put(20,27,'XX').put(20,28,'XX').put(30,33,'XX').put(41,28,'XX').put(42,29,'X').put(50,33,'XX').put(12,34,'XX').put(58,37,'XX').put(26,38,'XX').put(44,37,'XX').put(44,38,'X').put(15,25,'X').put(54,25,'XX').put(63,30,'XX').put(5,30,'XX').put(35,25,'XX');
    g.put(16,31,'===').put(36,35,'===').put(54,29,'===').put(24,23,'==').put(45,23,'==').put(9,38,'==').put(60,34,'==');
    g.put(22,30,'k').put(47,31,'k').put(36,33,'k').put(10,24,'i').put(59,24,'i').put(33,41,'a').put(10,37,'f').put(61,40,'u').put(37,23,'a').put(52,23,'f').put(66,8,'?').put(11,7,'n').put(58,9,'a');
    g.mark('start',35,41).mark('gate',33,23).mark('uplink',35,8).mark('cp1',35,23).mark('cp2',36,9).mark('spawn',35,27).mark('spawn',4,12).mark('spawn',65,12).mark('spawn',35,24);
    for(const [c,r] of [[12,7],[58,7],[11,19],[58,19],[47,26],[24,29],[35,24]])g.mark('perch',c,r);
    g.zone(1,9,5,60,18);
    const m=parse(g),k=m.marks;
    return finish({id:'kestrel',theme:'snow',...m,start:at(k.start),threat:1.1,guns:{infantry:'battle',scout:'smg',sniper:'marksman',shield:'pistol',gunner:'lmg'},insane:['rocketeer','scout'],perches:k.perch,spawnPoints:k.spawn,weather:'snow',
      intro:radio('LARK','Kestrel Station. Every launch order in this theatre routes through that dish. Open ground, marksmen on the fence. Use the rocks — and smoke, if you brought it.',8),resume:radio('LARK','Keep low. They’re glassing the valley.',5),
      stages:[
        {kind:'clear',zone:0,...at(k.gate),name:'Breach Kestrel Station',hint:'Silence the fence marksmen, then work the gate panel.',spawn:at(k.start)},
        {kind:'clear',zone:1,...at(k.uplink),name:'Reach the uplink console',hint:'Clear the compound. The console sits below the dish.',spawn:at(k.cp1),enter:{opens:[1],checkpoint:true,radio:radio('LARK','Gate’s open. The uplink console is at the foot of the dish, north side.',6)}},
        {kind:'survive',zone:2,...at(k.uplink),time:70,name:'Defend the uplink',hint:'Lark is pulling the launch log. Keep them off the dish.',spawn:at(k.cp2),enter:{opens:[2],checkpoint:true,radio:radio('LARK','I’m in. Pulling the launch log — this is slow. Side gates just opened. That wasn’t me.',6)},
          waves:[{after:0,entries:[{type:'scout',at:0},{type:'infantry',at:1},{type:'infantry',at:2}]},{after:15,entries:[{type:'drone',at:3},{type:'bomber',at:1},{type:'shield',story:'infantry',at:0}]},
            {after:30,entries:[{type:'scout',at:2},{type:'grenadier',at:0},{type:'bomber',at:3,min:'intense'}]},{after:46,entries:[{type:'gunner',story:'infantry',at:1},{type:'infantry',at:2},{type:'rocketeer',at:0,min:'insane'}]},
            {after:58,entries:[{type:'bomber',at:3},{type:'scout',at:0,min:'intense'},{type:'elite',at:1,min:'insane'}]}]},
        {kind:'boss',zone:2,...at(k.uplink),name:'Kill the Wraith',hint:'One shooter. He moves after every shot. Break his line, then punish the reload.',spawn:at(k.cp2),boss:{id:'wraith',type:'wraith',...k.perch[0]},
          enter:{checkpoint:true,radio:radio('WRAITH','You were a line item, Rook. I close line items.',5)},
          waves:[{hp:.66,entries:[{type:'bomber',at:1},{type:'bomber',at:2},{type:'scout',at:3,min:'intense'}]},{hp:.33,entries:[{type:'scout',at:0},{type:'bomber',at:3},{type:'infantry',at:1,min:'insane'}]}]},
        {kind:'extract',zone:2,...at(k.uplink),name:'Pull the drive',hint:'Interact with the uplink console.',enter:{radio:radio('LARK','He’s down. Pull the drive before they send another.',5)},
          start:radio('LARK','Authorisation on the missile that hit your extraction: CONTROL ACTUAL. Colonel Voss. That’s… my commanding officer.',7),cinematic:{duration:5,beats:[{at:2.4,radio:radio('ROOK','Then he’s hunting both of us now.',5)}]}}],
      areas:[{x:1400,y:1600,label:'KESTREL VALLEY'},{x:1360,y:150,label:'RELAY DISH'},{x:400,y:420,label:'GENERATOR SHED'},{x:2300,y:420,label:'BARRACKS'}]});}

  function underground(){const g=canvas(60,40,'#');
    g.fill(2,33,41,36,',').fill(14,25,22,31,':').fill(17,32,18,32,':').fill(38,10,41,36,',').fill(2,10,57,13,',').fill(24,10,33,12,'~').fill(24,14,33,14,':');
    g.fill(44,15,57,30,':').fill(42,19,43,20,':').fill(42,27,43,28,'1').fill(50,14,51,14,':').fill(38,22,41,22,'1').fill(56,15,57,17,'#');
    for(const c of [8,16,26,34])g.put(c,33,'X').put(c,36,'X');
    g.put(47,18,'X').put(47,23,'X').put(47,28,'X').put(54,18,'X').put(54,23,'X').put(54,28,'X').put(50,21,'==').put(50,25,'==');
    g.put(15,26,'T').put(21,26,'T').put(16,29,'C').put(20,28,'C').put(29,35,'C').put(11,34,'=').put(39,26,'C').put(36,11,'C').put(14,12,'==');
    g.put(12,34,'r').put(22,35,'r').put(30,34,'z').put(19,29,'b').put(15,30,'i').put(39,30,'k').put(40,25,'z');
    g.put(39,16,'z').put(20,11,'z').put(10,12,'r').put(36,12,'h').put(30,13,'b').put(45,11,'i');
    g.put(49,17,'k').put(52,27,'k').put(51,23,'h').put(55,22,'m').put(45,25,'i');
    g.put(5,35,'a').put(21,30,'f').put(14,29,'n').put(40,15,'a').put(12,11,'f').put(46,16,'u').put(56,29,'a').put(44,30,'p').put(3,13,'?');
    g.mark('start',4,35).mark('breaker',18,26).mark('platform',46,20).mark('control',55,18).mark('train',45,29).mark('cp1',18,28).mark('cp2',43,19).mark('cp3',53,19);
    for(const [c,r] of [[3,11],[56,11],[39,34],[39,12]])g.mark('spawn',c,r);
    for(const [c,r] of [[4,34],[18,27],[40,30],[20,12],[39,17],[50,20],[50,27]])g.mark('light',c,r);
    g.zone(1,2,10,41,21).zone(1,42,10,57,14).zone(2,42,15,57,30);
    const m=parse(g),k=m.marks;
    return finish({id:'underground',theme:'subway',...m,start:at(k.start),threat:1.15,dark:.9,lights:k.light,spawnPoints:k.spawn,guns:{scout:'smg',breacher:'sawedoff',gunner:'lmg',infantry:'battle',shield:'pistol'},insane:['ghost','breacher'],
      intro:radio('LARK','Voss has the surface locked. Line Six runs under the cordon and the power has been dead for weeks. Find the substation breaker. And Rook — something down there isn’t on Halcyon’s payroll.',9),resume:radio('LARK','Stay in your light. Listen for footsteps.',5),
      stages:[
        {kind:'clear',zone:0,...at(k.breaker),name:'Restore power at the substation',hint:'Clear the tunnel, then throw the breaker.',spawn:at(k.start)},
        {kind:'reach',zone:1,...at(k.platform),radius:150,name:'Reach Halden Street platform',hint:'North through the service passage.',spawn:at(k.cp1),dark:.62,enter:{opens:[1],checkpoint:true,radio:radio('LARK','Emergency lighting only — it’s the best I can do. The platform is north through the service passage.',6)}},
        {kind:'clear',zone:2,...at(k.control),name:'Take the platform control booth',hint:'Clear the platform. The booth is on the east wall.',spawn:at(k.cp2),dark:.62,enter:{checkpoint:true}},
        {kind:'survive',zone:2,...at(k.control),time:60,name:'Hold the platform',hint:'The maintenance train is four stops out.',spawn:at(k.cp3),dark:.5,enter:{checkpoint:true,radio:radio('LARK','Train’s four stops out. Sixty seconds. Every team in these tunnels heard that horn.',6)},
          waves:[{after:0,entries:[{type:'rusher',at:0},{type:'ghost',at:1},{type:'scout',at:2}]},{after:14,entries:[{type:'breacher',at:3},{type:'ghost',at:0},{type:'rusher',at:1,min:'intense'}]},
            {after:28,entries:[{type:'shield',at:2,story:'infantry'},{type:'scout',at:1},{type:'ghost',at:3,min:'insane'}]},{after:42,entries:[{type:'gunner',at:0,story:'infantry'},{type:'ghost',at:2},{type:'breacher',at:1,min:'insane'}]}]},
        {kind:'extract',zone:2,...at(k.train),name:'Board the train',hint:'Interact at the platform edge.',dark:.5,enter:{radio:radio('LARK','That’s your ride. Go!',4)},
          start:radio('LARK','Voss is moving something out of the city tonight. Highway Nine. Armoured convoy, full escort.',6),cinematic:{duration:4.5,beats:[{at:2.2,radio:radio('ROOK','Then that’s where I’m going.',4)}]}}],
      areas:[{x:400,y:1300,label:'LINE 6 / SOUTHBOUND'},{x:720,y:1100,label:'SUBSTATION A'},{x:1600,y:900,label:'SERVICE PASSAGE'},{x:2000,y:640,label:'HALDEN STREET'}]});}

  function convoy(){const g=canvas(80,34,'X');
    g.fill(1,2,78,31,'.').fill(4,4,14,9,':').fill(40,24,52,29,':').fill(60,3,70,8,':').fill(1,14,78,19,',');
    g.put(28,15,'UUU').put(28,18,'UUU').put(23,12,'===').put(23,21,'===').down(20,14,'||').down(20,18,'||').put(15,7,'===').put(32,26,'===').put(30,13,'O').put(30,20,'O');
    g.put(8,16,'VV').put(14,18,'VV').put(17,4,'XXX').put(10,22,'XX').put(26,27,'XX').put(4,12,'X').put(35,6,'XX');
    g.put(24,11,'m').put(24,22,'m').put(16,6,'s').put(33,27,'s').put(31,10,'q').put(12,16,'i').put(18,22,'i').put(27,9,'i').put(8,24,'k').put(22,28,'k').put(4,28,'a').put(12,28,'f').put(3,5,'?');
    g.put(37,15,'VVV').put(43,17,'VVV').put(49,15,'VVV').put(55,17,'VVV').put(35,12,'===').put(40,7,'XX').put(56,25,'XX').put(44,25,'X').put(58,10,'XX').put(46,21,'==');
    g.put(36,11,'m').put(40,13,'i').put(46,20,'i').put(53,12,'i').put(58,20,'i').put(41,18,'b').put(54,16,'b').put(47,23,'q').put(48,19,'h').put(38,22,'a').put(52,9,'f').put(57,28,'n');
    g.put(64,15,'VV').put(70,18,'VV').put(66,13,'O').put(72,20,'O').put(68,16,'O').put(63,8,'XX').put(74,25,'XX').put(66,26,'X').put(72,9,'X').put(62,22,'a').put(62,11,'a').put(66,24,'n').put(60,26,'f').put(61,4,'u');
    g.mark('start',3,26).mark('cargo',50,16).mark('cp1',33,16).mark('cp2',50,19).mark('apc',74,16);
    for(const [c,r] of [[76,4],[76,29],[60,4],[60,29]])g.mark('spawn',c,r);
    g.zone(1,35,2,60,31).zone(2,61,2,78,31);
    const m=parse(g),k=m.marks;
    return finish({id:'convoy',theme:'desert',...m,start:at(k.start),threat:1.2,spawnPoints:k.spawn,weather:'dust',guns:{infantry:'battle',scout:'smg',breacher:'autoshotgun',sniper:'precision',gunner:'lmg',rocketeer:'rocket',shield:'magnum'},insane:['rocketeer','gunner'],
      intro:radio('LARK','Highway Nine. That convoy carries the Blackout server — every kill order Voss ever signed. Burn the two fuel trucks at the checkpoint and the whole column stops.',8),resume:radio('LARK','Watch the high ground. They have glass on the dunes.',5),
      stages:[
        {kind:'destroy',zone:0,targets:'fuel',...at(k.cp1),name:'Burn the checkpoint fuel trucks',hint:'Two tankers on the highway. They burn hot — keep your distance.',spawn:at(k.start)},
        {kind:'clear',zone:1,...at(k.cargo),name:'Seize the cargo hauler',hint:'The column has stopped. Clear the escort and reach the hauler.',spawn:at(k.cp1),enter:{checkpoint:true,radio:radio('LARK','Column’s halted! The cargo hauler in the middle — get to it.',5)}},
        {kind:'boss',zone:2,...at(k.cargo),name:'Destroy the Bulwark',hint:'Heavy armour. Small arms barely scratch it — explosives, rockets or an EMP window.',spawn:at(k.cp2),boss:{id:'bulwark',type:'apc',...k.apc},
          enter:{checkpoint:true,radio:radio('LARK','Armour inbound from the east! That’s a Bulwark — your rifle will not scratch it. Explosives, Rook!',6)},
          waves:[{hp:.66,entries:[{type:'infantry',at:0},{type:'scout',at:1},{type:'rocketeer',at:2,min:'insane'}]},{hp:.33,entries:[{type:'breacher',at:1},{type:'infantry',at:3},{type:'gunner',at:0,min:'intense'}]}]},
        {kind:'extract',zone:2,...at(k.cargo),name:'Pull the server core',hint:'Interact with the cargo hauler.',enter:{radio:radio('LARK','It’s burning. Pull the core — quickly.',4)},
          start:radio('ROOK','Lark… it isn’t a server. It’s a hardware key.',5),cinematic:{duration:5,beats:[{at:2.4,radio:radio('LARK','A key to Site Meridian. That’s where the protocol actually lives.',6)}]}}],
      areas:[{x:240,y:440,label:'HIGHWAY 9 / CHECKPOINT'},{x:1800,y:500,label:'THE COLUMN'},{x:2800,y:440,label:'EAST APPROACH'}],
      fires:[{x:900,y:620,size:12},{x:2600,y:700,size:10}]});}

  function meridian(){const g=canvas(60,44,'#');
    g.fill(2,34,18,41,':').fill(8,20,11,33,',').fill(14,20,15,33,';').put(14,21,'WW').fill(3,10,20,19,':').fill(21,13,21,14,'1');
    g.fill(22,12,42,15,',').fill(30,4,33,30,',').fill(23,5,28,10,':').fill(25,11,26,11,':').down(29,6,'GGGG').fill(35,5,41,10,':').fill(37,11,38,11,':').down(34,6,'GGGG');
    g.fill(23,17,28,25,':').fill(25,16,26,16,':').down(29,18,'GGGGG').fill(35,17,41,25,':').fill(37,16,38,16,':').fill(43,13,43,14,'2');
    g.fill(44,5,57,29,':').put(47,9,'X').put(54,9,'X').put(47,25,'X').put(54,25,'X').put(45,6,'S').put(56,6,'S').put(51,28,'S').down(47,16,'||').down(54,16,'||').put(50,11,'===').put(50,22,'===');
    g.put(3,38,'VV').put(10,37,'C').put(7,35,'C').put(12,39,'===').put(8,12,'C').put(13,17,'C').put(11,15,'===').put(3,18,'T').put(27,13,'C').put(36,23,'C').put(40,19,'C');
    g.put(14,36,'i').put(6,37,'i').put(16,40,'k').put(9,21,'t').put(5,11,'t').put(18,17,'t').put(10,13,'e').put(16,15,'e').put(6,15,'i');
    g.put(26,8,'e').put(38,8,'h').put(32,5,'t').put(31,18,'d').put(32,24,'d').put(26,21,'e').put(39,21,'h').put(40,24,'t').put(36,13,'i').put(31,28,'k').put(24,13,'i');
    g.put(24,7,'J').put(40,7,'J').put(24,23,'J');
    g.put(4,36,'a').put(17,35,'f').put(15,32,'n').put(3,16,'a').put(19,11,'f').put(41,5,'u').put(28,14,'a').put(35,24,'f').put(41,25,'?').put(45,28,'a').put(57,28,'a').put(45,17,'u').put(57,5,'f');
    g.mark('start',4,40).mark('door',19,13).mark('core',45,14).mark('terminal',56,17).mark('warden',51,17).mark('cp1',19,14).mark('cp2',31,13).mark('cp3',42,14);
    for(const [c,r] of [[45,20],[56,24],[56,10],[45,9]])g.mark('spawn',c,r);
    g.zone(1,22,4,42,30).zone(2,43,4,57,30);
    const m=parse(g),k=m.marks;
    return finish({id:'meridian',theme:'facility',...m,start:at(k.start),threat:1.3,spawnPoints:k.spawn,guns:{infantry:'battle',scout:'smg',elite:'pulse',shield:'magnum',sniper:'precision'},insane:['elite','scout'],
      hazards:[hazard(8,24,11,24,2.4,.5,0),hazard(8,28,11,28,2.4,.5,1.2),hazard(8,31,11,31,1.8,.45,.4),hazard(30,20,33,20,2.6,.5,0),hazard(30,26,33,26,2.6,.5,1.3),hazard(36,12,36,15,3,.45,.8)],
      intro:radio('LARK','Site Meridian. Automated defences, prototype weapons, and the machine that decides who Voss erases. The sentry guns are armoured from the front — flank them or fry them.',8),resume:radio('LARK','Watch the beams. They cycle.',4),
      stages:[
        {kind:'clear',zone:0,...at(k.door),name:'Open the lab wing',hint:'Clear security, then work the door control. The vent bypasses the beam corridor.',spawn:at(k.start)},
        {kind:'destroy',zone:1,targets:'jammer',...at(k.cp2),name:'Break the three server racks',hint:'Racks sit behind lab glass. Each one keeps the core sealed.',spawn:at(k.cp1),enter:{opens:[1],checkpoint:true,radio:radio('LARK','Door’s open. Three server racks in the lab wing keep the core sealed. Break them.',6)}},
        {kind:'reach',zone:2,...at(k.core),radius:130,name:'Enter the core chamber',hint:'The seal has dropped. East end of the lab corridor.',spawn:at(k.cp2),enter:{opens:[2],checkpoint:true,radio:radio('LARK','Core chamber’s unlocked. Whatever is guarding it just powered up.',5)}},
        {kind:'boss',zone:2,...at(k.terminal),name:'Destroy the Warden',hint:'Its barrier feeds from the generators. Break one — or EMP it — to open a window.',spawn:at(k.cp3),boss:{id:'warden',type:'mech',...k.warden},
          enter:{checkpoint:true,radio:radio('WARDEN','Asset ROOK. Status: deceased. Correcting the record.',5)},
          waves:[{hp:.6,entries:[{type:'drone',at:0},{type:'elite',at:1},{type:'drone',at:2,min:'intense'}]},{hp:.3,entries:[{type:'elite',at:3},{type:'bomber',at:0},{type:'elite',at:2,min:'insane'}]}]},
        {kind:'extract',zone:2,...at(k.terminal),name:'Upload the Blackout list',hint:'Interact with the core terminal.',enter:{radio:radio('LARK','Upload it. All of it. Every name.',4)},
          start:radio('VOSS','You stole a list of names, Rook. I wrote that list. Come to the Citadel and I will add yours by hand.',7),cinematic:{duration:6.5,beats:[{at:3.2,radio:radio('LARK','He’s traced me — Rook, they’re at my door — ',5)}]}}],
      areas:[{x:400,y:1480,label:'LOADING DOCK'},{x:420,y:440,label:'SECURITY'},{x:1100,y:200,label:'LAB WING'},{x:2000,y:200,label:'CORE'}]});}

  // ACT III / THE TRUTH. Operation 7: Halcyon has found Lark. Get to her safehouse before their breach team does, then
  // walk her out across the canal to a car in the garage - she has a sidearm and no armour to speak of.
  function redline(){const g=canvas(64,44,'#');
    g.fill(1,36,62,40,',').fill(6,2,9,35,',').fill(42,2,45,35,',').fill(10,2,41,5,':');
    g.fill(10,19,41,21,'~').fill(18,19,21,21,',').fill(32,19,33,21,':');
    g.fill(10,22,41,35,':').fill(14,26,25,33,'#').fill(15,27,24,32,';').fill(19,33,20,33,';').fill(25,29,25,30,'W');
    g.fill(10,6,41,18,':');
    g.fill(46,2,61,17,';').fill(49,5,50,6,'#').fill(55,5,56,6,'#').fill(49,12,50,13,'#').fill(55,12,56,13,'#').down(46,2,'######').down(46,11,'####');
    g.fill(46,18,61,18,'#').fill(52,18,54,18,';').fill(46,19,61,35,':');
    // cover: the courtyard, the plaza across the canal, the yard and the garage
    g.put(12,24,'===').put(30,24,'===').put(36,28,'C').put(11,30,'C').put(28,31,'V').put(32,33,'===').put(38,25,'O');
    g.put(12,9,'===').put(22,9,'C').put(27,12,'===').put(35,9,'C').put(16,15,'|').down(16,15,'||').put(38,14,'===').put(24,16,'O').put(30,16,'C');
    g.put(48,24,'VV').put(55,22,'C').put(50,29,'===').put(58,27,'VV').put(56,33,'C');
    g.put(52,9,'VV').put(58,9,'C').put(48,15,'===');
    g.put(3,38,'V').put(14,38,'C').put(26,38,'===').put(40,37,'O').put(52,38,'VV');
    // the hostiles: the breach team at her door, the plaza across the canal, and the garage
    g.put(13,38,'i').put(30,37,'i').put(37,38,'A');
    g.put(12,25,'A').put(30,27,'A').put(38,31,'A').put(28,34,'P').put(17,24,'P').put(37,23,'g');
    g.put(12,7,'D').put(40,8,'D').put(20,14,'P').put(30,10,'P').put(25,8,'A').put(36,15,'A').put(24,12,'d').put(8,10,'k').put(44,13,'m');
    g.put(58,4,'A').put(58,15,'A').put(52,14,'P').put(48,7,'h');
    g.put(4,37,'a').put(11,27,'f').put(23,24,'a').put(40,33,'n').put(10,17,'f').put(41,7,'a').put(33,13,'u').put(60,20,'f').put(47,4,'a').put(60,16,'p').put(23,31,'?');
    g.mark('start',3,39).mark('door',19,34).mark('lark',20,30).mark('garage',47,9).mark('car',52,10).mark('cp1',19,35).mark('cp2',44,9);
    for(const [c,r] of [[60,3],[60,16],[44,3],[53,25]])g.mark('spawn',c,r);
    for(const [c,r] of [[8,37],[24,37],[40,37],[56,37],[8,20],[43,20],[19,20],[33,20],[25,10],[50,9],[57,9],[53,15],[20,28]])g.mark('light',c,r);
    g.zone(1,10,22,41,35).zone(2,6,2,45,21).zone(3,46,2,61,17);
    const m=parse(g),k=m.marks;
    return finish({id:'redline',theme:'rain',...m,start:at(k.start),threat:1.35,dark:.38,lights:k.light,spawnPoints:k.spawn,
      guns:{infantry:'battle',raider:'battle',striker:'smg',deadeye:'precision',scout:'smg',shield:'magnum',gunner:'lmg'},insane:['striker','raider'],
      intro:radio('LARK','Rook — they’re in my building. Halcyon. Not soldiers, contractors. I can hear them on the stairs.',7),resume:radio('LARK','Still here. Still breathing. Hurry.',4),
      stages:[
        {kind:'clear',zone:1,...at(k.door),name:'Reach Lark’s safehouse',hint:'Halcyon’s breach team is at her door. Clear the courtyard, then get to her.',spawn:at(k.start)},
        {kind:'reach',zone:2,...at(k.garage),radius:140,name:'Get Lark to the garage',hint:'Across the canal. She stays close; keep her out of the sharpshooters’ lanes.',spawn:at(k.cp1),
          enter:{checkpoint:true,escort:{id:'lark',name:'LARK',gun:'pistol',health:150,armor:60,at:at(k.lark)},radio:radio('LARK','You came. Okay — okay. I’m right behind you. Don’t let me get shot.',6)}},
        {kind:'clear',zone:3,...at(k.car),name:'Clear the garage',hint:'Halcyon got here first. Clear them out, then get Lark to the car.',spawn:at(k.cp2),enter:{checkpoint:true,radio:radio('LARK','The grey sedan. I can start it — I just need a minute nobody’s shooting at me.',6)}},
        {kind:'survive',zone:3,...at(k.car),time:60,name:'Cover Lark at the car',hint:'She is hot-wiring it. Hold the garage for a minute.',spawn:at(k.car),
          enter:{grants:{health:85,armor:45,refill:true},checkpoint:true,radio:radio('VOSS','Lieutenant Lark. You were the best analyst I ever had. Come home and nobody else has to die tonight.',7)},
          waves:[{entries:[{type:'striker',at:0},{type:'raider',at:1},{type:'scout',at:2}]},{after:15,entries:[{type:'raider',at:3},{type:'grenadier',at:0,min:'intense'},{type:'drone',at:1},{type:'striker',at:2,min:'intense'}]},
            {after:32,entries:[{type:'deadeye',at:2,min:'intense'},{type:'raider',at:0},{type:'striker',at:1},{type:'heavy',at:3,min:'insane'}]},{after:46,entries:[{type:'striker',at:3},{type:'raider',at:1}]}]},
        {kind:'extract',zone:3,...at(k.car),name:'Drive',hint:'The engine’s running. Get in.',enter:{radio:radio('LARK','Got it! Get in, get in!',3)},
          start:radio('LARK','He knows where we’ll go. The Citadel. He’s pulling everything he has back inside the walls.',7),
          cinematic:{duration:6,beats:[{at:2.8,radio:radio('ROOK','Then that’s where we’re going.',4)}]}}],
      areas:[{x:400,y:1560,label:'CANAL STREET'},{x:800,y:1230,label:'SAFEHOUSE'},{x:1040,y:820,label:'NORTH BRIDGE'},{x:1040,y:300,label:'MARKET PLAZA'},{x:2140,y:420,label:'PARKING GARAGE'}]});}
  // Operation 8: the Citadel, Halcyon's fortress. Two ways in - the main gate under its guns, or the storm drain to the
  // west - three shield pylons in the courtyard, the Havoc tank at the keep, and the lift to the top.
  function citadel(){const g=canvas(66,46,'#');
    g.fill(2,38,40,44,',').fill(10,30,13,37,',').fill(14,38,40,38,',');
    g.fill(2,19,3,37,';').fill(2,38,3,39,';').put(2,30,'WW').fill(4,20,5,21,';');
    g.fill(6,18,58,27,':').fill(10,28,13,29,',');
    g.fill(18,4,46,15,';').fill(6,16,58,17,'#').fill(30,16,33,17,'1').fill(30,18,33,18,':');
    g.fill(18,4,19,5,'#').fill(45,4,46,5,'#').fill(24,8,25,9,'#').fill(39,8,40,9,'#').fill(24,12,25,13,'#').fill(39,12,40,13,'#');
    // cover: the approach, the courtyard (built for a tank to roam), the keep
    g.put(5,40,'V').put(18,41,'===').put(26,39,'C').put(33,42,'VV').put(12,34,'C').put(8,33,'|').down(8,33,'||');
    g.put(9,20,'===').put(20,22,'C').put(24,25,'===').put(28,19,'O').put(38,21,'C').put(42,25,'===').put(47,19,'C').put(52,24,'===').put(57,22,'O').put(14,25,'C').put(36,26,'O');
    g.put(22,6,'===').put(42,6,'===').put(30,11,'C').put(28,14,'===').put(35,14,'===').put(21,11,'|').down(21,11,'||').put(43,11,'|').down(43,11,'||');
    g.put(16,20,'S').put(34,24,'S').put(54,20,'S');
    // the hostiles: the approach, the gate guns, the drain, the courtyard and the keep
    g.put(20,40,'i').put(30,41,'A').put(8,41,'i');
    g.put(10,27,'t').put(14,27,'t').put(9,24,'m').put(15,23,'A').put(2,33,'z').put(3,24,'z').put(5,21,'z');
    g.put(22,20,'A').put(30,23,'P').put(40,19,'D').put(48,25,'A').put(56,21,'D').put(26,26,'h').put(44,22,'q').put(36,19,'P').put(18,26,'d').put(50,19,'P').put(32,20,'e');
    g.put(26,6,'A').put(38,6,'i').put(32,9,'D').put(22,13,'P').put(42,13,'i').put(32,5,'h');
    g.put(6,42,'a').put(36,40,'f').put(3,36,'u').put(7,19,'f').put(25,21,'a').put(46,26,'n').put(55,26,'f').put(58,18,'a').put(20,5,'f').put(44,5,'a').put(31,12,'?').put(57,25,'p').put(12,19,'p').put(40,26,'f').put(30,26,'n').put(33,7,'p').put(26,14,'f');
    g.mark('start',4,43).mark('pylons',32,22).mark('tank',32,20).mark('keepgate',32,18).mark('lift',32,6).mark('cp1',12,33).mark('cp2',32,24).mark('cp3',32,19).mark('cp4',32,12);
    for(const [c,r] of [[20,5],[44,5],[57,19],[7,26]])g.mark('spawn',c,r);
    g.zone(1,2,18,58,29).zone(2,18,4,46,15);
    const m=parse(g),k=m.marks;
    return finish({id:'citadel',theme:'citadel',...m,start:at(k.start),threat:1.45,spawnPoints:k.spawn,
      guns:{infantry:'battle',raider:'battle',striker:'smg',deadeye:'precision',elite:'pulse',shield:'magnum',gunner:'lmg',heavy:'minigun'},insane:['raider','deadeye'],
      intro:radio('LARK','The Citadel. Main gate’s a gun line. There’s a storm drain on the west side — tight, dark, but it comes up inside the wall.',8),resume:radio('LARK','The pylons. Break the pylons and the shield over the keep drops.',5),
      stages:[
        {kind:'destroy',zone:1,targets:'generator',...at(k.pylons),name:'Break the three shield pylons',hint:'In by the gate’s guns or the west storm drain, then break the three courtyard pylons.',spawn:at(k.start)},
        {kind:'boss',zone:1,...at(k.keepgate),name:'Stop the Havoc',hint:'Rifle rounds bounce off: hit the engine deck at the back, or use rockets.',spawn:at(k.cp2),boss:{id:'havoc',type:'tank',tough:.8,...k.tank},
          enter:{checkpoint:true,radio:radio('VOSS','You brought her here. I was going to let her live, Rook.',5)},
          waves:[{hp:.6,entries:[{type:'striker',at:3},{type:'raider',at:2,min:'intense'}]},{hp:.3,entries:[{type:'raider',at:3},{type:'deadeye',at:1,min:'intense'},{type:'striker',at:2,min:'intense'}]}]},
        {kind:'clear',zone:2,...at(k.lift),name:'Take the keep',hint:'The keep’s garrison is dug in round the lift. Clear it, then work the lift controls.',spawn:at(k.cp3),
          enter:{opens:[1],grants:{health:80,armor:40,refill:true},checkpoint:true,radio:radio('LARK','Keep’s open. Clear it and get me to the lift controls.',5)}},
        {kind:'survive',zone:2,...at(k.lift),time:60,name:'Hold the lift',hint:'Lark is overriding the lift. Hold the keep for a minute.',spawn:at(k.cp4),
          enter:{checkpoint:true,radio:radio('LARK','I’m in the lift controls — he’s locking me out floor by floor. Give me a minute.',6)},
          waves:[{entries:[{type:'raider',at:0},{type:'striker',at:1},{type:'drone',at:2}]},{after:14,entries:[{type:'deadeye',at:0},{type:'raider',at:1},{type:'elite',at:2,min:'intense'}]},
            {after:30,entries:[{type:'heavy',at:3,min:'intense'},{type:'striker',at:0},{type:'striker',at:1,min:'intense'}]},{after:44,entries:[{type:'raider',at:2},{type:'raider',at:1},{type:'deadeye',at:3,min:'insane'}]}]},
        {kind:'extract',zone:2,...at(k.lift),name:'Ride the lift',hint:'The lift is yours. Interact to go up.',enter:{radio:radio('LARK','Done. Top floor. That’s him up there.',4)},
          start:radio('VOSS','Come up, then. I’ll turn the lights out myself.',5),cinematic:{duration:5.5,beats:[{at:2.6,radio:radio('ROOK','Lark — whatever happens up there, you get that list out.',5)}]}}],
      areas:[{x:840,y:1660,label:'APPROACH'},{x:100,y:1100,label:'STORM DRAIN'},{x:480,y:1150,label:'MAIN GATE'},{x:1280,y:880,label:'COURTYARD'},{x:1280,y:400,label:'THE KEEP'}]});}
  // Operation 9: the top of the Citadel. The command deck, the reactor that powers the Blackout servers, and Voss.
  function blackout(){const g=canvas(60,44,'#');
    g.fill(27,40,32,42,';').fill(10,30,50,39,':').fill(28,28,31,29,'1').fill(6,16,54,27,';').fill(28,14,31,15,'2').fill(8,3,52,13,':');
    // the command deck: consoles and glass; the reactor hall: catwalk cover and lasers; the summit: pillars and generators
    g.put(14,33,'T').put(20,33,'T').put(38,33,'T').put(44,33,'T').down(25,31,'GGGG').down(34,31,'GGGG').put(14,37,'===').put(42,37,'===').put(29,35,'C').put(12,31,'O').put(47,31,'O');
    g.put(10,22,'===').put(20,18,'C').put(24,25,'===').put(36,25,'===').put(40,18,'C').put(48,22,'===').put(30,20,'|').down(30,20,'||').put(16,26,'O').put(44,26,'O');
    g.put(12,20,'J').put(30,24,'J').put(48,20,'J');
    g.fill(15,6,16,7,'#').fill(43,6,44,7,'#').fill(15,10,16,11,'#').fill(43,10,44,11,'#').put(22,9,'===').put(36,9,'===').put(29,6,'C').put(10,12,'===').put(48,12,'===');
    g.put(12,5,'S').put(48,5,'S').put(30,12,'S');
    // the hostiles
    g.put(16,35,'A').put(44,35,'A').put(22,32,'P').put(38,32,'P').put(30,32,'e').put(12,38,'i').put(48,38,'i');
    g.put(10,18,'D').put(50,18,'D').put(22,20,'A').put(38,20,'A').put(30,17,'y').put(18,24,'P').put(42,24,'P').put(26,18,'d').put(34,18,'d').put(14,24,'h');
    g.put(28,41,'a').put(31,41,'f').put(11,34,'a').put(49,34,'f').put(29,37,'u').put(8,17,'f').put(52,17,'a').put(30,26,'n').put(9,26,'p').put(51,26,'a').put(10,4,'a').put(50,4,'f').put(20,12,'f').put(40,12,'a').put(30,38,'?');
    g.mark('start',29,41).mark('door',30,30).mark('reactor',30,22).mark('voss',30,7).mark('terminal',30,4).mark('cp1',30,30).mark('cp2',30,16);
    for(const [c,r] of [[9,4],[51,4],[9,12],[51,12]])g.mark('spawn',c,r);
    for(const [c,r] of [[12,5],[48,5],[30,12],[20,8],[40,8],[30,4]])g.mark('light',c,r);
    g.zone(1,6,16,54,27).zone(2,8,3,52,13);
    const m=parse(g),k=m.marks;
    return finish({id:'blackout',theme:'citadel',...m,start:at(k.start),threat:1.55,spawnPoints:k.spawn,lights:k.light,
      guns:{infantry:'battle',raider:'battle',striker:'smg',deadeye:'precision',elite:'pulse',shield:'magnum',heavy:'minigun'},insane:['raider','striker'],
      intro:radio('VOSS','Top floor, Rook. Everything below us runs on the reactor behind this deck. Including the Blackout servers. Including me.',8),resume:radio('LARK','Reactor couplings. Three of them. Cut them and his servers go dark.',5),
      stages:[
        {kind:'clear',zone:0,...at(k.door),name:'Take the command deck',hint:'Clear the deck, then work the blast door.',spawn:at(k.start)},
        {kind:'destroy',zone:1,targets:'jammer',...at(k.reactor),name:'Cut the reactor couplings',hint:'Three couplings feed the Blackout servers. Break all three.',spawn:at(k.cp1),enter:{opens:[1],checkpoint:true,radio:radio('LARK','Reactor hall. Three couplings — when the last one goes, so do the lights.',6)}},
        {kind:'boss',zone:2,...at(k.terminal),name:'End Voss',hint:'Break his generators or EMP him to drop the barrier. Once hurt, he blinks.',spawn:at(k.cp2),dark:.62,boss:{id:'voss',type:'voss',...k.voss},
          enter:{opens:[2],grants:{health:90,armor:50,refill:true},checkpoint:true,radio:radio('VOSS','There. Now it is dark enough for what you are, Rook. A deniable man. My best work.',7)},
          waves:[{hp:.66,entries:[{type:'raider',at:0},{type:'striker',at:1},{type:'deadeye',at:2,min:'intense'}]},{hp:.33,entries:[{type:'striker',at:2},{type:'raider',at:3},{type:'elite',at:0},{type:'heavy',at:1,min:'insane'}]}]},
        {kind:'extract',zone:2,...at(k.terminal),name:'Broadcast the truth',hint:'Voss is down. Interact with his terminal and send everything.',enter:{radio:radio('LARK','Rook. His terminal. Send it — everything, to everyone.',5)},
          start:radio('ROOK','Sending.',3),cinematic:{duration:9,beats:[{at:2.2,radio:radio('LARK','It’s out. Every name, every order, every signature. He can’t bury it now.',6)},{at:5.6,radio:radio('ROOK','Then I can stop running.',4)}]}}],
      areas:[{x:1200,y:1640,label:'LIFT'},{x:1200,y:1380,label:'COMMAND DECK'},{x:1200,y:880,label:'REACTOR HALL'},{x:1200,y:300,label:'SUMMIT'}]});}
  function holdout(){const g=canvas(44,32,'#');
    g.fill(1,1,42,30,'.').fill(1,14,42,17,',').fill(19,1,22,30,',').fill(6,5,10,8,'#').fill(33,5,37,8,'#').fill(6,23,10,26,'#').fill(33,23,37,26,'#');
    g.put(15,10,'===').put(26,10,'===').put(15,21,'===').put(26,21,'===').down(13,13,'||').down(30,17,'||').put(20,6,'C').put(21,25,'C').put(3,15,'C').put(40,16,'C').put(12,4,'O').put(31,27,'O').put(16,15,'VV').put(25,16,'VV');
    g.put(14,12,'a').put(29,19,'a').put(14,19,'f').put(29,12,'f').put(21,4,'n').put(21,27,'u');
    g.mark('start',21,19);for(const [c,r] of [[2,2],[41,2],[2,29],[41,29],[2,15],[41,15],[21,1],[21,30]])g.mark('spawn',c,r);
    const m=parse(g),k=m.marks;
    return finish({id:'holdout',theme:'city',...m,start:at(k.start),threat:1,spawnPoints:k.spawn,guns:{infantry:'rifle',scout:'smg',breacher:'sawedoff',sniper:'marksman',elite:'pulse',gunner:'lmg',rocketeer:'rocket',grenadier:'thumper',shield:'pistol',commander:'magnum'},
      intro:radio('LARK','Killhouse simulation. They keep coming until you stop. Every wave you clear pays out.',6),
      stages:[{kind:'endless',zone:0,x:k.start.x,y:k.start.y,name:'Survive the waves',hint:'Supplies drop between waves. Every fifth wave is a red wave, with a boss.',spawn:at(k.start)}],
      areas:[{x:860,y:600,label:'KILLHOUSE'}]});}

  function range(){
    return finish({id:'range',theme:'range',width:1800,height:1250,start:{x:390,y:625},
      walls:[box('n',0,0,1800,50),box('s',0,1200,1800,50),box('w',0,0,50,1250),box('e',1750,0,50,1250),box('range-wall',50,50,550,240),box('slide-cover',650,440,150,32,'barrier',150,true),box('vault-cover',650,770,150,32,'barrier',150,true),box('underpass',890,850,160,30,'underpass',Infinity,true),box('crate',1100,650,56,56,'crate',55,true),box('glass',900,340,28,110,'glass',45,true),box('barrel',1310,565,30,38,'barrel',25),box('panel',1510,850,44,44,'console',55)],
      enemies:[enemy('t1','infantry',1200,400,0),enemy('t2','rusher',1340,700,0),enemy('t3','shield',1480,1030,0),enemy('t4','sniper',1500,280,0),enemy('t5','drone',1100,960,0)],
      intro:radio('ROOK','Live fire range. Chain a sprint into a slide, then vault the low barricade. Resupply by the southern locker.',7),
      stages:[{kind:'range',zone:0,x:390,y:625,name:'Build your own perfect flow',hint:'All equipment unlocked. Settings select the range weapon and gadgets.',spawn:{x:390,y:625}}],
      pickups:[{id:'range-kit',x:400,y:950,type:'supply'}],
      areas:[{x:270,y:420,label:'MOVEMENT LAB'},{x:1050,y:230,label:'LIVE FIRE'},{x:900,y:825,label:'SLIDE UNDER'},{x:295,y:1010,label:'RESUPPLY'}]});
  }

  // Endless variants of the campaign maps: same geometry, pickups and theme, but the scripted stages/enemies are
  // replaced with a single wave-survival stage (as in holdout() above) so the existing director spawns every enemy.
  // The campaign's gates are left out: nothing in a killhouse ever opens them, and shut they cut the spawn points off
  // from the operator (every one of them in Site Meridian), so a wave there could never be cleared.
  function endlessVariant(build,baseId){const base=build(),start=at(base.start);
    return finish({...base,id:'holdout-'+baseId,enemies:[],walls:base.walls.filter(w=>w.kind!=='gate'),
      stages:[{kind:'endless',zone:0,x:start.x,y:start.y,name:'Survive the waves',hint:'Supplies drop between waves. Every fifth wave is a red wave, with a boss.',spawn:start}],
      intro:radio('LARK','Killhouse simulation, overlaid on a live operation zone. They keep coming until you stop.',6)});}
  const builders={crash,ruins,kestrel,underground,convoy,meridian,redline,citadel,blackout,holdout,range,
    'holdout-crash':()=>endlessVariant(crash,'crash'),'holdout-ruins':()=>endlessVariant(ruins,'ruins'),'holdout-kestrel':()=>endlessVariant(kestrel,'kestrel'),
    'holdout-underground':()=>endlessVariant(underground,'underground'),'holdout-redline':()=>endlessVariant(redline,'redline'),'holdout-citadel':()=>endlessVariant(citadel,'citadel'),'holdout-blackout':()=>endlessVariant(blackout,'blackout'),'holdout-convoy':()=>endlessVariant(convoy,'convoy'),'holdout-meridian':()=>endlessVariant(meridian,'meridian')};
  // Campaign order, briefing copy and recommended equipment. "rec" items are what the mission is tuned around; the briefing offers to buy them.
  const list=[
    {id:'crash',outro:'Your extraction burns over Vesper City. The missile came from your own side. Rook disappears into the ruins with one question: who gave the order?',n:1,act:'ACT I / THE FALL',title:'THE CRASH',sector:'VESPER CITY / SECTOR 07',terrain:'URBAN STREETS / MIXED RANGE',brief:'Recover your radio. Find a way out. Trust no one on the other end.',threats:['infantry','rusher','sniper','grenadier','shield','commander'],rec:{weapons:['rifle'],gear:[],note:'A forgiving first night. Learn to slide, vault and break line of sight.'},par:240,reward:400},
    {id:'ruins',outro:'Three jammers dead, one shutter open, and a stranger called Lark in your ear. She knows the people hunting you. She says the proof is on a mountain.',n:2,act:'ACT I / THE FALL',title:'NO SAFE GROUND',sector:'VESPER CITY / OLD QUARTER',terrain:'COLLAPSED BLOCKS / CLOSE QUARTERS',brief:'Three jammers blind the district. Burn them, then hold the metro shutter while a stranger opens it.',threats:['scout','breacher','grenadier','infantry','sniper'],rec:{weapons:['shotgun'],gear:['frag'],note:'Tight rooms and weak walls. A breaching shotgun and frags clear corners fast.'},par:330,reward:550},
    {id:'kestrel',outro:"The launch log names CONTROL ACTUAL: Colonel Marek Voss. Lark's commanding officer signed your death warrant, and now he knows she helped you.",n:3,act:'ACT I / THE FALL',title:'DEAD FREQUENCY',sector:'KESTREL HIGHLANDS / RELAY',terrain:'OPEN SNOWFIELD / LONG SIGHTLINES',brief:'Cross a frozen valley under marksman fire and steal the launch log from the relay dish.',threats:['sniper','scout','drone','bomber','wraith'],rec:{weapons:['marksman','precision'],gear:['smoke'],note:'Almost no cover on the approach. Smoke and a long rifle turn a shooting gallery into a fair fight.'},par:420,reward:700},
    {id:'underground',outro:'Line Six carries you under the cordon. Somewhere above, Voss is loading something into an armoured convoy and running for the border.',n:4,act:'ACT II / THE HUNT',title:'UNDERGROUND',sector:'LINE 6 / BENEATH THE CORDON',terrain:'BLACKED-OUT TUNNELS / POINT BLANK',brief:'No power, no light, no signal. Restore the substation and ride Line Six under the cordon.',threats:['ghost','rusher','breacher','gunner','shield'],rec:{weapons:['shotgun','autoshotgun'],gear:['flash'],note:'You fight inside your flashlight. Flashbangs stop ghosts cold; a shotgun finishes them.'},par:400,reward:850},
    {id:'convoy',outro:'The Bulwark burns on Highway Nine. Inside the hauler is not a server but a key — the only way into Site Meridian, where the Blackout Protocol lives.',n:5,act:'ACT II / THE HUNT',title:'IRON CONVOY',sector:'HIGHWAY 9 / SALT FLATS',terrain:'OPEN DESERT / ARMOUR',brief:'Stop the Blackout convoy on Highway Nine and take its cargo from a Bulwark armoured carrier.',threats:['gunner','rocketeer','sniper','breacher','apc'],rec:{weapons:['thumper','rocket'],gear:['mine'],note:'The Bulwark shrugs off bullets. Bring explosives — a launcher, rockets or mines — or you will not dent it.'},par:480,reward:1000},
    {id:'meridian',outro:'Every name on the Blackout list is public — and Voss has traced the upload to Lark. Her line goes dead mid-sentence. Rook is already moving.',n:6,act:'ACT II / THE HUNT',title:'GHOST SIGNAL',sector:'SITE MERIDIAN / BLACK SITE',terrain:'LAB CORRIDORS / SENTRIES / LASERS',brief:'Break into the Halcyon black site, crack the core and upload every name on the Blackout list.',threats:['turret','elite','shield','drone','mech'],rec:{weapons:['pulse','rail'],gear:['emp'],note:'Armoured sentries and a shielded Warden. An EMP opens every lock in this building.'},par:540,reward:1250},
    {id:'redline',outro:'Lark is alive, and the car is pointed at the Citadel. Voss has pulled every Halcyon team he has back inside its walls. He is not running any more.',n:7,act:'ACT III / THE TRUTH',title:'REDLINE',sector:'VESPER CITY / CANAL DISTRICT',terrain:'NIGHT STREETS / RAIN / ESCORT',brief:"Halcyon has found Lark. Reach her safehouse before their breach team does, then get her across the canal alive.",threats:['raider','striker','deadeye','grenadier','drone'],rec:{weapons:['smg','battle'],gear:['smoke'],note:'Halcyon special forces wear plates and lead their shots. Keep Lark out of the sharpshooters\' lanes - smoke breaks them.'},par:480,reward:1100},
    {id:'citadel',outro:'The Havoc burns in the courtyard and the lift is climbing. At the top: the reactor, the Blackout servers, and the man who signed your death warrant.',n:8,act:'ACT III / THE TRUTH',title:'CITADEL',sector:'THE CITADEL / OUTER WORKS',terrain:'FORTRESS / TWO ROUTES / ARMOUR',brief:'Get inside the Citadel - through its main gate or its storm drain - break the shield pylons and take the keep.',threats:['turret','gunner','ghost','raider','tank'],rec:{weapons:['launcher','rocket'],gear:['emp'],note:'The gate is a gun line and the keep has a tank. Rockets for its back, an EMP for the sentry guns - or take the drain and skip the guns.'},par:600,reward:1200},
    {id:'blackout',outro:'The Blackout Protocol is public: every name, every order, every signature. Colonel Marek Voss is dead. Rook is not, and for the first time since the crash, nobody is hunting him.',n:9,act:'ACT III / THE TRUTH',title:'BLACKOUT',sector:'THE CITADEL / SUMMIT',terrain:'COMMAND DECK / REACTOR / DARKNESS',brief:'The top of the Citadel. Cut the reactor that feeds the Blackout servers, then finish what Voss started.',threats:['raider','striker','deadeye','heavy','voss'],rec:{weapons:['pulse','rail'],gear:['emp','flash'],note:'Voss fights behind a barrier fed by three generators, and the lights go out. An EMP drops the barrier; a pulse rifle burns through it.'},par:660,reward:1300}];
  function build(id){return (builders[id]||builders.crash)();}
  // Holdout map picker metadata. The Killhouse is always unlocked; every other killhouse is a campaign map,
  // locked until that operation is marked done, and pays a little more the later in the campaign it comes ("pay").
  // size: a small map is fast and close (best for 1v1 to 2v2 in team deathmatch), a large one suits 3v3 and 4v4.
  const holdoutMaps=[{id:'holdout',title:'KILLHOUSE',sector:'ENDLESS',locks:null,pay:1,size:'small'},
    ...list.map((m,i)=>({id:'holdout-'+m.id,title:m.title,sector:m.sector,locks:m.id,pay:+(1.1+.1*i).toFixed(1),size:'large'}))];
  return {CELL,list,build,builders,canvas,parse,box,enemy,holdoutMaps};
});

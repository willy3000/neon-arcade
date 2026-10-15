'use strict';
// node blackout/tools/make-field-poses.cjs [--check out.png]
//
// Measures how the original character atlas (legacy/sprites/characters.png, see legacy/README.md) holds and moves -
// where each hand is, which way the gun points, where the knife's blade is, where the boots step - frame by frame, and
// writes it into blackout/icons.js (FIELD_POSES) for the field's own drawn soldier to be posed from. The reference
// is only read, never shipped: the poses are numbers, the drawing is the game's own.
//
// In the reference the hands are bare skin, the stocks are wood and the knife is bright steel, so each is found by its
// colour: skin-coloured pixels joined into patches (the largest, at the middle, is the head; the others are hands),
// wood for the rear of a long gun, the furthest pixel along the gun for its muzzle, the brightest grey for the blade,
// and the blue-grey of the boots for the feet. Every position is given relative to the head, in the units the sheet
// is drawn in (the reference's pixels divided by the sheet's zoom), so the drawn soldier keeps the reference's reach.
// --check draws what was found over the reference frames, to see that it was found right.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),ZOOM=1.16,HEAD=[-3,0];
(async()=>{const png='data:image/png;base64,'+fs.readFileSync(path.join(root,'legacy/sprites/characters.png')).toString('base64'),atlas=JSON.parse(fs.readFileSync(path.join(root,'legacy/sprites/characters.json'))).frames;
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1400,height:900}});
 const found=await page.evaluate(async([png,atlas])=>{const img=new Image();img.src=png;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
  const mean=a=>a.length?[a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]:null;
  // Patches of neighbouring pixels in a set (4-neighbour), largest first.
  const patches=(pts)=>{const key=q=>q[0]*200+q[1],left=new Set(pts.map(key)),out=[];for(const p of pts){if(!left.has(key(p)))continue;const grp=[],st=[p];left.delete(key(p));while(st.length){const q=st.pop();grp.push(q);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const n=[q[0]+dx,q[1]+dy];if(left.has(key(n))){left.delete(key(n));st.push(n);}}}out.push(grp);}return out.sort((a,b)=>b.length-a.length);};
  const out={};
  for(const [name,f] of Object.entries(atlas)){const d=x.getImageData(f.frame.x,f.frame.y,112,112).data,skin=[],wood=[],bright=[],boot=[],steel=[],pack=[],all=[];
   for(let yy=0;yy<112;yy++)for(let xx=0;xx<112;xx++){const i=(yy*112+xx)*4;if(d[i+3]<128)continue;const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);all.push([xx,yy]);
    if(r>=g+6&&Math.abs(g-b)<9&&r>22)skin.push([xx,yy]);if(r>=g+12&&g>=b+6&&r>70)wood.push([xx,yy]);if(mx>64&&mx-mn<16)bright.push([xx,yy]);if(b===mx&&b>=r+5&&b>=g+4)boot.push([xx,yy]);if(mx>44&&mx-mn<7)steel.push([xx,yy]);if(r>45&&g>40&&r-b>=14&&g-b>=12&&Math.abs(r-g)<14)pack.push([xx,yy]);}
   const [g]=name.split('/');
   if(g==='feet'){const ps=patches(boot).filter(p=>p.length>=8).slice(0,2).map(mean);out[name]={boots:ps};continue;}
   const ps=patches(skin).filter(p=>p.length>=5),cx=56,cy=58;
   // The head: the biggest skin-coloured patch near the middle (the cap is the same hue). Hands: the other patches.
   const head=ps.find(p=>{const m=mean(p);return Math.hypot(m[0]-cx,m[1]-cy)<16&&p.length>25;})||[],hm=head.length?mean(head):[cx,cy];
   const hands=ps.filter(p=>p!==head).map(p=>({m:mean(p),n:p.length})).filter(h=>Math.hypot(h.m[0]-hm[0],h.m[1]-hm[1])>8).slice(0,2);
   const tipOf=from=>{let best=null,bd=-1;for(const q of all){const dd=q[0]-from[0];if(dd>bd&&Math.abs(q[1]-from[1])<14){bd=dd;best=q;}}return best;};
   // The pack's camouflage, seen from above, says which way the torso faces.
   const rec={head:hm,hands:hands.map(h=>h.m),pack:mean(pack)};
   // The blade: a patch of neutral grey steel touching a hand (the cap and the pack have flecks of their own, and those
   // are tinted or away from the hands). Its far end gives the blade's direction.
   if(g==='knife'){let best=null,bn=0;for(const pt of patches(steel).filter(p=>p.length>=4)){for(const h of hands){const near=Math.min(...pt.map(q=>Math.hypot(q[0]-h.m[0],q[1]-h.m[1])));if(near<7&&pt.length>bn){bn=pt.length;const far=pt.reduce((a,q)=>Math.hypot(q[0]-h.m[0],q[1]-h.m[1])>Math.hypot(a[0]-h.m[0],a[1]-h.m[1])?q:a,pt[0]);best={hand:h.m,tip:far};}}}rec.blade=best&&best.tip;rec.knifeHand=best&&best.hand;}
   else{const woodM=mean(wood),tip=tipOf(hands.length?hands.reduce((a,h)=>h.m[0]>a[0]?h.m:a,hands[0].m):hm);rec.wood=woodM;rec.tip=tip;}
   out[name]=rec;}
  return out;},[png,atlas]);
 // Turn what was found into poses, an animation at a time, in the sheet's units relative to the head. What can be
 // measured reliably is used directly - the muzzle, the gun's line from stock to muzzle, the knife's blade, the boots;
 // the grip hand of a long gun is often hidden behind its stock, so it is put where it sits on the gun, the same
 // distance back from the muzzle as in the reference. The other hand is followed from frame to frame (a patch by the
 // head is the face, not a hand), and every series is smoothed over its neighbours so nothing jitters.
 const toLocal=(p,h)=>[(p[0]-h[0])/ZOOM+HEAD[0],(p[1]-h[1])/ZOOM+HEAD[1]],R1=v=>+v.toFixed(1),poses={};
 const GRIP_BACK={rifle:32,shotgun:32,handgun:14},seqs={};
 for(const name of Object.keys(found)){const [g,sq,i]=name.split('/');(seqs[g+'/'+sq]=seqs[g+'/'+sq]||[])[+i]=name;}
 const loops=sq=>/\/(idle|move|walk|run|strafe_left|strafe_right)$/.test(sq);
 const smooth=(vals,loop)=>vals.map((_,i)=>{const at=j=>vals[loop?(j+vals.length)%vals.length:Math.max(0,Math.min(vals.length-1,j))],w=[at(i-1),at(i),at(i+1)].filter(v=>v!=null);if(!w.length)return null;if(typeof w[0]==='number')return w.sort((a,b)=>a-b)[Math.floor(w.length/2)];
  return [0,1].map(k=>w.map(v=>v[k]).sort((a,b)=>a-b)[Math.floor(w.length/2)]);});
 const packAng=r=>r&&r.pack?Math.atan2(r.pack[1]-r.head[1],r.pack[0]-r.head[0]):null,BASE=packAng(found['rifle/idle/0']),unwrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
 for(const [sq,names] of Object.entries(seqs)){const g=sq.split('/')[0],loop=loops(sq),rs=names.map(n=>found[n]);
  // The drawn torso rests turned a little differently from the reference's, so 0.6 of the reference's turn brings its
  // pack to where the reference's pack is (checked on the rifle bash and the knife strike).
  const TURN=g==='feet'?null:smooth(rs.map(r=>{const a=packAng(r);return a==null?0:unwrap(a-BASE)*.6;}),loop);
  if(g==='feet'){const h=[56,58];let prev=null;const A=[],B=[];rs.forEach(r=>{let b=(r.boots||[]).map(p=>toLocal(p,h));if(b.length<2)b=prev||[[-9,-6],[-9,6]];b.sort((p,q)=>p[1]-q[1]);A.push(b[0]);B.push(b[1]);prev=b;});
   const a=smooth(A,loop),bb=smooth(B,loop);names.forEach((n,i)=>poses[n]={b:[a[i].map(R1),bb[i].map(R1)]});continue;}
  const others=rs.map(r=>(r.hands||[]).map(p=>toLocal(p,r.head)).filter(p=>Math.hypot(p[0]-HEAD[0],p[1]-HEAD[1])>8.5));
  if(g==='knife'){const K=[],O=[],D=[];let pk=null,po=null;rs.forEach((r,i)=>{const kh=r.knifeHand?toLocal(r.knifeHand,r.head):pk,tip=r.blade?toLocal(r.blade,r.head):null;
    const rest=others[i].filter(p=>!kh||Math.hypot(p[0]-kh[0],p[1]-kh[1])>4),o=rest.length?rest.reduce((a,p)=>!po||Math.hypot(p[0]-po[0],p[1]-po[1])<Math.hypot(a[0]-po[0],a[1]-po[1])?p:a,rest[0]):po;
    K.push(kh||[16,9]);O.push(o||[8,-12]);D.push(tip&&kh?Math.atan2(tip[1]-kh[1],tip[0]-kh[0]):(D.length?D[D.length-1]:0));pk=kh;po=o;});
   const k=smooth(K,loop),o=smooth(O,loop),d=smooth(D,loop);names.forEach((n,i)=>poses[n]={h:[k[i].map(R1),o[i].map(R1)],k:+d[i].toFixed(3),t:+TURN[i].toFixed(3)});continue;}
  // Guns: the muzzle and the line of the gun, then the hands.
  const T=[],ANG=[];rs.forEach((r,i)=>{const tip=r.tip?toLocal(r.tip,r.head):(T.length?T[T.length-1]:[44,9]);T.push(tip);
   const rear=g!=='handgun'&&r.wood?toLocal(r.wood,r.head):null;ANG.push(rear?Math.atan2(tip[1]-rear[1],tip[0]-rear[0]):(ANG.length?ANG[ANG.length-1]:0));});
  const t=smooth(T,loop),ang=smooth(ANG,loop),grip=t.map((p,i)=>[p[0]-Math.cos(ang[i])*GRIP_BACK[g],p[1]-Math.sin(ang[i])*GRIP_BACK[g]]);
  let po=null;const F=rs.map((r,i)=>{const cand=others[i].filter(p=>Math.hypot(p[0]-grip[i][0],p[1]-grip[i][1])>5);let f=cand.length?cand.reduce((a,p)=>(po?Math.hypot(p[0]-po[0],p[1]-po[1]):-p[0])<(po?Math.hypot(a[0]-po[0],a[1]-po[1]):-a[0])?p:a,cand[0]):null;
   if(!f)f=po||[grip[i][0]+Math.cos(ang[i])*13,grip[i][1]+Math.sin(ang[i])*13];po=f;return f;});
  const f=g==='handgun'?grip.map(p=>[p[0]-1.6,p[1]-2.2]):smooth(F,loop);
  names.forEach((n,i)=>poses[n]={h:[grip[i].map(R1),f[i].map(R1)],a:+ang[i].toFixed(3),t:+TURN[i].toFixed(3)});}
 console.log(Object.keys(poses).length+' frames posed');
 if(process.argv[2]==='--check'){const file=process.argv[3];
  await page.setContent('<body style="margin:0;background:#4d5743"><canvas id=c width=1400 height=900></canvas></body>');
  await page.evaluate(async([png,atlas,found])=>{const img=new Image();img.src=png;await img.decode();const x=document.getElementById('c').getContext('2d'),show=['rifle/idle/0','rifle/reload/4','rifle/reload/10','rifle/meleeattack/7','handgun/idle/0','handgun/reload/7','shotgun/reload/10','knife/idle/0','knife/meleeattack/3','knife/meleeattack/7','knife/meleeattack/11','feet/walk/5'],s=3;
   const dot=(ox,oy,p,c,r=6)=>{if(!p)return;x.beginPath();x.arc(ox+p[0]*s,oy+p[1]*s,r,0,7);x.strokeStyle=c;x.lineWidth=2;x.stroke();};
   show.forEach((n,i)=>{const f=atlas[n].frame,ox=(i%4)*345,oy=Math.floor(i/4)*300,r=found[n];x.drawImage(img,f.x,f.y,112,112,ox,oy,112*s,112*s);x.fillStyle='#fff';x.font='11px monospace';x.fillText(n,ox+2,oy+14);
    if(r.boots){r.boots.forEach(p=>dot(ox,oy,p,'#4cf'));return;}dot(ox,oy,r.head,'#ff0',6);(r.hands||[]).forEach((p,j)=>dot(ox,oy,p,j?'#f0f':'#0f0'));dot(ox,oy,r.wood,'#f80',3);dot(ox,oy,r.tip,'#f00',3);dot(ox,oy,r.blade,'#0ff',3);});},[png,atlas,found]);
  await page.screenshot({path:file});}
 await browser.close();
 // Write the table into icons.js between its markers.
 const icons=path.join(root,'blackout/icons.js');let src=fs.readFileSync(icons,'utf8');const nl=src.includes('\r\n')?'\r\n':'\n';
 const body=' const FIELD_POSES='+JSON.stringify(poses)+';';
 const a=src.indexOf(' // <field-poses>'),b=src.indexOf(' // </field-poses>');
 if(a<0||b<0)throw new Error('icons.js has no <field-poses> markers');
 src=src.slice(0,a)+' // <field-poses> made by blackout/tools/make-field-poses.cjs from the retired atlas; run it again rather than editing this line.'+nl+body+nl+src.slice(b);
 fs.writeFileSync(icons,src);console.log('wrote FIELD_POSES into blackout/icons.js');
})().catch(e=>{console.error(e);process.exit(1);});

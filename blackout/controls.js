(function(root){'use strict';
 // Game-agnostic pictures of the controls for a settings screen: a keyboard with its mouse, and a controller drawn
 // either as an Xbox pad or as a PlayStation (DualSense) pad. Each returns HTML. The game says what is bound where;
 // every key carries data-key (its KeyboardEvent.code) and every controller button data-pad (its name in gamepad.js),
 // so the page can react to clicks. Nothing here is focusable: the picture is a companion to a list of real buttons.
 // Sizes follow the container; the look is in style.css (".kb", ".pad-diagram").
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

 // A compact keyboard, sixteen keys wide: the main block with the arrows tucked under the right shift. [code, legend, width in keys].
 const letters=s=>[...s].map(c=>['Key'+c,c,1]),digits=s=>[...s].map(c=>['Digit'+c,c,1]);
 const ROWS=[
  [['Escape','ESC',1],...digits('1234567890'),['Minus','-',1],['Equal','=',1],['Backspace','BKSP',2],['Delete','DEL',1]],
  [['Tab','TAB',1.5],...letters('QWERTYUIOP'),['BracketLeft','[',1],['BracketRight',']',1],['Backslash','\\',1.5],['PageUp','PGUP',1]],
  [['CapsLock','CAPS',1.75],...letters('ASDFGHJKL'),['Semicolon',';',1],['Quote',"'",1],['Enter','ENTER',2.25],['PageDown','PGDN',1]],
  [['ShiftLeft','SHIFT',2.25],...letters('ZXCVBNM'),['Comma',',',1],['Period','.',1],['Slash','/',1],['ShiftRight','SHIFT',1.75],['ArrowUp','↑',1],['End','END',1]],
  [['ControlLeft','CTRL',1.25],['MetaLeft','WIN',1.25],['AltLeft','ALT',1.25],['Space','SPACE',6.25],['AltRight','ALT',1],['ControlRight','CTRL',1],[null,'',1],['ArrowLeft','←',1],['ArrowDown','↓',1],['ArrowRight','→',1]]];
 const DRAWN=new Set(ROWS.flat().map(k=>k[0]).filter(Boolean));
 // bound: {code: what it does}; fixed: the same for keys the game keeps for itself; listening: the code about to be replaced;
 // mouse: {left, right, wheel, move}. A binding to a key that is not drawn (the numeric pad, say) is listed underneath.
 function keyboard({bound={},fixed={},listening=null,mouse=null}={}){
  const cap=([code,legend,width])=>{const span=`style="grid-column:span ${width*4}"`;if(!code)return `<i class="key gap" ${span}></i>`;const label=bound[code]||fixed[code],locked=code in fixed||code==='MetaLeft';
   return `<i class="key${bound[code]?' bound':''}${locked?' fixed':''}${code===listening?' listening':''}" data-key="${code}" ${span}><b>${esc(legend)}</b>${label?`<span>${esc(label)}</span>`:''}</i>`;};
  const extra=Object.keys(bound).filter(code=>!DRAWN.has(code));
  return `<div class="kb"><div class="kb-keys">${ROWS.map(row=>`<div class="kb-row">${row.map(cap).join('')}</div>`).join('')}</div>${mouse?mouseArt(mouse):''}</div>`
   +(extra.length?`<p class="kb-extra">NOT ON THIS PICTURE: ${extra.map(code=>`<b>${esc(code.toUpperCase())}</b> ${esc(bound[code])}`).join(' · ')}</p>`:'');}
 function mouseArt({left,right,wheel,move}){
  return `<div class="kb-mouse"><svg viewBox="0 0 100 124" aria-hidden="true" focusable="false"><path class="m-body" d="M22 44Q22 6 50 6Q78 6 78 44V80Q78 118 50 118Q22 118 22 80Z"/><path class="m-left" d="M22 50V44Q22 8 48 6V50Z"/><path class="m-right" d="M78 50V44Q78 8 52 6V50Z"/><path class="m-line" d="M22 50H78M50 6V50"/><rect class="m-wheel" x="44" y="18" width="12" height="22" rx="6"/><text x="33" y="36">L</text><text x="67" y="36">R</text></svg>`
   +`<ul>${[['L',left],['R',right],['WHEEL',wheel],['MOVE',move]].filter(row=>row[1]).map(([name,does])=>`<li><b>${name}</b>${esc(does)}</li>`).join('')}</ul></div>`;}

 // The controller is drawn in a 900 x 430 box: the pad in the middle, seven call-outs down each side and two across the
 // top (the two small centre buttons). For each kind of pad: which button each call-out row belongs to, where on the
 // drawing each button is, and - for the one button of each cluster that the others stand in front of - the gap its
 // line is threaded through.
 const W=900,H=430,CALL_W=222,CALL_H=38,LEFT=14,RIGHT=W-LEFT-CALL_W,ROW0=70,ROW=50,TOP_W=175,TOP=[[268,6,400],[457,6,500]];
 const PADS={
  xbox:{left:['lt','lb','ls','up','left','right','down'],right:['rt','rb','y','b','x','a','rs'],
   at:{lt:[330,98],lb:[316,126],ls:[326,186],up:[398,222],left:[374,246],right:[422,246],down:[398,270],back:[422,173],start:[478,173],rt:[570,98],rb:[584,126],y:[556,159],b:[583,186],x:[529,186],a:[556,213],rs:[524,252]},
   thread:{right:[386,258],x:[569.5,199.5]}},
  ps:{left:['lt','lb','up','left','right','down','ls'],right:['rt','rb','y','b','x','a','rs'],
   at:{lt:[336,100],lb:[318,128],up:[345,168],left:[323,190],right:[367,190],down:[345,212],back:[384,139],start:[516,139],ls:[380,270],rt:[564,100],rb:[582,128],y:[555,163],b:[582,190],x:[528,190],a:[555,217],rs:[520,270]},
   thread:{right:[334,201],x:[568.5,203.5]}}};
 const RIM={y:13.5,b:13.5,x:13.5,a:13.5,back:9,start:9};
 const n1=v=>+v.toFixed(1),stick=(x,y)=>`<circle class="p-well" cx="${x}" cy="${y}" r="26"/><circle class="p-stick" cx="${x}" cy="${y}" r="18"/><circle class="p-cap" cx="${x}" cy="${y}" r="10"/>`;
 function xboxArt(){const face=(x,y,letter,color)=>`<circle class="p-btn" cx="${x}" cy="${y}" r="12.5"/><text class="p-letter" x="${x}" y="${y+4.5}" fill="${color}">${letter}</text>`;
  return `<rect class="p-trig" x="312" y="88" width="62" height="38" rx="13"/><rect class="p-trig" x="526" y="88" width="62" height="38" rx="13"/>`
   +`<rect class="p-bump" x="298" y="113" width="94" height="15" rx="7.5" transform="rotate(-7 345 120)"/><rect class="p-bump" x="508" y="113" width="94" height="15" rx="7.5" transform="rotate(7 555 120)"/>`
   +`<path class="p-shell" d="M345 122C385 112 515 112 555 122C588 124 608 142 616 172C628 216 638 284 628 322C621 346 596 352 584 334C572 312 556 288 532 282L368 282C344 288 328 312 316 334C304 352 279 346 272 322C262 284 272 216 284 172C292 142 312 124 345 122Z"/>`
   +stick(348,186)+stick(502,246)+`<circle class="p-well" cx="398" cy="246" r="32"/><path class="p-btn" d="M389 219h18v18h18v18h-18v18h-18v-18h-18v-18h18Z"/>`
   +face(556,159,'Y','#e3c15a')+face(583,186,'B','#de7566')+face(556,213,'A','#86c06f')+face(529,186,'X','#7aa7e0')
   +`<circle class="p-btn" cx="422" cy="180" r="7.5"/><path class="p-mark" d="M418.5 178.5h5v4h-5ZM420.5 177v-1.5h5v4h-1.5"/><circle class="p-btn" cx="478" cy="180" r="7.5"/><path class="p-mark" d="M474.5 177.5h7M474.5 180h7M474.5 182.5h7"/>`
   +`<circle class="p-guide" cx="450" cy="148" r="15"/><circle class="p-guide-in" cx="450" cy="148" r="8"/>`;}
 function psArt(){const petal=turn=>`<path class="p-btn" d="M336 163h18v15l-9 9l-9-9Z" transform="rotate(${turn} 345 190)"/>`,face=(x,y,mark)=>`<circle class="p-btn" cx="${x}" cy="${y}" r="12.5"/>${mark}`;
  return `<rect class="p-trig" x="306" y="90" width="60" height="38" rx="14"/><rect class="p-trig" x="534" y="90" width="60" height="38" rx="14"/>`
   +`<rect class="p-bump" x="288" y="118" width="84" height="14" rx="7" transform="rotate(-9 330 125)"/><rect class="p-bump" x="528" y="118" width="84" height="14" rx="7" transform="rotate(9 570 125)"/>`
   +`<path class="p-shell" d="M322 124C362 114 538 114 578 124C606 128 622 148 630 184C641 236 648 300 636 338C628 360 602 362 592 342C580 316 570 300 552 296L348 296C330 300 320 316 308 342C298 362 272 360 264 338C252 300 259 236 270 184C278 148 294 128 322 124Z"/>`
   +`<path class="p-inner" d="M392 124L508 124C514 150 520 196 538 226C550 248 544 286 522 296L378 296C356 286 350 248 362 226C380 196 386 150 392 124Z"/>`
   +`<rect class="p-touch" x="398" y="128" width="104" height="62" rx="10"/><path class="p-light" d="M394 134V184M506 134V184"/><rect class="p-pill" x="381" y="132" width="6" height="14" rx="3"/><rect class="p-pill" x="513" y="132" width="6" height="14" rx="3"/>`
   +petal(0)+petal(90)+petal(180)+petal(270)
   +face(555,163,'<path class="p-sym" stroke="#7fcdb4" d="M555 156.5l6.5 11h-13Z"/>')+face(582,190,'<circle class="p-sym" stroke="#e08a7c" cx="582" cy="190" r="6"/>')
   +face(555,217,'<path class="p-sym" stroke="#8fb1e8" d="M549.5 211.5l11 11M560.5 211.5l-11 11"/>')+face(528,190,'<rect class="p-sym" stroke="#d6a0cf" x="522.5" y="184.5" width="11" height="11"/>')
   +stick(398,256)+stick(502,256)+`<circle class="p-btn" cx="450" cy="232" r="8"/><rect class="p-pill" x="443" y="250" width="14" height="4" rx="2"/>`;}
 // labels: {button: what it does}; glyphs: {button: what it is called on this pad}; bound: the buttons whose action can be
 // changed; fixed: buttons the game keeps for itself; listening: the button about to be replaced.
 function pad(brand,{labels={},glyphs={},bound=[],fixed=[],listening=null}={}){const kind=brand==='xbox'?'xbox':'ps',P=PADS[kind],lines=[],calls=[];
  const state=name=>(bound.includes(name)?' bound':'')+(fixed.includes(name)?' fixed':'')+(labels[name]?'':' free')+(name===listening?' listening':'');
  const call=(name,side,x,y,width=CALL_W)=>calls.push(`<i class="call call-${side}${state(name)}" data-pad="${name}" style="left:${n1(x/W*100)}%;top:${n1(y/H*100)}%;width:${n1(width/W*100)}%;height:${n1(CALL_H/H*100)}%"><b>${esc(glyphs[name]||name.toUpperCase())}</b><span>${esc(labels[name]||'NOT USED')}</span></i>`);
  // A line to a button that has a symbol on it stops at the button's edge, so the symbol stays readable.
  const line=(name,points)=>{const r=RIM[name];if(r){const [[ax,ay],[bx,by]]=points,len=Math.hypot(bx-ax,by-ay);points[0]=[ax+(bx-ax)/len*r,ay+(by-ay)/len*r];}
   lines.push(`<g class="lead${state(name)}" data-pad="${name}"><polyline points="${points.map(p=>n1(p[0])+','+n1(p[1])).join(' ')}"/><circle cx="${n1(points[0][0])}" cy="${n1(points[0][1])}" r="${r?2.5:3.5}"/></g>`);};
  for(const [side,names] of [['l',P.left],['r',P.right]])names.forEach((name,row)=>{const y=ROW0+row*ROW,edge=side==='l'?LEFT+CALL_W:RIGHT,elbow=side==='l'?edge+26:edge-26,[ax,ay]=P.at[name],points=[[ax,ay]];
   if(P.thread[name]){const [tx,ty]=P.thread[name],len=Math.hypot(tx-ax,ty-ay);points.push([ax+(tx-ax)/len*55,ay+(ty-ay)/len*55]);}
   points.push([elbow,y],[edge,y]);line(name,points);call(name,side,side==='l'?LEFT:RIGHT,y-CALL_H/2);});
  ['back','start'].forEach((name,i)=>{const [x,y,from]=TOP[i];line(name,[P.at[name],[from,y+CALL_H]]);call(name,'t',x,y,TOP_W);});
  return `<div class="pad-diagram pad-${kind}"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><g class="pad-body">${kind==='xbox'?xboxArt():psArt()}</g>${lines.join('')}</svg>${calls.join('')}</div>`;}
 root.BPControls={keyboard,pad,keys:DRAWN};
})(globalThis);

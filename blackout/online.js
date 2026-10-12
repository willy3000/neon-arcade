(function(root){'use strict';
 // Online co-op transport. Both players connect out to a relay (server/relay.js), which pairs them by room code and
 // passes their messages along. It offers the same calls and events as the desktop app's LAN transport (BPNet in
 // electron/preload.js), so the lobby and the game do not care which one they are talking through - and because it is
 // an ordinary WebSocket, it works in the browser build as well as the desktop app.
 // The wait is long on purpose: a relay on a free hosting tier is put to sleep when idle and can take most of a minute
 // to wake for the first player of the day. A wrong address or a refused connection still fails straight away.
 const PROTOCOL=1,CONNECT_MS=75000;
 function relayUrl(){const pick=v=>typeof v==='string'&&/^wss?:\/\/[^\s]+$/i.test(v.trim())?v.trim():'';
  try{const q=pick(new URLSearchParams(root.location.search).get('relay'));if(q)return q;}catch{}
  try{const s=pick(root.localStorage.getItem('blackout-relay-url'));if(s)return s;}catch{}
  return pick(root.BPNet&&root.BPNet.relayUrl)||pick(root.BPOnlineConfig&&root.BPOnlineConfig.url);}
 class Online {
  constructor(){this.ws=null;this.onHost=null;this.onGuest=null;}
  get url(){return relayUrl();}
  get available(){return !!this.url&&typeof root.WebSocket==='function';}
  onHostEvent(cb){this.onHost=cb;}
  onGuestEvent(cb){this.onGuest=cb;}
  // Opens the connection, sends the opening request, and settles once the relay has answered it: a room code for a
  // host, nothing for a guest, or an Error whose message is the reason ("no-such-room", "room-full", "version",
  // "busy", "unreachable", "timeout"...).
  open(role,request){this.close();return new Promise((resolve,reject)=>{let settled=false,reason='';const ws=this.ws=new root.WebSocket(this.url);
   const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);},timer=setTimeout(()=>{finish(reject,new Error('timeout'));if(this.ws===ws)this.close();},CONNECT_MS);
   ws.onopen=()=>ws.send(JSON.stringify(request));
   ws.onmessage=e=>{const data=e.data;if(typeof data!=='string'||this.ws!==ws)return;
    // ">" marks a game message from the other player; anything else is the relay talking to us.
    if(data[0]==='>'){let msg;try{msg=JSON.parse(data.slice(1));}catch{return;}if(!msg||typeof msg!=='object')return;
     if(role==='guest'){this.onGuest&&this.onGuest(msg);return;}
     // Same convention as the LAN host: the guest's first message doubles as "a player has joined".
     if(msg.type==='hello')this.onHost&&this.onHost({...msg,type:'guestJoined'});this.onHost&&this.onHost(msg);return;}
    let c;try{c=JSON.parse(data);}catch{return;}
    if(c.t==='room')finish(resolve,String(c.code));else if(c.t==='joined')finish(resolve);
    else if(c.t==='error'){reason=String(c.code);finish(reject,new Error(reason));}
    else if(c.t==='peer'&&role==='host'&&!c.on)this.onHost&&this.onHost({type:'guestLeft'});};
   // A connection that ends without our asking: before it was set up that is a failed attempt, after it the other end
   // (or the relay) has gone.
   ws.onclose=()=>{if(!settled){finish(reject,new Error(reason||'unreachable'));return;}if(this.ws!==ws)return;this.ws=null;
    if(role==='host')this.onHost&&this.onHost({type:'linkLost',reason});else this.onGuest&&this.onGuest({type:'hostClosed',reason});};
   ws.onerror=()=>{};});}
  hostStart(){return this.open('host',{t:'host',v:PROTOCOL});}
  guestConnect(code){return this.open('guest',{t:'join',code:String(code),v:PROTOCOL});}
  // Messages may be handed over already serialised (the game does that for its large state updates).
  send(msg){const ws=this.ws;if(ws&&ws.readyState===1)ws.send('>'+(typeof msg==='string'?msg:JSON.stringify(msg)));}
  hostSend(msg){this.send(msg);}
  guestSend(msg){this.send(msg);}
  // Closing on purpose is silent: no "the other player left" event comes back from it.
  close(){const ws=this.ws;this.ws=null;if(!ws)return;ws.onclose=ws.onmessage=ws.onopen=null;try{ws.close(1000);}catch{}}
  hostStop(){this.close();}
  guestDisconnect(){this.close();}
 }
 root.BPOnline=new Online();
})(globalThis);

// Where online co-op connects: the public address of your relay (see server/README.md for how to put one up).
// Leave it empty and the game simply offers no ONLINE option. Use "wss://" for a relay behind HTTPS, which is what
// hosting platforms give you; plain "ws://" is for a relay on your own machine or network.
//
// For testing without editing this file, any of these override it, in this order:
//   1. ?relay=ws://localhost:8787 on the page address
//   2. localStorage.setItem('blackout-relay-url', 'ws://localhost:8787')
//   3. the BP_RELAY_URL environment variable, when running the desktop app
globalThis.BPOnlineConfig = { url: 'wss://neon-arcade-0zkx.onrender.com' };

# Blackout Protocol online relay

Online co-op needs one small service on the public internet: this relay. Both players connect out to it, the host is
given a five-character room code, the guest joins with that code, and the relay passes their game messages back and
forth. It does not run any game logic, stores nothing, and needs no database.

The game works without it. Until a relay address is configured, the lobby simply shows no ONLINE option and LAN play
is unaffected.

## Try it on your own machine

```
cd server
npm install
npm start                      # listens on port 8787
```

Then start two copies of the game pointed at it, with either of:

- the desktop app: set `BP_RELAY_URL=ws://localhost:8787` before `npm start` in the project root
- any build: add `?relay=ws://localhost:8787` to the page address, or run
  `localStorage.setItem('blackout-relay-url', 'ws://localhost:8787')` once in the console

In the game: HOLDOUT, then HOST under ONLINE on one copy and JOIN under ONLINE on the other.

## Put it online

Any host that runs Node 18+ or a container and gives you a public HTTPS address will do. The service listens on the
port in the `PORT` environment variable, which is how these platforms tell a service where to listen.

| Where | What to do |
|---|---|
| Render, Railway, Koyeb and similar | New web service from this repository, root directory `server`, build `npm install`, start `npm start`. |
| Fly.io, Cloud Run, any container host | Build the `Dockerfile` in this folder and run it. |
| Your own server | `npm install --omit=dev && npm start` behind a reverse proxy that terminates TLS and passes WebSocket upgrades through. |

Set `RELAY_TRUST_PROXY=1` when a platform's proxy sits in front of the service (the Dockerfile already does), so that
the per-address limits see each player's real address rather than the proxy's.

Check it is up by opening `https://your-address/health`; it answers with a short JSON status.

Then tell the game where it is, in `blackout/online-config.js`:

```js
globalThis.BPOnlineConfig = { url: 'wss://your-address' };
```

Use `wss://` (not `ws://`) for anything served over HTTPS, and rebuild the desktop app so the packaged copy carries
the address.

## What to expect

- **Size.** One relay process comfortably serves hundreds of two-player rooms. A room with a wave on the field is about
  70 KB/s of game data before compression, and the relay compresses it on the wire. A free or smallest paid tier is
  enough to start; watch outbound traffic allowances if it gets popular.
- **Location.** Every message travels player to relay to player, so put the relay in the region most of your players
  are in. The lobby and the in-game readout show each pair's actual delay.
- **Sleeping hosts.** Free tiers that put idle services to sleep will make the first lobby of the day take several
  seconds to open. Nothing breaks; the host just waits longer for a code.
- **Restarts.** Rooms live in memory. Restarting or redeploying the relay ends the games in progress; players are told
  the connection was lost and can host again.

## Settings

All optional, all environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 8787 | Port to listen on. |
| `RELAY_TRUST_PROXY` | off | Set to `1` behind a platform proxy, to read the player's address from `X-Forwarded-For`. |
| `RELAY_MAX_ROOMS` | 500 | Rooms open at once; further hosts are told the service is full. |
| `RELAY_MAX_CONNECTIONS_PER_ADDRESS` | 8 | Connections allowed from one address. |
| `RELAY_MAX_JOINS_PER_MINUTE` | 30 | Join attempts per address per minute, so room codes cannot be guessed by trying them all. |
| `RELAY_MAX_MESSAGES_PER_SECOND` | 150 | Per connection. The game sends about 30. |
| `RELAY_MAX_MESSAGE_BYTES` | 262144 | Largest single message accepted. |
| `RELAY_ROOM_IDLE_MINUTES` | 120 | A room with no traffic for this long is closed. |
| `RELAY_HEARTBEAT_SECONDS` | 20 | How often silent connections are checked for. |
| `RELAY_QUIET` | off | Set to `1` to stop logging room open/join/close lines. |
| `RELAY_TEST_LAG_MS` | 0 | Testing only: delays every forwarded message, to imitate a slow connection. |

## Limits of this version

- Two players per room, as in LAN play. The host's machine runs the game, so the host leaving ends the run.
- There are no accounts, matchmaking or friends lists: players share the room code themselves.
- A player whose connection drops is treated as having left. They can rejoin the lobby with the same code, but not the
  run in progress.
- The relay stops strangers flooding it or guessing codes, but it does not police what the two players in a room send
  each other. The game itself checks everything it receives, and a host can always cheat in their own game.

## Tests

`npm test` in this folder runs the relay's own checks over real local WebSockets (needs Node 22+ for the test client).
From the project root, `npm run test:e2e:online` starts a relay, launches two copies of the desktop app and plays a
session through it.

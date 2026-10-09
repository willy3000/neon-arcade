// BREAK THE SKY — Chapter 1: THE FALLEN GATE. Teaches movement and combat on the way to the Gatewarden, then hands over the grapple.
import { builder } from './builder.js';

const FORCE = ['slam', 'lightning', 'explosion', 'kinetic', 'charge'];

export function build() {
  const b = builder({
    id: 'chapter1', name: 'THE FALLEN GATE', subtitle: 'Chapter 1 · Break the Sky', biome: 'ruins', bounds: { x: -12, y: -6, w: 362, h: 66 }, killY: -11, spawn: { x: 0, y: 0 }, gear: { grapple: false },
    intro: [
      'The Sky Engine held the world together for a thousand years.',
      'Then it broke, and the land went up with it — islands, rivers, whole cities, all of it adrift.',
      'You were climbing toward the Gate when the storm took the bridge out from under you.',
    ],
    outro: [
      'The Fallen Gate stands open. Beyond it, the Hollow Canopy hangs in the cloud like a drowned forest.',
      'Somewhere above, the Engine is still turning. Slowly. Wrongly.',
      'Chapter 2 — THE HOLLOW CANOPY — is where the climb continues.',
    ],
  });

  // -- Crash site: move and jump -------------------------------------------------------------------------------------
  b.island(-10, 22, 0, 5); b.stone(13, 0, 4, 1.8); b.ledge(7.2, 5.2, 2.8);
  b.say(-1, 0, 3, [{ who: 'hero', text: 'Still breathing. The bridge is gone… and so is everyone who was on it.' }, { who: 'ORIEL', text: 'Not everyone. Up, sky-runner. The Gate is east, and it will not stay shut for you.' }]);
  b.hint('move', 2, 0, 8); b.hint('jump', 10, 0, 8);
  b.pickup('c1-shard-1', 'skyshard', 8.6, 6.3);
  b.tablet('c1-tablet-1', 4.5, 0, 'BRIDGE-WARDEN\'S MARK', 'Span Nine. Raised in the Engine\'s four-hundredth year. "What is held aloft is held together."');

  // -- Terrace: double jump, then the wall-jump chimney ---------------------------------------------------------------
  b.island(26, 38, 0, 5); b.island(38, 58, 3.6, 8);
  b.hint('doublejump', 30, 0, 7);
  b.stone(48.2, 6.6, 1.3, 7.4); b.stone(54, 3.6, 4, 7.4);
  b.hint('walljump', 49.5, 3.6, 4.5, 8);
  b.pickup('c1-shard-2', 'skyshard', 48.85, 15.1);
  b.island(58, 80, 11, 7);
  b.say(57, 11, 3, [{ who: 'ORIEL', text: 'There. The Fallen Gate — and the thing they left to keep it.' }, { who: 'hero', text: 'Then that is where I am going.' }], { vista: true });

  // -- First fight -----------------------------------------------------------------------------------------------------
  b.hint('combat', 60, 11, 5); b.enemy('minion', 67, 11); b.enemy('minion', 72, 11);
  b.checkpoint('a', 77, 11, 'The broken span');

  // -- Broken bridge: moving platforms, a dash gap and a slide arch ------------------------------------------------------
  b.mover(82, 11, 3.5, [[90, 11]], { speed: 3 });
  b.island(96, 101, 11, 4); b.ledge(91.6, 7, 2.8); b.pickup('c1-shard-3', 'skyshard', 93, 8.1);
  b.hint('dash', 96, 11, 5);
  b.ledge(103, 13, 3); b.ledge(108, 15, 3);
  b.island(112, 196, 15, 7);
  b.stone(118, 16.05, 4, 3.2); b.hint('slide', 113, 15, 4.5);

  // -- Courtyard arena -------------------------------------------------------------------------------------------------
  b.gate('g1a', 129, 15, 7); b.gate('g1b', 158, 15, 7);
  b.ledge(137, 18.2, 4.5); b.ledge(148, 18.2, 4.5);
  b.prop('barrel', 143.5, 15); b.prop('barrel', 153.5, 15); b.prop('crate', 132, 15); b.prop('crate', 155.5, 15);
  b.arena({
    id: 'courtyard', name: 'THE GATE COURT', trigger: { x: 133, y: 15, w: 4, h: 8 }, gates: ['g1a', 'g1b'], bounds: [130, 157.5],
    waves: [[{ type: 'minion', x: 141, y: 15 }, { type: 'minion', x: 147, y: 15 }, { type: 'minion', x: 152, y: 15 }],
      [{ type: 'hunter', x: 150, y: 15 }, { type: 'caster', x: 155, y: 15 }],
      [{ type: 'minion', x: 136, y: 15 }, { type: 'ember', x: 150, y: 15 }, { type: 'ember', x: 154, y: 15 }, { type: 'caster', x: 150, y: 18.2 }]],
  });
  b.hint('barrel', 138, 15, 5);
  b.checkpoint('b', 162.5, 15, 'The gate court');
  b.say(160, 15, 3, [{ who: 'ORIEL', text: 'They were the Gate\'s garrison once. The Engine does not let its dead lie down.' }]);

  // -- The ascent: bounce blooms, a wall-run and a lift for those who want it -----------------------------------------
  b.bounce(166, 15); b.hint('bounce', 163.5, 15, 3);
  b.ledge(170, 20.5, 4);
  b.zone('wallrun', 173, 19.5, 13, 7); b.hint('wallrun', 170, 20.5, 4);
  b.mover(175.5, 19, 3, [[181.5, 19]], { speed: 2.6 });
  b.ledge(185, 21, 2.4); b.bounce(187.4, 21, 2.4, 26);
  b.cracked(190.2, 15, 1, 6); b.stone(195.2, 15, 0.8, 6); b.prop('barrel', 188.4, 15); b.hint('breakable', 184, 15, 5);
  b.pickup('c1-shard-4', 'skyshard', 194, 16.3);
  b.tablet('c1-tablet-2', 192.6, 15, 'SCRATCHED INTO THE WALL', 'Day 40 since the sky came down. The Warden still walks the court. It does not sleep. It does not know the war is over.');

  // -- Upper terrace: the shield-bearer and the flooded hall ----------------------------------------------------------
  b.island(191, 224, 27, 6); b.island(224, 236, 26, 5); b.island(236, 292, 27, 7);
  b.hint('dive', 195, 27, 6); b.enemy('bulwark', 205, 27); b.enemy('wraith', 214, 31.5);
  b.zone('water', 224, 26, 12, 1.05);
  b.enemy('minion', 227, 26); b.enemy('minion', 230.5, 26); b.enemy('minion', 233.5, 26); b.enemy('caster', 240.5, 27);
  b.hint('elements', 219, 27, 5);
  b.prop('pylon', 238, 27, { accepts: FORCE, targets: ['lift1'], flag: 'lift1' }); b.hint('pylon', 236.5, 27, 3);
  b.mover(239.4, 27.5, 2.8, [[239.4, 34]], { speed: 3.5, trigger: true, id: 'lift1', pause: 1.6 });
  b.ledge(233, 34, 5.6); b.pickup('c1-heart', 'heart', 235.4, 35.1); b.pickup('c1-shard-5', 'skyshard', 233.8, 35.1);
  b.barricade(243, 27, 1, 4); b.stone(242.5, 31, 2, 6);
  b.checkpoint('c', 248, 27, 'Before the Gate');

  // -- The Gatewarden --------------------------------------------------------------------------------------------------
  b.gate('g2a', 252, 27, 9); b.gate('g2b', 286, 27, 9);
  b.ledge(259, 30.4, 4); b.ledge(275, 30.4, 4);
  b.enemy('warden', 277, 27, { group: 'warden' });
  b.arena({ id: 'warden', name: 'THE GATEWARDEN', boss: true, trigger: { x: 257, y: 27, w: 4, h: 9 }, gates: ['g2a', 'g2b'], bounds: [253, 285.5], waves: [] });
  b.say(249, 27, 2.5, [{ who: 'ORIEL', text: 'It is slow, and it is strong, and it announces everything it does. Watch its shoulders.' }]);

  // -- The broken sky-bridge: the grapple -------------------------------------------------------------------------------
  b.pickup('gear-grapple', 'gear', 288.6, 28.4, { gear: 'grapple', when: 'wardenDead' });
  b.anchor(295, 33.5); b.anchor(304, 34); b.anchor(313, 33.5);
  b.island(318.5, 346, 24, 7);
  b.zone('mercy', 284, 18, 40, 24);
  b.hint('grapple', 288, 27, 4.5, 8, { needs: 'grapple' }); b.hint('release', 293, 22, 26, 16, { needs: 'grapple' });
  b.say(321, 24, 3, [{ who: 'hero', text: 'So that is how the sky-runners crossed.' }, { who: 'ORIEL', text: 'That is how they flew. Go on. The Canopy is waiting, and it is not empty.' }]);
  b.trigger('complete', 336, 24, 3, 8);

  // -- Scenery -----------------------------------------------------------------------------------------------------------
  const D = (model, x, y, z, o) => b.deco('dungeon/' + model, x, y, z, o), H = (model, x, y, z, o) => b.deco('hex/' + model, x, y, z, o);
  D('rubble_large', -5, 0, -2.6); D('pillar', 1.5, 0, -2.4, { tilt: 0.25 }); D('wall_broken', 18, 0, -3.2); D('banner_thin_white', -7.5, 0, -2); D('rubble_half', 20, 0, 1.9, { scale: 0.7 });
  D('wall_arched', 30, 0, -3.2, { scale: 1.4 }); D('pillar_decorated', 35, 0, -2.6); D('torch_lit', 34.2, 1.9, -2.2);
  D('wall_archedwindow_open', 44, 3.6, -3.4, { scale: 1.5 }); D('pillar', 41, 3.6, -2.5);
  D('wall_broken', 62, 11, -3.3, { scale: 1.3 }); D('pillar_decorated', 60, 11, -2.6); D('banner_patternA_red', 64.5, 11, -2.9); D('sword_shield_broken', 70, 11, -2.4); D('rubble_large', 74, 11, -3);
  D('pillar', 79, 11, -2.4); D('pillar', 96.5, 11, -2.4, { tilt: -0.18 }); D('barrier_column', 99.5, 11, -2.2);
  D('wall_arched', 114, 15, -3.2, { scale: 1.3 }); D('pillar_decorated', 122.5, 15, -2.6); D('torch_lit', 121.6, 17.2, -2.2);
  for (let x = 131; x <= 156; x += 6.2) D(x % 12 < 6 ? 'wall_archedwindow_open' : 'wall', x, 15, -3.6, { scale: 1.55 });
  D('pillar_decorated', 130.2, 15, -2.4); D('pillar_decorated', 157.2, 15, -2.4); D('banner_shield_red', 143.5, 18.6, -3.3); D('banner_patternB_blue', 137.4, 18.6, -3.3); D('banner_patternB_blue', 149.8, 18.6, -3.3);
  D('torch_mounted', 134, 17.6, -3.2); D('torch_mounted', 153, 17.6, -3.2); D('crates_stacked', 156.4, 15, -2.2); D('keg', 131.2, 15, -2.3);
  D('wall', 176, 19.5, -3.4, { scale: 1.7 }); D('wall_cracked', 182.6, 19.5, -3.4, { scale: 1.7 }); D('wall_archedwindow_open', 189.2, 19.5, -3.4, { scale: 1.7 }); D('pillar', 172.5, 15, -2.4, { scale: 1.3 });
  D('chest_gold', 194.8, 15, -1.8); D('candle_triple', 193.4, 15, -1.6);
  D('wall_broken', 199, 27, -3.3, { scale: 1.3 }); D('pillar', 209, 27, -2.5); D('banner_triple_yellow', 203, 27, -3); D('rubble_half', 217, 27, -2.6);
  D('pillar_decorated', 223.2, 27, -2.5); D('pillar_decorated', 236.8, 27, -2.5); D('wall_arched', 230, 26, -3.4, { scale: 1.6 });
  D('wall_gated', 244, 27, -3.3, { scale: 1.3 }); D('torch_lit', 247, 28.2, -2.2); D('sword_shield_gold', 249.5, 27, -2.4);
  for (let x = 255; x <= 284; x += 6.4) D(Math.round(x) % 2 ? 'wall_pillar' : 'wall_arched', x, 27, -3.8, { scale: 1.9 });
  D('pillar_decorated', 253.4, 27, -2.5, { scale: 1.4 }); D('pillar_decorated', 285.2, 27, -2.5, { scale: 1.4 }); D('banner_shield_red', 269, 32.5, -3.6, { scale: 1.5 }); D('torch_mounted', 261, 30.5, -3.5); D('torch_mounted', 277, 30.5, -3.5);
  D('rubble_large', 290, 27, -2.8); D('pillar', 291.2, 27, -2.2, { tilt: 0.5 });
  D('wall_doorway', 337.5, 24, -2.8, { scale: 2.4 }); D('pillar_decorated', 331, 24, -2.6, { scale: 1.5 }); D('pillar_decorated', 344, 24, -2.6, { scale: 1.5 }); D('banner_patternA_red', 333.4, 24, -2.9, { scale: 1.3 });
  H('tent', 8.5, 0, -3.4, { scale: 1.6 }); H('weaponrack', 11, 0, -2.6, { scale: 1.5 }); H('flag_red', 76.2, 11, -1.9, { scale: 1.6 }); H('flag_red', 161.6, 15, -1.9, { scale: 1.6 }); H('flag_red', 247.2, 27, -1.9, { scale: 1.6 });
  H('building_destroyed', 104, 11.4, -9, { scale: 3 }); H('building_tower_A_blue', 322.5, 24, -5.5, { scale: 4.2 }); H('building_tower_B_blue', 343, 24, -6, { scale: 4.6 });

  b.L.init = sim => { if (sim.cleared.has('warden')) sim.flags.wardenDead = true; };
  b.L.onEvent = (sim, ev) => {
    if (ev.type === 'arenaClear' && ev.id === 'warden') { sim.flags.wardenDead = true; sim.events.push({ type: 'dialogue', lines: [{ who: 'ORIEL', text: 'It carried a sky-runner\'s line. Take it. You have earned the way across.' }] }); }
    if (ev.type === 'pickup' && ev.gear === 'grapple') sim.events.push({ type: 'gear', gear: 'grapple', title: 'GRAPPLE LAUNCHER', text: 'Hold to latch onto glowing anchors and swing. Let go on the upswing to launch.' });
  };
  return b.L;
}

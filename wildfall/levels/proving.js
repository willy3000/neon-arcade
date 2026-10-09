// The Proving Grounds: an optional practice space with every traversal tool unlocked and a timed movement course.
import { builder } from './builder.js';

export function build() {
  const b = builder({ id: 'proving', name: 'THE PROVING GROUNDS', subtitle: 'Practice · Movement trial', biome: 'canopy', bounds: { x: -14, y: -4, w: 172, h: 44 }, killY: -12, spawn: { x: 0, y: 0 }, gear: { grapple: true } });

  // Lower floor: a safe net under the whole course, with combat practice at the start.
  b.island(-12, 30, 0, 5); b.island(30, 150, 0, 5);
  b.enemy('dummy', 10, 0); b.enemy('dummy', 13.5, 0); b.enemy('dummy', 17, 0);
  b.prop('barrel', 21, 0); b.prop('crate', 23.5, 0); b.prop('crate', 24.7, 0);
  b.hint('combat', 6, 0, 14); b.hint('abilities', 16, 0, 10);
  b.checkpoint('start', -4, 0, 'Practice yard');
  b.tablet('proving-note', -8, 0, 'CARVED MARKER', 'Sky-runners trained here before the Fall. The stones still keep their time: cross from the first banner to the last without touching the low ground.');

  // Wall-jump chimney up to the high course.
  b.stone(28, 2.6, 1.5, 11.4); b.stone(34, 0, 4, 10);
  b.hint('walljump', 29.5, 0, 4.5, 9);
  b.island(38, 50, 10, 3); b.ledge(30.5, 6.2, 2.2);

  // Wall-run across a broken hall.
  b.zone('wallrun', 49, 9, 17, 8);
  b.island(65, 79, 10, 3);
  b.hint('wallrun', 44, 10, 6);
  b.checkpoint('high', 70, 10, 'High course');

  // Grapple line.
  b.anchor(85.5, 17.5); b.anchor(95.5, 18.5); b.anchor(105.5, 17.5); b.anchor(115.5, 18.5);
  b.hint('grapple', 73, 10, 6); b.hint('release', 80, 6, 34, 16);
  b.island(120, 134, 12, 3);

  // Bounce garden and moving platforms to the finish.
  b.bounce(126, 12); b.ledge(130, 20.5, 5);
  b.mover(137, 20.5, 3.5, [[146, 20.5]], { speed: 3.5 });
  b.island(150, 156, 20.5, 3);
  b.hint('bounce', 121, 12, 5);
  b.anchor(142, 28);

  // The trial runs from the first banner to the last.
  b.trigger('trialStart', 39, 10, 1.5, 6, { once: false }); b.trigger('trialEnd', 151, 20.5, 4, 6, { once: false });
  b.deco('hex/flag_red', 39.6, 10, -1.2); b.deco('hex/flag_blue', 152.5, 20.5, -1.2);

  // Low-ground extras: a slide gap, a breakable wall and a pylon-driven lift back up.
  b.stone(52, 1.05, 6, 2.2); b.hint('slide', 46, 0, 6);
  b.cracked(64, 0, 1.2, 4); b.stone(64, 4, 1.2, 3);
  b.pickup('proving-shard', 'skyshard', 68, 1.2);
  b.stone(69, 0, 1.2, 7);
  b.prop('pylon', 98, 0, { accepts: ['slam', 'lightning', 'explosion', 'kinetic'], targets: ['lift'] });
  b.mover(101, 0.5, 3.5, [[101, 12]], { speed: 4, trigger: true, id: 'lift', pause: 1.5 });
  b.hint('pylon', 94, 0, 6);
  b.zone('water', 108, -0.05, 9, 1.1); b.enemy('dummy', 110.5, 0); b.enemy('dummy', 113, 0); b.enemy('dummy', 115.5, 0);
  b.enemy('wraith', 90, 9.5);

  // Scenery.
  for (const [model, x, y, z, s] of [['dungeon/pillar_decorated', -10, 0, -2.2, 1], ['dungeon/wall_broken', -6, 0, -3, 1], ['dungeon/pillar', 4, 0, -2.6, 1], ['dungeon/wall_arched', 58, 10, -3.2, 1.6], ['dungeon/wall_arched', 50.5, 10, -3.2, 1.6],
    ['dungeon/pillar', 66, 10, -2.4, 1], ['dungeon/banner_patternA_red', 72, 10, -2.4, 1], ['dungeon/rubble_large', 124, 12, -3, 1], ['hex/building_tower_A_blue', 131, 12, -4.5, 2.4], ['dungeon/torch_lit', 70, 11.2, -2.3, 1]]) b.deco(model, x, y, z, { scale: s });
  return b.L;
}

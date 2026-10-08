/* Authored overlapping worlds: platform dimensions are explicit, never random. */
window.Phasebound = window.Phasebound || {};
(() => {
  const box = (x, y, w, h, dimension = "both") => ({ x, y, w, h, dimension });
  const floor = (from = 0, to = 1080) => box(from, 580, to - from, 60);
  const plate = (x, id) => ({ x, y: 574, w: 56, h: 6, id });
  const node = (x, id, kind = "bridge", duration = 10) => ({
    x,
    y: 550,
    id,
    kind,
    duration,
  });
  const door = (x, id, dimension = "both", kind = "plate") => ({
    ...box(x, 345, 18, 235, dimension),
    id,
    kind,
  });
  const bridge = (x, w, id) => ({ ...box(x, 580, w, 16, "kai"), id });
  const crystal = (x, y, owner) => ({ x, y, owner });
  const portals = () => ({ kai: [970, 566], luma: [1020, 566] });
  const levels = [
    {
      name: "Two Sparks",
      spawn: { kai: [85, 552], luma: [135, 552] },
      walls: [floor(), box(430, 540, 65, 40)],
      crystals: [crystal(465, 505, "both")],
      hints: [
        "Both sparks must find their own portal.",
        "Kai uses A/D/W. Luma uses the arrows.",
        "Jump over the shared stone, then guide each spark to its matching exit.",
      ],
      time: 30,
    },
    {
      name: "Different Ground",
      spawn: { kai: [85, 552], luma: [140, 552] },
      walls: [
        floor(),
        box(360, 520, 70, 60, "kai"),
        box(650, 520, 70, 60, "luma"),
      ],
      crystals: [crystal(395, 480, "kai"), crystal(685, 480, "luma")],
      hints: [
        "The worlds overlap, but their terrain does not.",
        "Amber stone supports Kai; cyan stone supports Luma.",
        "Jump your own obstacle. Pass through the other character’s platforms.",
      ],
      time: 35,
    },
    {
      name: "Hold the Line",
      spawn: { kai: [85, 552], luma: [140, 552] },
      walls: [floor()],
      plates: [plate(360, "A")],
      doors: [door(610, "A", "luma")],
      crystals: [crystal(740, 550, "both")],
      hints: [
        "One spark holds the way open for the other.",
        "Kai must stand on the amber plate while Luma crosses the cyan gate.",
        "Park Kai on the amber plate, move Luma through the gate to the exit, then send Kai home.",
      ],
      time: 45,
    },
    {
      name: "A Weight Between Us",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor()],
      blocks: [{ x: 260, y: 546, w: 34, h: 34 }],
      plates: [plate(490, "A")],
      doors: [door(650, "A")],
      crystals: [crystal(790, 550, "both")],
      hints: [
        "A stone can hold a plate after Kai leaves.",
        "Kai pushes stone; Luma phases through it. S braces or releases a nearby block.",
        "Push the block onto the plate on the marked amber pad. Brace it with S, jump over it, and cross together.",
      ],
      time: 55,
    },
    {
      name: "Borrowed Light",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor(0, 400), floor(620), box(400, 580, 220, 16, "luma")],
      nodes: [node(330, "B")],
      bridges: [bridge(400, 220, "B")],
      crystals: [crystal(715, 550, "both")],
      hints: [
        "Luma can reveal a path Kai cannot normally see.",
        "Move Luma near the cyan relay and press Down. The purple bridge lasts ten seconds.",
        "Activate the relay before the gap, cross with Kai while it glows, and let Luma use the permanent cyan path.",
      ],
      time: 45,
    },
    {
      name: "Through the Veil",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor()],
      nodes: [node(555, "V", "latch")],
      plates: [plate(700, "A")],
      doors: [door(460, "V", "veil", "latch"), door(805, "A", "luma")],
      crystals: [crystal(655, 550, "both")],
      hints: [
        "Luma can cross the striped veil. Kai needs help.",
        "Luma’s spirit switch opens Kai’s veil; Kai’s plate opens Luma’s final gate.",
        "Send Luma through the veil to the relay and press Down. Move Kai onto the plate beyond the veil, send Luma through, then finish with Kai.",
      ],
      time: 60,
    },
    {
      name: "The Fading Path",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor(0, 420), floor(640), box(420, 580, 220, 16, "luma")],
      nodes: [node(345, "T", "timed", 10)],
      bridges: [bridge(420, 220, "T")],
      doors: [door(790, "T", "kai", "timed")],
      crystals: [crystal(710, 550, "both")],
      hints: [
        "One relay powers both a bridge and a gate.",
        "The ten-second window freezes while paused. Return to the relay if it fades.",
        "Stage Kai near the gap, activate with Luma at the near-bank relay, then cross and clear the amber gate.",
      ],
      time: 50,
    },
    {
      name: "Across the Divide",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor(0, 350), floor(570), box(350, 580, 220, 16, "luma")],
      plates: [plate(250, "A"), plate(800, "C")],
      nodes: [node(675, "B", "bridge", 12)],
      bridges: [bridge(350, 220, "B")],
      doors: [door(620, "A", "luma"), door(910, "C", "luma")],
      crystals: [crystal(725, 550, "both")],
      hints: [
        "Trade the lead, then trade it again.",
        "Kai opens the first cyan gate. Luma crosses and reveals the bridge from the far side.",
        "Hold plate A, send Luma to the far-bank relay and press Down, cross with Kai to plate C, then let Luma finish.",
      ],
      time: 75,
    },
    {
      name: "Bound by Starlight",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor(), box(490, 535, 55, 45)],
      tethers: [{ x: 330, y: 550, r: 76 }],
      doors: [door(720, "LINK", "both", "tether")],
      crystals: [crystal(520, 495, "both")],
      hints: [
        "The purple node can link both sparks.",
        "Bring both within the node’s ring. S or Down links them, powering the gate. The tether keeps them close.",
        "Meet inside the purple ring, link, and move together. Press interact again to unlink if you need to regroup.",
      ],
      time: 55,
    },
    {
      name: "A Shared Crossing",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [floor(0, 380), floor(620)],
      platforms: [
        { ...box(450, 545, 110, 16), axis: "x", range: 110, speed: 0.9 },
      ],
      tethers: [{ x: 280, y: 550, r: 76 }],
      doors: [door(825, "LINK", "both", "tether")],
      checkpoints: [{ x: 735, y: 550 }],
      crystals: [crystal(735, 545, "both")],
      hints: [
        "The ferry moves between both ledges.",
        "Link at the near-bank node, board with both sparks, and keep the tether slack.",
        "Jump onto the shuttle at the left bank. Ride toward the right bank, then jump or walk off. Meet at the far-bank flag to save a checkpoint.",
      ],
      time: 80,
    },
    {
      name: "The Resonant Ruins",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [
        floor(0, 310),
        floor(480, 650),
        floor(820),
        box(310, 580, 170, 16, "luma"),
        box(650, 580, 170, 16, "luma"),
      ],
      nodes: [node(250, "B", "bridge", 12)],
      bridges: [bridge(310, 170, "B")],
      platforms: [
        { ...box(695, 545, 85, 16, "kai"), axis: "x", range: 60, speed: 1 },
      ],
      tethers: [{ x: 555, y: 550, r: 76 }],
      checkpoints: [{ x: 555, y: 550 }],
      doors: [door(930, "LINK", "both", "tether")],
      crystals: [crystal(880, 550, "both")],
      hints: [
        "Three paths, one shared destination.",
        "Reveal the first bridge, meet at the middle checkpoint, and link before the second crossing.",
        "Luma can use the cyan causeway while Kai rides the amber ferry. Stay within the tether’s reach and clear the powered final gate.",
      ],
      time: 95,
    },
    {
      name: "Where Worlds Meet",
      spawn: { kai: [85, 552], luma: [145, 552] },
      walls: [
        floor(0, 340),
        floor(540),
        box(340, 580, 200, 16, "luma"),
        box(700, 520, 55, 60, "kai"),
        box(865, 520, 45, 60, "luma"),
      ],
      nodes: [node(280, "B", "bridge", 12), node(900, "V", "latch")],
      bridges: [bridge(340, 200, "B")],
      blocks: [{ x: 575, y: 546, w: 34, h: 34 }],
      plates: [{ ...plate(615, "A"), w: 64 }],
      tethers: [{ x: 780, y: 550, r: 76 }],
      checkpoints: [{ x: 780, y: 550 }],
      doors: [
        door(840, "A", "luma"),
        door(930, "V", "kai", "latch"),
        { ...door(980, "LINK", "both", "tether"), also: "V" },
      ],
      crystals: [crystal(725, 480, "kai"), crystal(890, 480, "luma")],
      portals: { kai: [1010, 566], luma: [1030, 566] },
      hints: [
        "Use everything the two worlds have taught you.",
        "Reveal the bridge, brace the stone on A, meet at the checkpoint, and link. Luma opens Kai’s last gate from beyond the cyan barrier.",
        "Activate the near-bank relay. Kai pushes the block onto plate A and presses S. Meet at the checkpoint and link. Luma jumps the cyan step to the final spirit relay, then both pass the powered final gate.",
      ],
      time: 120,
    },
  ];
  for (const [id, l] of levels.entries())
    Object.assign(l, {
      id,
      width: 1080,
      height: 640,
      chapter:
        id < 4
          ? "THE AWAKENING"
          : id < 8
            ? "FRACTURED REALITY"
            : "THE CONVERGENCE",
      walls: [box(0, -100, 24, 900), box(1056, -100, 24, 900), ...l.walls],
      plates: l.plates || [],
      blocks: l.blocks || [],
      nodes: l.nodes || [],
      bridges: l.bridges || [],
      doors: l.doors || [],
      tethers: l.tethers || [],
      platforms: l.platforms || [],
      checkpoints: l.checkpoints || [],
      portals: l.portals || portals(),
    });
  Phasebound.levels = levels;
})();

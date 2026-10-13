# Commander voice lines

The commander's first five lines (`vo-welcome`, `vo-mission`, `vo-stay-sharp`, `vo-watch-six`, `vo-move-out`) are cut
straight from the original recording. Every other `vo-*.ogg` in `blackout/assets/audio/` was generated in the same
voice with [Chatterbox](https://github.com/resemble-ai/chatterbox) (MIT licence), which runs on your own machine,
using the script in this folder.

## What is here

| File | What it is |
|---|---|
| `voice_lines.py` | Generates lines, checks them, and writes game-ready `.ogg` files. |
| `lines.txt` | The lines: `name|style|text`, one per row. Write a designation the way it should be said ("M eight-seventy", "M-K eighteen", "E-M-P"), not as it is printed; the check treats both as the same words. |
| `ref-command.wav` | Reference for barked orders: the forceful parts of the recording ("Welcome to the battlefield, soldier", "eliminate the threat", "Stay sharp", "Move out!"). |
| `ref-calm.wav` | Reference for measured lines: the quieter parts ("Your mission is simple, survive, adapt", "Watch your six, and don't trust the silence"). |
| `ref-full.wav` | The whole recording, for lines in between. |

A style is a reference clip plus two delivery settings; see `STYLES` at the top of the script. Cloning a barked order
from barked speech, and a quiet aside from quiet speech, is what keeps the delivery fitting the moment.

## Setting up

Chatterbox needs Python 3.10 or 3.11 (not newer), about 3 GB of disk for the model, which downloads on first run, and
a further 2 GB for its libraries.

```
pip install chatterbox-tts faster-whisper "setuptools<81"
```

`setuptools<81` matters: without it Chatterbox fails at start-up with `TypeError: 'NoneType' object is not callable`,
because its watermarking component cannot load. `faster-whisper` is optional but recommended; it is what checks the
takes.

On a machine without a suitable graphics card it runs on the processor, at roughly 15 to 20 seconds per take.

## Making lines

```
python voice_lines.py lines.txt out        # three takes per line
python voice_lines.py lines.txt out 5      # five takes per line
```

For each line this generates several takes, transcribes each one, and keeps the take that most exactly says the text.
You get:

- `out/<name>.ogg` — the kept take, trimmed, levelled and faded, ready for the game
- `out/takes/<name>_take<N>.wav` — every take, for listening
- `out/report.tsv` — what was heard in each take and which was kept

The check only confirms the words. It cannot judge whether a take sounds good, so listen to the kept takes. To use a
different take:

```
python voice_lines.py pick out vo-hostiles 2
```

## Putting a line in the game

1. Copy `out/<name>.ogg` into `blackout/assets/audio/`.
2. Add the file name to the `files` list at the top of `blackout/audio.js`.
3. Speak it from `blackout/game.js` with `scene.audio.say('<name>', { rest: 45 })`. `rest` is how many seconds must
   pass before that line may be spoken again; `cut: true` lets it interrupt a line already playing. The existing cues
   are in `launch()`, `onEvent()`, `hud()` and `end()`, and lines that share a moment are grouped in `VOICE`.
   Two kinds of line need no code at all, only the right file name: another way of announcing a mode goes in that
   mode's list in `VOICE` (one is picked at random), and a gun or gadget is spoken about when it is bought or
   equipped if a file named `vo-w-<weapon id>.ogg` or `vo-g-<gadget id>.ogg` exists (the ids are the keys in
   `blackout/world.js`). A map is spoken about in the same way when the lobby leader picks it, from
   `vo-map-<map>.ogg`: the map is the killhouse id without its `holdout-` prefix (`vo-map-underground.ogg`), and
   `killhouse` for the default one. Field support and perks work the same way from `vo-s-<id>.ogg` and
   `vo-p-<id>.ogg`. A file still has to be in the `files` list (step 2) to be loaded.
4. Add the file to `blackout/assets/integrity.json` and note it in `blackout/ASSET_MANIFEST.md`.

## Before release

Chatterbox marks everything it generates with an inaudible watermark identifying it as machine-made. Whoever's voice
the original recording is, make sure you have the right to use it and to generate new speech from it.

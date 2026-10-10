"""Rebuild the redistributable atlases from the downloaded, licensed source packs.
Source archives are kept out of deployment; see ASSET_MANIFEST.md for URLs.
Requires Pillow. Run from repository root after retrieving the source archives.
"""
from pathlib import Path
import json
import hashlib
import shutil
from PIL import Image, ImageEnhance

ROOT = Path('blackout/assets')
SOURCE = ROOT / 'source'
CHAR = SOURCE / 'survivor/Top_Down_Survivor'
frames = []
for category in ['feet', 'handgun', 'rifle', 'shotgun', 'knife']:
    for seq in sorted((CHAR / category).iterdir()):
        if not seq.is_dir():
            continue
        for path in sorted(seq.glob('*.png'), key=lambda p: int(p.stem.split('_')[-1])):
            image = Image.open(path).convert('RGBA')
            # Preserve original animation coordinates inside each sequence.
            original_size = image.size
            image = ImageEnhance.Color(image).enhance(.58)
            image = image.resize((round(image.width * .28), round(image.height * .28)), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (112, 112))
            anchor_x = 102 if category == 'feet' else 104
            anchor_y = original_size[1] / 2
            canvas.alpha_composite(image, (round(56 - anchor_x * .28), round(56 - anchor_y * .28)))
            frames.append((f'{category}/{seq.name}/{path.stem.split("_")[-1]}', canvas))
atlas = Image.new('RGBA', (1792, ((len(frames) + 15) // 16) * 112))
metadata = {'frames': {}, 'meta': {'image': 'characters.png', 'scale': '1', 'author': 'Riley Gombart', 'license': 'CC BY 3.0'}}
for i, (name, image) in enumerate(frames):
    x, y = (i % 16) * 112, (i // 16) * 112
    atlas.alpha_composite(image, (x, y))
    metadata['frames'][name] = {'frame': {'x': x, 'y': y, 'w': 112, 'h': 112}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': 112, 'h': 112}, 'sourceSize': {'w': 112, 'h': 112}}
atlas.save(ROOT / 'characters.png', optimize=True)
(ROOT / 'characters.json').write_text(json.dumps(metadata, separators=(',', ':')))
print('Character atlas:', len(frames), 'real frames', atlas.size)

props = {'crate': 129, 'glass': 159, 'leaf': 134, 'debris': 290, 'wooddebris': 266, 'console': 296, 'door': 437, 'vent': 295, 'barrel': 204, 'fence': 441}
atlas = Image.new('RGBA', (640, 128))
metadata = {'frames': {}, 'meta': {'image': 'props.png', 'author': 'Kenney', 'license': 'CC0'}}
for i, (name, number) in enumerate(props.items()):
    image = Image.open(SOURCE / f'props/PNG/Tiles/tile_{number:02d}.png').convert('RGBA')
    image = ImageEnhance.Color(image).enhance(.35)
    image.thumbnail((64, 64))
    x = i * 64
    atlas.alpha_composite(image, (x + (64 - image.width)//2, (64-image.height)//2))
    metadata['frames'][name] = {'frame': {'x': x, 'y': 0, 'w': 64, 'h': 64}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': 64, 'h': 64}, 'sourceSize': {'w': 64, 'h': 64}}
atlas.save(ROOT / 'props.png', optimize=True)
(ROOT / 'props.json').write_text(json.dumps(metadata))
audio = ROOT / 'audio'
audio.mkdir(exist_ok=True)
copies = {
    'footstep-concrete-0.ogg': 'impact/Audio/footstep_concrete_000.ogg',
    'footstep-concrete-1.ogg': 'impact/Audio/footstep_concrete_002.ogg',
    'footstep-wood.ogg': 'impact/Audio/footstep_wood_002.ogg',
    'metal.ogg': 'impact/Audio/impactMetal_medium_000.ogg',
    'body.ogg': 'impact/Audio/impactSoft_medium_000.ogg',
    'wood.ogg': 'impact/Audio/impactWood_medium_000.ogg',
    'glass.ogg': 'impact/Audio/impactGlass_medium_000.ogg',
    'explosion.ogg': 'scifi/Audio/explosionCrunch_002.ogg',
    'rumble.ogg': 'scifi/Audio/lowFrequency_explosion_000.ogg',
    'radio.ogg': 'scifi/Audio/computerNoise_000.ogg',
    'reload-rifle.wav': 'reload-rifle.wav',
    'reload-pistol.wav': 'reload-pistol.wav',
    'reload-shotgun.wav': 'reload-shotgun.wav',
    'pistol.ogg': 'residue/residue-sfx/pxx.ogg',
    'rifle.ogg': 'residue/residue-sfx/mrrl.ogg',
    'shotgun.ogg': 'residue/residue-sfx/hurker.ogg',
    'smg.ogg': 'residue/residue-sfx/zipper.ogg',
    'empty.ogg': 'residue/residue-sfx/emptyclip.ogg',
    'pickup.ogg': 'residue/residue-sfx/ammopickup.ogg',
    'heal.ogg': 'residue/residue-sfx/healthboost.ogg',
    'flow.ogg': 'residue/residue-sfx/points.ogg',
    'wind.ogg': 'residue/residue-sfx/ventilator.ogg',
    'ambience.ogg': 'residue/residue-sfx/quietship.ogg',
    'laser.ogg': 'scifi/Audio/laserSmall_001.ogg',
    'laser-large.ogg': 'scifi/Audio/laserLarge_000.ogg',
    'forcefield.ogg': 'scifi/Audio/forceField_001.ogg',
    'door.ogg': 'scifi/Audio/doorOpen_001.ogg',
    'footstep-snow-0.ogg': 'impact/Audio/footstep_snow_000.ogg',
    'footstep-snow-1.ogg': 'impact/Audio/footstep_snow_002.ogg',
    'bell.ogg': 'impact/Audio/impactBell_heavy_000.ogg',
    'plate.ogg': 'impact/Audio/impactPlate_heavy_000.ogg',
    'punch.ogg': 'impact/Audio/impactPunch_heavy_000.ogg',
    'boom.ogg': 'residue/residue-sfx/boom.ogg',
    'points.ogg': 'residue/residue-sfx/ptplus.ogg',
    'healthpack.ogg': 'residue/residue-sfx/healthpack.ogg',
}
for name, source in copies.items():
    p = SOURCE / source
    if p.exists():
        shutil.copyfile(p, audio / name)
    else:
        print('Missing sound:', p)
licenses = ROOT / 'licenses'
licenses.mkdir(exist_ok=True)
for pack in ['impact', 'scifi', 'props']:
    shutil.copyfile(SOURCE / pack / 'License.txt', licenses / f'kenney-{pack}.txt')
props_license = licenses / 'kenney-props.txt'
props_license.write_bytes(props_license.read_bytes().replace(b'\r\n', b'\n'))
entries = []
for path in sorted(ROOT.rglob('*')):
    if path.is_file() and 'source' not in path.parts and path.name != 'integrity.json':
        entries.append({'file': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(ROOT / 'integrity.json').write_text(json.dumps({'files': entries}, indent=2), encoding='utf-8')

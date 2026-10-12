"""
Generate game voice lines in the voice of reference clips using Chatterbox (MIT licence).

Grown from clone_voice.py. What it adds:
  - styles: each line names a style, and a style is a reference clip plus delivery settings, so a barked order is
    cloned from barked speech and a quiet aside from quiet speech;
  - takes: every line is generated several times with different seeds, because any one take can come out garbled;
  - a check: if faster-whisper is installed, each take is transcribed and scored against the text it was meant to
    say, and the best-scoring take is kept (ties go to the take with the most typical length). Write designations
    the way they should be said ("M eight-seventy", not "M870"); the check understands both as the same thing;
  - game-ready output: the kept take has the silence trimmed from both ends, is brought to a common loudness, given
    short fades and written as a 44.1 kHz Ogg Vorbis file ready to drop into the game.

Setup (Python 3.10/3.11):
    pip install chatterbox-tts faster-whisper

Usage:
    python voice_lines.py lines.txt output_folder [takes]

lines.txt, one line of dialogue per row:
    name|style|text
        vo-hostiles|command|Hostiles inbound!
        vo-area-clear|calm|Area clear. Catch your breath.

The kept takes are written to output_folder/name.ogg, every take to output_folder/takes/ as WAV, and a summary of
what was heard in each take to output_folder/report.tsv.

To swap in a different take after listening (here take 2 of vo-hostiles):
    python voice_lines.py pick output_folder vo-hostiles 2
"""
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import soundfile as sf
import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

HERE = Path(__file__).parent
# reference: the clip whose voice and manner are copied. exaggeration: emotional intensity (~0.3 flat, 0.7+ dramatic).
# cfg_weight: how closely the pacing follows the text; lower is slower and more deliberate, which also offsets the
# way high exaggeration speeds speech up.
STYLES = {
    "command": {"reference": HERE / "ref-command.wav", "exaggeration": 0.75, "cfg_weight": 0.35},
    "firm": {"reference": HERE / "ref-full.wav", "exaggeration": 0.55, "cfg_weight": 0.45},
    "brisk": {"reference": HERE / "ref-command.wav", "exaggeration": 0.6, "cfg_weight": 0.6},
    "calm": {"reference": HERE / "ref-calm.wav", "exaggeration": 0.4, "cfg_weight": 0.5},
}


def pick_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():  # Apple Silicon
        return "mps"
    return "cpu"


def words(text):
    return re.sub(r"[^a-z0-9' ]+", " ", text.lower().replace("’", "'")).split()


UNITS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
TENS = {w: 10 * (i + 2) for i, w in enumerate("twenty thirty forty fifty sixty seventy eighty ninety".split())}


def spoken(text):
    """The words of a line as they sound, so that a designation compares equal however it is written: the script's
    'M eight-seventy' and a transcript's 'M870' or 'M-870' all become 'm870'. Number words turn into digits, and
    within a clause spelled-out letters and the digits that follow them are joined."""
    out = []
    for clause in re.split(r"[.,;:!?]+(?:\s|$)", text):
        tokens, after_tens = [], False
        for w in words(clause):
            if w in TENS:
                tokens.append(str(TENS[w]))
                after_tens = True
                continue
            if w in UNITS:
                if after_tens and UNITS[w] < 10:
                    tokens[-1] = tokens[-1][0] + str(UNITS[w])  # forty + four -> 44
                else:
                    tokens.append(str(UNITS[w]))
            else:
                tokens.append(w)
            after_tens = False
        joined, spelled = [], False  # spelled: the last entry is letters said one at a time
        for w in tokens:
            last = joined[-1] if joined else ""
            letter = len(w) == 1 and w.isalpha()
            if last and letter and spelled:
                joined[-1] += w
            elif last and w.isdigit() and (last[-1].isdigit() or (last.isalpha() and len(last) <= 3)):
                joined[-1] += w
                spelled = False
            else:
                joined.append(w)
                spelled = letter
        out += joined
    return out


def trim(wav, sr, floor=0.012, pad=0.06):
    """Cut the silence before the first and after the last audible sample, leaving a short pad."""
    loud = (wav.abs().max(dim=0).values > floor).nonzero()
    if loud.numel() == 0:
        return wav
    start = max(0, int(loud[0]) - int(pad * sr))
    end = min(wav.shape[-1], int(loud[-1]) + int(pad * 2 * sr))
    return wav[..., start:end]


def finish(wav, sr, path, loudness=0.2, peak=0.9, out_sr=44100):
    """Write a take as the game wants it: common loudness (RMS of the spoken part, matched to the original
    recording's lines), peaks rounded off rather than clipped, short fades, Ogg."""
    wav = ta.functional.resample(wav, sr, out_sr)[0]
    spoken = wav[wav.abs() > 0.02]
    if spoken.numel():
        wav = wav * (loudness / spoken.pow(2).mean().sqrt().clamp(min=1e-4))
    wav = torch.tanh(wav / peak) * peak
    n_in, n_out = int(0.01 * out_sr), int(0.06 * out_sr)
    wav[:n_in] *= torch.linspace(0, 1, n_in)
    wav[-n_out:] *= torch.linspace(1, 0, n_out)
    sf.write(str(path), wav.numpy(), out_sr, format="OGG", subtype="VORBIS")


def load_listener():
    """The transcription check is optional: without faster-whisper the first take of each line is kept."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed: takes will not be checked against their text.")
        return None
    return WhisperModel("base.en", device="cpu", compute_type="int8")


def heard(listener, path):
    segments, _ = listener.transcribe(str(path), language="en", beam_size=5, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segments)


def main():
    if len(sys.argv) == 5 and sys.argv[1] == "pick":
        out_dir, name, take = Path(sys.argv[2]), sys.argv[3], sys.argv[4]
        wav, sr = ta.load(str(out_dir / "takes" / f"{name}_take{take}.wav"))
        finish(wav, sr, out_dir / f"{name}.ogg")
        print(f"{name}.ogg is now take {take}")
        return
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)
    lines_file, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    takes = int(sys.argv[3]) if len(sys.argv) == 4 else 3
    (out_dir / "takes").mkdir(parents=True, exist_ok=True)

    rows = []
    for n, row in enumerate(r.strip() for r in lines_file.read_text(encoding="utf-8").splitlines()):
        if not row or row.startswith("#"):
            continue
        parts = [p.strip() for p in row.split("|", 2)]
        if len(parts) != 3 or parts[1] not in STYLES:
            sys.exit(f"line {n + 1}: expected name|style|text with style one of {', '.join(STYLES)}: {row}")
        rows.append(parts)

    device = pick_device()
    print(f"Loading model on {device} (first run downloads weights)...", flush=True)
    model = ChatterboxTTS.from_pretrained(device=device)
    listener = load_listener()

    report = ["name\tstyle\ttake\tseconds\tmatch\theard\tkept"]
    # One style at a time, so each reference clip is only analysed once.
    for style_name, style in STYLES.items():
        batch = [r for r in rows if r[1] == style_name]
        if not batch:
            continue
        model.prepare_conditionals(str(style["reference"]), exaggeration=style["exaggeration"])
        for name, _, text in batch:
            results = []
            for take in range(1, takes + 1):
                torch.manual_seed(1000 * take + sum(map(ord, name)))
                wav = model.generate(text, exaggeration=style["exaggeration"], cfg_weight=style["cfg_weight"])
                wav = trim(wav.cpu(), model.sr)
                path = out_dir / "takes" / f"{name}_take{take}.wav"
                ta.save(str(path), wav, model.sr)
                said = heard(listener, path) if listener else ""
                match = SequenceMatcher(None, spoken(text), spoken(said)).ratio() if listener else 1.0
                results.append({"take": take, "path": path, "wav": wav, "seconds": wav.shape[-1] / model.sr, "match": match, "heard": said})
                print(f"  {name} take {take}: {results[-1]['seconds']:.2f}s  match {match:.2f}  heard: {said}", flush=True)
            # Best transcription first; among equals, the take nearest the middle length (a rushed or dragged
            # take is more likely to be an odd one).
            middle = sorted(r["seconds"] for r in results)[len(results) // 2]
            best = max(results, key=lambda r: (round(r["match"], 2), -abs(r["seconds"] - middle)))
            finish(best["wav"], model.sr, out_dir / f"{name}.ogg")
            for r in results:
                report.append(f"{name}\t{style_name}\t{r['take']}\t{r['seconds']:.2f}\t{r['match']:.2f}\t{r['heard']}\t{'yes' if r is best else ''}")
            print(f"[{name}] kept take {best['take']} ({best['seconds']:.2f}s, match {best['match']:.2f}): {text}", flush=True)

    (out_dir / "report.tsv").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Done. {len(rows)} lines in {out_dir}/, {takes} takes each in {out_dir / 'takes'}/")


if __name__ == "__main__":
    main()

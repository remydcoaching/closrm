#!/usr/bin/env python3
"""Meta App Review — adds the English captions to the recorded clips and
assembles them.

Input : docs/meta-app-review/clips/<clip> (screen recordings, any size)
        docs/meta-app-review/captions.json (title + steps per clip)
Output: docs/meta-app-review/videos/<n>-<name>.mp4  (one per clip, 1920x1200)
        docs/meta-app-review/videos/closrm-app-review.mp4 (all clips, one video)

Captions are drawn as images (PIL) and overlaid with ffmpeg — the local
ffmpeg has no subtitles/drawtext filter. The title stays at the top for the
whole clip; the steps show one after the other at the bottom, spread evenly
over the clip's duration.

Usage: python3 scripts/meta-review/build_video.py [--clips DIR] [--out DIR]
"""
import argparse
import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
# 16:10 like a Mac screen. The recording sits between the title band (top)
# and the step band (bottom) so no part of the screen is covered — the
# address bar (closrm.fr) must stay visible to the reviewer.
W, H = 1920, 1200
TOP, BOTTOM = 80, 170
AREA_H = H - TOP - BOTTOM
FONT = "/System/Library/Fonts/Helvetica.ttc"


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def band(text: str, size: int, top: bool, path: Path) -> None:
    """A full-width semi-transparent band with wrapped white text."""
    font = ImageFont.truetype(FONT, size)
    lines = textwrap.wrap(text, width=int(W / (size * 0.52)))
    line_h = int(size * 1.3)
    h = TOP if top else BOTTOM
    pad = max(4, (h - line_h * len(lines)) // 2)
    img = Image.new("RGBA", (W, h), (17, 17, 17, 255) if top else (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        tw = d.textlength(line, font=font)
        d.text(((W - tw) / 2, pad + i * line_h), line, font=font, fill=(255, 255, 255, 255))
    img.save(path)


def build_clip(clip: Path, chapter: dict, out: Path, tmp: Path) -> None:
    total = duration(clip)
    steps = chapter["steps"]
    title_png = tmp / f"{clip.stem}-title.png"
    band(chapter["title"], 36, True, title_png)
    inputs = ["-i", str(clip), "-i", str(title_png)]
    step_pngs = []
    for i, s in enumerate(steps):
        p = tmp / f"{clip.stem}-step{i}.png"
        band(s, 40, False, p)
        step_pngs.append(p)
        inputs += ["-i", str(p)]
    # Normalize every clip to 1920x1080 (letterboxed) so they concatenate.
    chain = [f"[0:v]scale={W}:{AREA_H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:{TOP}+({AREA_H}-ih)/2:color=black,fps=30,format=yuv420p[v0]"]
    chain.append("[v0][1:v]overlay=0:0[v1]")
    last = "v1"
    slot = total / len(steps)
    for i in range(len(steps)):
        start, end = i * slot, (i + 1) * slot if i < len(steps) - 1 else total + 1
        chain.append(f"[{last}][{i + 2}:v]overlay=0:H-h:enable='between(t,{start:.2f},{end:.2f})'[s{i}]")
        last = f"s{i}"
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", *inputs,
        "-filter_complex", ";".join(chain), "-map", f"[{last}]", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", default=str(ROOT / "docs/meta-app-review/clips"))
    ap.add_argument("--out", default=str(ROOT / "docs/meta-app-review/videos"))
    ap.add_argument("--captions", default=str(ROOT / "docs/meta-app-review/captions.json"))
    args = ap.parse_args()
    clips_dir, out_dir = Path(args.clips), Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    chapters = json.loads(Path(args.captions).read_text())["chapters"]

    built, missing = [], []
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for ch in chapters:
            clip = clips_dir / ch["clip"]
            if not clip.exists():
                # Accept .mp4 too (QuickTime / Cmd+Shift+5 save .mov by default).
                alt = clip.with_suffix(".mp4")
                clip = alt if alt.exists() else clip
            if not clip.exists():
                missing.append(ch["clip"])
                continue
            out = out_dir / f"{Path(ch['clip']).stem}.mp4"
            print(f"→ {clip.name} ({duration(clip):.0f} s) → {out.name}")
            build_clip(clip, ch, out, tmp)
            built.append((out, ch["title"]))
        if built:
            lst = tmp / "list.txt"
            lst.write_text("".join(f"file '{p}'\n" for p, _ in built))
            full = out_dir / "closrm-app-review.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(full)], check=True)
            print(f"✓ Vidéo complète : {full} ({duration(full):.0f} s)")
            # Where each permission starts in the full video — pasted in the
            # review notes so the reviewer can jump to it.
            mmss = lambda x: f"{int(x) // 60:02d}:{int(x) % 60:02d}"
            t, lines = 0.0, []
            for p, title in built:
                d = duration(p)
                lines.append(f"{mmss(t)}–{mmss(t + d)}  {title}")
                t += d
            (out_dir / "chapters.txt").write_text("\n".join(lines) + "\n")
            print("Chapitres (à coller dans les notes Meta) :\n  " + "\n  ".join(lines))
    if missing:
        print("Clips manquants (non inclus) : " + ", ".join(missing))
    return 0 if built else 1


if __name__ == "__main__":
    sys.exit(main())

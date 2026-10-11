"""Narrate the temple story stops with Microsoft neural voices (edge-tts), with word timings for karaoke captions.

usage: python scripts/narrate.py [temple-id ...] [--force]
  (or: npm run narrate -- [temple-id ...] [--force])

For every src/temples/stories/<id>.json and every stop, in English and Hindi, writes
  public/audio/stories/<id>/<stopId>.<lang>.m4a   mono, 24 kHz, 64k AAC
  public/audio/stories/<id>/<stopId>.<lang>.json  {hash, voice, rate, dur, said, segments, words:[[t, d, c0, c1]...]}
Spoken text: the stop's text, then "Did you know?" + its didYouKnow. Clips whose text, voice and rate
are unchanged (same hash) are skipped, so re-running only renders what changed.

Voices (the narrator of the earlier video): English en-IN-NeerjaExpressiveNeural at +4%;
Neerja cannot speak Hindi, so Hindi uses hi-IN-SwaraNeural at +4%.
Needs edge-tts (pip install edge-tts) and ffmpeg/ffprobe on PATH (or FFMPEG=/path/to/ffmpeg).
"""
import asyncio, glob, hashlib, json, os, shutil, subprocess, sys, tempfile

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORIES = os.environ.get("STORIES_DIR") or os.path.join(ROOT, "src", "temples", "stories")
OUT = os.environ.get("NARRATE_OUT") or os.path.join(ROOT, "public", "audio", "stories")
VOICES = {
    "en": ("en-IN-NeerjaExpressiveNeural", "+4%"),
    "hi": ("hi-IN-SwaraNeural", "+4%"),
}
DYK = {"en": "Did you know?", "hi": "क्या आप जानते हैं?"}
FORMAT = "2"  # bump to re-render everything (e.g. after changing the ffmpeg chain)
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FFPROBE = os.environ.get("FFPROBE") or shutil.which("ffprobe") or os.path.join(os.path.dirname(FFMPEG), "ffprobe")


def compose(stop, lang):
    """The spoken string and where the card's sections sit inside it."""
    text = stop["text"][lang].strip()
    said, segments = text, [{"key": "text", "start": 0, "end": len(text)}]
    dyk = (stop.get("didYouKnow") or {}).get(lang, "").strip()
    if dyk:
        said += "\n\n" + DYK[lang] + " "
        segments.append({"key": "didYouKnow", "start": len(said), "end": len(said) + len(dyk)})
        said += dyk
    return said, segments


def align(said, words):
    """Map each WordBoundary token to character offsets in `said` (sequential search; -1 if not found nearby)."""
    out, cur = [], 0
    for t, d, w in words:
        w = w.strip()
        i = said.find(w, cur) if w else -1
        if i < 0 or i - cur > 60:
            out.append([round(t, 3), round(d, 3), -1, -1])
            continue
        out.append([round(t, 3), round(d, 3), i, i + len(w)])
        cur = i + len(w)
    return out


async def render(said, voice, rate, m4a):
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name
    try:
        try:
            c = edge_tts.Communicate(said, voice, rate=rate, boundary="WordBoundary")
        except TypeError:  # older edge-tts always sends word boundaries
            c = edge_tts.Communicate(said, voice, rate=rate)
        words = []
        with open(tmp, "wb") as f:
            async for ch in c.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
        # trim only trailing silence so the word timings stay aligned; mono 64k AAC
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", tmp, "-af",
                        "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,volume=1.6,alimiter=limit=0.95",
                        "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", m4a], check=True)
        dur = float(subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", m4a],
                                   capture_output=True, text=True, check=True).stdout)
        return dur, words
    finally:
        os.remove(tmp)


async def one(sem, tid, stop, lang, force):
    voice, rate = VOICES[lang]
    said, segments = compose(stop, lang)
    h = hashlib.sha256("|".join([FORMAT, voice, rate, said]).encode()).hexdigest()[:16]
    base = os.path.join(OUT, tid, f'{stop["id"]}.{lang}')
    if not force and os.path.exists(base + ".m4a"):
        try:
            if json.load(open(base + ".json", encoding="utf-8")).get("hash") == h:
                return "skip"
        except (OSError, ValueError):
            pass
    async with sem:
        for attempt in range(4):
            try:
                dur, words = await render(said, voice, rate, base + ".m4a")
                break
            except Exception as e:  # network hiccups from the TTS service
                if attempt == 3:
                    raise
                print(f"  retry {tid}/{stop['id']}.{lang}: {e}", flush=True)
                await asyncio.sleep(2 * (attempt + 1))
    meta = {"hash": h, "voice": voice, "rate": rate, "dur": round(dur, 3), "said": said,
            "segments": segments, "words": align(said, words)}
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    lost = sum(1 for w in meta["words"] if w[2] < 0)
    print(f"  {tid}/{stop['id']}.{lang}  {dur:6.2f}s  {len(words):3d} words{f'  ({lost} unaligned)' if lost else ''}", flush=True)
    return "done"


async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    files = sorted(glob.glob(os.path.join(STORIES, "*.json")))
    if args:
        files = [f for f in files if os.path.splitext(os.path.basename(f))[0] in args]
    if not files:
        print("no story files found in", STORIES)
        return
    sem = asyncio.Semaphore(4)
    stats = {"done": 0, "skip": 0}
    for path in files:
        try:
            story = json.load(open(path, encoding="utf-8"))
        except ValueError as e:
            print(f"skipping {os.path.basename(path)}: {e}")
            continue
        if not isinstance(story, dict) or not story.get("stops"):
            continue
        tid = story.get("id") or os.path.splitext(os.path.basename(path))[0]
        os.makedirs(os.path.join(OUT, tid), exist_ok=True)
        jobs = [one(sem, tid, s, lang, force) for s in story["stops"] for lang in VOICES
                if (s.get("text") or {}).get(lang, "").strip()]
        print(f"{tid}: {len(jobs)} clips", flush=True)
        for r in await asyncio.gather(*jobs):
            stats[r] += 1
        # drop clips of stops that no longer exist
        keep = {f'{s["id"]}.{lang}' for s in story["stops"] for lang in VOICES}
        for f in glob.glob(os.path.join(OUT, tid, "*.*.*")):
            name = os.path.basename(f).rsplit(".", 1)[0]
            if name not in keep:
                os.remove(f)
                print(f"  removed stale {os.path.basename(f)}")
    print(f"rendered {stats['done']}, unchanged {stats['skip']}")


asyncio.run(main())

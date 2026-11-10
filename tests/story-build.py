#!/usr/bin/env python3
"""Builds the marketing site's Card Stories clips and posters (run with the app served on :8765 and story-clip.js beside this).

For each story and look (Neon for dark pages, Holo on the Sunrise background for light pages) it:
  1. records the slide's entrance in slow motion (animations at 1/8 speed, so every moment is captured, none dropped),
  2. turns the captured frames back into real time at 30 fps, each output frame taken from the capture closest to its moment,
  3. trims the still frames at the end (the clip rests on its last frame on the site),
  4. encodes a 720-wide clip (phones) and a 540-wide clip (computers) with slow, careful H.264 settings, and a 540-wide poster
     (the last frame) as WebP.
The name-and-period line at the top of the player ("Nick · All time") and the player's controls are hidden while recording.

  python3 story-build.py [story ...]       e.g. python3 story-build.py game      (all stories when none are named)
"""
import json, os, subprocess, sys, shutil
from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = '/tmp/claude-0/-home-claude/0d23d6a4-0497-5286-ae54-9e35a72a5811/scratchpad/sitepv/'
OUT = '/home/claude/cardtab-site/assets/stories/'
SLOW = 0.125           # animation speed while recording
FPS = 30
# story: (slide index for "All time", most seconds of entrance to keep, extra env)
STORIES = {
    'alltime':   (0, 2.0, {}),
    'topwin':    (1, 2.0, {}),
    'came-from': (2, 2.0, {}),
    'budget':    (3, 2.2, {'BUDGET': '50000'}),
    'game':      (5, 2.2, {}),
    'patience':  (8, 3.6, {}),
}
LOOKS = {'': {'THEMENAME': 'Neon'}, 'holo-': {'THEMENAME': 'Holo', 'BG': 'Sunrise'}}


def record(story, look):
    slide, secs, extra = STORIES[story]
    d = 'rec-' + look + story
    env = dict(os.environ, SPER='All time', SLIDE=str(slide), SLOW=str(SLOW), MS=str(int((secs + 0.6) / SLOW * 1000)), DIR=d, HIDEWHO='1', **LOOKS[look], **extra)
    r = subprocess.run(['node', os.path.join(HERE, 'story-clip.js')], env=env, capture_output=True, text=True, timeout=600)
    if r.returncode: raise SystemExit(r.stdout + r.stderr)
    print('   ', ' | '.join(l for l in r.stdout.splitlines() if l.startswith(('theme', 'bg', 'frames'))), flush=True)
    return SCR + d + '/'


def retime(src, secs):
    meta = json.load(open(src + 'times.json'))
    pairs = sorted(zip(meta['t'], sorted(f for f in os.listdir(src) if f.endswith('.png'))))   # frames can arrive out of order
    pairs = [pr for k, pr in enumerate(pairs) if k == 0 or pr[0] > pairs[k - 1][0]]
    ts = [pr[0] for pr in pairs]; files = [pr[1] for pr in pairs]
    t0 = ts[0]
    ct = [(t - t0) * meta['slow'] for t in ts]               # moments in the story's own (real-speed) time
    # the entrance starts at the key press, shortly after capture begins: start at the first frame that differs from the first
    # the player's crossfade between slides is switched off while recording, so the slide change is one big jump between two
    # captured frames (animation steps are small): start on the frame after the biggest jump in the first second
    small = lambda f: Image.open(src + f).convert('L').resize((90, 160))
    lim = next((k for k, c in enumerate(ct) if c > 1.0), len(ct) - 1)
    prev, best, start = small(files[0]), -1, 0
    for k in range(1, lim):
        cur = small(files[k]); dd = ImageStat.Stat(ImageChops.difference(prev, cur)).mean[0]
        if dd > best: best, start = dd, k
        prev = cur
    c0 = ct[start]
    seq, j = [], start
    n = int(secs * FPS)
    for i in range(n):
        want = c0 + i / FPS
        while j + 1 < len(ct) and abs(ct[j + 1] - want) <= abs(ct[j] - want): j += 1
        seq.append(files[j])
    # trim the still frames at the end, keeping a few
    last = len(seq) - 1
    ref = Image.open(src + seq[-1]).convert('RGB')
    while last > 10 and ImageStat.Stat(ImageChops.difference(ref, Image.open(src + seq[last - 1]).convert('RGB'))).mean[0] < 0.15: last -= 1
    return seq[:min(len(seq), last + 4)]


def encode(src, seq, name):
    tmp = src + 'seq/'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    for i, f in enumerate(seq): os.link(src + f, tmp + '%04d.png' % i)
    for w, crf in ((720, 27), (540, 28)):
        out = OUT + 'story-' + name + '-' + str(w) + '.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', tmp + '%04d.png',
                        '-vf', 'scale=%d:-2:flags=lanczos,format=yuv420p' % w, '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation',
                        '-crf', str(crf), '-profile:v', 'high', '-x264-params', 'keyint=600:min-keyint=600:bframes=8:ref=6:aq-mode=3',
                        '-movflags', '+faststart', '-an', out], check=True)
    Image.open(tmp + '%04d.png' % (len(seq) - 1)).convert('RGB').resize((540, 960), Image.LANCZOS).save(OUT + 'story-' + name + '.webp', 'WEBP', quality=80, method=6)
    return len(seq)


if __name__ == '__main__':
    want = sys.argv[1:] or list(STORIES)
    for story in want:
        for look in LOOKS:
            src = record(story, look)
            seq = retime(src, STORIES[story][1])
            n = encode(src, seq, look + story)
            sz = [os.path.getsize(OUT + 'story-' + look + story + s) for s in ('-720.mp4', '-540.mp4', '.webp')]
            print('%-16s %3d frames  720: %4d KB  540: %4d KB  poster: %3d KB' % (look + story, n, sz[0] // 1024, sz[1] // 1024, sz[2] // 1024), flush=True)

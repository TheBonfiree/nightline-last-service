#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# extract-frames.sh — derive the ticker scrub sequence from the master clip.
#
#   bash scripts/extract-frames.sh
#
# Idempotent: safe to re-run after replacing the master. Requires ffmpeg on
# PATH. Nothing here runs at page load; the outputs are committed alongside
# the source and the master mp4 is never served.
#
# The master is a red LED dot-matrix sign filmed head-on at 1280x592, 222
# frames at ~19.97fps. Four transforms, in this order:
#
#   1. CROP to the text band. The clip's top and bottom thirds are unlit
#      ghost grid with nothing in them; a departure board's service ticker is
#      one text row, so the strip is cropped to that row plus enough dark grid
#      either side to read as a physical panel rather than a text box.
#
#   2. QUANTISE the dark end. A luma histogram of the crop puts 67% of pixels
#      at 0-7 and a further 21% at 8-15 (black ground and unlit ghost grid),
#      with ~3% of camera noise smeared across 16-70. That noise is invisible
#      and was costing roughly 60% of the encoded size. Collapsing it to two
#      flat values compresses hard AND looks more correct: real unlit dots are
#      uniform, not dithered.
#
#   3. RECOLOUR red -> amber. The page rations colour to a single hue
#      (--amber, #ffa733) on the status column and this ticker. The footage's
#      red would be a second hue and would break that rationing. Done as a
#      channel remix rather than a hue rotation, which would drag the unlit
#      grid off neutral too.
#
#   4. DECIMATE to half the frames. The subject is a linear horizontal
#      translate, so intermediate frames carry no information the scrub
#      cannot get from position. 111 frames is well past the point where a
#      scroll-driven scrub reads as continuous.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

MASTER=assets/reference/ticker-master.mp4
OUT_D=public/frames/desktop
OUT_M=public/frames/mobile
Q_D=66
Q_M=64

CROP="crop=1280:340:0:126"
QUANT="lutyuv=y='if(lt(val,6),0,if(lt(val,30),22,val))'"
AMBER="colorchannelmixer=rr=1:rg=0:rb=0:gr=0.60:gg=0.30:gb=0:br=0.16:bg=0:bb=0.30"

echo "==> desktop frames"
rm -f "$OUT_D"/*.webp "$OUT_M"/*.webp
mkdir -p "$OUT_D" "$OUT_M"

# -fps_mode passthrough: emit exactly the frames select() keeps, no
# duplication and no drops. Duplicated frames read as stutter during a scrub.
#
# -c:v libwebp is NOT optional. Given a multi-frame input and a .webp output
# pattern, ffmpeg otherwise selects libwebp_anim and writes ONE animated file
# instead of a numbered sequence.
ffmpeg -y -v error -i "$MASTER" \
  -fps_mode passthrough \
  -vf "$CROP,$QUANT,$AMBER,select='not(mod(n,2))',scale=1120:-2" \
  -c:v libwebp -q:v $Q_D "$OUT_D/f_%04d.webp"

# ffmpeg's image2 muxer starts numbering at 1; the JS indexes from 0.
i=0
for f in $(ls "$OUT_D"/f_*.webp | sort); do
  mv "$f" "$(printf "$OUT_D/frame_%04d.webp" $i)"
  i=$((i+1))
done
TOTAL=$i
echo "    $TOTAL desktop frames"

# Mobile: two thirds of the desktop set at 640px. Its own contiguous 0..N
# sequence, so the JS needs no index remapping — only the directory changes.
j=0
for ((n=0; n<TOTAL; n++)); do
  (( n % 3 == 2 )) && continue
  ffmpeg -y -v error -i "$(printf "$OUT_D/frame_%04d.webp" $n)" \
    -vf scale=640:-2 -q:v $Q_M "$(printf "$OUT_M/frame_%04d.webp" $j)"
  j=$((j+1))
done
echo "    $j mobile frames"

echo
echo "Set TICKER.count = $TOTAL and TICKER.mobileCount = $j in src/config.ts"
du -sh "$OUT_D" "$OUT_M"

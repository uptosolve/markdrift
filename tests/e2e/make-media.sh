#!/usr/bin/env bash
# Generates the test videos and photos used by the e2e suite. Needs ffmpeg.
set -e
cd "$(dirname "$0")/../.."
mkdir -p test-media && cd test-media
q="-hide_banner -loglevel error -y"
ffmpeg $q -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 12 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k landscape-1080p.mp4
ffmpeg $q -f lavfi -i smptebars=size=1280x720:rate=30 -f lavfi -i sine=frequency=660 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac raw-720.mp4
ffmpeg $q -display_rotation 90 -i raw-720.mp4 -c copy phone-rotated.mp4
ffmpeg $q -f lavfi -i mandelbrot=size=854x480:rate=25 -f lavfi -i sine=frequency=300 -t 6 -c:v libvpx-vp9 -b:v 1M -c:a libopus clip.webm
ffmpeg $q -f lavfi -i testsrc=size=640x360:rate=24 -f lavfi -i sine=frequency=500 -t 5 -c:v libx264 -pix_fmt yuv420p -c:a pcm_s16le pcm-audio.mov
ffmpeg $q -i landscape-1080p.mp4 -c copy -t 6 clip.mkv
ffmpeg $q -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 180 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac long-3min.mp4
ffmpeg $q -f lavfi -i testsrc2=size=3000x2000 -frames:v 1 photo-big.jpg
ffmpeg $q -f lavfi -i gradients=size=1080x1350 -frames:v 1 photo-portrait.png
cat > logo.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><circle cx="60" cy="60" r="48" fill="#2266ff"/><path d="M38 78 L52 42 L60 62 L68 42 L82 78" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/><text x="122" y="78" font-family="Arial" font-weight="700" font-size="48" fill="#2266ff">ACME</text></svg>
SVG
echo "test media ready in test-media/"

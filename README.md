# BoostWave

Private, in-browser volume booster for audio and video. Files never leave the device.

## Run locally
    npm install
    npm run dev

## Deploy on Vercel
Push to Git and import the repo (Vite is auto-detected; build `npm run build`, output `dist`).
`prebuild` copies the FFmpeg WebAssembly core from `node_modules` into `public/ffmpeg`, so nothing loads from a CDN.

## Ads (optional)
Set `VITE_ADSENSE_CLIENT` (e.g. `ca-pub-123...`) and `VITE_ADSENSE_SLOT` in Vercel env vars. The slot sits below the tool; export is never gated.

## Pipeline
1. Preview: Web Audio chain (high-pass, presence EQ, compressor, gain, limiter, mono option).
2. Export: same chain rendered offline, peak-checked, written as WAV.
3. FFmpeg WASM (single-thread, no special headers) encodes MP3/M4A/OGG/FLAC or muxes the boosted audio into MP4/WEBM video. Available encoders are detected at runtime and unsupported formats are disabled.

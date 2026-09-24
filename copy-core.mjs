import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public/ffmpeg', { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm'])
  copyFileSync(`node_modules/@ffmpeg/core/dist/esm/${f}`, `public/ffmpeg/${f}`);
console.log('FFmpeg core copied to public/ffmpeg');

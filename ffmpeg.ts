import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let logs = '';
export const caps = new Set<string>();

export function ensure(): Promise<FFmpeg> {
  if (ff) return Promise.resolve(ff);
  loading ??= (async () => {
    const f = new FFmpeg();
    f.on('log', ({ message }) => { logs += message + '\n'; });
    await f.load({ coreURL: '/ffmpeg/ffmpeg-core.js', wasmURL: '/ffmpeg/ffmpeg-core.wasm' });
    logs = '';
    await f.exec(['-hide_banner', '-encoders']);
    for (const n of ['libmp3lame', 'libvorbis', 'libopus', 'libvpx', 'libx264', 'aac', 'flac'])
      if (logs.includes(' ' + n + ' ')) caps.add(n);
    ff = f;
    return f;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

export function cancelFF(): void {
  ff?.terminate();
  ff = null; loading = null; caps.clear();
}

const MIME: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm' };

export async function convert(
  wav: Blob, src: File | null, fmt: string, kbps: number,
  trim: { start: number; dur: number; full: boolean }, onProgress: (p: number) => void,
): Promise<Blob> {
  const f = await ensure();
  const out = `out.${fmt}`, files = ['in.wav', out];
  const onP = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
  f.on('progress', onP);
  try {
    await f.writeFile('in.wav', await fetchFile(wav));
    const k = `${kbps}k`;
    let args: string[];
    if (src && (fmt === 'mp4' || fmt === 'webm')) {
      const ext = (src.name.split('.').pop() || 'mp4').toLowerCase(), vin = `v.${ext}`;
      files.push(vin);
      await f.writeFile(vin, await fetchFile(src));
      const copy = trim.full && ((fmt === 'mp4' && ['mp4', 'm4v', 'mov'].includes(ext)) || (fmt === 'webm' && ext === 'webm'));
      const v = copy ? ['-c:v', 'copy'] : fmt === 'mp4'
        ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p']
        : ['-c:v', 'libvpx', '-b:v', '2M', '-deadline', 'realtime', '-cpu-used', '5'];
      const a = fmt === 'mp4' ? ['-c:a', 'aac', '-b:a', k] : ['-c:a', 'libopus', '-b:a', '128k'];
      args = [...(trim.full ? [] : ['-ss', String(trim.start), '-t', String(trim.dur)]), '-i', vin, '-i', 'in.wav',
        '-map', '0:v:0', '-map', '1:a:0', ...v, ...a, ...(fmt === 'mp4' ? ['-movflags', '+faststart'] : []), '-shortest', out];
    } else {
      const c: Record<string, string[]> = {
        mp3: ['-c:a', 'libmp3lame', '-b:a', k], m4a: ['-c:a', 'aac', '-b:a', k],
        ogg: ['-c:a', 'libvorbis', '-q:a', '5'], flac: ['-c:a', 'flac'],
      };
      if (!c[fmt]) throw new Error(`Unsupported format: ${fmt}`);
      args = ['-i', 'in.wav', '-vn', ...c[fmt], out];
    }
    const code = await f.exec(args);
    if (code !== 0) throw new Error('FFmpeg could not encode this file. Try WAV or a different format.');
    const data = (await f.readFile(out)) as Uint8Array;
    return new Blob([data], { type: MIME[fmt] });
  } finally {
    f.off('progress', onP);
    for (const n of files) { try { await f.deleteFile(n); } catch { /* already gone */ } }
  }
}

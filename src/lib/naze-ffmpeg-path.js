// Pastikan ffmpeg tersedia di panel (cari ffmpeg sistem, kalau tidak ada pakai ffmpeg-static)
import { execSync } from 'child_process'
import path from 'path'

try {
  if (!process.env.FFMPEG_PATH) {
    let found = ''
    try { found = execSync('command -v ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'], shell: '/bin/sh' }).toString().trim() } catch {}
    if (found) {
      process.env.FFMPEG_PATH = found
    } else {
      const mod = await import('ffmpeg-static').catch(() => null)
      const bin = mod?.default
      if (bin) {
        process.env.FFMPEG_PATH = bin
        process.env.PATH = path.dirname(bin) + path.delimiter + process.env.PATH
      }
    }
  }
} catch {}

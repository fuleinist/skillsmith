/**
 * Minimal ustar (POSIX tar) writer with gzip compression.
 * Zero dependencies; output is deterministic for a given input.
 */
import { gzipSync } from 'node:zlib';

export interface TarEntry {
  /** Archive path, with forward slashes. */
  path: string;
  /** File contents. */
  data: Buffer;
  /** Unix mode. Defaults to 0644. */
  mode?: number;
  /** Modification time (seconds since epoch). Defaults to 0 for determinism. */
  mtime?: number;
}

const BLOCK = 512;

function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, '0') + '\0';
}

function writeString(buf: Buffer, offset: number, str: string, length: number): void {
  buf.write(str, offset, Math.min(Buffer.byteLength(str), length), 'utf8');
}

/** Split a long path into ustar name/prefix fields. */
function splitName(path: string): { name: string; prefix: string } {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i] !== '/') continue;
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }
  throw new Error(`path too long for tar: ${path}`);
}

/** Create a deterministic .tar.gz buffer from entries (stored in the given order). */
export function createTarGz(entries: TarEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const e of entries) {
    const { name, prefix } = splitName(e.path);
    const header = Buffer.alloc(BLOCK);
    writeString(header, 0, name, 100);
    writeString(header, 100, octal(e.mode ?? 0o644, 8), 8); // mode
    writeString(header, 108, octal(0, 8), 8); // uid
    writeString(header, 116, octal(0, 8), 8); // gid
    writeString(header, 124, octal(e.data.length, 12), 12); // size
    writeString(header, 136, octal(e.mtime ?? 0, 12), 12); // mtime
    header.fill(0x20, 148, 156); // checksum placeholder
    writeString(header, 156, '0', 1); // typeflag: regular file
    writeString(header, 257, 'ustar\0', 6); // magic
    writeString(header, 263, '00', 2); // version
    writeString(header, 345, prefix, 155); // prefix

    let sum = 0;
    for (const b of header) sum += b;
    writeString(header, 148, sum.toString(8).padStart(6, '0') + '\0 ', 8);

    chunks.push(header);
    chunks.push(
      e.data.length % BLOCK === 0
        ? e.data
        : Buffer.concat([e.data, Buffer.alloc(BLOCK - (e.data.length % BLOCK))]),
    );
  }
  chunks.push(Buffer.alloc(BLOCK * 2)); // end-of-archive marker
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}
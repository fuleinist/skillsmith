import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** SHA-256 hex digest of a buffer or string. */
export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface WalkedFile {
  /** Absolute path. */
  abs: string;
  /** Path relative to the walk root, with forward slashes. */
  rel: string;
}

/** List files under a directory tree in deterministic (sorted) order. */
export function walkFiles(root: string, exclude: string[] = []): WalkedFile[] {
  const skip = new Set(exclude);
  const out: WalkedFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (skip.has(name)) continue;
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.push({ abs, rel: relative(root, abs).split('\\').join('/') });
    }
  };
  walk(root);
  return out;
}

/** Format a byte count for humans. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
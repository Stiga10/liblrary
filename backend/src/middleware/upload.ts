// Cover upload: accept an image, normalise it, store it under a name we choose.
//
// Three rules that matter (CLAUDE.md section 6 and the api-endpoint skill):
//   - whitelist mimetypes, do not blacklist
//   - cap the size before anything touches the disk
//   - NEVER build a path from file.originalname; that is path traversal
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { errors } from '../lib/errors.js';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

const COVERS_DIR = path.resolve('uploads/covers');

// memoryStorage: the buffer goes straight to sharp, so no unvalidated file is ever
// written to disk.
export const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(errors.invalidFileType());
  },
}).single('cover');

/**
 * Normalise to WebP at a sane cover size and write it under a generated name.
 * Returns the public URL path, not a filesystem path.
 */
export async function storeCover(bookId: number, buffer: Buffer): Promise<string> {
  await mkdir(COVERS_DIR, { recursive: true });

  const filename = `${bookId}-${randomUUID()}.webp`;
  const processed = await sharp(buffer)
    // `inside` keeps the aspect ratio; withoutEnlargement avoids upscaling a small scan.
    .resize(600, 900, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(path.join(COVERS_DIR, filename), processed);
  return `/uploads/covers/${filename}`;
}

/** Best-effort cleanup of a replaced cover. A missing file is not an error. */
export async function deleteCover(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;
  const filename = path.basename(publicUrl);
  // Defensive: only ever unlink inside the covers directory.
  const target = path.join(COVERS_DIR, filename);
  if (!target.startsWith(COVERS_DIR + path.sep)) return;
  try {
    await unlink(target);
  } catch {
    // The file may already be gone; nothing to recover from.
  }
}

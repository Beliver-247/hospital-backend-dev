// src/middleware/upload.js
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = path.resolve('uploads');

// ensure uploads dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const stamp = Date.now();
    cb(null, `${base}-${stamp}${ext}`);
  }
});

const accept = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]);

function fileFilter(req, file, cb) {
  if (accept.has(file.mimetype)) return cb(null, true);
  cb(new Error('Unsupported file type'), false);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

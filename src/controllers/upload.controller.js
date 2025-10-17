// src/controllers/upload.controller.js
export async function uploadSingle(req, res) {
  // multer puts file on req.file
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const { type } = req.body; // optional: 'ID' | 'REPORT'
  if (type && !['ID', 'REPORT'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type. Use ID or REPORT' });
  }

  const file = req.file;
  const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

  // keep response minimal for frontend use
  return res.status(201).json({
    url: publicUrl,
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    type: type || null
  });
}

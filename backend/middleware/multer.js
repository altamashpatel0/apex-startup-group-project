const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Sub-folders per resource type: uploads/gallery, uploads/blogs, etc.
    const subFolder = req.uploadFolder || 'misc';
    const dest = path.join(uploadDir, subFolder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

// File type filter
const fileFilter = (req, file, cb) => {
  // Allowed image extensions
  const allowedExts = /\.(jpe?g|png|gif|webp|svg)$/i;
  // Allowed MIME types — covers standard image types + SVG variants
  const allowedMimes = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i;

  const extValid  = allowedExts.test(path.extname(file.originalname));
  const mimeValid = allowedMimes.test(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed image formats: JPG, JPEG, PNG, GIF, WebP, SVG.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = upload;

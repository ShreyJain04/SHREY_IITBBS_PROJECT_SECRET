const multer = require('multer');
const path = require('path');

const uploadsPath = path.join(__dirname, 'uploads');

// Create directory if it doesn't exist
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'chapters-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/json' || 
      file.originalname.toLowerCase().endsWith('.json')) {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;
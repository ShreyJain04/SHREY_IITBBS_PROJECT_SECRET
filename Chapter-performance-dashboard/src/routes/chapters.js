const express = require('express');
const router = express.Router();
const {
  getAllChapters,
  getChapterById,
  uploadChapters
} = require('../controllers/chapterController');
const { adminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { cache } = require('../middleware/cache');
const { uploadLimiter } = require('../middleware/rateLimiter');

// /api/v1/chapters 
router.get('/', cache(3600), getAllChapters);

router.get('/:id', getChapterById);

router.post('/', 
  uploadLimiter,
  adminAuth, 
  upload.single('chapters'), 
  uploadChapters
);

module.exports = router;
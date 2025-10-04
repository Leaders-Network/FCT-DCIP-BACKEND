const express = require('express');
const multer = require('multer');
const { uploadFile, getFileDownloadUrl, downloadFile } = require('../controllers/files');
const auth = require('../middlewares/authentication');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Routes
router.post('/upload', auth, upload.single('file'), uploadFile);
router.get('/download-url/:publicId', auth, getFileDownloadUrl);
router.get('/download/:publicId', auth, downloadFile);

// Legacy survey document routes (redirect to new endpoints)
router.get('/survey/:publicId', auth, downloadFile);

module.exports = router;
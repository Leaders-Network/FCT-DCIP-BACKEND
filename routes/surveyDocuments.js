const express = require('express');
const multer = require('multer');
const {
  uploadSurveyDocument,
  uploadMultipleSurveyDocuments,
  getDocuments,
  deleteDocument,
  getDocumentDownloadUrl
} = require('../controllers/surveyDocuments');
const auth = require('../middlewares/authentication');

const router = express.Router();

// Configure multer for survey document uploads
const storage = multer.memoryStorage();

// Enhanced file filter for survey documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported. Allowed: PDF, Images (JPEG, PNG, WebP), Word, Excel'), false);
  }
};

// Single file upload configuration
const uploadSingle = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter
});

// Multiple file upload configuration
const uploadMultiple = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 10 // Max 10 files at once
  },
  fileFilter
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 20MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files per upload.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name for file upload.'
      });
    }
  }
  
  if (error.message.includes('File type not supported')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};

// All routes require authentication
router.use(auth);

// Survey document upload routes
router.post('/upload/single', 
  uploadSingle.single('document'), 
  handleMulterError,
  uploadSurveyDocument
);

router.post('/upload/multiple', 
  uploadMultiple.array('documents', 10), 
  handleMulterError,
  uploadMultipleSurveyDocuments
);

// Document management routes
router.get('/', getDocuments); // Get documents by assignmentId or policyId
router.get('/download/:publicId', getDocumentDownloadUrl); // Get download URL
router.delete('/assignment/:assignmentId/document/:documentId', deleteDocument); // Delete from assignment
router.delete('/policy/:policyId/document/:documentId', deleteDocument); // Delete from policy

module.exports = router;
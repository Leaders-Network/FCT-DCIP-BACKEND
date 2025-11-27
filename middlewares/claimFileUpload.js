const multer = require('multer');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../services/fileUploadService');

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// File filter for claim documents
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, JPG, PNG, DOCX`), false);
    }
};

// Multer configuration for claim document uploads
const claimUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE, // 5MB per file
        files: 5 // Maximum 5 files
    }
});

// Middleware for single file upload
const uploadSingle = claimUpload.single('document');

// Middleware for multiple file uploads (up to 5 files)
const uploadMultiple = claimUpload.array('documents', 5);

// Error handling middleware for multer errors
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds 5 MB limit'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Maximum 5 files allowed per claim'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Unexpected file field'
            });
        }
        return res.status(400).json({
            success: false,
            error: `Upload error: ${err.message}`
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next();
};

module.exports = {
    claimUpload,
    uploadSingle,
    uploadMultiple,
    handleUploadError
};

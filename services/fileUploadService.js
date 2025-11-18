const { uploadToCloudinary, getDownloadUrl, deleteFromCloudinary } = require('../utils/cloudinary');

// Allowed file types for claim documents
const ALLOWED_MIME_TYPES = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc'
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes
const MAX_FILES = 5;

/**
 * Validate file type and size
 * @param {Object} file - File object from multer
 * @returns {{isValid: boolean, error: string|null}}
 */
const validateFile = (file) => {
    // Check file type
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return {
            isValid: false,
            error: `Invalid file type: ${file.mimetype}. Allowed types: PDF, JPG, PNG, DOCX`
        };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return {
            isValid: false,
            error: `File size (${sizeMB} MB) exceeds maximum allowed size of 5 MB`
        };
    }

    return {
        isValid: true,
        error: null
    };
};

/**
 * Upload documents to Cloudinary
 * @param {Array} files - Array of file objects from multer
 * @param {string} claimId - Claim ID for organizing files
 * @returns {Promise<Array>} Array of uploaded document metadata
 */
const uploadDocuments = async (files, claimId) => {
    try {
        // Validate number of files
        if (files.length > MAX_FILES) {
            throw new Error(`Maximum ${MAX_FILES} files allowed per claim`);
        }

        const uploadedDocuments = [];

        for (const file of files) {
            // Validate each file
            const validation = validateFile(file);
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Upload to Cloudinary
            const folder = `claim-documents/${claimId}`;
            const result = await uploadToCloudinary(file.buffer, file.originalname, folder);

            // Store document metadata
            uploadedDocuments.push({
                fileName: file.originalname,
                fileType: ALLOWED_MIME_TYPES[file.mimetype],
                fileSize: file.size,
                cloudinaryUrl: result.url,
                cloudinaryPublicId: result.publicId,
                uploadedAt: new Date()
            });

            console.log(`File uploaded: ${file.originalname} for claim ${claimId}`);
        }

        return uploadedDocuments;
    } catch (error) {
        console.error('Document upload error:', error);
        throw error;
    }
};

/**
 * Get document download URL
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Download URL
 */
const getDocumentUrl = (publicId) => {
    return getDownloadUrl(publicId);
};

/**
 * Retrieve document buffer from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Buffer>} Document buffer
 */
const getDocument = async (publicId) => {
    try {
        // For Cloudinary, we'll return the download URL instead of buffer
        // The client can download directly from Cloudinary
        return getDownloadUrl(publicId);
    } catch (error) {
        console.error('Get document error:', error);
        throw error;
    }
};

/**
 * Delete document from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteDocument = async (publicId) => {
    try {
        const result = await deleteFromCloudinary(publicId);
        console.log(`Document deleted: ${publicId}`);
        return result;
    } catch (error) {
        console.error('Delete document error:', error);
        throw error;
    }
};

/**
 * Validate multiple files before upload
 * @param {Array} files - Array of file objects
 * @returns {{isValid: boolean, errors: Array}}
 */
const validateFiles = (files) => {
    const errors = [];

    if (!files || files.length === 0) {
        return {
            isValid: true,
            errors: []
        };
    }

    if (files.length > MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed per claim`);
    }

    files.forEach((file, index) => {
        const validation = validateFile(file);
        if (!validation.isValid) {
            errors.push(`File ${index + 1} (${file.originalname}): ${validation.error}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    validateFile,
    validateFiles,
    uploadDocuments,
    getDocument,
    getDocumentUrl,
    deleteDocument,
    MAX_FILE_SIZE,
    MAX_FILES,
    ALLOWED_MIME_TYPES
};

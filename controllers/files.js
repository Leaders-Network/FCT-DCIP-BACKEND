const { StatusCodes } = require('http-status-codes');
const { uploadToCloudinary, getDownloadUrl, getFileInfo } = require('../utils/cloudinary');
const { BadRequestError, NotFoundError } = require('../errors');

// Upload file to Cloudinary
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const { originalname, buffer } = req.file;
    const { folder = 'survey-documents' } = req.body;

    // Validate file type (only PDFs for survey documents)
    if (!originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestError('Only PDF files are allowed');
    }

    // Validate file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestError('File size cannot exceed 10MB');
    }

    const result = await uploadToCloudinary(buffer, originalname, folder);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'File uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to upload file',
      error: error
    });
  }
};

// Get file download URL
const getFileDownloadUrl = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      throw new BadRequestError('Public ID is required');
    }

    // Verify file exists
    const fileInfo = await getFileInfo(publicId);
    
    if (!fileInfo) {
      throw new NotFoundError('File not found');
    }

    const downloadUrl = getDownloadUrl(publicId);

    res.status(StatusCodes.OK).json({
      success: true,
      downloadUrl,
      fileName: fileInfo.original_filename || 'document.pdf',
      fileSize: fileInfo.bytes,
      uploadDate: fileInfo.created_at
    });
  } catch (error) {
    console.error('Get download URL error:', error);
    
    if (error.http_code === 404) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'File not found'
      });
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get download URL',
      error: error.message
    });
  }
};

// Download file directly (proxy through backend)
const downloadFile = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { fileName } = req.query;

    if (!publicId) {
      throw new BadRequestError('Public ID is required');
    }

    // Get file info to verify it exists
    const fileInfo = await getFileInfo(publicId);
    
    if (!fileInfo) {
      throw new NotFoundError('File not found');
    }

    const downloadUrl = getDownloadUrl(publicId);

    // Fetch the file from Cloudinary
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new NotFoundError('File not accessible');
    }

    const fileBuffer = await response.arrayBuffer();
    const displayName = fileName || fileInfo.original_filename || 'document.pdf';

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${displayName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', fileBuffer.byteLength);

    // Send the file
    res.send(Buffer.from(fileBuffer));
  } catch (error) {
    console.error('File download error:', error);
    
    if (error.http_code === 404 || error instanceof NotFoundError) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'File not found'
      });
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

module.exports = {
  uploadFile,
  getFileDownloadUrl,
  downloadFile
};
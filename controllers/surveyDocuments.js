const { StatusCodes } = require('http-status-codes');
const { uploadToCloudinary, deleteFromCloudinary, getFileInfo } = require('../utils/cloudinary');
const SurveySubmission = require('../models/SurveySubmission');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const { BadRequestError, NotFoundError } = require('../errors');

// Upload survey document
const uploadSurveyDocument = async (req, res) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const { 
      assignmentId, 
      ammcId,
      category = 'general',
      description = '',
      documentType = 'survey_document'
    } = req.body;
    
    const { userId } = req.user;

    // Validate required parameters
    if (!assignmentId && !ammcId) {
      throw new BadRequestError('Either assignmentId or ammcId is required');
    }

    // Validate file type
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

    if (!allowedTypes.includes(mimetype)) {
      throw new BadRequestError('File type not supported. Allowed: PDF, Images (JPEG, PNG, WebP), Word, Excel');
    }

    // Validate file size (20MB limit for images, 10MB for documents)
    const maxSize = mimetype.startsWith('image/') ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    if (size > maxSize) {
      throw new BadRequestError(`File size exceeds limit. Max: ${maxSize / (1024 * 1024)}MB`);
    }

    // Determine folder structure
    const folder = assignmentId 
      ? `survey-documents/${assignmentId}` 
      : `policy-documents/${ammcId}`;

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, originalname, folder);

    // Create document record
    const documentData = {
      fileName: originalname,
      fileType: mimetype,
      fileSize: size,
      cloudinaryUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      category,
      description,
      documentType,
      uploadedBy: userId,
      uploadedAt: new Date()
    };

    // Add document to assignment or policy
    if (assignmentId) {
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        throw new NotFoundError('Assignment not found');
      }
      
      // Check if user has permission (surveyor assigned to this assignment or admin)
      if (assignment.surveyorId.toString() !== userId && req.user.role !== 'admin') {
        throw new BadRequestError('Not authorized to upload to this assignment');
      }

      if (!assignment.documents) {
        assignment.documents = [];
      }
      assignment.documents.push(documentData);
      await assignment.save();
    }

    if (ammcId) {
      const policy = await PolicyRequest.findById(ammcId);
      if (!policy) {
        throw new NotFoundError('AMMC request not found');
      }

      if (!policy.documents) {
        policy.documents = [];
      }
      policy.documents.push(documentData);
      await policy.save();
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: documentData,
        uploadResult: {
          url: uploadResult.url,
          publicId: uploadResult.publicId
        }
      }
    });
  } catch (error) {
    console.error('Survey document upload error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// Upload multiple survey documents
const uploadMultipleSurveyDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new BadRequestError('No files provided');
    }

    const { 
      assignmentId, 
      ammcId,
      category = 'general',
      description = '',
      documentType = 'survey_document'
    } = req.body;
    
    const { userId } = req.user;

    // Validate required parameters
    if (!assignmentId && !ammcId) {
      throw new BadRequestError('Either assignmentId or ammcId is required');
    }

    const uploadedDocuments = [];
    const failedUploads = [];

    // Process each file
    for (const file of req.files) {
      try {
        const { originalname, buffer, mimetype, size } = file;

        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg', 
          'image/jpg',
          'image/png',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(mimetype)) {
          failedUploads.push({
            fileName: originalname,
            error: 'File type not supported'
          });
          continue;
        }

        // Validate file size
        const maxSize = mimetype.startsWith('image/') ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
        if (size > maxSize) {
          failedUploads.push({
            fileName: originalname,
            error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
          });
          continue;
        }

        // Determine folder structure
        const folder = assignmentId 
          ? `survey-documents/${assignmentId}` 
          : `policy-documents/${ammcId}`;

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(buffer, originalname, folder);

        // Create document record
        const documentData = {
          fileName: originalname,
          fileType: mimetype,
          fileSize: size,
          cloudinaryUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          category,
          description,
          documentType,
          uploadedBy: userId,
          uploadedAt: new Date()
        };

        uploadedDocuments.push(documentData);
      } catch (error) {
        failedUploads.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Add successful uploads to assignment or policy
    if (uploadedDocuments.length > 0) {
      if (assignmentId) {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
          throw new NotFoundError('Assignment not found');
        }
        
        if (!assignment.documents) {
          assignment.documents = [];
        }
        assignment.documents.push(...uploadedDocuments);
        await assignment.save();
      }

      if (ammcId) {
        const policy = await PolicyRequest.findById(ammcId);
        if (!policy) {
          throw new NotFoundError('AMMC request not found');
        }

        if (!policy.documents) {
          policy.documents = [];
        }
        policy.documents.push(...uploadedDocuments);
        await policy.save();
      }
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: `${uploadedDocuments.length} documents uploaded successfully`,
      data: {
        uploadedDocuments,
        failedUploads,
        summary: {
          total: req.files.length,
          successful: uploadedDocuments.length,
          failed: failedUploads.length
        }
      }
    });
  } catch (error) {
    console.error('Multiple document upload error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to upload documents',
      error: error.message
    });
  }
};

// Get documents for assignment or policy
const getDocuments = async (req, res) => {
  try {
    const { assignmentId, ammcId } = req.query;
    const { category, documentType } = req.query;

    if (!assignmentId && !ammcId) {
      throw new BadRequestError('Either assignmentId or ammcId is required');
    }

    let documents = [];

    if (assignmentId) {
      const assignment = await Assignment.findById(assignmentId)
        .populate('surveyorId', 'firstname lastname')
        .select('documents');
      
      if (!assignment) {
        throw new NotFoundError('Assignment not found');
      }
      
      documents = assignment.documents || [];
    }

    if (ammcId) {
      const policy = await PolicyRequest.findById(ammcId)
        .select('documents');
      
      if (!policy) {
        throw new NotFoundError('AMMC request not found');
      }
      
      documents = [...documents, ...(policy.documents || [])];
    }

    // Apply filters
    if (category) {
      documents = documents.filter(doc => doc.category === category);
    }

    if (documentType) {
      documents = documents.filter(doc => doc.documentType === documentType);
    }

    // Group documents by category
    const groupedDocuments = documents.reduce((groups, doc) => {
      const category = doc.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(doc);
      return groups;
    }, {});

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        documents,
        groupedDocuments,
        summary: {
          total: documents.length,
          categories: Object.keys(groupedDocuments).length
        }
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get documents',
      error: error.message
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const { assignmentId, ammcId, documentId } = req.params;
    const { userId } = req.user;

    if (!assignmentId && !ammcId) {
      throw new BadRequestError('Either assignmentId or ammcId is required');
    }

    let targetModel, targetDocument, documentToDelete;

    if (assignmentId) {
      targetModel = await Assignment.findById(assignmentId);
      if (!targetModel) {
        throw new NotFoundError('Assignment not found');
      }
      
      documentToDelete = targetModel.documents?.find(doc => doc._id.toString() === documentId);
    }

    if (ammcId) {
      targetModel = await PolicyRequest.findById(ammcId);
      if (!targetModel) {
        throw new NotFoundError('AMMC request not found');
      }
      
      documentToDelete = targetModel.documents?.find(doc => doc._id.toString() === documentId);
    }

    if (!documentToDelete) {
      throw new NotFoundError('Document not found');
    }

    // Check permissions (document owner or admin)
    if (documentToDelete.uploadedBy.toString() !== userId && req.user.role !== 'admin') {
      throw new BadRequestError('Not authorized to delete this document');
    }

    // Delete from Cloudinary
    if (documentToDelete.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(documentToDelete.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Remove from database
    if (assignmentId) {
      targetModel.documents = targetModel.documents.filter(doc => doc._id.toString() !== documentId);
    }
    
    if (ammcId) {
      targetModel.documents = targetModel.documents.filter(doc => doc._id.toString() !== documentId);
    }

    await targetModel.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
};

// Get document download URL
const getDocumentDownloadUrl = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      throw new BadRequestError('Public ID is required');
    }

    // Verify file exists in Cloudinary
    const fileInfo = await getFileInfo(publicId);
    
    if (!fileInfo) {
      throw new NotFoundError('File not found');
    }

    const downloadUrl = require('../utils/cloudinary').getDownloadUrl(publicId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        downloadUrl,
        fileName: fileInfo.original_filename || 'document',
        fileSize: fileInfo.bytes,
        uploadDate: fileInfo.created_at,
        fileType: fileInfo.format
      }
    });
  } catch (error) {
    console.error('Get document download URL error:', error);
    
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

module.exports = {
  uploadSurveyDocument,
  uploadMultipleSurveyDocuments,
  getDocuments,
  deleteDocument,
  getDocumentDownloadUrl
};
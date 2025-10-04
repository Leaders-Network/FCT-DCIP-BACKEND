const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Upload file to Cloudinary
const uploadToCloudinary = async (fileBuffer, fileName, folder = 'survey-documents') => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: `${folder}/${Date.now()}_${fileName}`,
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              success: true,
              url: result.secure_url,
              publicId: result.public_id,
              originalName: fileName
            });
          }
        }
      );
      
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Get download URL from Cloudinary
const getDownloadUrl = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    flags: 'attachment',
    secure: true
  });
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

// Get file info from Cloudinary
const getFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'raw'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary file info error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  getDownloadUrl,
  deleteFromCloudinary,
  getFileInfo
};
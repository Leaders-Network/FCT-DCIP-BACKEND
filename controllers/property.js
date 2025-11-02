const { StatusCodes } = require('http-status-codes');
const { Property } = require('../models/Property');
const { NotFoundError } = require('../errors');

const adminGetAllProperties = async (req, res) => {
  try {
    const properties = await Property.find({ deleted: { $ne: true } }).populate(['category', 'ownedBy']);
    if (!properties) {
      throw new NotFoundError('No properties found');
    }
    res.status(StatusCodes.OK).json({
      success: true,
      allProperties: { count: properties.length, properties }
    });
  } catch (error) {
    console.error('Admin get all properties error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get properties',
      error: error.message
    });
  }
};

// Get user's properties
const getUserProperties = async (req, res) => {
  try {
    const { userId } = req.user;
    const properties = await Property.find({
      ownedBy: userId,
      deleted: { $ne: true }
    }).populate('category');

    res.status(StatusCodes.OK).json({
      success: true,
      allProperties: { count: properties.length, properties }
    });
  } catch (error) {
    console.error('Get user properties error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get properties',
      error: error.message
    });
  }
};

// Delete property (soft delete for admin, hard delete for users)
const deleteProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { userId, role } = req.user;

    const property = await Property.findById(propertyId);
    if (!property) {
      throw new NotFoundError('Property not found');
    }

    // Check permissions - users can only delete their own properties
    if (role === 'User' && property.ownedBy.toString() !== userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You can only delete your own properties'
      });
    }

    // Check if property is already deleted
    if (property.deleted) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Property is already deleted'
      });
    }

    // Check if property is referenced in any active policy requests
    const PolicyRequest = require('../models/PolicyRequest');
    const activePolicyRequests = await PolicyRequest.find({
      propertyId: propertyId,
      status: { $in: ['submitted', 'assigned', 'surveyed', 'approved'] }
    });

    if (activePolicyRequests.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Cannot delete property with active policy requests. Please complete or cancel related policies first.'
      });
    }

    if (role === 'Admin' || role === 'Super-admin') {
      // Soft delete for admin
      property.deleted = true;
      property.status = 'Cancelled';
      await property.save();
    } else {
      // Hard delete for users (only if no policy references)
      await Property.findByIdAndDelete(propertyId);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete property',
      error: error.message
    });
  }
};

// Restore deleted property (admin only)
const restoreProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      throw new NotFoundError('Property not found');
    }

    if (!property.deleted) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Property is not deleted'
      });
    }

    property.deleted = false;
    property.status = 'Unverified';
    await property.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Property restored successfully',
      data: property
    });
  } catch (error) {
    console.error('Restore property error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to restore property',
      error: error.message
    });
  }
};

module.exports = {
  adminGetAllProperties,
  getUserProperties,
  deleteProperty,
  restoreProperty
};

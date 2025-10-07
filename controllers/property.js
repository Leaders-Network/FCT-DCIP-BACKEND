const { StatusCodes } = require('http-status-codes');
const { Property } = require('../models/Property');
const { NotFoundError } = require('../errors');

const adminGetAllProperties = async (req, res) => {
  try {
    const properties = await Property.find({}).populate(['category', 'ownedBy']);
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

module.exports = {
  adminGetAllProperties,
};

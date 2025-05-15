const mongoose = require('mongoose')


const PropertySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Unverified', 'Verified', 'Processing', 'Pending', 'Blacklist', 'Cancelled', 'Expired'],
        default: 'Unverified'
    },
    category: {
        type: mongoose.Types.ObjectId,
        ref: 'PropertyCategory',
        required: [true, 'Please provide property category']
    },
    address: {
        type: String,
        required: [true, 'Please provide property address']
    },
    phonenumber: {
        type: String,
        match: [/^(?:\+234\d{10}|234\d{10}|0\d{10})$/, 'Please provide a valid phone number'],
        required: [true, 'Please provide a contact phone-number']
    },
    images: [{
        type: String
    }],
    deleted: { 
        type: Boolean, 
        default: false 
    },
    ownedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
})

const Property = mongoose.model("Property", PropertySchema);
const PropertyCategory = mongoose.model("PropertyCategory", PropertyCategorySchema)
module.exports = { Property, PropertyCategory }
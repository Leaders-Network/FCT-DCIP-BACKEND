const mongoose = require('mongoose')

const PropertyCategorySchema = new mongoose.Schema({
        category: {
        type: String,
        enum:[ 
"Single Occupier Office Building",
"Single Occupier Residential Building",
"Hotel/Hostel/Guest House",
"Recreation Centre/Club House/Cinema Hall",
"Multi Occupier/Multi Purpose Business Building",

"Multi Occupier/Mixed Use Residential Building",

"Hospital/Clinic/Health Centre",
"Others",

"Petrol/Gas Station"],
        
    },
})

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
    propertyType: {
        type: String,
    },
    buildingValue: {
        type: Number,
    },
    yearBuilt: {
        type: Number,
    },
    squareFootage: {
        type: Number,
    },
    constructionMaterial: {
        type: String,
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
    insuranceClass:{
        type:String,
        default:'',
    },
    insuranceCompany:{
        type:String,
        default:'',
    },
    policyNumber:{
        type:String,
        default:'',
        unique:true
    },
    buildingNumber:{
        type:String,
    }
})

const Property = mongoose.model("Property", PropertySchema);
const PropertyCategory = mongoose.model("PropertyCategory", PropertyCategorySchema)
module.exports = { Property,PropertyCategory}
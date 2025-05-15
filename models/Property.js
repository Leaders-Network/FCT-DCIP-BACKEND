const mongoose = require('mongoose')

<<<<<<< Updated upstream
const PropertyCategorySchema = new mongoose.Schema({
    category: {
        type: String,
        enum: ["Single Occupier Office Building", "Single Occupier Residential Building", "Hotel/Hostel/Guest House", "Recreation Centre/Club House/Cinema Hall", "School/Training Institute", "Petrol/Gas Station", "Hospital/Clinic/Health Centre", "Multi Occupier/Multi Purpose Business Building", "Multi Occupier/Mixed Use Residential Building", "Others"],
        required: true
    }
})
=======
>>>>>>> Stashed changes

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
    },
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

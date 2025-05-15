const mongoose = require('mongoose')


// const PropertyCategorySchema = new mongoose.Schema({
//     category: {
//         type: String,
//         enum: ["Single Occupier Office Building", "Single Occupier Residential Building", "Hotel/Hostel/Guest House", "Recreation Centre/Club House/Cinema Hall", "School/Training Institute", "Petrol/Gas Station", "Hospital/Clinic/Health Centre", "Multi Occupier/Multi Purpose Business Building", "Multi Occupier/Mixed Use Residential Building", "Others"],
//         required: true
//     }
// })

// const PropertyCategorySchema = new mongoose.Schema({
    
// })

const PropertySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Unverified', 'Verified', 'Processing', 'Pending', 'Blacklist', 'Cancelled', 'Expired'],
        default: 'Unverified'
    },
    category: {
        type: mongoose.Types.ObjectId,
        ref: 'PropertyCategory',
         enum: ["Single Occupier Office Building", "Single Occupier Residential Building", "Hotel/Hostel/Guest House", "Recreation Centre/Club House/Cinema Hall", "School/Training Institute", "Petrol/Gas Station", "Hospital/Clinic/Health Centre", "Multi Occupier/Multi Purpose Business Building", "Multi Occupier/Mixed Use Residential Building", "Others"],
        required: [true, 'Please provide property category']
    },
    address: {
        type: String,
        required: [true, 'Please provide property address']
    },
    // phonenumber: {
    //     type: String,
    //     match: [/^(?:\+234\d{10}|234\d{10}|0\d{10})$/, 'Please provide a valid phone number'],
    //     required: [true, 'Please provide a contact phone-number']
    // },
    images:{ 
        type:[String],
        require:true,
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
    // category: {
    //     type: String,
    //     enum: ["Single Occupier Office Building", "Single Occupier Residential Building", "Hotel/Hostel/Guest House", "Recreation Centre/Club House/Cinema Hall", "School/Training Institute", "Petrol/Gas Station", "Hospital/Clinic/Health Centre", "Multi Occupier/Multi Purpose Business Building", "Multi Occupier/Mixed Use Residential Building", "Others"],
    //     required: true
    // }
},{
    timestamps:true
})

const Property = mongoose.model("Property", PropertySchema);
// const PropertyCategory = mongoose.model("PropertyCategory", PropertyCategorySchema)
// module.exports = { Property, PropertyCategory }
module.exports = { Property}
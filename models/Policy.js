const mongoose = require('mongoose')

const policySchema = new mongoose.Schema({
    policyNumber:{
        type:String,
        default:'',
        require:true,
        unique:true
    },
    address:{
        type:String,
        // require:true
    },
    ownerBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user',
        // require:true
    },
    buildingNumber:{
        type:String,
    },
    phonenumber:{
        type:String,
        // require:true
    },
    insuranceClass:{
        type:String,
        // require:true
    },
    insuranceCompany:{
        type:String,
    },
    propertyId:{
         type:mongoose.Schema.Types.ObjectId,
        ref:'property',
        default:''
        // require:true
    }
})

const Policy = mongoose.model('policy',policySchema)

module.exports = Policy
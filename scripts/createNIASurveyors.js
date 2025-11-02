const mongoose = require('mongoose');
const { Employee, Role, Status } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
require('dotenv').config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local';
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB!');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

const createNIASurveyors = async () => {
    try {
        console.log('🚀 Creating NIA Surveyors');
        console.log('===============================\n');

        await connectDB();

        // Get required roles and statuses
        const surveyorRole = await Role.findOne({ role: 'Surveyor' });
        const activeStatus = await Status.findOne({ status: 'Active' });

        if (!surveyorRole) {
            console.log('Creating Surveyor role...');
            await Role.create({ role: 'Surveyor' });
        }

        if (!activeStatus) {
            console.log('Creating Active status...');
            await Status.create({ status: 'Active' });
        }

        const niaSurveyors = [
            {
                firstname: 'John',
                lastname: 'Doe',
                email: 'john.doe@nia.gov.ng',
                phonenumber: '+2348012345678',
                profile: {
                    specialization: ['residential', 'commercial'],
                    experience: 5,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Wuse', 'Garki']
                    },
                    availability: 'available'
                },
                licenseNumber: 'NIA-001-2024',
                address: '123 Wuse District, Abuja',
                emergencyContact: '+2348021112222'
            },
            {
                firstname: 'Jane',
                lastname: 'Smith',
                email: 'jane.smith@nia.gov.ng',
                phonenumber: '+2348023456789',
                profile: {
                    specialization: ['industrial', 'agricultural'],
                    experience: 8,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Maitama', 'Asokoro']
                    },
                    availability: 'busy'
                },
                licenseNumber: 'NIA-002-2024',
                address: '456 Maitama District, Abuja',
                emergencyContact: '+2348033334444'
            },
            {
                firstname: 'Michael',
                lastname: 'Johnson',
                email: 'michael.johnson@nia.gov.ng',
                phonenumber: '+2348034567890',
                profile: {
                    specialization: ['residential'],
                    experience: 3,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Kubwa', 'Nyanya']
                    },
                    availability: 'available'
                },
                licenseNumber: 'NIA-003-2024',
                address: '789 Kubwa District, Abuja',
                emergencyContact: '+2348045556666'
            },
            {
                firstname: 'Sarah',
                lastname: 'Williams',
                email: 'sarah.williams@nia.gov.ng',
                phonenumber: '+2348056789012',
                profile: {
                    specialization: ['commercial', 'industrial'],
                    experience: 6,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Central Business District', 'Utako']
                    },
                    availability: 'available'
                },
                licenseNumber: 'NIA-004-2024',
                address: '321 CBD, Abuja',
                emergencyContact: '+2348067778888'
            }
        ];

        for (const surveyorData of niaSurveyors) {
            try {
                // Check if employee already exists
                const existingEmployee = await Employee.findOne({ email: surveyorData.email });
                if (existingEmployee) {
                    console.log(`⚠️  Employee ${surveyorData.email} already exists, skipping...`);
                    continue;
                }

                // Create employee record
                const employee = new Employee({
                    firstname: surveyorData.firstname,
                    lastname: surveyorData.lastname,
                    email: surveyorData.email,
                    phonenumber: surveyorData.phonenumber,
                    employeeRole: surveyorRole._id,
                    employeeStatus: activeStatus._id,
                    organization: 'NIA'
                });

                await employee.save();

                // Create surveyor profile
                const surveyor = new Surveyor({
                    userId: employee._id,
                    profile: surveyorData.profile,
                    licenseNumber: surveyorData.licenseNumber,
                    address: surveyorData.address,
                    emergencyContact: surveyorData.emergencyContact,
                    organization: 'NIA',
                    status: 'active',
                    rating: Math.random() * 2 + 3 // Random rating between 3-5
                });

                await surveyor.save();

                console.log(`✅ Created NIA surveyor: ${surveyorData.firstname} ${surveyorData.lastname} (${surveyorData.email})`);
            } catch (error) {
                console.error(`❌ Failed to create surveyor ${surveyorData.email}:`, error.message);
            }
        }

        console.log('\n🎉 NIA Surveyors creation completed!');
        console.log('==============================\n');

        // Display summary
        const totalNIASurveyors = await Surveyor.countDocuments({ organization: 'NIA' });
        console.log(`📊 Total NIA Surveyors in database: ${totalNIASurveyors}`);

        await mongoose.connection.close();
        console.log('🔌 Database connection closed.');

    } catch (error) {
        console.error('❌ Error creating NIA surveyors:', error);
        process.exit(1);
    }
};

createNIASurveyors();
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

const createAMMCSurveyors = async () => {
    try {
        console.log('🚀 Creating AMMC Surveyors');
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

        const ammcSurveyors = [
            {
                firstname: 'David',
                lastname: 'Brown',
                email: 'david.brown@ammc.gov.ng',
                phonenumber: '+2348078901234',
                profile: {
                    specialization: ['residential', 'commercial'],
                    experience: 7,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Wuse', 'Garki']
                    },
                    availability: 'available'
                },
                licenseNumber: 'AMMC-001-2024',
                address: '100 Wuse II District, Abuja',
                emergencyContact: '+2348089012345'
            },
            {
                firstname: 'Lisa',
                lastname: 'Davis',
                email: 'lisa.davis@ammc.gov.ng',
                phonenumber: '+2348090123456',
                profile: {
                    specialization: ['industrial', 'commercial'],
                    experience: 4,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Maitama', 'Asokoro']
                    },
                    availability: 'available'
                },
                licenseNumber: 'AMMC-002-2024',
                address: '200 Maitama District, Abuja',
                emergencyContact: '+2348001234567'
            },
            {
                firstname: 'Robert',
                lastname: 'Wilson',
                email: 'robert.wilson@ammc.gov.ng',
                phonenumber: '+2348012345678',
                profile: {
                    specialization: ['residential', 'agricultural'],
                    experience: 9,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Kubwa', 'Nyanya']
                    },
                    availability: 'busy'
                },
                licenseNumber: 'AMMC-003-2024',
                address: '300 Kubwa District, Abuja',
                emergencyContact: '+2348023456789'
            },
            {
                firstname: 'Emily',
                lastname: 'Taylor',
                email: 'emily.taylor@ammc.gov.ng',
                phonenumber: '+2348034567890',
                profile: {
                    specialization: ['commercial', 'industrial'],
                    experience: 5,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Central Business District', 'Utako']
                    },
                    availability: 'available'
                },
                licenseNumber: 'AMMC-004-2024',
                address: '400 CBD, Abuja',
                emergencyContact: '+2348045678901'
            },
            {
                firstname: 'James',
                lastname: 'Anderson',
                email: 'james.anderson@ammc.gov.ng',
                phonenumber: '+2348056789012',
                profile: {
                    specialization: ['residential'],
                    experience: 2,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Gwarinpa', 'Karu']
                    },
                    availability: 'available'
                },
                licenseNumber: 'AMMC-005-2024',
                address: '500 Gwarinpa District, Abuja',
                emergencyContact: '+2348067890123'
            }
        ];

        for (const surveyorData of ammcSurveyors) {
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
                    organization: 'AMMC'
                });

                await employee.save();

                // Create surveyor profile
                const surveyor = new Surveyor({
                    userId: employee._id,
                    profile: surveyorData.profile,
                    licenseNumber: surveyorData.licenseNumber,
                    address: surveyorData.address,
                    emergencyContact: surveyorData.emergencyContact,
                    organization: 'AMMC',
                    status: 'active',
                    rating: Math.random() * 2 + 3 // Random rating between 3-5
                });

                await surveyor.save();

                console.log(`✅ Created AMMC surveyor: ${surveyorData.firstname} ${surveyorData.lastname} (${surveyorData.email})`);
            } catch (error) {
                console.error(`❌ Failed to create surveyor ${surveyorData.email}:`, error.message);
            }
        }

        console.log('\n🎉 AMMC Surveyors creation completed!');
        console.log('==============================\n');

        // Display summary
        const totalAMMCSurveyors = await Surveyor.countDocuments({ organization: 'AMMC' });
        console.log(`📊 Total AMMC Surveyors in database: ${totalAMMCSurveyors}`);

        await mongoose.connection.close();
        console.log('🔌 Database connection closed.');

    } catch (error) {
        console.error('❌ Error creating AMMC surveyors:', error);
        process.exit(1);
    }
};

createAMMCSurveyors();
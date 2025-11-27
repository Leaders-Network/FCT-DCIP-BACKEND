const mongoose = require('mongoose');
const { Employee } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
require('dotenv').config();

const createSurveyorRecord = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Get the user ID from command line arguments or use a default
        const userId = process.argv[2];

        if (!userId) {
            console.log('Usage: node createSurveyorRecord.js <userId>');
            console.log('Or run without arguments to create for all employees without surveyor records');

            // Find all employees without surveyor records
            const employees = await Employee.find({});
            console.log(`Found ${employees.length} employees`);

            for (const employee of employees) {
                const existingSurveyor = await Surveyor.findOne({ userId: employee._id });

                if (!existingSurveyor) {
                    console.log(`Creating surveyor record for ${employee.firstname} ${employee.lastname} (${employee._id})`);

                    const surveyor = new Surveyor({
                        userId: employee._id,
                        organization: 'AMMC', // Default to AMMC, can be changed later
                        profile: {
                            specialization: ['residential'],
                            experience: 1,
                            licenseNumber: `LIC-${Date.now()}`,
                            certifications: []
                        },
                        contactDetails: {
                            email: employee.email,
                            phone: employee.phonenumber || '',
                            address: ''
                        },
                        availability: {
                            status: 'available',
                            workingHours: {
                                start: '08:00',
                                end: '17:00'
                            },
                            workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                        },
                        statistics: {
                            totalAssignments: 0,
                            pendingAssignments: 0,
                            completedSurveys: 0,
                            averageRating: 0
                        },
                        status: 'active'
                    });

                    await surveyor.save();
                    console.log(`✅ Created surveyor record for ${employee.firstname} ${employee.lastname}`);
                } else {
                    console.log(`⏭️  Surveyor record already exists for ${employee.firstname} ${employee.lastname}`);
                }
            }
        } else {
            // Create for specific user
            const employee = await Employee.findById(userId);

            if (!employee) {
                console.log(`❌ Employee with ID ${userId} not found`);
                process.exit(1);
            }

            const existingSurveyor = await Surveyor.findOne({ userId });

            if (existingSurveyor) {
                console.log(`⏭️  Surveyor record already exists for ${employee.firstname} ${employee.lastname}`);
                process.exit(0);
            }

            console.log(`Creating surveyor record for ${employee.firstname} ${employee.lastname} (${userId})`);

            const surveyor = new Surveyor({
                userId: employee._id,
                organization: 'AMMC', // Default to AMMC, can be changed later
                profile: {
                    specialization: ['residential'],
                    experience: 1,
                    licenseNumber: `LIC-${Date.now()}`,
                    certifications: []
                },
                contactDetails: {
                    email: employee.email,
                    phone: employee.phonenumber || '',
                    address: ''
                },
                availability: {
                    status: 'available',
                    workingHours: {
                        start: '08:00',
                        end: '17:00'
                    },
                    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                },
                statistics: {
                    totalAssignments: 0,
                    pendingAssignments: 0,
                    completedSurveys: 0,
                    averageRating: 0
                },
                status: 'active'
            });

            await surveyor.save();
            console.log(`✅ Created surveyor record for ${employee.firstname} ${employee.lastname}`);
        }

        console.log('✅ Script completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating surveyor record:', error);
        process.exit(1);
    }
};

createSurveyorRecord();
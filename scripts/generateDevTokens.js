/**
 * Generate valid JWT tokens for development testing
 * Run this script to get valid tokens for all user types
 * 
 * Usage: node scripts/generateDevTokens.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { Employee, Role, Status } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const NIAAdmin = require('../models/NIAAdmin');

const generateToken = (userId, fullname, role, model) => {
    return jwt.sign(
        { userId, fullname, role, model },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME || '30d' }
    );
};

const generateDevTokens = async () => {
    try {
        console.log('🔐 Generating development tokens for all user types...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const tokens = {};
        const credentials = {};

        // ========== 1. REGULAR USER ==========
        console.log('👤 Setting up Regular User...');
        let testUser = await User.findOne({ email: 'testuser@example.com' });

        if (!testUser) {
            testUser = await User.create({
                fullname: 'Test User',
                email: 'testuser@example.com',
                password: 'password123',
                phonenumber: '08012345678',
                role: 'user',
                isEmailVerified: true
            });
            console.log('✅ Test user created');
        } else {
            console.log('✅ Test user found');
        }

        tokens.user = generateToken(
            testUser._id,
            testUser.fullname,
            testUser.role,
            'User'
        );
        credentials.user = { email: 'testuser@example.com', password: 'password123' };

        // ========== 2. SUPER ADMIN ==========
        console.log('👤 Setting up Super Admin...');
        const superAdminRole = await Role.findOne({ role: 'Super-admin' });
        const activeStatus = await Status.findOne({ status: 'Active' });

        let superAdmin = await Employee.findOne({ email: 'superadmin@example.com' });

        if (!superAdmin && superAdminRole && activeStatus) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            superAdmin = await Employee.create({
                firstname: 'Super',
                lastname: 'Admin',
                email: 'superadmin@example.com',
                password: hashedPassword,
                phonenumber: '08011111111',
                employeeRole: superAdminRole._id,
                employeeStatus: activeStatus._id,
                organization: 'AMMC'
            });
            console.log('✅ Super admin created');
        } else if (superAdmin) {
            console.log('✅ Super admin found');
        }

        if (superAdmin) {
            await superAdmin.populate(['employeeRole', 'employeeStatus']);
            tokens.superAdmin = generateToken(
                superAdmin._id,
                `${superAdmin.firstname} ${superAdmin.lastname}`,
                superAdmin.employeeRole?.role || 'Super-admin',
                'Employee'
            );
            credentials.superAdmin = { email: 'superadmin@example.com', password: 'admin123' };
        }

        // ========== 3. AMMC ADMIN ==========
        console.log('👤 Setting up AMMC Admin...');
        const adminRole = await Role.findOne({ role: 'Admin' });

        let ammcAdmin = await Employee.findOne({ email: 'ammcadmin@example.com' });

        if (!ammcAdmin && adminRole && activeStatus) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            ammcAdmin = await Employee.create({
                firstname: 'AMMC',
                lastname: 'Admin',
                email: 'ammcadmin@example.com',
                password: hashedPassword,
                phonenumber: '08022222222',
                employeeRole: adminRole._id,
                employeeStatus: activeStatus._id,
                organization: 'AMMC'
            });
            console.log('✅ AMMC admin created');
        } else if (ammcAdmin) {
            console.log('✅ AMMC admin found');
        }

        if (ammcAdmin) {
            await ammcAdmin.populate(['employeeRole', 'employeeStatus']);
            tokens.ammcAdmin = generateToken(
                ammcAdmin._id,
                `${ammcAdmin.firstname} ${ammcAdmin.lastname}`,
                ammcAdmin.employeeRole?.role || 'Admin',
                'Employee'
            );
            credentials.ammcAdmin = { email: 'ammcadmin@example.com', password: 'admin123' };
        }

        // ========== 4. NIA ADMIN ==========
        console.log('👤 Setting up NIA Admin...');
        let niaAdminEmployee = await Employee.findOne({ email: 'niaadmin@example.com' });

        if (!niaAdminEmployee && adminRole && activeStatus) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            niaAdminEmployee = await Employee.create({
                firstname: 'NIA',
                lastname: 'Admin',
                email: 'niaadmin@example.com',
                password: hashedPassword,
                phonenumber: '08033333333',
                employeeRole: adminRole._id,
                employeeStatus: activeStatus._id,
                organization: 'NIA'
            });
            console.log('✅ NIA admin employee created');
        } else if (niaAdminEmployee) {
            console.log('✅ NIA admin employee found');
        }

        if (niaAdminEmployee) {
            let niaAdminRecord = await NIAAdmin.findOne({ userId: niaAdminEmployee._id });

            if (!niaAdminRecord) {
                niaAdminRecord = await NIAAdmin.create({
                    userId: niaAdminEmployee._id,
                    permissions: {
                        canViewReports: true,
                        canManageAssignments: true,
                        canManageSurveyors: true,
                        canAccessDashboard: true
                    },
                    status: 'active'
                });
                console.log('✅ NIA admin record created');
            }

            await niaAdminEmployee.populate(['employeeRole', 'employeeStatus']);
            tokens.niaAdmin = generateToken(
                niaAdminEmployee._id,
                `${niaAdminEmployee.firstname} ${niaAdminEmployee.lastname}`,
                niaAdminEmployee.employeeRole?.role || 'Admin',
                'Employee'
            );
            credentials.niaAdmin = { email: 'niaadmin@example.com', password: 'admin123' };
        }

        // ========== 5. SURVEYOR ==========
        console.log('👤 Setting up Surveyor...');
        const staffRole = await Role.findOne({ role: 'Staff' });

        let surveyorEmployee = await Employee.findOne({ email: 'surveyor@example.com' });

        if (!surveyorEmployee && staffRole && activeStatus) {
            const hashedPassword = await bcrypt.hash('surveyor123', 10);
            surveyorEmployee = await Employee.create({
                firstname: 'Test',
                lastname: 'Surveyor',
                email: 'surveyor@example.com',
                password: hashedPassword,
                phonenumber: '08044444444',
                employeeRole: staffRole._id,
                employeeStatus: activeStatus._id,
                organization: 'AMMC'
            });
            console.log('✅ Surveyor employee created');
        } else if (surveyorEmployee) {
            console.log('✅ Surveyor employee found');
        }

        if (surveyorEmployee) {
            let surveyorRecord = await Surveyor.findOne({ userId: surveyorEmployee._id });

            if (!surveyorRecord) {
                surveyorRecord = await Surveyor.create({
                    userId: surveyorEmployee._id,
                    organization: 'AMMC',
                    profile: {
                        specialization: ['residential', 'commercial'],
                        experience: 5,
                        licenseNumber: `LIC-${Date.now()}`,
                        certifications: ['Property Assessment', 'Risk Evaluation']
                    },
                    contactDetails: {
                        email: surveyorEmployee.email,
                        phone: surveyorEmployee.phonenumber || '',
                        address: 'Abuja, Nigeria'
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
                console.log('✅ Surveyor record created');
            }

            await surveyorEmployee.populate(['employeeRole', 'employeeStatus']);
            tokens.surveyor = generateToken(
                surveyorEmployee._id,
                `${surveyorEmployee.firstname} ${surveyorEmployee.lastname}`,
                surveyorEmployee.employeeRole?.role || 'Staff',
                'Employee'
            );
            credentials.surveyor = { email: 'surveyor@example.com', password: 'surveyor123' };
        }

        console.log('\n' + '='.repeat(100));
        console.log('📋 DEVELOPMENT TOKENS GENERATED SUCCESSFULLY');
        console.log('='.repeat(100));

        if (tokens.user) {
            console.log('\n🔵 REGULAR USER:');
            console.log(`   Email: ${credentials.user.email}`);
            console.log(`   Password: ${credentials.user.password}`);
            console.log(`   Token: ${tokens.user}`);
        }

        if (tokens.superAdmin) {
            console.log('\n🔴 SUPER ADMIN:');
            console.log(`   Email: ${credentials.superAdmin.email}`);
            console.log(`   Password: ${credentials.superAdmin.password}`);
            console.log(`   Token: ${tokens.superAdmin}`);
        }

        if (tokens.ammcAdmin) {
            console.log('\n🟠 AMMC ADMIN:');
            console.log(`   Email: ${credentials.ammcAdmin.email}`);
            console.log(`   Password: ${credentials.ammcAdmin.password}`);
            console.log(`   Token: ${tokens.ammcAdmin}`);
        }

        if (tokens.niaAdmin) {
            console.log('\n🟣 NIA ADMIN:');
            console.log(`   Email: ${credentials.niaAdmin.email}`);
            console.log(`   Password: ${credentials.niaAdmin.password}`);
            console.log(`   Token: ${tokens.niaAdmin}`);
        }

        if (tokens.surveyor) {
            console.log('\n🟢 SURVEYOR:');
            console.log(`   Email: ${credentials.surveyor.email}`);
            console.log(`   Password: ${credentials.surveyor.password}`);
            console.log(`   Token: ${tokens.surveyor}`);
        }

        console.log('\n' + '='.repeat(100));
        console.log('📝 QUICK SETUP - Copy and paste in browser console:');
        console.log('='.repeat(100));
        if (tokens.user) console.log(`localStorage.setItem("userToken", "${tokens.user}");`);
        if (tokens.superAdmin) console.log(`localStorage.setItem("superAdminToken", "${tokens.superAdmin}");`);
        if (tokens.ammcAdmin) console.log(`localStorage.setItem("adminToken", "${tokens.ammcAdmin}");`);
        if (tokens.niaAdmin) console.log(`localStorage.setItem("niaAdminToken", "${tokens.niaAdmin}");`);
        if (tokens.surveyor) console.log(`localStorage.setItem("surveyorToken", "${tokens.surveyor}");`);
        console.log('\n');

        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating tokens:', error);
        console.error(error.stack);
        process.exit(1);
    }
};

generateDevTokens();

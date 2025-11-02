const express = require('express');
const cors = require('cors');
const { StatusCodes } = require('http-status-codes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    // For testing, accept any Bearer token
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token format'
        });
    }

    // Mock user data
    req.user = {
        userId: '68ff39a917a0cc55d758f00e',
        fullname: 'Test NIA Admin',
        role: 'NIA-Admin',
        organization: 'NIA'
    };

    req.niaAdmin = {
        _id: '507f1f77bcf86cd799439015',
        userId: req.user.userId,
        permissions: {
            canManageSurveyors: true,
            canViewReports: true,
            canManageAssignments: true
        },
        hasPermission: (permission) => req.niaAdmin.permissions[permission] || false
    };

    next();
};

// Mock surveyors endpoint
app.get('/api/v1/nia-admin/surveyors', mockAuth, (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        availability,
        specialization,
        search
    } = req.query;

    // Mock data
    const mockSurveyors = [
        {
            _id: '507f1f77bcf86cd799439011',
            userId: {
                firstname: 'John',
                lastname: 'Doe',
                email: 'john.doe@nia.gov.ng',
                phonenumber: '+234-801-234-5678'
            },
            profile: {
                specialization: ['residential', 'commercial'],
                availability: 'available',
                experience: 5,
                location: {
                    state: 'FCT',
                    city: 'Abuja',
                    area: ['Wuse', 'Garki']
                }
            },
            status: 'active',
            organization: 'NIA',
            rating: 4.5,
            licenseNumber: 'NIA-001-2024',
            assignmentStats: {
                total: 25,
                completed: 20,
                inProgress: 3,
                pending: 2
            },
            createdAt: new Date('2024-01-15')
        },
        {
            _id: '507f1f77bcf86cd799439012',
            userId: {
                firstname: 'Jane',
                lastname: 'Smith',
                email: 'jane.smith@nia.gov.ng',
                phonenumber: '+234-802-345-6789'
            },
            profile: {
                specialization: ['industrial', 'agricultural'],
                availability: 'busy',
                experience: 8,
                location: {
                    state: 'FCT',
                    city: 'Abuja',
                    area: ['Maitama', 'Asokoro']
                }
            },
            status: 'active',
            organization: 'NIA',
            rating: 4.8,
            licenseNumber: 'NIA-002-2024',
            assignmentStats: {
                total: 40,
                completed: 35,
                inProgress: 4,
                pending: 1
            },
            createdAt: new Date('2024-01-10')
        },
        {
            _id: '507f1f77bcf86cd799439013',
            userId: {
                firstname: 'Michael',
                lastname: 'Johnson',
                email: 'michael.johnson@nia.gov.ng',
                phonenumber: '+234-803-456-7890'
            },
            profile: {
                specialization: ['residential'],
                availability: 'available',
                experience: 3,
                location: {
                    state: 'FCT',
                    city: 'Abuja',
                    area: ['Kubwa', 'Nyanya']
                }
            },
            status: 'active',
            organization: 'NIA',
            rating: 4.2,
            licenseNumber: 'NIA-003-2024',
            assignmentStats: {
                total: 15,
                completed: 12,
                inProgress: 2,
                pending: 1
            },
            createdAt: new Date('2024-02-01')
        }
    ];

    // Apply filters
    let filteredSurveyors = mockSurveyors;

    if (status && status !== 'all') {
        filteredSurveyors = filteredSurveyors.filter(s => s.status === status);
    }

    if (availability && availability !== 'all') {
        filteredSurveyors = filteredSurveyors.filter(s => s.profile.availability === availability);
    }

    if (specialization && specialization !== 'all') {
        filteredSurveyors = filteredSurveyors.filter(s =>
            s.profile.specialization.includes(specialization)
        );
    }

    if (search) {
        const searchLower = search.toLowerCase();
        filteredSurveyors = filteredSurveyors.filter(s =>
            s.userId.firstname.toLowerCase().includes(searchLower) ||
            s.userId.lastname.toLowerCase().includes(searchLower) ||
            s.userId.email.toLowerCase().includes(searchLower) ||
            s.userId.phonenumber.includes(search)
        );
    }

    // Pagination
    const total = filteredSurveyors.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedSurveyors = filteredSurveyors.slice(skip, skip + parseInt(limit));

    res.status(StatusCodes.OK).json({
        success: true,
        data: {
            surveyors: paginatedSurveyors,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        }
    });
});

// Health check
app.get('/', (req, res) => {
    res.json({ message: 'Test server running', status: 'ok' });
});

const PORT = 5001; // Test backend port
app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📊 NIA Admin Surveyors endpoint: http://localhost:${PORT}/api/v1/nia-admin/surveyors`);
});
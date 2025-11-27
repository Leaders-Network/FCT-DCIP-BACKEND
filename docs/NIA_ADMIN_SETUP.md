# NIA Admin Setup Guide

## Overview
This guide explains how to set up and use the Nigerian Insurers Association (NIA) admin accounts for the dual-surveyor system.

## Creating NIA Admin Accounts

### Quick Setup
Run the following command in the backend directory to create NIA admin accounts:

```bash
npm run create-nia-admin
```

This will create:
- 1 Main NIA Administrator account
- 2 Additional NIA admin accounts for testing

### Manual Setup
If you need to create additional NIA admins manually, you can modify the `scripts/createNIAAdmin.js` file and add more admin configurations to the `ADDITIONAL_NIA_ADMINS` array.

## Default NIA Admin Credentials

### Main NIA Admin
- **Email:** admin@nia.org.ng
- **Password:** NIAAdmin@123
- **Name:** NIA Administrator
- **Organization:** NIA

### Additional Test Admins
1. **John Doe**
   - Email: john.doe@nia.org.ng
   - Password: NIAAdmin@456

2. **Jane Smith**
   - Email: jane.smith@nia.org.ng
   - Password: NIAAdmin@789

## Accessing NIA Admin Dashboard

### Login Process
1. Navigate to the employee login page: `http://localhost:3000/employee-login`
2. Use any of the NIA admin credentials above
3. After successful login, you'll be redirected to the NIA admin dashboard

### Dashboard URLs
- **Main Dashboard:** `http://localhost:3000/nia-admin`
- **User Inquiries:** `http://localhost:3000/nia-admin/user-inquiries`
- **Processing Monitor:** `http://localhost:3000/nia-admin/processing-monitor`

## NIA Admin Features

### User Conflict Inquiry Management
- View all user-submitted conflict inquiries
- Filter by status, urgency, and conflict type
- Assign inquiries to NIA administrators
- Respond to user inquiries via email, phone, or in-person
- Add internal notes and escalate issues
- Track response times and resolution metrics

### Processing Monitor
- Monitor dual-surveyor assignment progress
- View real-time statistics for NIA assignments
- Track completion rates and performance metrics
- Manage automatic report processing

### Dual-Surveyor System
- Independent assignment management for NIA surveyors
- Coordinate with AMMC administrators
- Handle merged report conflicts and discrepancies
- Manage user communications and notifications

## Security Notes

### Important Security Practices
1. **Change Default Passwords:** Always change the default passwords after first login
2. **Use Strong Passwords:** Implement strong password policies for production
3. **Regular Updates:** Regularly update admin credentials
4. **Access Control:** Limit admin access to authorized personnel only

### Role-Based Access
- NIA admins have organization-specific access
- Cannot access AMMC-specific data or functions
- Proper separation of duties between organizations

## Troubleshooting

### Common Issues

#### Login Problems
- Verify credentials are correct
- Check if the backend server is running
- Ensure database connection is active

#### API Connection Issues
- Verify `NEXT_PUBLIC_API_BASE_URL` in frontend `.env`
- Check `NEXT_PUBLIC_API_KEY` configuration
- Ensure backend is running on correct port (default: 5000)

#### Database Issues
- Verify MongoDB connection string
- Check if required roles and statuses exist
- Run the admin creation script again if needed

### Getting Help
If you encounter issues:
1. Check the browser console for error messages
2. Review backend logs for API errors
3. Verify environment configuration
4. Ensure all required dependencies are installed

## Development Notes

### Database Schema
The NIA admin system uses:
- **Employee Model:** Extended with `organization` field
- **Role Model:** Includes 'NIA-Admin' role type
- **User Conflict Inquiries:** Organization-specific filtering
- **Processing Monitor:** Dual-organization support

### API Endpoints
NIA-specific endpoints:
- `GET /api/v1/user-conflict-inquiries/admin` - Get inquiries
- `PUT /api/v1/user-conflict-inquiries/admin/:id/assign` - Assign inquiry
- `PUT /api/v1/user-conflict-inquiries/admin/:id/respond` - Send response
- `GET /api/v1/processing-monitor/stats` - Get processing statistics

### Frontend Components
- `NIAUserConflictInbox` - NIA-specific inquiry management
- `AMMCUserConflictInbox` - AMMC-specific inquiry management
- Shared service layer with organization filtering

## Production Deployment

### Environment Variables
Ensure these are set for production:
```env
MONGO_URI=your_production_mongodb_uri
JWT_SECRET=your_secure_jwt_secret
JWT_LIFETIME=24h
NEXT_PUBLIC_API_BASE_URL=your_production_api_url
NEXT_PUBLIC_API_KEY=your_production_api_key
```

### Security Checklist
- [ ] Change all default passwords
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting
- [ ] Enable API key validation
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts

## Support
For technical support or questions about the NIA admin system, please contact the development team or refer to the main project documentation.
# Database Setup Guide

This guide will help you set up and manage your MongoDB database for the FCT-DCIP project.

## Quick Start

### 1. Fresh Database Setup (New Project)
```bash
# This will clear everything and create a fresh database with admin account
npm run reset-db
```

### 2. Add Admin to Existing Database
```bash
# This will only create an admin account without clearing existing data
npm run create-admin
```

### 3. Migrate Existing Data (policyId → ammcId)
```bash
# This will rename policyId fields to ammcId in existing data
npm run migrate-fields
```

## Default Admin Credentials

After running any of the setup scripts, you can login with:

- **Email:** `admin@ammc.com`
- **Password:** `Admin@123`
- **Role:** Super Admin

**🔒 Important:** Change this password after first login!

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Reset Database | `npm run reset-db` | ⚠️ Clears all data and creates fresh setup |
| Create Admin | `npm run create-admin` | Creates admin account only |
| Migrate Fields | `npm run migrate-fields` | Migrates policyId to ammcId |

## Step-by-Step Setup

### For New Projects:
1. Ensure MongoDB is running
2. Set up your `.env` file with `MONGO_URI`
3. Run: `npm run reset-db`
4. Start your server: `npm run dev`
5. Login with admin credentials

### For Existing Projects:
1. **Backup your database first!**
2. Run field migration: `npm run migrate-fields`
3. Create admin if needed: `npm run create-admin`
4. Start your server: `npm run dev`

## Environment Variables Required

Create a `.env` file in the backend root with:

```env
MONGO_URI=mongodb://localhost:27017/fct-dcip
# or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fct-dcip

JWT_SECRET=your-super-secret-jwt-key
JWT_LIFETIME=30d

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Troubleshooting

### Connection Issues:
```bash
# Check if MongoDB is running
mongosh

# Or if using MongoDB service
sudo systemctl status mongod
```

### Permission Issues:
- Ensure your MongoDB user has read/write permissions
- Check your `MONGO_URI` connection string

### Script Errors:
- Make sure all dependencies are installed: `npm install`
- Check that your `.env` file exists and has correct values
- Verify MongoDB is accessible

## Database Collections

After setup, your database will have:

- **employees** - Admin and staff accounts
- **roles** - User roles (Super-admin, Admin, Staff, Surveyor)
- **statuses** - Account statuses (Active, Inactive)
- **users** - Regular user accounts
- **policyrequests** - Insurance policy requests
- **assignments** - Survey assignments
- **surveysubmissions** - Survey submissions
- **surveyors** - Surveyor profiles
- **properties** - Property records

## Security Notes

1. **Change Default Password:** Always change the admin password after first login
2. **Secure Environment:** Keep your `.env` file secure and never commit it to version control
3. **Database Access:** Limit database access to authorized personnel
4. **Regular Backups:** Always backup before running destructive operations

## Need Help?

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your environment variables are correct
3. Ensure MongoDB is running and accessible
4. Make sure all npm dependencies are installed

## Advanced Usage

### Custom Admin Configuration:
Edit the `ADMIN_CONFIG` object in `scripts/createAdmin.js` or `scripts/resetDatabase.js`:

```javascript
const ADMIN_CONFIG = {
  firstname: 'Your',
  lastname: 'Name',
  email: 'your-email@company.com',
  phonenumber: '+2348123456789',
  password: 'YourSecurePassword123!'
};
```

### Manual Database Operations:
```bash
# Connect to MongoDB shell
mongosh

# Switch to your database
use fct-dcip

# Check collections
show collections

# Count documents
db.employees.countDocuments()
```
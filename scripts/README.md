# Database Management Scripts

This directory contains scripts for managing the MongoDB database for the FCT-DCIP project.

## Scripts Available

### 1. Reset Database (`resetDatabase.js`)

**⚠️ WARNING: This script will completely clear your database!**

This script will:
- Clear all collections in the database
- Create default roles and statuses
- Create a super admin account
- Verify the setup

**Usage:**
```bash
# Run with confirmation prompt
node scripts/resetDatabase.js

# Run without confirmation (force)
node scripts/resetDatabase.js --force

# Or use npm script
npm run reset-db
npm run db:reset
```

### 2. Create Admin (`createAdmin.js`)

This script will:
- Ensure required roles and statuses exist
- Create a super admin account (if it doesn't exist)
- Won't delete any existing data

**Usage:**
```bash
# Run the script
node scripts/createAdmin.js

# Or use npm script
npm run create-admin
npm run db:admin
```

## Default Admin Credentials

The scripts create an admin account with these default credentials:

- **Email:** `admin@ammc.com`
- **Password:** `Admin@123`
- **Name:** `Super Admin`
- **Role:** `Super-admin`
- **Status:** `Active`

**🔒 Security Note:** Change the default password after first login!

## Configuration

You can modify the admin credentials by editing the `ADMIN_CONFIG` object in either script:

```javascript
const ADMIN_CONFIG = {
  firstname: 'Super',
  lastname: 'Admin',
  email: 'admin@ammc.com',
  phonenumber: '+2348123456789',
  password: 'Admin@123' // Change this!
};
```

## Prerequisites

1. **Environment Variables:** Ensure your `.env` file contains:
   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   JWT_LIFETIME=your_jwt_lifetime
   ```

2. **Dependencies:** All required packages should be installed:
   ```bash
   npm install
   ```

## Roles and Statuses Created

### Roles:
- `Super-admin` - Full system access
- `Admin` - Administrative access
- `Staff` - Staff level access
- `Surveyor` - Surveyor specific access

### Statuses:
- `Active` - User is active and can login
- `Inactive` - User is inactive and cannot login

## Database Collections

The scripts work with these collections:
- `employees` - Employee accounts (including admins)
- `roles` - User roles
- `statuses` - User statuses
- `users` - Regular users
- `policyrequests` - Policy requests (now using ammcId)
- `assignments` - Survey assignments (now using ammcId)
- `surveysubmissions` - Survey submissions (now using ammcId)
- `surveyors` - Surveyor profiles
- `properties` - Property records
- `otps` - OTP records

## Migration Notes

After running the reset script, you may need to run the field migration for existing data:

```javascript
// MongoDB migration for policyId to ammcId
db.assignments.updateMany({}, { $rename: { "policyId": "ammcId" } });
db.surveysubmissions.updateMany({}, { $rename: { "policyId": "ammcId" } });
```

## Troubleshooting

### Common Issues:

1. **Connection Error:**
   - Check your `MONGO_URI` in `.env`
   - Ensure MongoDB is running
   - Check network connectivity

2. **Permission Error:**
   - Ensure the database user has write permissions
   - Check MongoDB authentication

3. **Duplicate Key Error:**
   - Admin account might already exist
   - Use `createAdmin.js` instead of `resetDatabase.js`

### Logs:

The scripts provide colored console output:
- 🟢 Green: Success messages
- 🟡 Yellow: Warning/Info messages
- 🔴 Red: Error messages
- 🔵 Cyan: Data/Details

## Examples

### Fresh Setup:
```bash
# For a completely fresh database
npm run reset-db
```

### Add Admin to Existing Database:
```bash
# To just create admin without clearing data
npm run create-admin
```

### Custom Admin:
```bash
# Edit the ADMIN_CONFIG in the script first, then run:
node scripts/createAdmin.js
```

## Security Best Practices

1. **Change Default Password:** Always change the default admin password after first login
2. **Environment Variables:** Keep your `.env` file secure and never commit it
3. **Database Access:** Limit database access to authorized personnel only
4. **Regular Backups:** Always backup your database before running reset scripts

## Support

If you encounter issues with these scripts:
1. Check the console output for specific error messages
2. Verify your environment variables
3. Ensure all dependencies are installed
4. Check MongoDB connection and permissions
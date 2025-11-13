# Broker Admin Seed Script

This script creates sample broker administrator accounts for testing and development purposes.

## Usage

Run the script from the backend directory:

```bash
npm run create-broker-admins
```

Or directly:

```bash
node scripts/createBrokerAdmins.js
```

## What It Creates

The script creates 5 broker admin accounts with the following details:

### 1. Premium Insurance Brokers Ltd
- **Name:** Michael Johnson
- **Email:** michael.johnson@premiumbrokers.ng
- **Phone:** +2348011111111
- **License:** BFL-2024-001
- **Position:** Senior Broker Administrator

### 2. Elite Insurance Brokers
- **Name:** Sarah Williams
- **Email:** sarah.williams@elitebrokers.ng
- **Phone:** +2348022222222
- **License:** BFL-2024-002
- **Position:** Broker Administrator

### 3. Trust Insurance Brokers
- **Name:** Daniel Martinez
- **Email:** daniel.martinez@trustbrokers.ng
- **Phone:** +2348033333333
- **License:** BFL-2024-003
- **Position:** Lead Broker Administrator

### 4. Reliable Insurance Brokers Ltd
- **Name:** Jennifer Garcia
- **Email:** jennifer.garcia@reliablebrokers.ng
- **Phone:** +2348044444444
- **License:** BFL-2024-004
- **Position:** Broker Administrator

### 5. First Choice Insurance Brokers
- **Name:** Christopher Rodriguez
- **Email:** chris.rodriguez@firstchoicebrokers.ng
- **Phone:** +2348055555555
- **License:** BFL-2024-005
- **Position:** Broker Administrator

## Default Credentials

All accounts use the same password for testing:

- **Password:** `Broker@123`

## Login

After running the script, you can log in at:

```
/broker-admin/login
```

Or via API:

```bash
POST /api/v1/broker-admin/auth/login
Content-Type: application/json

{
  "email": "michael.johnson@premiumbrokers.ng",
  "password": "Broker@123"
}
```

## Permissions

All created broker admins have the following permissions enabled:
- ✅ View Claims
- ✅ Update Claim Status
- ✅ View Reports
- ✅ Access Analytics

## Database Collections

The script creates records in:
1. **Employee** collection (with organization='Broker')
2. **BrokerAdmin** collection (with broker-specific profile data)

## Prerequisites

- MongoDB connection must be configured in `.env` file
- `MONGO_URI` environment variable should be set
- Required models: Employee, Role, Status, BrokerAdmin

## Notes

- The script will skip creating accounts if an employee with the same email already exists
- All accounts are created with 'active' status
- The script automatically creates the 'Broker-Admin' role if it doesn't exist

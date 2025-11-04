const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const { Employee } = require('./models/Employee');

        // Find all employees with admin roles
        const admins = await Employee.find({})
            .populate(['employeeRole', 'employeeStatus'])
            .select('firstname lastname email employeeRole employeeStatus');

        console.log('\n=== All Employees ===');
        admins.forEach(emp => {
            console.log(`${emp.firstname} ${emp.lastname} (${emp.email}) - Role: ${emp.employeeRole?.role || 'No role'} - Status: ${emp.employeeStatus?.status || 'No status'}`);
        });

        // Check specifically for admin roles
        const adminRoles = admins.filter(emp => ['Admin', 'Super-admin'].includes(emp.employeeRole?.role));
        console.log('\n=== AMMC Admins ===');
        adminRoles.forEach(emp => {
            console.log(`${emp.firstname} ${emp.lastname} (${emp.email}) - Role: ${emp.employeeRole?.role}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUsers();
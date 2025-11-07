const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Script to add database indexes for performance optimization
 * Run this once to create indexes on frequently queried fields
 */

async function addDatabaseIndexes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        console.log('\n📊 Adding database indexes for performance optimization...\n');

        // PolicyRequest indexes
        console.log('Adding PolicyRequest indexes...');
        await db.collection('policyrequests').createIndex({ userId: 1, status: 1 });
        await db.collection('policyrequests').createIndex({ createdAt: -1 });
        await db.collection('policyrequests').createIndex({ 'propertyDetails.address': 'text' });
        console.log('✅ PolicyRequest indexes added');

        // Assignment indexes
        console.log('Adding Assignment indexes...');
        await db.collection('assignments').createIndex({ surveyorId: 1, status: 1 });
        await db.collection('assignments').createIndex({ policyId: 1 });
        await db.collection('assignments').createIndex({ organization: 1, status: 1 });
        await db.collection('assignments').createIndex({ createdAt: -1 });
        console.log('✅ Assignment indexes added');

        // DualAssignment indexes (already in model, but ensuring they exist)
        console.log('Adding DualAssignment indexes...');
        await db.collection('dualassignments').createIndex({ policyId: 1 }, { unique: true });
        await db.collection('dualassignments').createIndex({ completionStatus: 1, processingStatus: 1 });
        await db.collection('dualassignments').createIndex({ assignmentStatus: 1 });
        console.log('✅ DualAssignment indexes added');

        // MergedReport indexes (already in model, but ensuring they exist)
        console.log('Adding MergedReport indexes...');
        await db.collection('mergedreports').createIndex({ policyId: 1 }, { unique: true });
        await db.collection('mergedreports').createIndex({ releaseStatus: 1 });
        await db.collection('mergedreports').createIndex({ conflictDetected: 1 });
        await db.collection('mergedreports').createIndex({ createdAt: -1 });
        console.log('✅ MergedReport indexes added');

        // SurveySubmission indexes
        console.log('Adding SurveySubmission indexes...');
        await db.collection('surveysubmissions').createIndex({ surveyorId: 1, ammcId: 1 });
        await db.collection('surveysubmissions').createIndex({ status: 1 });
        await db.collection('surveysubmissions').createIndex({ organization: 1 });
        await db.collection('surveysubmissions').createIndex({ submissionTime: -1 });
        console.log('✅ SurveySubmission indexes added');

        // Employee indexes
        console.log('Adding Employee indexes...');
        await db.collection('employees').createIndex({ email: 1 }, { unique: true });
        await db.collection('employees').createIndex({ organization: 1 });
        await db.collection('employees').createIndex({ deleted: 1 });
        console.log('✅ Employee indexes added');

        // Surveyor indexes
        console.log('Adding Surveyor indexes...');
        await db.collection('surveyors').createIndex({ userId: 1 });
        await db.collection('surveyors').createIndex({ organization: 1, status: 1 });
        await db.collection('surveyors').createIndex({ 'profile.availability': 1 });
        console.log('✅ Surveyor indexes added');

        // User indexes
        console.log('Adding User indexes...');
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ createdAt: -1 });
        console.log('✅ User indexes added');

        console.log('\n✅ All database indexes added successfully!');
        console.log('\n📈 Performance improvements:');
        console.log('   - Faster query execution');
        console.log('   - Reduced database load');
        console.log('   - Better scalability');

    } catch (error) {
        console.error('❌ Error adding indexes:', error);
    } finally {
        await mongoose.disconnect();
    }
}

addDatabaseIndexes();

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function listUsers() {
  try {
    await mongoose.connect(process.env.ATLAS_URI, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB\n');
    
    const users = await User.find({}).lean();
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('You may need to create a user first.');
      process.exit(0);
    }
    
    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });
    
    const doctors = users.filter(u => u.role === 'DOCTOR');
    if (doctors.length > 0) {
      console.log('\n--- DOCTORS ONLY ---');
      doctors.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.name || 'No name'} (${doc.email})`);
        console.log(`   Doctor ID: ${doc._id}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No doctors found. You may need to create a doctor user.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

listUsers();

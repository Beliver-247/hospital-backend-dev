import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

const users = [
  {
    name: 'Dr. John Smith',
    email: 'doctor@hospital.com',
    passwordHash: '', // Will be set below
    role: 'DOCTOR',
    doctorType: 'Cardiologist'
  },
  {
    name: 'Dr. Sarah Williams',
    email: 'sarah.williams@hospital.com',
    passwordHash: '',
    role: 'DOCTOR',
    doctorType: 'Pediatric'
  },
  {
    name: 'Admin User',
    email: 'admin@hospital.com',
    passwordHash: '',
    role: 'STAFF'
  },
  {
    name: 'Patient User',
    email: 'patient@example.com',
    passwordHash: '',
    role: 'PATIENT'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.ATLAS_URI, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB');
    
    // Hash passwords
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    for (const user of users) {
      user.passwordHash = hashedPassword;
    }
    
    // Clear existing users (optional - comment out if you want to keep existing data)
    await User.deleteMany({});
    console.log('✅ Cleared existing users');
    
    // Insert new users
    const result = await User.insertMany(users);
    console.log(`✅ Seeded ${result.length} users successfully\n`);
    
    console.log('User Details:');
    console.log('='.repeat(60));
    result.forEach(u => {
      console.log(`\n${u.name}`);
      console.log(`  ID: ${u._id}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Password: password123`);
      console.log(`  Role: ${u.role}`);
      if (u.doctorType) console.log(`  Doctor Type: ${u.doctorType}`);
    });
    console.log('\n' + '='.repeat(60));
    
    const doctors = result.filter(u => u.role === 'DOCTOR');
    if (doctors.length > 0) {
      console.log('\n🩺 DOCTOR IDs (use these for payment doctorId):');
      doctors.forEach(doc => {
        console.log(`  - ${doc.name}: ${doc._id}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();

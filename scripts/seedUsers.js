

// scripts/seedUsers.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import env from '../src/config/env.js';

dotenv.config();

// Define all users to seed here
const users = [
  {
    email: 'doctor@hospital.com',
    name: 'Dr. John Smith',
    role: 'DOCTOR',
    password: 'password123',
    doctorType: 'Cardiologist'
  },
  {
    email: 'sarah.williams@hospital.com',
    name: 'Dr. Sarah Williams',
    role: 'DOCTOR',
    password: 'password123',
    doctorType: 'Pediatric'
  },
  {
    email: 'admin@hospital.com',
    name: 'Admin User',
    role: 'STAFF',
    password: 'password123'
  },
  {
    email: 'patient@example.com',
    name: 'Patient User',
    role: 'PATIENT',
    password: 'password123'
  },
  {
    email: 'thassaramadusha@gmail.com',
    name: 'John Patient',
    role: 'PATIENT',
    password: 'secret'
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(env.atlasUri, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB (hospital-db)');

    // Remove all existing users (optional: comment out if you want to keep existing)
    await User.deleteMany({});
    console.log('🧹 Cleared existing users');

    for (const u of users) {
      // Hash password
      const passwordHash = await bcrypt.hash(u.password, 10);
      // Prepare user object
      const userObj = {
        email: u.email,
        passwordHash,
        role: u.role,
        name: u.name
      };
      if (u.doctorType) userObj.doctorType = u.doctorType;

      await User.create(userObj);
      console.log(`✅ Created ${u.role} user: ${u.email} (password: ${u.password})`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
    console.log('🎉 User seeding complete!');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seedUsers();

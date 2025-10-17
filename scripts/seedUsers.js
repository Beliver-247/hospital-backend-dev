// scripts/seedUsers.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import env from '../src/config/env.js';

dotenv.config();

async function seedUsers() {
  try {
    await mongoose.connect(env.atlasUri, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB (hospital-db)');

    const users = [
      {
        email: 'doc@example.com',
        name: 'Dr. Example',
        role: 'DOCTOR',
        password: 'secret'
      },
      {
        email: 'staff@example.com',
        name: 'Staff Member',
        role: 'STAFF',
        password: 'secret'
      },
      {
        email: 'patient@example.com',
        name: 'John Patient',
        role: 'PATIENT',
        password: 'secret'
      }
    ];

    for (const u of users) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`⚠️ User already exists: ${u.email}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(u.password, 10);
      await User.create({
        email: u.email,
        passwordHash,
        role: u.role,
        name: u.name
      });
      console.log(`✅ Created ${u.role} user: ${u.email} (password: ${u.password})`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seedUsers();

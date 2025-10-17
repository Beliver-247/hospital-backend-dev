// scripts/seedUser.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import env from '../src/config/env.js';

dotenv.config();

async function main() {
  try {
    await mongoose.connect(env.atlasUri, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB (hospital-db)');

    const email = 'doc@example.com';
    const plainPassword = 'secret'; // change if you want
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await User.create({
      email,
      passwordHash,
      role: 'DOCTOR',
      name: 'Dr. Example'
    });

    console.log('✅ User created successfully:');
    console.log({ email, password: plainPassword, role: user.role });

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

main();

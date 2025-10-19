// src/scripts/seedPaymentTypes.js
import mongoose from 'mongoose';
import PaymentType from '../src/models/payments/PaymentType.js';
import dotenv from 'dotenv';
dotenv.config();

async function seedPaymentTypes() {
  if (!process.env.ATLAS_URI) {
    console.error('Error: ATLAS_URI is not set in environment variables.');
    process.exit(1);
  }
  await mongoose.connect(process.env.ATLAS_URI, { dbName: 'hospital-db' });
  console.log('✅ Connected to MongoDB (hospital-db)');
  const types = [
    { type: 'card', description: 'Credit or debit card payment' },
    { type: 'cash', description: 'Cash payment at hospital' },
    { type: 'insurance', description: 'Insurance payment' }
  ];
  for (const t of types) {
    await PaymentType.updateOne({ type: t.type }, t, { upsert: true });
    console.log(`✅ Seeded payment type: ${t.type}`);
  }
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
  console.log('🎉 PaymentType seeding complete!');
}

seedPaymentTypes();
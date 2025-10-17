import mongoose from 'mongoose';
import env from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  // IMPORTANT: we use your selected database name here
  await mongoose.connect(env.atlasUri, {
    dbName: 'hospital-db',
  });

  console.log('✅ MongoDB connected (hospital-db)');
}

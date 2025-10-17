import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

beforeAll(async () => {
  // ensure uploads dir exists for upload tests
  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const uri = process.env.ATLAS_URI;
  const dbName = process.env.TEST_DB_NAME || 'hospital-db-test';
  if (!uri) throw new Error('ATLAS_URI not set in env');

  await mongoose.connect(uri, { dbName });
});

afterEach(async () => {
  // clean all collections to keep tests isolated
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

import 'dotenv/config';
import mongoose from 'mongoose';
import Patient from '../src/models/Patient.js';

const patients = [
  {
    patientId: 'P001',
    personal: {
      firstName: 'Thassara',
      lastName: 'Madusha',
      nic: '199812345678',
      dob: '1998-05-15',
      gender: 'MALE'
    },
    contact: {
      email: 'thassaramadusha@gmail.com',
      phone: '0712345678',
      address: '123 Main St, Colombo'
    }
  },
  {
    patientId: 'P002',
    personal: {
      firstName: 'Jane',
      lastName: 'Smith',
      nic: '199512345679',
      dob: '1995-08-20',
      gender: 'FEMALE'
    },
    contact: {
      email: 'jane.smith@example.com',
      phone: '0723456789',
      address: '456 Park Ave, Kandy'
    }
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.ATLAS_URI, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB');
    
    // Clear existing patients (optional - comment out if you want to keep existing data)
    await Patient.deleteMany({});
    console.log('✅ Cleared existing patients');
    
    // Insert new patients
    const result = await Patient.insertMany(patients);
    console.log(`✅ Seeded ${result.length} patients successfully`);
    console.log('Patient IDs:');
    result.forEach(p => {
      console.log(`  - ${p.personal.firstName} ${p.personal.lastName}: ${p._id} (${p.contact.email})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();

import 'dotenv/config';
import mongoose from 'mongoose';
import Payment from '../src/models/payments/Payment.js';

async function listPayments() {
  try {
    await mongoose.connect(process.env.ATLAS_URI, { dbName: 'hospital-db' });
    console.log('✅ Connected to MongoDB\n');
    
    const payments = await Payment.find({})
      .populate('customer.userId', 'name email')
      .populate('customer.patientId', 'personal.firstName personal.lastName contact.email')
      .populate('doctorId', 'name email')
      .lean();
    
    if (payments.length === 0) {
      console.log('❌ No payments found in database');
      console.log('Create a payment first using POST /api/payments/card/initiate');
      process.exit(0);
    }
    
    console.log(`Found ${payments.length} payment(s):\n`);
    console.log('='.repeat(80));
    
    payments.forEach((payment, index) => {
      console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Method: ${payment.method}`);
      console.log(`   Currency: ${payment.currency}`);
      console.log(`   📊 TOTAL AMOUNT: ${payment.totalAmount}`);
      console.log(`   💰 BREAKDOWN:`);
      console.log(`      - Consultation Fee: ${payment.breakdown.consultationFee}`);
      console.log(`      - Lab Tests: ${payment.breakdown.labTests}`);
      console.log(`      - Prescription: ${payment.breakdown.prescription}`);
      console.log(`      - Processing Fee: ${payment.breakdown.processingFee}`);
      console.log(`      - Other: ${payment.breakdown.other}`);
      
      if (payment.customer?.patientId) {
        const patient = payment.customer.patientId;
        console.log(`   👤 Patient: ${patient.personal?.firstName} ${patient.personal?.lastName} (${patient.contact?.email})`);
      }
      
      if (payment.doctorId) {
        console.log(`   🩺 Doctor: ${payment.doctorId.name} (${payment.doctorId.email})`);
      }
      
      if (payment.card) {
        console.log(`   💳 Card: **** **** **** ${payment.card.last4} (${payment.card.brand})`);
      }
      
      console.log(`   📅 Created: ${payment.createdAt}`);
      console.log(`   Notes: ${payment.notes || 'None'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

listPayments();

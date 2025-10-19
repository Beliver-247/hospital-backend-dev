# Payment OTP Email - Complete Setup Guide

## Changes Made

### 1. Payment Model (`src/models/payments/Payment.js`)
- ✅ Added `doctorId` field to link payments to doctors

### 2. Payment Service (`src/services/payments/cardPayment.service.js`)
- ✅ Added `doctorId` parameter to `initiate()` method
- ✅ Now sends OTP notification with full payment details (breakdown, doctor, patient info)
- ✅ Creates payment first, then generates OTP and updates the payment

### 3. OTP Service (`src/services/payments/otp.service.js`)
- ✅ Removed duplicate notification call (now handled in cardPayment service)

### 4. Notification Service (`src/services/notify.service.js`)
- ✅ Email template includes:
  - Patient name (from Patient model)
  - Doctor name (from User model via doctorId)
  - Full fee breakdown (consultation, lab tests, prescription, processing fee, other)
  - Total amount and currency
  - OTP code

### 5. Validator (`src/validators/paymentSchemas.js`)
- ✅ Added `doctorId` as optional field in `initiateCardPaymentSchema`

### 6. Controller (`src/controllers/payment.controller.js`)
- ✅ Now accepts and passes `doctorId` to the service

### 7. Environment Config (`.env`)
- ✅ Added `NOTIFY_ENABLED=true` to enable notifications
- ✅ Added `NOTIFY_DRIVER=smtp` to use email instead of console logging
- ✅ SMTP settings already configured for Gmail

### 8. Patient Seed Script (`scripts/seedPatients.js`)
- ✅ Created script to seed test patients including:
  - Thassara Madusha (thassaramadusha@gmail.com)
  - Jane Smith (jane.smith@example.com)

---

## How to Test

### Step 1: Fix MongoDB Connection
Your MongoDB Atlas connection is failing. You need to:
1. **Check if your cluster exists** in MongoDB Atlas dashboard
2. **Verify the connection string** in `.env` file
3. **Check your IP whitelist** in Atlas (Network Access)
4. **Or use a local MongoDB** instance if you have one installed

### Step 2: Seed Patients
Once MongoDB is connected, run:
```cmd
node scripts\seedPatients.js
```
This will create test patients in your database.

### Step 3: Restart Your Server
```cmd
npm start
```

### Step 4: Get Auth Token
Login to get a JWT token:
```
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "your_user@example.com",
  "password": "your_password"
}
```

### Step 5: Initiate Card Payment with Doctor and Patient Info
```
POST http://localhost:4000/api/payments/card/initiate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "breakdown": {
    "consultationFee": 1000,
    "labTests": 500,
    "prescription": 250,
    "processingFee": 50,
    "other": 100
  },
  "currency": "LKR",
  "card": {
    "number": "4242424242424242",
    "expMonth": 12,
    "expYear": 2027,
    "cvc": "123",
    "name": "Test Card",
    "brand": "VISA"
  },
  "patientId": "<PATIENT_ID_FROM_SEED_SCRIPT>",
  "doctorId": "<DOCTOR_USER_ID>",
  "notes": "OPD visit"
}
```

**Important:** Replace `<PATIENT_ID_FROM_SEED_SCRIPT>` with the actual patient ID returned from the seed script, and `<DOCTOR_USER_ID>` with a valid doctor user ID from your User collection.

### Step 6: Check Email
The OTP email will be sent to `thassaramadusha@gmail.com` (the patient's email) and will include:
- Patient name: "Thassara Madusha"
- Doctor name: (from the User with doctorId)
- Consultation Fee: 1000
- Lab Tests: 500
- Prescription: 250
- Processing Fee: 50
- Other: 100
- Total: 1900 LKR
- OTP Code: 6-digit code

---

## Troubleshooting

### MongoDB Connection Issues
**Error:** `querySrv ENOTFOUND _mongodb._tcp.cluster0.wafmrnz.mongodb.net`

**Solutions:**
1. Check MongoDB Atlas dashboard - make sure cluster exists
2. Verify connection string format in `.env`:
   ```
   ATLAS_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority
   ```
3. Add your IP address to Atlas whitelist (Network Access → Add IP Address)
4. Try using a local MongoDB: `ATLAS_URI=mongodb://localhost:27017/hospital`

### Email Not Sending
**Check:**
1. `.env` has `NOTIFY_ENABLED=true` and `NOTIFY_DRIVER=smtp`
2. SMTP credentials are correct
3. Gmail App Password is valid (not your regular password)
4. Check server console for nodemailer errors

### Missing Doctor Name in Email
**Ensure:**
1. You provide a valid `doctorId` in the payment initiate request
2. The `doctorId` corresponds to an existing User in your database
3. That User document has a `name` field

### Missing Patient Name in Email
**Ensure:**
1. You provide a valid `patientId` in the payment initiate request
2. The patient exists in the database (run seed script)
3. Patient has `personal.firstName` and `personal.lastName` fields

---

## Summary

All the code changes have been made to:
✅ Enable real email sending via SMTP
✅ Include patient name, doctor name, and full fee breakdown in OTP emails
✅ Accept and store `doctorId` in payment records
✅ Create test patients for testing

**Next Steps:**
1. Fix your MongoDB connection issue
2. Run the patient seed script
3. Restart your server
4. Test the payment flow with a valid patientId and doctorId
5. Check thassaramadusha@gmail.com for the OTP email with all details

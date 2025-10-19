# Payments API (Card + OTP)

This document describes the payment module for card payments with OTP verification. It follows SOLID principles and integrates with authentication (Bearer JWT). All endpoints are under the `/api` prefix.

## Table of contents
- Overview
- Security and environment
- Domain model
- Status flow
- Validation rules
- Endpoints (with examples)
- Postman collection

---

## Overview

Components:
- `Payment` base model using Mongoose discriminators (method: CARD/CASH/INSURANCE)
- `CardPayment` extends Payment with masked card details and OTP linkage
- `Otp` model to store hashed OTP codes with expiry and consumption tracking
- Services: `PaymentService`, `CardPaymentService`, `otp.service`
- Routes mounted at `/api/payments`

Key behaviors:
- Raw PAN/CVC never stored; only last4, brand, and a placeholder `token` are persisted
- OTP is generated (hashed), has a TTL, and is single-use
- Each payment is owned by the logged-in user via `customer.userId`
- Optionally link captured payments to a `Patient` via `customer.patientId` and `Patient.payments[]`

---

## Security and environment

Authentication
- Use Bearer JWT for all payment endpoints
- Obtain token via `POST /api/auth/login`

Environment variables (optional but helpful for dev)
- `OTP_TTL_MIN` (default 5) – OTP expiry time in minutes
- `NOTIFY_ENABLED=true` and `NOTIFY_DRIVER=console` – logs OTP and payment events to console (dev only)

---

## Domain model (simplified)

Payment (base)
- method: `CARD | CASH | INSURANCE`
- status: `PENDING | AUTHORIZED | CAPTURED | FAILED | REFUNDED | CANCELLED`
- currency: string (default: `LKR`)
- totalAmount: number
- breakdown: { consultationFee, labTests, prescription, processingFee, other }
- customer: { userId: ObjectId(User), patientId?: ObjectId(Patient) }
- notes?: string

CardPayment (extends Payment)
- card: { last4, brand, token }
- otpRefId: ObjectId(Otp)
- authorizedAt?: Date
- capturedAt?: Date

Otp
- purpose: `'PAYMENT'`
- codeHash: string (bcrypt)
- target: string (e.g., email)
- meta: object (e.g., last4, amount)
- expiresAt: Date
- consumedAt?: Date

---

## Status flow
1) Initiate: create Payment with `status=PENDING` and send OTP
2) Confirm: verify OTP, then set `status=CAPTURED` (and set timestamps)
3) Optional updates: allow `CANCELLED` or `REFUNDED` via PATCH (business-only in this implementation)

---

## Validation rules (high-level)

Breakdown object
- consultationFee, labTests, prescription, processingFee: number ≥ 0 (required)
- other: number ≥ 0 (default 0)

Card
- number (credit card), expMonth (1–12), expYear (≥ current year), cvc (3–4 digits), name (string), brand (string)

Confirm
- otpRefId: ObjectId
- otpCode: 6-digit numeric

List query
- page (default 1), limit (1–100, default 20)
- method (CARD|CASH|INSURANCE), status, from (ISO date), to (ISO date)

---

## Endpoints

All paths below are prefixed with `/api`.

### 0) Auth – Login (to get token)

POST `/auth/login`
- Body
  {
    "email": "patient@example.com",
    "password": "secret"
  }
- Response 200
  {
    "token": "<jwt>",
    "user": { "id": "...", "email": "patient@example.com", "role": "PATIENT", "name": "John Patient" }
  }

Use `Authorization: Bearer <token>` for the endpoints below.

### 1) Initiate card payment (send OTP)

POST `/payments/card/initiate`
- Headers: Authorization: Bearer <token>
- Body
  {
    "breakdown": {
      "consultationFee": 1000,
      "labTests": 500,
      "prescription": 250,
      "processingFee": 50,
      "other": 0
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
    "patientId": "68f34abc1234567890fedcba",
    "notes": "OPD visit"
  }
- Response 201
  {
    "paymentId": "68f34d0e6df27136713c97f7",
    "otpRefId": "68f34d0e6df27136713c97f6",
    "devOtpCode": "123456" // dev only (console driver, non-production)
  }

### 2) Confirm card payment (verify OTP and capture)

POST `/payments/card/:paymentId/confirm`
- Headers: Authorization: Bearer <token>
- Body
  {
    "otpRefId": "68f34d0e6df27136713c97f6",
    "otpCode": "123456"
  }
- Response 200
  {
    "payment": {
      "_id": "68f34d0e6df27136713c97f7",
      "method": "CARD",
      "status": "CAPTURED",
      "currency": "LKR",
      "totalAmount": 1800,
      "breakdown": { "consultationFee": 1000, "labTests": 500, "prescription": 250, "processingFee": 50, "other": 0 },
      "customer": { "userId": "68f34...", "patientId": "68f34..." },
      "card": { "last4": "4242", "brand": "VISA", "token": "tok_4242_..." },
      "otpRefId": "68f34d0e...",
      "authorizedAt": "2025-10-18T07:58:25.123Z",
      "capturedAt": "2025-10-18T07:58:25.123Z"
    }
  }
- Errors 400/404
  - `{"message": "OTP NOT_FOUND|INVALID|EXPIRED|ALREADY_USED"}`
  - `{"message": "Mismatched OTP reference"}`
  - `{"message": "Payment not found"}`

### 3) List my payments

GET `/payments/me`
- Headers: Authorization: Bearer <token>
- Query (optional): `method=CARD&status=CAPTURED&from=2025-10-01&to=2025-10-31&page=1&limit=20`
- Response 200
  {
    "items": [ { "_id": "...", "method": "CARD", "status": "CAPTURED", ... } ],
    "total": 1,
    "page": 1,
    "limit": 20
  }

### 4) Get payment by id (owned by current user)

GET `/payments/:id`
- Headers: Authorization: Bearer <token>
- Response 200: Payment JSON
- Errors 404: `{"message": "Payment not found"}`

### 5) Update a payment (notes / status)

PATCH `/payments/:id`
- Headers: Authorization: Bearer <token>
- Body (one or both fields)
  { "notes": "Updated note" }
  { "status": "CANCELLED" }  // or REFUNDED
- Response 200: Updated payment JSON
- Errors 404: `{"message": "Payment not found"}`

### 6) Delete a payment

DELETE `/payments/:id`
- Headers: Authorization: Bearer <token>
- Response 204 No Content
- Errors 404: `{"message": "Payment not found"}`

---

## Postman collection

A ready-to-import Postman collection is included at:
- `docs/postman/hospital-payments.postman_collection.json`

Usage:
1) Import the JSON into Postman
2) Set a variable `baseUrl = http://localhost:4000/api`
3) Login first, copy the token
4) Set a collection or environment variable `token = <your JWT>`
5) Run the requests in order: Initiate → Confirm → Me → Get by Id → Patch → Delete

---

## Notes

- In development (console driver + non-production), `devOtpCode` is returned by `/payments/card/initiate` for testing convenience
- In production, you’ll integrate email/SMS and omit `devOtpCode` from responses
- To support `CASH` and `INSURANCE`, add corresponding services/controllers following the same base `Payment` contract

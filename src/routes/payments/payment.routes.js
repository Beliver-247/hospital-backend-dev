import { Router } from 'express';
import {
  initiateCard,
  confirmCard,
  getMyPayments,
  updatePayment,
  deletePayment,
  getPaymentById,
  downloadReceipt
} from '../../controllers/payments/payment.controller.js';

const router = Router();

// Initiate card payment (sends OTP)
router.post('/card/initiate', ...initiateCard);

// Confirm card payment with OTP
router.post('/card/:paymentId/confirm', ...confirmCard);

// List current user's payments
router.get('/me', ...getMyPayments);

// Update or delete a payment (own payments only)
router.patch('/:id', ...updatePayment);
router.delete('/:id', ...deletePayment);

// Get a single payment by id (own payments only)
router.get('/:id', ...getPaymentById);

// Download receipt PDF for a payment (own payments only)
router.get('/:id/receipt', ...downloadReceipt);

export default router;

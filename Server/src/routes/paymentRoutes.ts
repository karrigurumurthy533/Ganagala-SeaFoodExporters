import { Router } from 'express';
import {
  createPaymentOrder,
  getPaymentStatus,
  handleCashfreeWebhook,
} from '../controllers/paymentController.js';

const router = Router();

router.post('/orders', createPaymentOrder);
router.get('/orders/:orderId', getPaymentStatus);
router.post('/webhook', handleCashfreeWebhook);

export default router;

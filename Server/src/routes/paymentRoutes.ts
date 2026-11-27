import { Router } from 'express';
import {
  createPaymentOrder,
  getPaymentStatus,
  paymentCallback,
} from '../controllers/paymentController.js';

const router = Router();

router.post('/orders', createPaymentOrder);
router.get('/orders/:orderId', getPaymentStatus);
router.post('/callback', paymentCallback);

export default router;

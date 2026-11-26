import { Router } from 'express';
import {
  createPaymentOrder,
  getPaymentStatus,
} from '../controllers/paymentController.js';

const router = Router();

router.post('/orders', createPaymentOrder);
router.get('/orders/:orderId', getPaymentStatus);

export default router;

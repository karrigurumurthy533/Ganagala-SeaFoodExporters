import { Router } from 'express';
import {
  createPaymentOrder,
  getPaymentStatus,
  paymentCallback,
  paymentCallbackBrowserReturn,
  paymentWebhook,
} from '../controllers/paymentController.js';

const router = Router();

router.post('/orders', createPaymentOrder);
router.get('/orders/:orderId', getPaymentStatus);
router.post('/callback', paymentCallback);
router.get('/callback', paymentCallbackBrowserReturn);
router.post('/webhook', paymentWebhook);

export default router;

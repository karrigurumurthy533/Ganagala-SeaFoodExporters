import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';
import paymentRoutes from './routes/paymentRoutes.js';

dotenv.config();

console.log({
  appIdLoaded: !!process.env.CASHFREE_APP_ID,
  secretLoaded: !!process.env.CASHFREE_SECRET_KEY,
  environment: process.env.CASHFREE_ENV,
  appIdLength: process.env.CASHFREE_APP_ID?.trim().length,
});
const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'https://ganagalaseafoodexporters.com').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/payments', paymentRoutes);
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Request failed:', error);
  res.status(500).json({ message: 'Internal server error' });
});
const port = Number(process.env.PORT || 5000);
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => app.listen(port, () => console.log(`Server listening on ${port}`))).catch((error: unknown) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
}
export default app;

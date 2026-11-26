import mongoose, { Schema } from 'mongoose';

const paymentSchema = new Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  cfOrderId: String,
  paymentSessionId: String,
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, required: true, lowercase: true, trim: true },
  country: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, default: 'INR' },
  cashfreePaymentId: { type: String, sparse: true, unique: true },
  status: { type: String, enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'], default: 'CREATED', index: true },
  paymentDate: Date,
  rawStatus: String,
  lastWebhookEvent: String,
  processedWebhookEvents: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);







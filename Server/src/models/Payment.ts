import mongoose, { Schema } from 'mongoose';

const paymentSchema = new Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  payglocalGid: { type: String, sparse: true, unique: true },
  customerName: { type: String, trim: true },
  customerEmail: { type: String, lowercase: true, trim: true },
  customerPhone: { type: String, trim: true },
  country: { type: String, trim: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, default: 'INR' },
  status: { type: String, enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'], default: 'PENDING', index: true },
  paymentDate: Date,
  rawStatus: String,
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);







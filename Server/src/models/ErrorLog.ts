import mongoose, { Schema } from 'mongoose';

const errorLogSchema = new Schema({
  context: { type: String, required: true, index: true },
  name: { type: String, required: true },
  message: { type: String, required: true },
  stack: { type: String },
  details: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.models.ErrorLog || mongoose.model('ErrorLog', errorLogSchema);
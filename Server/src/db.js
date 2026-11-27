import mongoose from 'mongoose';
import { logError } from './utils/errorLogger.js';

export default async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');
  mongoose.connection.on('error', (error) => logError('MongoDB connection error', error));
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

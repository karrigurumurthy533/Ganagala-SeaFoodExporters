import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import ErrorLog from '../models/ErrorLog.js';

const logFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../logs/errors.log');

function errorFields(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'NonErrorThrown', message: String(error), stack: undefined };
}

export function logError(context: string, error: unknown, details: Record<string, unknown> = {}) {
  const entry = {
    context,
    ...errorFields(error),
    details,
  };

  console.error(`[${context}]`, entry);
  try {
    appendFileSync(logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, 'utf8');
  } catch (writeError) {
    console.error('Could not persist error log to file:', writeError);
  }

  if (mongoose.connection.readyState === 1) {
    void ErrorLog.create(entry).catch((storeError: unknown) => {
      console.error('Could not persist error log to MongoDB:', storeError);
    });
  }
}
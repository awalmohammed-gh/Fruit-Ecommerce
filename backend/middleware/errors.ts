import type { ErrorRequestHandler } from 'express';
export class HttpError extends Error {
  // `details` are extra fields for the JSON response, e.g. which account type a 401 is about.
  constructor(public status: number, message: string, public details: Record<string, unknown> = {}) { super(message); }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return void res.status(409).json({ message: error.keyPattern?.email ? 'This email is already registered' : 'This record already exists' });
  if (error.name === 'ValidationError' || error.name === 'CastError') return void res.status(400).json({ message: 'Please provide valid field values' });
  if (error.name === 'VersionError') return void res.status(409).json({ message: 'Your details changed in another request. Please refresh and try again.' });
  if (error.type === 'entity.parse.failed') return void res.status(400).json({ message: 'Invalid JSON body' });
  if (error.name === 'MulterError') return void res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Images must be 2 MB or smaller' : 'Upload a single image file' });
  if (error.type === 'entity.too.large') return void res.status(413).json({ message: 'Request is too large' });
  if (!error.status) console.error('Request failed:', error.name);
  res.status(error.status || 500).json(error.status ? { message: error.message, ...error.details } : { message: 'Something went wrong. Please try again.' });
};

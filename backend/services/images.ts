import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary.js';
import { HttpError } from '../middleware/errors.js';

// Shared Cloudinary transport for storefront content and authenticated profile photos.
export async function uploadImage(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  if (!cloudinary.config().cloud_name) throw new HttpError(503, 'Image uploads are not configured on the server. Please try again later.');
  try {
    return await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload_stream({ ...options, resource_type: 'image' }, (error, uploaded) =>
        error || !uploaded ? reject(error ?? new Error('Upload failed')) : resolve(uploaded)).end(buffer);
    });
  } catch { throw new HttpError(502, 'The image could not be uploaded. Please try again.'); }
}

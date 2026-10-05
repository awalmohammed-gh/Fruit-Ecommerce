import type { Request, Response } from 'express';
import User, { safeUser } from '../models/User.js';
import { bodyObject } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';
import { uploadImage } from '../services/images.js';

const IMAGE_MAX = 5 * 1024 * 1024;
function validateImage(file: Express.Multer.File | undefined) {
  if (!file) throw new HttpError(400, 'Choose a photo to upload');
  if (file.size > IMAGE_MAX) throw new HttpError(413, 'Photos must be 5 MB or smaller');
  const bytes = file.buffer;
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR';
  const jpg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(file.mimetype === 'image/png' && png || file.mimetype === 'image/jpeg' && jpg || file.mimetype === 'image/webp' && webp))
    throw new HttpError(400, 'Choose a valid JPG, PNG or WebP image');
  return file;
}
async function save(req: Request, res: Response, fields: Record<string, unknown>, message: string) {
  const user = await User.findOneAndUpdate({ _id: req.user._id, isActive: true }, { $set: fields }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new HttpError(401, 'Please sign in again', { account: 'customer' });
  res.json({ message, user: safeUser(user) });
}
export const customerSettingsController = {
  avatar: async (req: Request, res: Response) => {
    const file = validateImage(req.file);
    const uploaded = await uploadImage(file.buffer, {
      folder: 'greenfarm/avatars', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
    });
    await save(req, res, { avatar: uploaded.secure_url }, 'Profile photo updated');
  },
  removeAvatar: async (req: Request, res: Response) => { await save(req, res, { avatar: '' }, 'Profile photo removed'); },
  preferences: async (req: Request, res: Response) => {
    bodyObject(req.body);
    const fields: Record<string, unknown> = {};
    if (req.body.productSort !== undefined) {
      if (typeof req.body.productSort !== 'string' || !['newest', 'rating', 'price_asc', 'price_desc', 'name'].includes(req.body.productSort)) throw new HttpError(400, 'Choose a supported product sort order');
      fields['preferences.productSort'] = req.body.productSort;
    }
    if (req.body.notifications !== undefined) {
      bodyObject(req.body.notifications);
      for (const [key, value] of Object.entries(req.body.notifications)) {
        if (!['order', 'account', 'promotion', 'system'].includes(key) || typeof value !== 'boolean') throw new HttpError(400, 'Invalid notification preference');
        fields[`preferences.notifications.${key}`] = value;
      }
    }
    if (!Object.keys(fields).length) throw new HttpError(400, 'Provide preferences to update');
    await save(req, res, fields, 'Preferences saved');
  },
};

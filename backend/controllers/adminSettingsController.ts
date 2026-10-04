import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import AdminSettings from '../models/AdminSettings.js';
import { adminProfile, adminVersion, endAllSessions, isAdminLogin, startAdminSession, storedAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import * as validate from '../middleware/validate.js';
import { signInLock } from '../middleware/rateLimit.js';
import type { AppConfig } from '../types.js';

const OPTIONS = {
  appearance: ['light', 'dark', 'system'], sidebar: ['expanded', 'collapsed'], tableDensity: ['comfortable', 'compact'],
  pageSize: [10, 20, 50, 100], dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  timeFormat: ['12-hour', '24-hour'], currencyDisplay: ['symbol', 'code'],
} as const;

function onlyFields(body: unknown, allowed: readonly string[]) {
  validate.bodyObject(body);
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError(400, 'This form contains a field you cannot change');
}

export function adminSettingsController(config: AppConfig) {
  const attempts = signInLock('admin-password', config.loginLockout);
  return {
    profile: async (req: Request, res: Response) => {
      onlyFields(req.body, ['fullName', 'phone', 'avatar']);
      const fields = validate.profile(req.body, true);
      if (!Object.keys(fields).length) throw new HttpError(400, 'Provide profile details to update');
      const account = await AdminSettings.findOneAndUpdate({ email: req.admin.email }, { $set: fields }, { returnDocument: "after", runValidators: true });
      if (!account) throw new HttpError(404, 'Admin account not found');
      res.json({ message: 'Account updated successfully', admin: adminProfile(config, account) });
    },
    password: async (req: Request, res: Response) => {
      onlyFields(req.body, ['currentPassword', 'newPassword', 'confirmPassword']);
      const current = validate.password(req.body, 'currentPassword', false);
      const next = validate.password(req.body, 'newPassword');
      if (next !== req.body.confirmPassword) throw new HttpError(400, 'New passwords do not match');
      const key = req.admin.email;
      await attempts.check(res, key);
      const account = await storedAdmin(config);
      if (!account) throw new HttpError(404, 'Admin account not found');
      if (!(await isAdminLogin(config, key, current))) {
        await attempts.fail(key);
        throw new HttpError(400, 'Current password is incorrect');
      }
      await attempts.clear(key);
      if (current === next) throw new HttpError(400, 'Choose a different new password');
      account.passwordHash = await bcrypt.hash(next, 12);
      account.bootstrapVersion = adminVersion(config);
      await account.save();
      await endAllSessions('admin', req.admin._id);
      await startAdminSession(res, config);
      res.json({ message: 'Password changed. Other admin sessions have been signed out.' });
    },
    preferences: async (req: Request, res: Response) => {
      const account = await AdminSettings.findOne({ email: req.admin.email });
      if (!account) throw new HttpError(404, 'Admin account not found');
      res.json({ preferences: account.preferences });
    },
    savePreferences: async (req: Request, res: Response) => {
      onlyFields(req.body, Object.keys(OPTIONS));
      const values: Record<string, unknown> = {};
      for (const [key, choices] of Object.entries(OPTIONS)) {
        if (req.body[key] === undefined) continue;
        if (!(choices as readonly unknown[]).includes(req.body[key])) throw new HttpError(400, `Invalid ${key} preference`);
        values[`preferences.${key}`] = req.body[key];
      }
      if (!Object.keys(values).length) throw new HttpError(400, 'Provide preferences to update');
      const account = await AdminSettings.findOneAndUpdate({ email: req.admin.email }, { $set: values }, { returnDocument: "after", runValidators: true });
      if (!account) throw new HttpError(404, 'Admin account not found');
      res.json({ message: 'Preferences saved successfully', preferences: account.preferences });
    },
  };
}

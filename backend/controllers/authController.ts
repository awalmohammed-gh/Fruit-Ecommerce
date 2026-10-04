import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import User, { safeUser } from "../models/User.js";
import AdminSettings from "../models/AdminSettings.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { signInLock } from "../middleware/rateLimit.js";
import {
  startSession,
  endSession,
  endAllSessions,
  isAdminEmail,
  isAdminLogin,
  startAdminSession,
  adminProfile,
  adminVersion,
  restoreAdmin,
  restoreCustomer,
} from "../middleware/auth.js";
import type { AppConfig } from "../types.js";

// Compared against when the email isn't registered, so an unknown email takes as long as a wrong password.
const NO_ACCOUNT_HASH = bcrypt.hashSync("greenfarm-no-account", 12);

export function authController(config: AppConfig) {
  // Failed sign-ins per account, wherever they come from.
  const attempts = signInLock("sign-in", config.loginLockout);
  return {
    register: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const email = validate.email(req.body);
      const password = validate.password(req.body);
      const fields = validate.profile(req.body);
      if (isAdminEmail(config, email) || (await User.exists({ email })))
        throw new HttpError(409, "This email is already registered");
      const user = await User.create({ ...fields, email, password });
      await startSession(res, config, "customer", user._id, user.tokenVersion);
      res.status(201).json({ message: "Account created", user: safeUser(user) });
    },
    login: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const email = validate.email(req.body);
      const password = validate.password(req.body, "password", false);
      const key = `customer:${email}`;
      await attempts.check(res, key);
      // Customers only. The admin credentials are not accepted here; the admin signs in at /admin/login.
      const user = await User.findOne({ email }).select("+password +tokenVersion");
      const matches = await bcrypt.compare(password, user?.password ?? NO_ACCOUNT_HASH);
      if (!user || !matches) {
        await attempts.fail(key);
        throw new HttpError(401, "Email or password is incorrect");
      }
      await attempts.clear(key);
      if (!user.isActive) throw new HttpError(403, "This account is inactive");
      await startSession(res, config, "customer", user._id, user.tokenVersion);
      res.json({ message: "Signed in", user: safeUser(user) });
    },
    // The only way into the admin dashboard: the .env admin credentials, never a customer account.
    adminLogin: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const email = validate.email(req.body);
      const password = validate.password(req.body, "password", false);
      const key = `admin:${email}`;
      await attempts.check(res, key);
      if (!(await isAdminLogin(config, email, password))) {
        await attempts.fail(key);
        throw new HttpError(401, "Admin email or password is incorrect");
      }
      await attempts.clear(key);
      const account = await AdminSettings.findOneAndUpdate({ email: config.admin!.email }, {
        $set: { lastLoginAt: new Date() }, $setOnInsert: { bootstrapVersion: adminVersion(config) },
      }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
      await startAdminSession(res, config);
      res.json({ message: "Signed in", admin: adminProfile(config, account) });
    },
    // Restores the admin after a refresh; null when this browser has no admin sign-in.
    adminCurrent: async (req: Request, res: Response) => {
      res.json({ admin: await restoreAdmin(req, res, config) });
    },
    // Each sign-out ends only that account type's sign-in and clears only its cookie.
    adminLogout: async (req: Request, res: Response) => {
      await endSession(req, res, config, "admin");
      res.json({ message: "Signed out" });
    },
    logout: async (req: Request, res: Response) => {
      await endSession(req, res, config, "customer");
      res.json({ message: "Signed out" });
    },
    // Restores the customer after a refresh; null when this browser has no customer sign-in.
    current: async (req: Request, res: Response) => {
      const user = await restoreCustomer(req, res, config);
      res.json({ user: user ? safeUser(user) : null });
    },
    updateProfile: async (req: Request, res: Response) => {
      const fields = validate.profile(req.body, true);
      if (!Object.keys(fields).length)
        throw new HttpError(400, "Provide fullName, phone, or avatar to update");
      Object.assign(req.user, fields);
      await req.user.save();
      res.json({ message: "Profile updated", user: safeUser(req.user) });
    },
    changePassword: async (req: Request, res: Response) => {
      validate.bodyObject(req.body);
      const currentPassword = validate.password(req.body, "currentPassword", false);
      const newPassword = validate.password(req.body, "newPassword");
      const key = `password:${String(req.user._id)}`;
      await attempts.check(res, key);
      const user = await User.findById(req.user._id).select("+password +tokenVersion");
      if (!user || !user.isActive) throw new HttpError(401, "Please sign in again");
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        await attempts.fail(key);
        throw new HttpError(400, "Current password is incorrect");
      }
      await attempts.clear(key);
      if (currentPassword === newPassword) throw new HttpError(400, "Choose a different new password");
      user.password = newPassword;
      user.tokenVersion += 1;
      await user.save();
      // Sign out every other browser and device, then give this one a fresh sign-in.
      await endAllSessions("customer", user._id);
      await startSession(res, config, "customer", user._id, user.tokenVersion);
      res.json({ message: "Password changed. Other sessions have been signed out.", user: safeUser(user) });
    },
  };
}

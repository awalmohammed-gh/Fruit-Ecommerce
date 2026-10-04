import mongoose, { type ClientSession } from "mongoose";
import type { Request, Response } from "express";
import User, { type UserDocument } from "../models/User.js";
import Address, { safeAddress } from "../models/Address.js";
import * as validate from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";

function validId(req: Request) {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    throw new HttpError(400, "Invalid address ID");
}
async function snapshot(
  userId: mongoose.Types.ObjectId,
  session: ClientSession | null = null,
) {
  const user = await User.findById(userId).session(session);
  if (!user) throw new HttpError(401, "Please sign in again");
  const addresses = await Address.find({ user: userId })
    .sort({ createdAt: 1, _id: 1 })
    .session(session);
  return addresses.map((item) => safeAddress(item, user.defaultAddress));
}
async function mutate(
  userId: mongoose.Types.ObjectId,
  operation: (user: UserDocument, session: ClientSession) => Promise<void>,
) {
  return mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { $inc: { addressRevision: 1 } },
      { returnDocument: "after", session },
    );
    if (!user) throw new HttpError(401, "Please sign in again");
    await operation(user, session);
    await user.save({ session });
    return snapshot(userId, session);
  });
}
export const addressController = {
  list: async (req: Request, res: Response) => {
    res.json({ addresses: await snapshot(req.user._id) });
  },
  get: async (req: Request, res: Response) => {
    validId(req);
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!address) throw new HttpError(404, "Address not found");
    res.json({ address: safeAddress(address, req.user.defaultAddress) });
  },
  create: async (req: Request, res: Response) => {
    const { fields, makeDefault } = validate.address(req.body);
    const addresses = await mutate(req.user._id, async (user, session) => {
      const address = new Address({ ...fields, user: user._id });
      await address.save({ session });
      if (!user.defaultAddress || makeDefault)
        user.defaultAddress = address._id;
    });
    res.status(201).json({ message: "Address added", addresses });
  },
  update: async (req: Request, res: Response) => {
    validId(req);
    const { fields, makeDefault } = validate.address(req.body, true);
    const addresses = await mutate(req.user._id, async (user, session) => {
      const address = await Address.findOne({
        _id: req.params.id,
        user: user._id,
      }).session(session);
      if (!address) throw new HttpError(404, "Address not found");
      Object.assign(address, fields);
      await address.save({ session });
      if (makeDefault) user.defaultAddress = address._id;
    });
    res.json({ message: "Address updated", addresses });
  },
  remove: async (req: Request, res: Response) => {
    validId(req);
    const addresses = await mutate(req.user._id, async (user, session) => {
      const address = await Address.findOneAndDelete(
        { _id: req.params.id, user: user._id },
        { session },
      );
      if (!address) throw new HttpError(404, "Address not found");
      if (String(user.defaultAddress) === String(address._id)) {
        const replacement = await Address.findOne({ user: user._id })
          .sort({ createdAt: 1, _id: 1 })
          .session(session);
        user.defaultAddress = replacement?._id ?? null;
      }
    });
    res.json({ message: "Address deleted", addresses });
  },
  setDefault: async (req: Request, res: Response) => {
    validId(req);
    const addresses = await mutate(req.user._id, async (user, session) => {
      const address = await Address.findOne({
        _id: req.params.id,
        user: user._id,
      }).session(session);
      if (!address) throw new HttpError(404, "Address not found");
      user.defaultAddress = address._id;
    });
    res.json({ message: "Default address updated", addresses });
  },
};

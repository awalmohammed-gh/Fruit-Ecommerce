import mongoose from 'mongoose';
import User from '../models/User.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import DeliveryAssignment from '../models/DeliveryAssignment.js';
import Review from '../models/Review.js';
import Session from '../models/Session.js';
import RateLimit from '../models/RateLimit.js';
// dbName overrides the database in the URI; without either, MongoDB silently uses "test".
export async function connectDatabase(uri: string | undefined, dbName?: string) {
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...(dbName && { dbName }) });
  const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Use MongoDB Atlas or a replica set for atomic address updates');
  await User.init();
  await Address.init();
  await Product.init();
  await Category.init();
  await Order.init();
  // syncIndexes, not init: earlier versions had indexes that must go (a link to User, and a plain unique email
  // that is now unique among live applications only). Older records count as live until replaced.
  await DeliveryPartner.updateMany({ replaced: { $exists: false } }, { $set: { replaced: false } });
  await DeliveryPartner.syncIndexes();
  await DeliveryAssignment.init();
  await Review.init();
  await Session.init();
  await RateLimit.init();
  await addProductSlugs();
}

// Products created before readable addresses existed get their slug (from the name) once.
export async function addProductSlugs() {
  for (const product of await Product.find({ slug: { $exists: false } })) await product.save();
}

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
import Notification, { NotificationCounter } from '../models/Notification.js';
import NotificationReceipt from '../models/NotificationReceipt.js';
// dbName overrides the database in the URI; without either, MongoDB silently uses "test".
// The full startup: connect, then make sure indexes and one-off data fixes are in place. The long-running
// server (server.ts) and the tests wait for all of it before serving.
export async function connectDatabase(uri: string | undefined, dbName?: string) {
  await openDatabase(uri, dbName);
  await prepareDatabase();
}

/**
 * Only what a request needs: the connection, the replica-set check and the notification counter.
 * This is the critical path of a serverless cold start (serverless.ts), so it costs as few round trips as possible.
 * autoIndex false: Mongoose otherwise starts building every model's indexes the moment it connects, and each of
 * those calls opens another connection to the database, competing with the request's own queries.
 * prepareDatabase then builds them explicitly, after the response.
 */
export async function openDatabase(uri: string | undefined, dbName?: string, { autoIndex = true } = {}) {
  if (!uri) throw new Error('MONGODB_URI is required');
  // autoCreate follows autoIndex: it too sends one request per model on connect (createIndexes creates them later).
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex, autoCreate: autoIndex, ...(dbName && { dbName }) });
  // One after the other on the connection just opened: run side by side, the second would wait for a new connection
  // (TLS and sign-in, several round trips) instead of one round trip.
  const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Use MongoDB Atlas or a replica set for atomic address updates');
  await NotificationCounter.updateOne({ _id: 'feed' }, { $setOnInsert: { value: 0 } }, { upsert: true });
}

/**
 * Indexes and one-off data fixes. Every step is idempotent and, on an existing database, finds nothing to do,
 * yet it costs dozens of round trips and several connections; serverless.ts therefore runs it once per instance,
 * after the first response has been sent.
 */
export async function prepareDatabase() {
  // Independent collections: their index checks run side by side instead of one after another. With autoIndex off
  // (serverless.ts) init() would skip the indexes, so they are built explicitly.
  const autoIndex = mongoose.connection.get('autoIndex') !== false;
  await Promise.all([User, Address, Product, Category, Order, DeliveryAssignment, Review, Session, RateLimit, Notification, NotificationReceipt, NotificationCounter]
    .map(async (model) => { await (model as mongoose.Model<unknown>).init(); if (!autoIndex) await (model as mongoose.Model<unknown>).createIndexes(); }));
  // syncIndexes, not init: earlier versions had indexes that must go (a link to User, and a plain unique email
  // that is now unique among live applications only). Older records count as live until replaced.
  await DeliveryPartner.updateMany({ replaced: { $exists: false } }, { $set: { replaced: false } });
  await DeliveryPartner.syncIndexes();
  await addProductSlugs();
}

// Products created before readable addresses existed get their slug (from the name) once.
export async function addProductSlugs() {
  for (const product of await Product.find({ slug: { $exists: false } })) await product.save();
}

// Isolated API for browser verification. Does not load or use backend/.env.
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase } from '../config/database.js';

const database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.16' } });
await connectDatabase(database.getUri('greenfarm_browser_test'));
const app = createApp({ jwtSecret: randomBytes(48).toString('hex'), origins: ['http://localhost:5176'], authLimit: 1000, secureCookies: false, sameSite: 'lax' });
const server = app.listen(5001, () => console.log('Temporary browser-test API ready on port 5001'));
const stop = () => server.close(() => { void mongoose.disconnect().then(() => database.stop()).then(() => process.exit(0)); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

import express from "express";
import { waitUntil } from "@vercel/functions";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { connectCloudinary } from "./config/cloudinary.js";
import { cancelUnconfirmedOrders } from "./services/orders.js";

// Vercel entry point (the backend service's entrypoint in vercel.json). There is no long-running process, so the
// database connection is opened once per instance and reused, and the unconfirmed-order sweep that server.ts runs
// every 15 minutes runs at most that often per instance, after the response has been sent.
let ready: Promise<void> | undefined;
let lastSweep = 0;

function connect() {
  ready ??= connectDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME?.trim() || undefined)
    .then(() => connectCloudinary())
    .catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

const server = express();
server.disable("x-powered-by");
server.use(async (_req, res, next) => {
  try {
    await connect();
  } catch (error) {
    console.error("Unable to connect to the database:", error instanceof Error ? error.message : error);
    res.status(503).json({ message: "Service temporarily unavailable" });
    return;
  }
  if (Date.now() - lastSweep > 15 * 60_000) {
    lastSweep = Date.now();
    waitUntil(cancelUnconfirmedOrders()
      .then((count) => { if (count) console.log(`Cancelled ${count} unconfirmed order${count === 1 ? "" : "s"}`); })
      .catch(() => console.error("Unable to cancel unconfirmed orders")));
  }
  next();
});
server.use(createApp());

export default server;

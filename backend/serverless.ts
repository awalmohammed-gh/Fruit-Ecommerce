import express, { type Response } from "express";
import { waitUntil } from "@vercel/functions";
import { createApp } from "./app.js";
import { openDatabase, prepareDatabase } from "./config/database.js";
import { connectCloudinary } from "./config/cloudinary.js";
import { cancelUnconfirmedOrders } from "./services/orders.js";

// Vercel entry point (the backend service's entrypoint in vercel.json). There is no long-running process, so the
// database connection is opened once per instance and reused, and the unconfirmed-order sweep that server.ts runs
// every 15 minutes runs at most that often per instance, after the response has been sent.
//
// Cold starts: a request only waits for the connection itself (openDatabase). Index checks and one-off data
// fixes (prepareDatabase) find nothing to do on an existing database but cost many round trips and connections, so
// they run once per instance after the first response has been sent, instead of in front of it or alongside it.
let ready: Promise<void> | undefined;
let prepared = false;
let lastSweep = 0;

function connect() {
  ready ??= openDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME?.trim() || undefined, { autoIndex: false })
    .then(() => connectCloudinary())
    .catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

// Background work for this instance. Registered with waitUntil while the request's context is current, but it only
// starts once the response is done, so it never competes with the request for database connections.
function afterResponse(res: Response, task: () => Promise<unknown>) {
  waitUntil(new Promise<void>((resolve) => res.once("close", resolve)).then(task));
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
  if (!prepared) {
    prepared = true;
    afterResponse(res, () => prepareDatabase().catch((error: unknown) => {
      prepared = false;
      console.error("Unable to prepare the database:", error instanceof Error ? error.message : error);
    }));
  }
  if (Date.now() - lastSweep > 15 * 60_000) {
    lastSweep = Date.now();
    afterResponse(res, () => cancelUnconfirmedOrders()
      .then((count) => { if (count) console.log(`Cancelled ${count} unconfirmed order${count === 1 ? "" : "s"}`); })
      .catch(() => console.error("Unable to cancel unconfirmed orders")));
  }
  next();
});
server.use(createApp());

export default server;

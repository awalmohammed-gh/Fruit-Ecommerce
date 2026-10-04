import "dotenv/config";

import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { connectCloudinary } from "./config/cloudinary.js";
import { cancelUnconfirmedOrders } from "./services/orders.js";


async function start() {
  const app = createApp();
  await connectDatabase(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME?.trim() || undefined);
  connectCloudinary();
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`GreenFarm API ready on port ${port}`));
  // Every 15 minutes: cancel orders nobody confirmed in time and return their stock (config/orderLimits.ts).
  const sweep = () => cancelUnconfirmedOrders()
    .then((count) => { if (count) console.log(`Cancelled ${count} unconfirmed order${count === 1 ? "" : "s"}`); })
    .catch(() => console.error("Unable to cancel unconfirmed orders"));
  void sweep();
  const sweeper = setInterval(sweep, 15 * 60_000);
  const stop = () => { clearInterval(sweeper); server.close(() => { void mongoose.disconnect().then(() => process.exit(0)); }); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
start().catch(async (error: unknown) => {
  const message = error instanceof Error && /^(JWT_|ADMIN_EMAIL|MONGODB_URI|Use MongoDB|Invalid COOKIE|COOKIE_SAME_SITE|CLIENT_ORIGIN|TRUST_PROXY)/.test(error.message)
    ? error.message : "Check your database connection and environment configuration";
  console.error("Unable to start GreenFarm API:", message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

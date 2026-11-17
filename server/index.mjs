import "dotenv/config";
import express from "express";
import path from "node:path";
import { createApi } from "./api.mjs";
import { startNotificationWorker } from "./worker.mjs";
const app = createApi();
const stopWorker =
  process.env.NOTIFICATION_WORKER_ENABLED === "true"
    ? startNotificationWorker()
    : () => {};
process.once("SIGTERM", stopWorker);
if (process.env.NODE_ENV === "production") {
  const root = path.resolve("dist");
  app.use(express.static(root, { index: false }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "index.html")),
  );
}
const port = Number(process.env.PORT || 3001);
app.listen(
  port,
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  () => console.log(`Syllabus AI server listening on port ${port}`),
);

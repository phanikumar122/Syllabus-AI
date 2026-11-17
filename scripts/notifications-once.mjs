import "dotenv/config";
import { runNotificationJob } from "../server/worker.mjs";
const summary = await runNotificationJob();
console.log(summary);

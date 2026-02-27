import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import webpush from "web-push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const STORE_PATH = path.join(__dirname, "data", "store.json");
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const APP_TASKS_URL = process.env.APP_TASKS_URL || "https://danielaivnv.github.io/task-tracker/tasks.html";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:example@example.com";
const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);

if (pushEnabled) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn("Push is disabled: missing VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY.");
}

ensureStoreFile();

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, pushEnabled });
});

app.post("/api/devices/register", (req, res) => {
  const { deviceId, timezone, subscription } = req.body || {};
  if (!isNonEmptyString(deviceId)) {
    res.status(400).json({ ok: false, error: "deviceId is required" });
    return;
  }
  if (!isValidSubscription(subscription)) {
    res.status(400).json({ ok: false, error: "subscription is invalid" });
    return;
  }

  const store = readStore();
  const device = store.devices[deviceId] || {};
  store.devices[deviceId] = {
    ...device,
    deviceId,
    timezone: isNonEmptyString(timezone) ? timezone : "UTC",
    subscription,
    updatedAt: Date.now()
  };
  writeStore(store);

  res.json({ ok: true });
});

app.post("/api/tasks/sync", (req, res) => {
  const { deviceId, timezone, tasks } = req.body || {};
  if (!isNonEmptyString(deviceId)) {
    res.status(400).json({ ok: false, error: "deviceId is required" });
    return;
  }
  if (!Array.isArray(tasks)) {
    res.status(400).json({ ok: false, error: "tasks must be an array" });
    return;
  }

  const sanitizedTasks = tasks.map(sanitizeTask).filter(Boolean);
  const store = readStore();

  const existingDevice = store.devices[deviceId] || {
    deviceId,
    timezone: "UTC",
    subscription: null,
    updatedAt: Date.now()
  };

  store.devices[deviceId] = {
    ...existingDevice,
    timezone: isNonEmptyString(timezone) ? timezone : existingDevice.timezone || "UTC",
    updatedAt: Date.now()
  };
  store.tasksByDevice[deviceId] = sanitizedTasks;
  writeStore(store);

  res.json({ ok: true, synced: sanitizedTasks.length });
});

cron.schedule("* * * * *", async () => {
  try {
    await dispatchDueNotifications();
  } catch (error) {
    console.error("Cron dispatch failed:", error);
  }
});

app.listen(PORT, () => {
  console.log(`Focus backend running on port ${PORT}`);
});

async function dispatchDueNotifications() {
  if (!pushEnabled) return;

  const store = readStore();
  const now = Date.now();
  let changed = false;

  for (const [deviceId, device] of Object.entries(store.devices)) {
    if (!device || !isValidSubscription(device.subscription)) continue;

    const tasks = Array.isArray(store.tasksByDevice[deviceId]) ? store.tasksByDevice[deviceId] : [];
    const sentMap = store.sentByDevice[deviceId] || {};
    const activeTimedTaskIds = new Set(
      tasks
        .filter((task) => task && !task.completed && task.dueAt && task.allDay === false)
        .map((task) => task.id)
    );

    for (const taskId of Object.keys(sentMap)) {
      if (!activeTimedTaskIds.has(taskId)) {
        delete sentMap[taskId];
        changed = true;
      }
    }

    let sentInBatch = 0;
    for (const task of tasks) {
      if (sentInBatch >= 3) break;
      if (!task || task.completed || !task.dueAt || task.allDay !== false) continue;

      const dueTs = Date.parse(task.dueAt);
      if (!Number.isFinite(dueTs) || dueTs > now) continue;
      if (sentMap[task.id] === task.dueAt) continue;

      const minutesLate = Math.max(0, Math.floor((now - dueTs) / 60000));
      const payload = JSON.stringify({
        title: minutesLate <= 1 ? "Task due now" : "Task overdue",
        body: minutesLate <= 1 ? task.title : `${task.title} (${minutesLate} min late)`,
        url: APP_TASKS_URL
      });

      try {
        await webpush.sendNotification(device.subscription, payload, { TTL: 120 });
        sentMap[task.id] = task.dueAt;
        changed = true;
        sentInBatch += 1;
      } catch (error) {
        if (error && (error.statusCode === 404 || error.statusCode === 410)) {
          store.devices[deviceId].subscription = null;
          changed = true;
          break;
        }
      }
    }

    store.sentByDevice[deviceId] = sentMap;
  }

  if (changed) {
    writeStore(store);
  }
}

function sanitizeTask(task) {
  if (!task || !isNonEmptyString(task.id) || !isNonEmptyString(task.title)) return null;

  return {
    id: task.id,
    title: task.title.slice(0, 200),
    dueAt: isNonEmptyString(task.dueAt) ? task.dueAt : null,
    allDay: task.allDay !== false,
    completed: Boolean(task.completed),
    updatedAt: Number(task.updatedAt) || Date.now()
  };
}

function isValidSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") return false;
  if (!isNonEmptyString(subscription.endpoint)) return false;
  const keys = subscription.keys || {};
  return isNonEmptyString(keys.p256dh) && isNonEmptyString(keys.auth);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    writeStore({
      devices: {},
      tasksByDevice: {},
      sentByDevice: {}
    });
  }
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      devices: parsed.devices || {},
      tasksByDevice: parsed.tasksByDevice || {},
      sentByDevice: parsed.sentByDevice || {}
    };
  } catch {
    return {
      devices: {},
      tasksByDevice: {},
      sentByDevice: {}
    };
  }
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

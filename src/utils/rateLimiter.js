// Rate Limit 工具：10 req/min，支援 Redis store

import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

const WINDOW_MS = 60 * 1000; // 1 分鐘
const MAX = Number(process.env.RATE_LIMIT_MAX) || 10; // 10 req/min

export async function createRateLimiter() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const client = createClient({ url: redisUrl });
      client.on("error", (err) => console.error("Redis Rate Limit 連線錯誤：", err));
      await client.connect();

      const store = new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: "rl:scrape:",
      });

      return rateLimit({
        windowMs: WINDOW_MS,
        max: MAX,
        store,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: "Too many requests, please try again later.",
        },
      });
    } catch (err) {
      console.error("Redis Rate Limit 初始化失敗，改用記憶體 store：", err);
    }
  }

  return rateLimit({
    windowMs: WINDOW_MS,
    max: MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many requests, please try again later.",
    },
  });
}

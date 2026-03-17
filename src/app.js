// 主應用程式：設定 Express 伺服器與中介層

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import scrapeRouter from "./routes/scrape.js";
import { createRateLimiter } from "./utils/rateLimiter.js";
import {
  initRedisCache,
  getRedisClient,
  getCacheTTL,
} from "./utils/cache.js";

dotenv.config();

const app = express();

// ---- 基本設定 ----
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ---- 中介層 ----
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(NODE_ENV === "development" ? "dev" : "combined"));

// Rate Limit 與 scrape 路由在 start() 中掛載（確保 rate limit 先執行）

// ---- Redis 緩存中介層（TTL 15 min）----
const cacheMiddleware = async (req, res, next) => {
  const redis = getRedisClient();
  if (!redis) return next();

  const key = `cache:scrape:${req.originalUrl}`;

  try {
    const cached = await redis.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (e) {
    return next();
  }

  const origJson = res.json.bind(res);
  res.json = (body) => {
    redis.setEx(key, getCacheTTL(), JSON.stringify(body)).catch(() => {});
    origJson(body);
  };
  next();
};

// ---- 啟動伺服器 ----
async function start() {
  await initRedisCache();

  const rateLimiter = await createRateLimiter().catch((err) => {
    console.error("Rate Limit 初始化失敗：", err);
    return null;
  });
  if (rateLimiter) {
    app.use("/api", rateLimiter);
    console.log("Rate Limit 已啟用：10 req/min");
  }

  app.use("/api/scrape", cacheMiddleware, scrapeRouter);

  app.get("/health", (req, res) => {
    return res.json({
      success: true,
      message: "OK",
      env: NODE_ENV,
    });
  });

  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      error: "Not Found",
      path: req.originalUrl,
    });
  });

  app.use((err, req, res, next) => {
    console.error("未捕捉錯誤：", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  });

  app.listen(PORT, () => {
    console.log(`伺服器已啟動，埠號 port=${PORT}`);
    console.log("環境變數：REDIS_URL, USER_AGENT, PROXY");
  });
}

start().catch((err) => {
  console.error("啟動失敗：", err);
  process.exit(1);
});

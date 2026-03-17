// 爬蟲相關路由：104 職缺 / PTT Stock / TWSE 台股

import express from "express";
import {
  scrape104Jobs,
  scrapePttStock,
  scrapeTwseStock,
} from "../utils/puppeteer.js";

const router = express.Router();

function handleError(res, error, statusCode = 500) {
  console.error("爬蟲錯誤：", error);
  return res.status(statusCode).json({
    success: false,
    error: error.message || "Scrape failed",
  });
}

// ---- 1. 104 職缺爬蟲 ----
// GET /api/scrape/104-jobs?keyword=後端工程師&location=6001001000&page=1&jobcat=2007001000
router.get("/104-jobs", async (req, res) => {
  const { keyword, location, page, jobcat } = req.query;

  if (!keyword) {
    return res.status(400).json({
      success: false,
      error: "缺少必要參數 keyword",
    });
  }

  try {
    const data = await scrape104Jobs({
      keyword,
      location: location || undefined,
      page: Number(page) || 1,
      jobcat: jobcat || "2007001000",
    });

    return res.json({
      success: true,
      source: "104",
      query: { keyword, location, page: Number(page) || 1 },
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ---- 2. PTT Stock 版爬蟲 ----
// GET /api/scrape/ptt-stock?stock_id=2330&days=7
router.get("/ptt-stock", async (req, res) => {
  const { stock_id, days } = req.query;

  if (!stock_id) {
    return res.status(400).json({
      success: false,
      error: "缺少必要參數 stock_id",
    });
  }

  try {
    const data = await scrapePttStock({
      stock_id,
      days: Math.min(Number(days) || 7, 14),
    });

    return res.json({
      success: true,
      source: "PTT Stock",
      query: { stock_id, days: Math.min(Number(days) || 7, 14) },
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ---- 3. TWSE 台股日收盤價 ----
// GET /api/scrape/twse-stock?stock_id=2330
router.get("/twse-stock", async (req, res) => {
  const { stock_id } = req.query;

  if (!stock_id) {
    return res.status(400).json({
      success: false,
      error: "缺少必要參數 stock_id",
    });
  }

  try {
    const data = await scrapeTwseStock({ stock_id });

    return res.json({
      success: true,
      source: "TWSE",
      query: { stock_id },
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;

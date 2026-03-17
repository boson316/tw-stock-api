// Puppeteer 工具：建立 headless 瀏覽器與各站台爬蟲邏輯（含完整反爬防護）

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserPreferencesPlugin from "puppeteer-extra-plugin-user-preferences";

puppeteer.use(StealthPlugin());
puppeteer.use(
  UserPreferencesPlugin({
    userPrefs: {
      intl: { accept_languages: "zh-TW,zh,en-US,en" },
      profile: { default_content_setting_values: { plugins: 1 } },
    },
  })
);

const TIMEOUT_MS = 30000;

// 台灣常見 Chrome User-Agent（隨機選用）
const USER_AGENTS_TW = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
];

// 常見桌面 Viewport（隨機選用）
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

// 延時 3–5 秒（頁面載入間隔）
export function randomDelay() {
  const ms = 3000 + Math.random() * 2000;
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomUserAgent() {
  return process.env.USER_AGENT || pickRandom(USER_AGENTS_TW);
}

function getRandomViewport() {
  return pickRandom(VIEWPORTS);
}

// ---- 共用：啟動瀏覽器（含 proxy 支援）----
export async function createBrowser() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
  ];

  const proxy = process.env.PROXY;
  if (proxy) {
    const match = proxy.match(/^(?:https?:\/\/)?([^:]+(?::\d+)?)/);
    const server = match ? match[1] : proxy;
    args.push(`--proxy-server=${server}`);
  }

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.launch({
    headless: "new",
    args,
    executablePath,
  });

  return browser;
}

// ---- 共用：建立新分頁並套用反爬設定 ----
export async function createPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);

  const ua = getRandomUserAgent();
  const viewport = getRandomViewport();

  await page.setUserAgent(ua);
  await page.setViewport(viewport);

  // Proxy 認證（若 PROXY 含帳密）
  const proxy = process.env.PROXY;
  if (proxy && /^https?:\/\/[^:]+:[^@]+@/.test(proxy)) {
    try {
      const u = new URL(proxy);
      await page.authenticate({
        username: decodeURIComponent(u.username || ""),
        password: decodeURIComponent(u.password || ""),
      });
    } catch (e) {
      // 解析失敗則略過
    }
  }

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (["image", "media", "font"].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  return page;
}

// ---- 104 職缺爬蟲（Puppeteer 版，調整 selector / timeout）----
export async function scrape104Jobs({ keyword, location, page = 1, jobcat = "2007001000" }) {
  const browser = await createBrowser();
  const pageInstance = await createPage(browser);

  try {
    await randomDelay();

    const params = new URLSearchParams({
      ro: "0",
      keyword: keyword,
      mode: "s",
      jobsource: "2018indexpoc",
      page: String(page),
    });
    if (location) params.set("jobarea", location);
    if (jobcat) params.set("jobcat", jobcat);

    const url = `https://www.104.com.tw/jobs/search/?${params.toString()}`;

    await pageInstance.goto(url, {
      waitUntil: "networkidle2",
      timeout: TIMEOUT_MS + 15000, // 比預設再長一點，給 104 多一點載入時間
    });

    // 先給頁面一些時間載入動態內容（用 setTimeout 而非 waitForTimeout，避免版本差異）
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const jobs = await pageInstance.evaluate(() => {
      // 優先從常見職缺列表容器找
      const selectors = [
        ".job-list-item",
        ".joblist-div-item",
        "[data-qa='job-list-item']",
        "[class*='job-list-item']",
        "article[class*='job']",
      ];

      let nodes = [];
      for (const sel of selectors) {
        nodes = Array.from(document.querySelectorAll(sel));
        if (nodes.length > 0) break;
      }

      if (!nodes.length) return [];

      const result = [];

      nodes.forEach((el) => {
        const titleEl =
          el.querySelector(".joblist-div-item-title") ||
          el.querySelector(".job-list-item__title") ||
          el.querySelector("a.job-link") ||
          el.querySelector("a[class*='job']") ||
          el.querySelector("h2 a");

        const companyEl =
          el.querySelector(".company") ||
          el.querySelector(".job-list-item__company") ||
          el.querySelector("[class*='company']");

        const salaryEl =
          el.querySelector(".salary") ||
          el.querySelector(".job-list-item__info-salary") ||
          el.querySelector("[class*='salary']");

        const areaEl =
          el.querySelector(".job-list-item__info-area") ||
          el.querySelector("[class*='area']") ||
          el.querySelector("[class*='location']");

        const timeEl =
          el.querySelector(".jobsource-update-time") ||
          el.querySelector(".job-list-item__info-update") ||
          el.querySelector("[class*='update']");

        const title = titleEl?.textContent?.trim() || "";
        if (!title) return;

        let href = "";
        if (titleEl && "href" in titleEl && typeof titleEl.href === "string") {
          href = titleEl.href;
        } else if (titleEl && typeof titleEl.getAttribute === "function") {
          const h = titleEl.getAttribute("href") || "";
          href = h ? (h.startsWith("http") ? h : `https:${h}`) : "";
        }

        result.push({
          title,
          link: href,
          company: companyEl?.textContent?.trim() || "",
          location: areaEl?.textContent?.trim() || "",
          salary: salaryEl?.textContent?.trim() || "",
          updateTime: timeEl?.textContent?.trim() || "",
        });
      });

      return result;
    });

    return Array.isArray(jobs) ? jobs.slice(0, 20) : [];
  } finally {
    await pageInstance.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ---- PTT Stock 版爬蟲 ----
export async function scrapePttStock({ stock_id, days = 7 }) {
  const browser = await createBrowser();
  const pageInstance = await createPage(browser);

  try {
    await randomDelay();

    const baseUrl = "https://www.ptt.cc/bbs/Stock/index.html";
    await pageInstance.goto(baseUrl, { waitUntil: "networkidle2", timeout: TIMEOUT_MS });

    try {
      const over18Btn = await pageInstance.$("button[name='yes']");
      if (over18Btn) {
        await over18Btn.click();
        await pageInstance.waitForNavigation({ waitUntil: "networkidle2", timeout: TIMEOUT_MS });
      }
    } catch (e) {}

    const articles = [];
    const maxPages = Math.min(days, 10);
    const stockIdStr = String(stock_id);

    for (let i = 0; i < maxPages && articles.length < 20; i++) {
      if (i > 0) await randomDelay();

      const pageArticles = await pageInstance.evaluate((sid) => {
        const rows = document.querySelectorAll(".r-ent");
        const list = [];

        rows.forEach((row) => {
          const titleEl = row.querySelector(".title a");
          if (!titleEl) return;
          const title = titleEl.textContent?.trim() || "";
          if (!title.includes(sid)) return;

          const authorEl = row.querySelector(".meta .author");
          const pushEl = row.querySelector(".nrec span");

          list.push({
            title,
            link: `https://www.ptt.cc${titleEl.getAttribute("href") || ""}`,
            author: authorEl?.textContent?.trim() || "",
            score: pushEl?.textContent?.trim() || "0",
          });
        });

        return list;
      }, stockIdStr);

      for (const a of pageArticles) {
        if (articles.length >= 20) break;

        try {
          await randomDelay();
          await pageInstance.goto(a.link, { waitUntil: "domcontentloaded", timeout: 10000 });
          const summary = await pageInstance.evaluate(() => {
            const main = document.querySelector("#main-content");
            if (!main) return "";
            const text = main.textContent || "";
            return text.replace(/\s+/g, " ").trim().slice(0, 150);
          });
          articles.push({ ...a, contentSummary: summary });
        } catch (e) {
          articles.push({ ...a, contentSummary: "" });
        }
      }

      const prevHref = await pageInstance.evaluate(() => {
        const btns = document.querySelectorAll(".btn.wide");
        return btns.length >= 2 ? btns[1].getAttribute("href") : null;
      });

      if (!prevHref) break;

      await pageInstance.goto(`https://www.ptt.cc${prevHref}`, {
        waitUntil: "networkidle2",
        timeout: TIMEOUT_MS,
      });
    }

    return articles.slice(0, 20);
  } finally {
    await pageInstance.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ---- TWSE 台股日收盤價 ----
export async function scrapeTwseStock({ stock_id }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = `${year}${month}01`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const ua = getRandomUserAgent();

  const fetchMonth = async (d) => {
    const u = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${d}&stockNo=${stock_id}`;
    const r = await fetch(u, {
      signal: controller.signal,
      headers: { "User-Agent": ua },
    });
    if (!r.ok) throw new Error(`TWSE API 錯誤：${r.status}`);
    return r.json();
  };

  try {
    let json = await fetchMonth(date);
    if (json.stat !== "OK" || !json.data?.length) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevDate = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, "0")}01`;
      json = await fetchMonth(prevDate);
    }
    clearTimeout(timeoutId);

    if (json.stat !== "OK" || !json.data?.length) {
      return {
        stock_id,
        found: false,
        message: json.stat || "無資料",
      };
    }

    const last = json.data[json.data.length - 1];
    const closePrice = parseFloat(String(last[6]).replace(/,/g, "")) || null;
    const changeStr = String(last[7]).replace(/,/g, "");
    const changeVal = parseFloat(changeStr) || 0;
    const volume = parseInt(String(last[1]).replace(/,/g, ""), 10) || null;

    let changePercent = null;
    if (closePrice && changeVal !== 0) {
      const prevClose = closePrice - changeVal;
      if (prevClose) changePercent = ((changeVal / prevClose) * 100).toFixed(2);
    }

    return {
      stock_id,
      found: true,
      closePrice,
      change: changeVal,
      changePercent: changePercent !== null ? parseFloat(changePercent) : null,
      volume,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

## 台灣職缺/股價爬蟲 API

Node.js + Express + Puppeteer 爬蟲 API，支援：

- `104` 職缺搜尋
- `PTT Stock` 文章搜尋（依股票代碼）
- `TWSE` 台股日成交資料（取最新收盤/漲跌/成交量）

### 需求

- Node.js 20+
- （選用）Redis（建議用 Upstash）

### 安裝與啟動

```bash
npm install
npm run dev
```

啟動後測試：

- `GET /health`

### API

#### 1) 104 職缺：`/api/scrape/104-jobs`

- **Query**
  - `keyword`：必填
  - `location`：選填（104 地區代碼；若你傳「台北」這種文字，104 不一定吃得進去，建議用代碼）
  - `page`：選填（預設 `1`）

- **curl demo**

```bash
curl "http://localhost:3000/api/scrape/104-jobs?keyword=Rust&location=6001001000&page=1"
```

#### 2) PTT Stock：`/api/scrape/ptt-stock`

- **Query**
  - `stock_id`：必填（例：`2330`）
  - `days`：選填（預設 `7`，最多 `14`）

- **curl demo**

```bash
curl "http://localhost:3000/api/scrape/ptt-stock?stock_id=2330&days=7"
```

#### 3) TWSE：`/api/scrape/twse-stock`

- **Query**
  - `stock_id`：必填（例：`2330`）

- **curl demo**

```bash
curl "http://localhost:3000/api/scrape/twse-stock?stock_id=2330"
```

### 環境變數

請在雲端平台設定環境變數（不要把真實連線字串寫進 repo）。

- `REDIS_URL`: Upstash 提供的 `rediss://...`
- `RATE_LIMIT_MAX`: 每分鐘上限（預設 10）
- `USER_AGENT`: 自訂 UA（選填）
- `PROXY`: Proxy（選填）

本機可參考 `.env.example`。

### Docker（本機快速跑 Redis + API）

```bash
docker compose up --build
```

### GIF 截圖

- 建議你用瀏覽器測試 `GET /health`、`/api/scrape/twse-stock?...` 後，用螢幕錄影工具錄成 GIF，放到 `README.md` 內（例如 `docs/demo.gif`）。

### 部署：Railway（概念步驟）

- 建立新專案 → 連 GitHub repo
- 設定環境變數：
  - `REDIS_URL=rediss://...`（Upstash）
  - `RATE_LIMIT_MAX=10`（選填）
- Start 指令：`npm start`
- 部署完成後打 `https://<your-domain>/health`

### 部署：Hugging Face Spaces（Docker）

- 建立 Space → 選 **Docker**
- 把本 repo 推上去（包含 `Dockerfile`）
- 在 Space 的 Secrets / Variables 設定：
  - `REDIS_URL=rediss://...`
- Build 完成後，用 Space 提供的 URL 測 `GET /health`


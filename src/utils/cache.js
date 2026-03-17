// Redis 緩存工具：TTL 15 分鐘

const CACHE_TTL = 900; // 15 min

let redisClient = null;

export async function initRedisCache() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.error("Redis 緩存錯誤：", err));
    await client.connect();
    redisClient = client;
    console.log("Redis 緩存已連線");
    return redisClient;
  } catch (err) {
    console.error("Redis 緩存初始化失敗：", err);
    redisClient = null;
    return null;
  }
}

export function getRedisClient() {
  return redisClient;
}

export function getCacheTTL() {
  return CACHE_TTL;
}

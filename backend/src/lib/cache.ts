import redis from "./redis.js";

export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch (err) {
    console.error("[cache] read failed", key, err);
    return null;
  }
};

export const cacheSet = async (key: string, value: string, seconds: number) => {
  try {
    await redis.set(key, value, { expiration: { type: "EX", value: seconds } });
  } catch (err) {
    console.error("[cache] write failed", key, err);
  }
};

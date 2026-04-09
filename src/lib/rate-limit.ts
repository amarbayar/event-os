import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isTest = process.env.NODE_ENV === "test";

export const ratelimit = isTest
  ? {
      limit: async () => ({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      }),
    }
  : new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
    });

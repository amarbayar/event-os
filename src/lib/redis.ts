import { Redis } from "@upstash/redis";

const isTest = process.env.NODE_ENV === "test";

export const redis = isTest
  ? {
      get: async () => null,
      set: async () => {},
    }
  : new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

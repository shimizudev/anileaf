import Redis from 'ioredis';
import { CACHE_TTL } from './constants';

const redis = new Redis({
	host: process.env.REDIS_HOST || 'localhost',
	password: process.env.REDIS_PASSWORD,
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
});

export interface CacheOptions {
	ttl?: number;
	prefix?: string;
}

class Cache {
	private readonly defaultPrefix = 'flowery:';

	constructor(private readonly client: Redis) {}

	/**
	 * Get data from cache
	 */
	async get<T>(key: string, prefix = this.defaultPrefix): Promise<T | null> {
		try {
			const data = await this.client.get(this.getKey(key, prefix));
			return data ? JSON.parse(data) : null;
		} catch (error) {
			console.error('Cache get error:', error);
			return null;
		}
	}

	/**
	 * Set data in cache
	 */
	async set(key: string, data: unknown, options: CacheOptions = {}): Promise<void> {
		try {
			const { ttl = CACHE_TTL.DAY, prefix = this.defaultPrefix } = options;
			await this.client.setex(this.getKey(key, prefix), ttl, JSON.stringify(data));
		} catch (error) {
			console.error('Cache set error:', error);
		}
	}

	/**
	 * Delete data from cache
	 */
	async del(key: string, prefix = this.defaultPrefix): Promise<void> {
		try {
			await this.client.del(this.getKey(key, prefix));
		} catch (error) {
			console.error('Cache delete error:', error);
		}
	}

	/**
	 * Clear all cache with prefix
	 */
	async clear(prefix = this.defaultPrefix): Promise<void> {
		try {
			const keys = await this.client.keys(`${prefix}*`);
			if (keys.length) {
				await this.client.del(...keys);
			}
		} catch (error) {
			console.error('Cache clear error:', error);
		}
	}

	/**
	 * Get cache key with prefix
	 */
	private getKey(key: string, prefix: string): string {
		return `${prefix}${key}`;
	}

	/**
	 * Check if cache is connected
	 */
	async isReady(): Promise<boolean> {
		try {
			await this.client.ping();
			return true;
		} catch {
			return false;
		}
	}
}

export const cache = new Cache(redis);

// Helper functions for common cache operations
export async function getCache<T>(key: string): Promise<T | null> {
	return cache.get<T>(key);
}

export async function setCache(key: string, data: unknown, ttl = CACHE_TTL.DAY): Promise<void> {
	return cache.set(key, data, { ttl });
}

export async function deleteCache(key: string): Promise<void> {
	return cache.del(key);
}

export async function clearCache(): Promise<void> {
	return cache.clear();
}

export async function isCacheReady(): Promise<boolean> {
	return cache.isReady();
}

// Export the Redis client for direct access if needed
export { redis };

import { Router } from 'express';
import AnimeModel from '../models/anime';
import { TimeFrame, getTimeFrameDates } from '../lib/utils/scoring';
import { getCache, setCache } from '../lib/cache';
import { CACHE_TTL } from '../lib/constants';

const router = Router();

interface StatsResponse {
	timeFrame: TimeFrame;
	data: unknown[];
	pageInfo: {
		total: number;
		currentPage: number;
		lastPage: number;
		hasNextPage: boolean;
		perPage: number;
	};
}

// @ts-expect-error
router.get('/stats/:type', async (req, res) => {
	try {
		const { type } = req.params;
		const timeFrame = (req.query.timeFrame as TimeFrame) || TimeFrame.ALL_TIME;
		const page = Number(req.query.page) || 1;
		const perPage = Number(req.query.perPage) || 50;

		const cacheKey = `anime:stats:${type}:${timeFrame}:${page}:${perPage}`;
		const cached = await getCache<StatsResponse>(cacheKey);
		if (cached) return res.json(cached);

		const { start, end } = getTimeFrameDates(timeFrame);
		const skip = (page - 1) * perPage;

		let query = {};
		let sort = {};

		// Add date range to query if not all time
		if (timeFrame !== TimeFrame.ALL_TIME) {
			query = {
				updatedAt: {
					$gte: start,
					$lte: end,
				},
			};
		}

		// Set sort based on stat type
		switch (type) {
			case 'most-popular':
				sort = { popularityScore: -1 };
				break;
			case 'best-rated':
				sort = { rating: -1 };
				break;
			case 'most-watched':
				sort = { views: -1 };
				break;
			case 'most-completed':
				sort = { completed: -1 };
				break;
			case 'trending':
				sort = { trendingScore: -1 };
				break;
			default:
				return res.status(400).json({ error: 'Invalid stat type' });
		}

		const [data, total] = await Promise.all([
			AnimeModel.find(query).sort(sort).skip(skip).limit(perPage),
			AnimeModel.countDocuments(query),
		]);

		const response: StatsResponse = {
			timeFrame,
			data,
			pageInfo: {
				total,
				currentPage: page,
				lastPage: Math.ceil(total / perPage),
				hasNextPage: skip + perPage < total,
				perPage,
			},
		};

		// Cache for different durations based on time frame
		const cacheDuration =
			timeFrame === TimeFrame.ALL_TIME
				? CACHE_TTL.WEEK
				: timeFrame === TimeFrame.THIS_WEEK
					? CACHE_TTL.HOUR
					: CACHE_TTL.DAY;

		await setCache(cacheKey, response, cacheDuration);
		res.json(response);
	} catch (error) {
		console.error('Error in /stats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;

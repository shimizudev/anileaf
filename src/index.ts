import { connect } from './lib/db';
import AnimeModel from './models/anime';
import { get } from './lib/mappings/get';
import { FloweryStatus } from './lib/utils/status';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import cors from 'cors';
import { flowery } from './lib/request';
import { getAnilistIds } from './lib/mappings/anilist';
import statsRoutes from './routes/stats';
import scoringRoutes from './routes/scoring';
import { getCache, setCache, isCacheReady, clearCache } from './lib/cache';
import chalk from 'chalk';

const Logger = {
	info: <T>(...message: T[]) => {
		console.info(chalk.blue(message.join(' ')));
	},
	error: <T>(...message: T[]) => {
		console.error(chalk.red(message.join(' ')));
	},
};

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 60, // Limit each IP to 60 requests per windowMs
});
app.use(limiter);

// Cache TTL configurations
const CACHE_TTL = {
	Unknown: 60 * 60 * 24, // 24 hours
	'Currently Airing': 60 * 60, // 1 hour
	'Coming Soon': 60 * 60 * 12, // 12 hours
	Hiatus: 60 * 60 * 6, // 6 hours
	TRENDING: 60 * 60 * 24, // 24 hours
	POPULAR: 60 * 60 * 24, // 24 hours
	SORT: 60 * 60 * 24, // 24 hours
} as const;

// Helper function to determine if we should update data
function shouldUpdate(status: { status: FloweryStatus } | undefined): boolean {
	if (!status) return false;
	return [FloweryStatus.RELEASING, FloweryStatus.NOT_YET_RELEASED, FloweryStatus.HIATUS].includes(
		status.status,
	);
}

// @ts-expect-error
app.get('/info/:id', async (req, res) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ error: 'No ID or slug provided' });
		}
		const cacheKey = `anime:info:${id}`;

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const cached = await getCache<any>(cacheKey);
		if (cached) {
			if (shouldUpdate(cached.status as { status: FloweryStatus })) {
				updateAnimeInBackground(id);
			}
			return res.json(cached);
		}

		const fetchAnilistIds = async () => {
			const { data } = await flowery.get<string>(
				'https://raw.githubusercontent.com/5H4D0WILA/IDFetch/main/ids.txt',
			);

			if (!data) throw new Error('No data received from IDs endpoint');

			return data
				.split('\n')
				.map((id) => Number.parseInt(id.trim()))
				.filter((id) => !Number.isNaN(id))
				.sort((a, b) => a - b);
		};

		const isAnilistId = (await fetchAnilistIds()).includes(Number(id));
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let anime: any;

		if (isAnilistId) {
			// Cause it's anilist, we can use the anilist ID to find the anime
			anime = await AnimeModel.findOne({ 'mappings.anilist': Number(id) });

			if (!anime) {
				try {
					Logger.info(`Fetching anime ${id} from AniList`);
					const animeInfo = await get(Number(id));
					anime = new AnimeModel(animeInfo);
					await anime.save();
				} catch (error) {
					Logger.error(`Failed to fetch anime ${id} from AniList:`, error);
					return res.status(404).json({ error: 'Anime not found' });
				}
			} else if (shouldUpdate(anime.status)) {
				Logger.info(`Updating anime ${id} in database`);
				const animeInfo = await get(Number(id));
				await AnimeModel.updateOne({ 'mappings.anilist': Number(id) }, { $set: animeInfo });
				anime = await AnimeModel.findOne({ 'mappings.anilist': Number(id) });
			}
		} else {
			anime = await AnimeModel.findOne({ id: Number(id) });
			if (!anime) {
				return res.status(404).json({ error: 'Anime not found' });
			}
		}

		const ttl = shouldUpdate(anime.status)
			? CACHE_TTL[anime.status.status as keyof typeof CACHE_TTL]
			: CACHE_TTL.Unknown;

		await setCache(cacheKey, anime, ttl);
		res.json(anime);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/lookup', async (req, res) => {
	try {
		const { provider, id } = req.query;

		if (!provider || !id) {
			return res.status(400).json({ error: 'Provider and ID are required' });
		}

		const cacheKey = `anime:lookup:${provider}:${id}`;
		const cached = await getCache(cacheKey);
		if (cached) return res.json(cached);

		let query = {};
		switch (provider) {
			case 'slug':
				query = { slug: id };
				break;
			case 'anilist':
				query = { 'mappings.anilist': Number(id) };
				break;
			case 'mal':
				query = { 'mappings.mal_id': Number(id) };
				break;
			case 'tvdb':
				query = { 'mappings.tvdb': id };
				break;
			case 'anidb':
				query = { 'mappings.anidb_id': Number(id) };
				break;
			case 'kitsu':
				query = { 'mappings.kitsu_id': Number(id) };
				break;
			case 'hianime':
				query = { 'mappings.hianime': Number(id) };
				break;
			case 'anitaku':
				query = {
					$or: [{ 'mappings.anitaku.sub': id }, { 'mappings.anitaku.dub': id }],
				};
				break;
			default:
				return res.status(400).json({ error: 'Invalid provider' });
		}

		const anime = await AnimeModel.findOne(query);
		if (!anime) {
			return res.status(404).json({ error: 'Anime not found' });
		}

		const ttl = shouldUpdate(anime.status as { status: FloweryStatus })
			? CACHE_TTL[(anime.status as { status: FloweryStatus }).status as keyof typeof CACHE_TTL]
			: CACHE_TTL.Unknown;

		await setCache(cacheKey, anime, ttl);
		res.json(anime);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/episodes/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const meta = req.query.meta?.toString() || 'all';
		const cacheKey = `anime:episodes:${id}:${meta}`;

		// Check cache first
		const cached = await getCache<{ totalEpisodes: number; streamEpisodes: unknown }>(cacheKey);
		if (cached) return res.json(cached);

		// Find in database
		const anime = await AnimeModel.findOne({ id: Number(id) });
		if (!anime) {
			return res.status(404).json({ error: 'Anime not found' });
		}

		const episodes = {
			totalEpisodes: anime.totalEpisodes,
			streamEpisodes:
				meta === 'all'
					? anime.streamEpisodes
					: (anime.streamEpisodes as Record<string, unknown>)[
							meta as keyof typeof anime.streamEpisodes
						],
		};

		await setCache(cacheKey, episodes, CACHE_TTL.Unknown);
		res.json(episodes);
	} catch {
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/characters/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const cacheKey = `anime:characters:${id}`;

		// Check cache first
		const cached = await getCache<unknown>(cacheKey);
		if (cached) return res.json(cached);

		// Find in database
		const anime = await AnimeModel.findOne({ id: Number(id) });
		if (!anime) {
			return res.status(404).json({ error: 'Anime not found' });
		}

		await setCache(cacheKey, anime.characters, CACHE_TTL.Unknown);
		res.json(anime.characters);
	} catch {
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/relations/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const cacheKey = `anime:relations:${id}`;

		// Check cache first
		const cached = await getCache<unknown>(cacheKey);
		if (cached) return res.json(cached);

		// Find in database
		const anime = await AnimeModel.findOne({ id: Number(id) });
		if (!anime) {
			return res.status(404).json({ error: 'Anime not found' });
		}

		// Fetch related anime info
		const relatedAnime = await Promise.all(
			anime.relations.map(async (relation) => {
				const related = await AnimeModel.findOne({
					'mappings.anilist': relation.id,
				});
				if (related) {
					return {
						...relation,
						anime: related,
					};
				}
				return relation;
			}),
		);

		await setCache(cacheKey, relatedAnime, CACHE_TTL.Unknown);
		res.json(relatedAnime);
	} catch {
		res.status(500).json({ error: 'Internal server error' });
	}
});

async function fetchAndSaveAnime(ids: number[]) {
	const promises = ids.map(async (id) => {
		const existing = await AnimeModel.findOne({ 'mappings.anilist': id });
		if (!existing) {
			try {
				const animeInfo = await get(id);
				const anime = new AnimeModel(animeInfo);
				await anime.save();
				return anime;
			} catch (error) {
				console.error(`Failed to fetch anime ${id}:`, error);
				return null;
			}
		}
		return existing;
	});

	return (await Promise.all(promises)).filter(Boolean);
}

interface PaginatedResponse<T> {
	data: T[];
	pageInfo: {
		total: number;
		currentPage: number;
		lastPage: number;
		hasNextPage: boolean;
		perPage: number;
	};
}

// @ts-expect-error
app.get('/trending', async (req, res) => {
	try {
		const page = Number(req.query.page) || 1;
		const perPage = Number(req.query.perPage) || 50;
		const cacheKey = `anime:trending:${page}:${perPage}`;

		const cached = await getCache<PaginatedResponse<unknown>>(cacheKey);
		if (cached) return res.json(cached);

		const skip = (page - 1) * perPage;
		const [data, total] = await Promise.all([
			AnimeModel.find().sort({ trendingScore: -1 }).skip(skip).limit(perPage),
			AnimeModel.countDocuments(),
		]);

		const pageInfo = {
			total,
			currentPage: page,
			lastPage: Math.ceil(total / perPage),
			hasNextPage: skip + perPage < total,
			perPage,
		};

		const response = { data, pageInfo };
		await setCache(cacheKey, response, CACHE_TTL.TRENDING);
		res.json(response);
	} catch (error) {
		console.error('Error in /trending:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/popular', async (req, res) => {
	try {
		const { season, year } = req.query;
		const page = Number(req.query.page) || 1;
		const perPage = Number(req.query.perPage) || 50;
		const cacheKey = `anime:popular:${season || 'all'}:${year || 'all'}:${page}:${perPage}`;

		const cached = await getCache<PaginatedResponse<unknown>>(cacheKey);
		if (cached) return res.json(cached);

		const query = {} as Record<string, string | number>;
		if (season) query.season = (season as string).toUpperCase();
		if (year) query.year = Number(year);

		const skip = (page - 1) * perPage;
		const [data, total] = await Promise.all([
			AnimeModel.find(query).sort({ popularityScore: -1 }).skip(skip).limit(perPage),
			AnimeModel.countDocuments(query),
		]);

		const pageInfo = {
			total,
			currentPage: page,
			lastPage: Math.ceil(total / perPage),
			hasNextPage: skip + perPage < total,
			perPage,
		};

		const response = { data, pageInfo };
		await setCache(cacheKey, response, CACHE_TTL.POPULAR);
		res.json(response);
	} catch (error) {
		console.error('Error in /popular:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// @ts-expect-error
app.get('/sort', async (req, res) => {
	try {
		const { type = 'score', sort = 'desc' } = req.query;
		const page = Number(req.query.page) || 1;
		const perPage = Number(req.query.perPage) || 50;
		const cacheKey = `anime:sort:${type}:${sort}:${page}:${perPage}`;

		const cached = await getCache<PaginatedResponse<unknown>>(cacheKey);
		if (cached) return res.json(cached);

		let results: unknown[];
		let pageInfo: PaginatedResponse<unknown>['pageInfo'];

		// Handle AniList-based sorting
		if (['trending', 'popularity', 'score'].includes(type as string)) {
			const sortMapping: Record<string, string[]> = {
				trending: ['TRENDING_DESC'],
				popularity: ['POPULARITY_DESC'],
				score: ['SCORE_DESC'],
			};

			const { ids, pageInfo: anilistPageInfo } = await getAnilistIds({
				sort: sortMapping[type as string],
				page,
				perPage,
			});

			results = await fetchAndSaveAnime(ids);
			pageInfo = anilistPageInfo;
		} else {
			// Handle database-based sorting
			const sortField =
				{
					title: 'title.english',
					year: 'year',
					duration: 'duration',
					// Add more sorting fields as needed
				}[type as string] || 'title.english';

			const skip = (page - 1) * perPage;
			const [data, total] = await Promise.all([
				AnimeModel.find()
					.sort({ [sortField]: sort === 'desc' ? -1 : 1 })
					.skip(skip)
					.limit(perPage),
				AnimeModel.countDocuments(),
			]);

			results = data;
			pageInfo = {
				total,
				currentPage: page,
				lastPage: Math.ceil(total / perPage),
				hasNextPage: skip + perPage < total,
				perPage,
			};
		}

		const response: PaginatedResponse<unknown> = {
			data: results,
			pageInfo,
		};

		await setCache(cacheKey, response, CACHE_TTL.SORT);
		res.json(response);
	} catch (error) {
		console.error('Error in /sort:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

async function updateAnimeInBackground(id: string): Promise<void> {
	try {
		console.info('Updating anime in background:', id);
		const animeInfo = await get(Number(id));

		await AnimeModel.updateOne({ 'mappings.anilist': Number(id) }, { $set: animeInfo });

		const cacheKey = `anime:info:${id}`;
		const ttl = shouldUpdate(animeInfo.status as { status: FloweryStatus })
			? CACHE_TTL[(animeInfo.status as { status: FloweryStatus }).status as keyof typeof CACHE_TTL]
			: CACHE_TTL.Unknown;
		await setCache(cacheKey, animeInfo, ttl);
	} catch (error) {
		console.error('Background update failed for ID:', id, error);
	}
}

async function startServer(): Promise<void> {
	try {
		await connect();
		const isCacheUp = await isCacheReady();
		if (!isCacheUp) {
			throw new Error('Redis cache is not available');
		}

		if (process.env.DELETE_ALL_DATA && Boolean(process.env.DELETE_ALL_DATA) === true) {
			await AnimeModel.deleteMany({});
			Logger.info('Deleted all data');
		}

		if (process.env.CLEAR_ALL_CACHE && Boolean(process.env.CLEAR_ALL_CACHE) === true) {
			await clearCache();
			Logger.info('Cleared all cache');
		}

		app.listen(port, () => {
			Logger.info(`Server running on port ${port}`);
		});
	} catch (error) {
		Logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

app.use('/scoring', scoringRoutes);
app.use('/', statsRoutes);

startServer();

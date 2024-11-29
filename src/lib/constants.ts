// Anime providers
export const ANITAKU_URL = 'https://anitaku.bz';
export const HIANIME_URL = 'https://hianime.to';
// export const ANIME_TERI_URL = 'https://anime-teri.com'; // Will be scraped later (not planned)
// export const ANIME_WORLD_URL = 'https://anime-world.in'; // Will be scraped later (not planned)

// Metadata providers
export const ANILIST_GRAPHQL = 'https://graphql.anilist.co';
export const KITSU_URL = 'https://kitsu.app';
export const MAL_API = 'https://api.jikan.moe/v4';
export const ANIDB_URL = 'https://anidb.net';
export const ANIME_PLANET_URL = 'https://anime-planet.com';

// Manga providers
export const MANGADEX_URL = 'https://mangadex.org';
export const MANGA_LIFE_URL = 'https://manga-life.net';

// Cache TTLs
export const CACHE_TTL = {
	// ... existing TTLs ...
	TRENDING: 60 * 30, // 30 minutes
	POPULAR: 60 * 60 * 2, // 2 hours
	SORT: 60 * 60 * 24, // 24 hours
	HOUR: 60 * 60, // 1 hour
	DAY: 60 * 60 * 24, // 24 hours
	WEEK: 60 * 60 * 24 * 7, // 1 week
} as const;

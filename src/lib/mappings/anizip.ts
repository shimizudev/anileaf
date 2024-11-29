import { flowery } from '../request';

interface AniZipData {
	titles: {
		'x-jat': string;
		ja: string;
		en: string;
		it: string;
		he: string;
		de: string;
		fr: string;
		es: string;
		ru: string;
		ko: string;
		ar: string;
		'zh-Hans': string;
	};
	episodes: {
		[key: string]: AniZipEpisode;
	};
	episodeCount: number;
	specialCount: number;
	images: Image[];
	mappings: Mappings;
}

export interface AniZipEpisode {
	tvdbShowId?: number;
	tvdbId?: number;
	seasonNumber?: number;
	episodeNumber?: number;
	absoluteEpisodeNumber?: number;
	title: {
		ja?: string;
		en: string;
		fr?: string;
		'x-jat'?: string;
	};
	airDate?: string;
	airDateUtc?: string;
	runtime?: number;
	overview?: string;
	image?: string;
	episode: string;
	anidbEid: number;
	length: number;
	airdate: string;
	rating?: string;
	summary?: string;
	finaleType?: string;
}

interface Image {
	coverType: 'Banner' | 'Poster' | 'Fanart' | 'Clearlogo';
	url: string;
}

interface Mappings {
	animeplanet_id: string;
	kitsu_id: number;
	mal_id: number;
	type: string;
	anilist_id: number;
	anisearch_id: number;
	anidb_id: number;
	notifymoe_id: string;
	livechart_id: number;
	thetvdb_id: number;
	imdb_id: string;
	themoviedb_id: string;
}

export const getAniZip = async (id: number) => {
	const { data, error } = await flowery.get<AniZipData>(
		`https://api.ani.zip/mappings?anilist_id=${id}`,
	);

	if (error || !data) return undefined;

	return data.episodes ? Object.values(data.episodes) : undefined;
};

export const getAniZipMappings = async (id: number) => {
	const { data, error } = await flowery.get<AniZipData>(
		`https://api.ani.zip/mappings?anilist_id=${id}`,
	);

	if (error || !data) return undefined;

	return data.mappings;
};

export const getAniZipSynonyms = async (id: number) => {
	const { data, error } = await flowery.get<AniZipData>(
		`https://api.ani.zip/mappings?anilist_id=${id}`,
	);

	if (error || !data) return undefined;

	return data.titles ? Object.values(data.titles) : undefined;
};

export const getAniZipArtwork = async (id: number) => {
	const { data, error } = await flowery.get<AniZipData>(
		`https://api.ani.zip/mappings?anilist_id=${id}`,
	);

	if (error || !data) return undefined;

	return data.images;
};

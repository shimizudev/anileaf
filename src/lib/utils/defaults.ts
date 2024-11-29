import type {
	BaseProviderResult,
	AniListResult,
	MALResult,
	TVDBResult,
	KitsuResult,
	StreamingResult,
} from '../../types/providers';
import { FloweryFormat, FormatColor } from './format';
import { FloweryStatus, StatusColor } from './status';
import { FlowerySeason, SeasonColor } from './season';

export const DEFAULT_TITLE = {
	english: null,
	romaji: null,
	native: null,
	userPreferred: 'Unknown Title',
} as const;

export const DEFAULT_BASE_RESULT: BaseProviderResult = {
	id: '',
	title: DEFAULT_TITLE,
	malId: null,
	description: null,
	coverImage: null,
	bannerImage: null,
	genres: [],
	color: null,
	year: null,
	status: {
		status: FloweryStatus.UNKNOWN,
		color: StatusColor.UNKNOWN,
	},
	format: {
		format: FloweryFormat.UNKNOWN,
		color: FormatColor.UNKNOWN,
	},
	season: null,
	totalEpisodes: 0,
	rating: 0,
	duration: null,
	type: 'UNKNOWN',
	trailer: null,
	characters: [],
	relations: [],
	artwork: [],
	episodes: [],
} as const;

export const DEFAULT_ANILIST_RESULT: AniListResult = {
	...DEFAULT_BASE_RESULT,
	characters: [],
	relations: [],
	startDate: null,
	endDate: null,
	countryOfOrigin: null,
	studios: [],
	tags: [],
} as const;

// Default provider-specific results
export const DEFAULT_MAL_RESULT: MALResult = {
	...DEFAULT_BASE_RESULT,
	characters: [],
	staff: [],
	aired: {
		from: null,
		to: null,
		string: null,
	},
	broadcast: {
		day: null,
		time: null,
		timezone: null,
	},
	source: null,
	themes: [],
	demographics: [],
} as const;

export const DEFAULT_TVDB_RESULT: TVDBResult = {
	...DEFAULT_BASE_RESULT,
	airsDays: [],
	network: null,
	runtime: null,
	contentRating: null,
	firstAired: null,
	lastAired: null,
	nextAired: null,
	status: 'Unknown',
	overview: null,
	slug: null,
	aliases: [],
} as const;

export const DEFAULT_KITSU_RESULT: KitsuResult = {
	...DEFAULT_BASE_RESULT,
	slug: '',
	synopsis: null,
	canonicalTitle: '',
	abbreviatedTitles: [],
	averageRating: null,
	userCount: 0,
	favoritesCount: 0,
	startDate: null,
	endDate: null,
	nextRelease: null,
	popularityRank: 0,
	ratingRank: 0,
	ageRating: null,
	ageRatingGuide: null,
} as const;

export const DEFAULT_STREAMING_RESULT: StreamingResult = {
	...DEFAULT_BASE_RESULT,
	episodes: [],
	subOrDub: 'sub',
	isOngoing: false,
	lastEpisodeUpdate: null,
	nextEpisodeAir: null,
	hasNewEpisodes: false,
} as const;

// Update the ensureAnimeInfo function to use a type map
type ProviderTypeMap = {
	anilist: AniListResult;
	mal: MALResult;
	tvdb: TVDBResult;
	kitsu: KitsuResult;
	streaming: StreamingResult;
};

export function ensureAnimeInfo<T extends keyof ProviderTypeMap>(
	info: Partial<ProviderTypeMap[T]>,
	type: T,
): ProviderTypeMap[T] {
	const defaults: ProviderTypeMap = {
		anilist: DEFAULT_ANILIST_RESULT,
		mal: DEFAULT_MAL_RESULT,
		tvdb: DEFAULT_TVDB_RESULT,
		kitsu: DEFAULT_KITSU_RESULT,
		streaming: DEFAULT_STREAMING_RESULT,
	};

	return {
		...defaults[type],
		...info,
		title: {
			...DEFAULT_TITLE,
			...(typeof info.title === 'object' ? info.title : {}),
		},
	} as ProviderTypeMap[T];
}

// Helper function for ensuring provider-specific fields
export function ensureProviderFields<T extends object>(value: unknown, defaultValue: T): T {
	if (!value || typeof value !== 'object') {
		return defaultValue;
	}

	return Object.entries(defaultValue).reduce((acc, [key, defaultVal]) => {
		acc[key as keyof T] = (value as Record<string, unknown>)[key] ?? defaultVal;
		return acc;
	}, {} as T);
}

// Provider-specific ensure functions
export function ensureMALFields(value: unknown): MALResult['aired'] {
	return ensureProviderFields(value, DEFAULT_MAL_RESULT.aired);
}

export function ensureTVDBFields(value: unknown): TVDBResult['broadcast'] {
	return ensureProviderFields(value, {
		day: null,
		time: null,
		timezone: null,
	});
}

export function ensureKitsuFields(
	value: unknown,
): Pick<KitsuResult, 'averageRating' | 'userCount'> {
	return ensureProviderFields(value, {
		averageRating: null,
		userCount: 0,
	});
}

export function ensureStreamingFields(
	value: unknown,
): Pick<StreamingResult, 'subOrDub' | 'isOngoing'> {
	return ensureProviderFields(value, {
		subOrDub: 'sub',
		isOngoing: false,
	});
}

// Update utility functions to be more type-safe
export function ensureString<T extends string | null>(value: unknown, defaultValue: T): T {
	if (typeof value === 'string') return value as T;
	return defaultValue;
}

export function ensureNumber(value: unknown, defaultValue = 0): number {
	const num = Number(value);
	return Number.isNaN(num) ? defaultValue : num;
}

export function ensureArray<T>(value: unknown, defaultValue: T[] = []): T[] {
	return Array.isArray(value) ? value : defaultValue;
}

export function ensureObject<T extends object>(value: unknown, defaultValue: T): T {
	if (value && typeof value === 'object') {
		return { ...defaultValue, ...value };
	}
	return defaultValue;
}

export function ensureDate(value: unknown, defaultValue: Date | null = null): Date | null {
	if (!value) return defaultValue;
	const date = new Date(value as string);
	return Number.isNaN(date.getTime()) ? defaultValue : date;
}

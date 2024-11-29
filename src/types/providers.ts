import type { IAnimeResult, ITitle, Episode, Character, VoiceActor, Staff, Artwork } from './main';
import type { FloweryStatus, StatusColor } from '../lib/utils/status';
import type { FloweryFormat, FormatColor } from '../lib/utils/format';
import type { FlowerySeason, SeasonColor } from '../lib/utils/season';

// Base interface for all provider results
export interface BaseProviderResult extends Omit<IAnimeResult, 'trailer'> {
	id: string | number;
	title: ITitle;
	malId: number | null;
	description: string | null;
	coverImage: string | null;
	bannerImage: string | null;
	genres: string[];
	color: string | null;
	year: number | null;
	status:
		| {
				status: FloweryStatus;
				color: StatusColor;
		  }
		| string
		| null;
	format: {
		format: FloweryFormat;
		color: FormatColor;
	} | null;
	season: {
		season: FlowerySeason;
		color: SeasonColor;
	} | null;
	totalEpisodes: number;
	rating: number;
	duration: string | null;
	type: string;
	trailer: Trailer | null;
	characters: Character[];
	relations: AniListRelation[];
	artwork: Artwork[];
	episodes: Episode[] | number;
}

export type Trailer = {
	id?: string | null;
	site?: string | null;
	thumbnail?: string | null;
};

// AniList specific types
export interface AniListCharacter extends Character {
	role: string;
	voiceActors: VoiceActor[];
}

export interface AniListRelation {
	type: string;
	title: string;
	id: number;
	format: {
		format: FloweryFormat;
		color: FormatColor;
	} | null;
	status: {
		status: FloweryStatus;
		color: StatusColor;
	};
	image: string | null;
}

export interface AniListResult extends BaseProviderResult {
	characters: AniListCharacter[];
	relations: AniListRelation[];
	startDate: string | null;
	endDate: string | null;
	countryOfOrigin: string | null;
	studios: string[];
	tags: Array<{
		name: string;
		description: string;
		category: string;
	}>;
}

// MAL specific types
export interface MALCharacter extends Character {
	role: string;
	voiceActors: Array<VoiceActor & { language: string }>;
}

export interface MALResult extends BaseProviderResult {
	characters: MALCharacter[];
	staff: Staff[];
	aired: {
		from: string | null;
		to: string | null;
		string: string | null;
	};
	broadcast: {
		day: string | null;
		time: string | null;
		timezone: string | null;
	} | null;
	source: string | null;
	themes: string[];
	demographics: string[];
}

// TVDB specific types
export interface TVDBResult extends BaseProviderResult {
	airsDays: string[];
	network: string | null;
	runtime: number | null;
	contentRating: string | null;
	firstAired: string | null;
	lastAired: string | null;
	nextAired: string | null;
	status: string;
	overview: string | null;
	slug: string | null;
	aliases: string[];
}

// Kitsu specific types
export interface KitsuResult extends BaseProviderResult {
	slug: string;
	synopsis: string | null;
	canonicalTitle: string;
	abbreviatedTitles: string[];
	averageRating: string | null;
	userCount: number;
	favoritesCount: number;
	startDate: string | null;
	endDate: string | null;
	nextRelease: string | null;
	popularityRank: number;
	ratingRank: number;
	ageRating: string | null;
	ageRatingGuide: string | null;
}

// Streaming provider types
export interface StreamingEpisode extends Episode {
	sources: Array<{
		url: string;
		quality: string;
	}>;
	subtitles: Array<{
		url: string;
		lang: string;
	}>;
}

export interface StreamingResult extends BaseProviderResult {
	episodes: StreamingEpisode[];
	subOrDub: 'sub' | 'dub' | 'both';
	isOngoing: boolean;
	lastEpisodeUpdate: string | null;
	nextEpisodeAir: string | null;
	hasNewEpisodes: boolean;
}

// Union type for all provider results
export type ProviderResult = AniListResult | MALResult | TVDBResult | KitsuResult | StreamingResult;

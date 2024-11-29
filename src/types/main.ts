import type { FloweryStatus, StatusColor } from '../lib/utils/status';

export interface ITitle {
	english?: string | null;
	romaji?: string | null;
	native?: string | null;
	userPreferred?: string | null;
}

export interface Episode {
	id?: number | string | null;
	title?: string | null;
	description?: string | null;
	number?: number | null;
	image?: string | null;
	airDate?: string | null;
	rating?: number | null;
	isFiller?: boolean; // not null cause when filler is not available, it will be false
	duration?: number | string | null;
	hasDub?: boolean;
	airDateRelative?: string | null;
	airDateIso?: string | null;
	updatedAt?: number | string | null;
	season?: {
		name?: string | null;
		number?: number | null;
		aired?: {
			relative?: string | null;
			iso?: string | null;
			unix?: number | null;
			formatted?: string | null;
		};
		description?: string | null;
		image?: string | null;
		totalEpisodes?: number | null;
		rating?: number | null;
	};
}

export interface Artwork {
	type: string;
	image: string;
	provider: string;
	language?: string;
}

export interface VoiceActor {
	id?: number | null;
	name?: string | null;
	image?: string | null;
	language?: string | null;
}

export interface Character {
	id?: number | null;
	name?: string | null;
	image?: string | null;
	role?: string | null;
	voiceActors?: Array<VoiceActor>;
}

export interface Staff {
	id?: number | null;
	name?: string | null;
	image?: string | null;
	positions?: string[];
}

export interface IAnimeResult extends Record<string, unknown> {
	id: string | number;
	title: ITitle | string;
	malId?: number | null;
	image?: string | null;
	trailer?: {
		id: string | null;
		site: string;
		thumbnail: string | null;
	};
	description?: string;
	status?:
		| {
				status: FloweryStatus;
				color: StatusColor;
		  }
		| string
		| null;
	cover?: string;
	rating?: number;
	releaseDate?: string;
	color?: string;
	genres?: string[];
	totalEpisodes?: number;
	duration?: string;
	type?: string;
	episodes?: Array<Episode>;
	characters?: Array<Character>;
	staff?: Array<Staff>;
	tags?: string[];
}

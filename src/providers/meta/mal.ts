import { flowery } from '../../lib/request';
import { MAL_API } from '../../lib/constants';
import type { IAnimeResult, ITitle } from '../../types/main';
import { ensureAnimeInfo, ensureMALFields } from '../../lib/utils/defaults';
import type { StreamingResult, Trailer } from '../../types/providers';

interface MALTitle {
	type: string;
	title: string;
}

interface MALImage {
	image_url: string;
	small_image_url: string;
	large_image_url: string;
}

interface MALImages {
	jpg: MALImage;
	webp: MALImage;
}

interface MALTrailerImage {
	image_url: string;
	small_image_url: string;
	medium_image_url: string;
	large_image_url: string;
	maximum_image_url: string;
}

interface MALTrailer {
	youtube_id: string;
	url: string;
	embed_url: string;
	images: MALTrailerImage;
}

interface MALAired {
	from: string;
	to: string;
	prop: {
		from: { day: number; month: number; year: number };
		to: { day: number; month: number; year: number };
	};
	string: string;
}

interface MALBroadcast {
	day: string;
	time: string;
	timezone: string;
	string: string;
}

interface MALProducer {
	mal_id: number;
	type: string;
	name: string;
	url: string;
}

interface MALGenre {
	mal_id: number;
	type: string;
	name: string;
	url: string;
}

interface MALAnimeInfo {
	mal_id: number;
	url: string;
	images: MALImages;
	trailer: MALTrailer;
	approved: boolean;
	titles: MALTitle[];
	title: string;
	title_english: string | null;
	title_japanese: string | null;
	title_synonyms: string[];
	type: string;
	source: string;
	episodes: number;
	status: string;
	airing: boolean;
	aired: MALAired;
	duration: string;
	rating: string;
	score: number;
	scored_by: number;
	rank: number;
	popularity: number;
	members: number;
	favorites: number;
	synopsis: string;
	background: string | null;
	season: string;
	year: number;
	broadcast: MALBroadcast;
	producers: MALProducer[];
	licensors: MALProducer[];
	studios: MALProducer[];
	genres: MALGenre[];
	explicit_genres: MALGenre[];
	themes: MALGenre[];
	demographics: MALGenre[];
}

interface MALEpisode {
	mal_id: number;
	url: string | null;
	title: string;
	title_japanese: string | null;
	title_romanji: string | null;
	aired: string | null;
	score: number;
	filler: boolean;
	recap: boolean;
	forum_url: string;
}

interface MALCharacterVoiceActor {
	person: {
		mal_id: number;
		url: string;
		images: { jpg: { image_url: string } };
		name: string;
	};
	language: string;
}

interface MALCharacter {
	character: {
		mal_id: number;
		url: string;
		images: {
			jpg: { image_url: string };
			webp: { image_url: string; small_image_url: string };
		};
		name: string;
	};
	role: string;
	favorites: number;
	voice_actors: MALCharacterVoiceActor[];
}

interface MALStaffMember {
	person: {
		mal_id: number;
		url: string;
		images: { jpg: { image_url: string } };
		name: string;
	};
	positions: string[];
}

interface MALResponse<T> {
	data: T;
}

interface MALPaginatedResponse<T> {
	pagination: {
		last_visible_page: number;
		has_next_page: boolean;
	};
	data: T[];
}

export class MalProvider {
	private readonly baseUrl = MAL_API;

	/**
	 * Fetches basic anime information from MAL
	 */
	private async getBasicInfo(id: number): Promise<MALResponse<MALAnimeInfo>> {
		const response = await flowery.get<MALResponse<MALAnimeInfo>>(`${this.baseUrl}/anime/${id}`);
		if (!response.data || response.error) {
			throw new Error('No data found in the response');
		}
		return response.data;
	}

	/**
	 * Fetches episode information from MAL
	 */
	private async getEpisodes(id: number): Promise<MALPaginatedResponse<MALEpisode>> {
		const response = await flowery.get<MALPaginatedResponse<MALEpisode>>(
			`${this.baseUrl}/anime/${id}/episodes`,
		);
		if (!response.data || response.error) {
			throw new Error('No data found in the response');
		}
		return response.data;
	}

	/**
	 * Fetches character information from MAL
	 */
	private async getCharacters(id: number): Promise<MALPaginatedResponse<MALCharacter>> {
		const response = await flowery.get<MALPaginatedResponse<MALCharacter>>(
			`${this.baseUrl}/anime/${id}/characters`,
		);
		if (!response.data || response.error) {
			throw new Error('No data found in the response');
		}
		return response.data;
	}

	/**
	 * Fetches staff information from MAL
	 */
	private async getStaff(id: number): Promise<MALPaginatedResponse<MALStaffMember>> {
		const response = await flowery.get<MALPaginatedResponse<MALStaffMember>>(
			`${this.baseUrl}/anime/${id}/staff`,
		);
		if (!response.data || response.error) {
			throw new Error('No data found in the response');
		}
		return response.data;
	}

	/**
	 * Fetches full anime information from MAL
	 */
	private async getFullInfo(id: number): Promise<MALResponse<MALAnimeInfo>> {
		const response = await flowery.get<MALResponse<MALAnimeInfo>>(
			`${this.baseUrl}/anime/${id}/full`,
		);
		if (!response.data || response.error) {
			throw new Error('No data found in the response');
		}
		return response.data;
	}

	/**
	 * Converts MAL title format to ITitle format
	 */
	private convertToITitle(malInfo: MALAnimeInfo): ITitle {
		return {
			english: malInfo.titles ? malInfo.title_english : null,
			romaji: malInfo.titles ? malInfo.titles.find((t) => t.type === 'Japanese')?.title : null,
			native: malInfo.titles ? malInfo.title_japanese : null,
			userPreferred: malInfo.titles ? malInfo.title : null,
		};
	}

	/**
	 * Fetches and merges all available information for an anime
	 */
	public async getInfo(id: number): Promise<IAnimeResult> {
		try {
			// Fetch all information concurrently
			const [basicInfoResult, episodesResult, charactersResult, staffResult, fullInfoResult] =
				await Promise.allSettled([
					this.getBasicInfo(id),
					this.getEpisodes(id),
					this.getCharacters(id),
					this.getStaff(id),
					this.getFullInfo(id),
				]);

			// Get the successful results or use empty objects/arrays as fallbacks
			const basicInfo =
				basicInfoResult.status === 'fulfilled' ? basicInfoResult.value.data : ({} as MALAnimeInfo);
			const episodes =
				episodesResult.status === 'fulfilled' ? episodesResult.value.data : ([] as MALEpisode[]);
			const characters =
				charactersResult.status === 'fulfilled'
					? charactersResult.value.data
					: ([] as MALCharacter[]);
			const staff =
				staffResult.status === 'fulfilled' ? staffResult.value.data : ([] as MALStaffMember[]);
			const fullInfo =
				fullInfoResult.status === 'fulfilled' ? fullInfoResult.value.data : ({} as MALAnimeInfo);

			// Merge all information, preferring fullInfo over basicInfo when available
			const mergedInfo: IAnimeResult = {
				id: fullInfo.mal_id
					? String(fullInfo.mal_id)
					: basicInfo?.mal_id
						? String(basicInfo?.mal_id)
						: String(id),
				title: this.convertToITitle(fullInfo || basicInfo),
				malId: fullInfo?.mal_id || basicInfo?.mal_id || null,
				image:
					fullInfo?.images?.jpg?.large_image_url || basicInfo?.images?.jpg?.large_image_url || null,
				aired: fullInfo?.aired || basicInfo?.aired || null,
				isAiring: fullInfo?.airing || basicInfo?.airing || false,
				synonyms: fullInfo?.title_synonyms || basicInfo?.title_synonyms || [],
				trailer: {
					id: basicInfo?.trailer?.youtube_id || null,
					site: 'youtube',
					thumbnail:
						fullInfo?.trailer?.images?.maximum_image_url ||
						basicInfo?.trailer?.images?.maximum_image_url,
				},
				description: fullInfo?.synopsis || basicInfo?.synopsis || '',
				status: fullInfo?.status || basicInfo?.status || null,
				cover:
					fullInfo?.images?.jpg?.large_image_url || basicInfo?.images?.jpg?.large_image_url || '',
				rating: fullInfo?.score || basicInfo?.score || 0,
				releaseDate: fullInfo?.aired?.from || basicInfo?.aired?.from || '',
				color: '#000000', // MAL doesn't provide color information
				genres: basicInfo?.genres ? basicInfo?.genres.map((g) => g.name) : [],
				totalEpisodes: basicInfo?.episodes,
				duration: basicInfo?.duration,
				type: basicInfo?.type,
				// Additional merged information
				episodes:
					// biome-ignore lint/complexity/useOptionalChain: <explanation>
					episodes && episodes?.length
						? episodes.map((ep) => ({
								id: ep?.mal_id,
								title: ep?.title,
								description: null,
								number: ep?.mal_id,
								image: null,
								airDate: ep?.aired,
							}))
						: [],
				characters:
					// biome-ignore lint/complexity/useOptionalChain: <explanation>
					characters && characters?.length
						? characters.map((char) => ({
								id: char?.character.mal_id,
								name: char?.character.name,
								image: char?.character.images.jpg.image_url,
								role: char?.role,
								voiceActors: char?.voice_actors.map((va) => ({
									id: va?.person.mal_id,
									name: va?.person.name,
									image: va?.person.images.jpg.image_url,
									language: va?.language,
								})),
							}))
						: [],
				staff:
					// biome-ignore lint/complexity/useOptionalChain: <explanation>
					staff && staff?.length
						? staff.map((s) => ({
								id: s?.person.mal_id,
								name: s?.person.name,
								image: s?.person.images.jpg.image_url,
								positions: s?.positions,
							}))
						: [],
			};

			return mergedInfo;
		} catch (error) {
			console.error('MAL getInfo error:', error);
			const fallback = ensureAnimeInfo({ id: String(id) }, 'mal');
			fallback.trailer = {
				id: null,
				site: 'youtube',
				thumbnail: null,
			};
			// @ts-expect-error
			return fallback;
		}
	}
}

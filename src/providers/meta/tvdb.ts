import { RequestClient, type RequestResponse } from '../../lib/request';
import { sanitizeTitle } from '../../lib/string-sim';
import { Format } from '../../lib/utils/format';
import type { Artwork as ArtworkType, Character, Episode, IAnimeResult } from '../../types/main';
import { format as dateFormat, formatDistanceToNow, parseISO } from 'date-fns';

interface Search {
	objectID: string;
	country?: Country;
	director?: string;
	extended_title?: string;
	genres?: Genre[];
	id: string;
	image_url: string;
	name: string;
	overview?: string;
	primary_language?: PrimaryLanguage;
	primary_type: TVDBType;
	status?: Status;
	type: TVDBType;
	tvdb_id: string;
	year?: string;
	slug?: string;
	overviews?: Overviews;
	translations: Overviews;
	remote_ids?: RemoteID[];
	thumbnail?: string;
	aliases?: string[];
	first_air_time?: Date;
	network?: string;
	studios?: string[];
}

enum Country {
	CZE = 'cze',
	JPN = 'jpn',
	USA = 'usa',
}

enum Genre {
	ACTION = 'Action',
	ADVENTURE = 'Adventure',
	ANIMATION = 'Animation',
	ANIME = 'Anime',
	CHILDREN = 'Children',
	COMEDY = 'Comedy',
	DRAMA = 'Drama',
	FAMILY = 'Family',
	FANTASY = 'Fantasy',
	SPORT = 'Sport',
}

interface Overviews {
	eng?: string;
	fra?: string;
	ita?: string;
	jpn?: string;
	pol?: string;
	pt?: string;
	spa?: string;
	por?: string;
	ara?: string;
	cat?: string;
	deu?: string;
	heb?: string;
	kor?: string;
	msa?: string;
	rus?: string;
	srp?: string;
	tur?: string;
	zho?: string;
	hun?: string;
	cha?: string;
	nld?: string;
	tha?: string;
	ces?: string;
}

enum PrimaryLanguage {
	CES = 'ces',
	ENG = 'eng',
	ITA = 'ita',
	JPN = 'jpn',
}

enum TVDBType {
	LIST = 'list',
	MOVIE = 'movie',
	SERIES = 'series',
}

interface RemoteID {
	id: string;
	type: number;
	sourceName: SourceName;
}

enum SourceName {
	EIDR = 'EIDR',
	FACEBOOK = 'Facebook',
	FANSITE = 'Fan Site',
	IMDB = 'IMDB',
	INSTAGRAM = 'Instagram',
	OFFICIAL_WEBSITE = 'Official Website',
	TMS_ZAP2It = 'TMS (Zap2It)',
	TMDB = 'TheMovieDB.com',
	TWITTER = 'Twitter',
	YOUTUBE = 'Youtube',
}

enum Status {
	CONTINUING = 'Continuing',
	ENDED = 'Ended',
	RELEASED = 'Released',
	UPCOMING = 'Upcoming',
}

export class TVDBProvider {
	private readonly client: RequestClient;
	private readonly tvdbUrl = 'https://thetvdb.com';
	private readonly apiKeys = [
		'f5744a13-9203-4d02-b951-fbd7352c1657',
		'8f406bec-6ddb-45e7-8f4b-e1861e10f1bb',
		'5476e702-85aa-45fd-a8da-e74df3840baf',
		'51020266-18f7-4382-81fc-75a4014fa59f',
	];
	private formats: Format[] = [
		Format.TV,
		Format.MOVIE,
		Format.ONA,
		Format.SPECIAL,
		Format.TV_SHORT,
		Format.OVA,
	];

	private async getToken(key: string): Promise<string | undefined> {
		const data: RequestResponse<unknown> | undefined = await this.client
			.post('login', {
				body: JSON.stringify({
					apikey: `${key}`,
				}),
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			})
			.catch((err) => {
				console.error(err);
				return undefined;
			});
		if (!data) return undefined;

		if (!data.error) {
			return (data.data as { data: { token: string } }).data.token as string;
		}

		return undefined;
	}

	constructor() {
		this.client = new RequestClient('https://api4.thetvdb.com/v4');
	}

	async search(query: string, format?: Format, year?: number): Promise<IAnimeResult[] | undefined> {
		const isSeason = query.toLowerCase().includes('season');

		const token = await this.getToken(
			this.apiKeys[Math.floor(Math.random() * this.apiKeys.length)],
		);

		const sanitizedQuery = sanitizeTitle(query);

		const formattedType =
			format === Format.TV || format === Format.TV_SHORT || format === Format.SPECIAL
				? 'series'
				: format === Format.MOVIE
					? 'movies'
					: undefined;

		const { data: searchData, error } = await this.client.get<{ data: Search[] }>(
			`search?query=${encodeURIComponent(sanitizedQuery as string)}${isSeason && year ? `&year=${year}` : ''}${formattedType ? `&type=${formattedType}` : ''}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		);

		if (error) return undefined;

		const results: IAnimeResult[] = [];

		for (const data of searchData?.data || []) {
			if (data.primary_type !== TVDBType.SERIES && data.primary_type !== TVDBType.MOVIE) continue;
			if (isSeason) data.year = '0';

			const firstAirDate = data.first_air_time ? parseISO(data.first_air_time.toString()) : null;
			const relativeAirDate = firstAirDate
				? formatDistanceToNow(firstAirDate, { addSuffix: true })
				: null;
			const formattedAirDate = firstAirDate ? dateFormat(firstAirDate, 'MMMM do, yyyy') : null;

			results.push({
				id: `${data.primary_type}/${data.tvdb_id}`,
				format: Format.UNKNOWN,
				title: {
					english: data.translations.eng ?? data.name,
					romaji: data.translations.jpn ?? data.name,
					userPreferred: data.translations.eng ?? data.name,
				},
				synonyms: data.aliases ?? [],
				image: data.image_url,
				year: Number(data.year ?? 0) ?? 0,
				airDate: formattedAirDate,
				airDateRelative: relativeAirDate,
				airDateIso: firstAirDate?.toISOString(),
			});
		}

		return results;
	}

	async getInfo(
		id: string,
		hasPrequelRelation: boolean,
		mediaCoverImage: string,
	): Promise<IAnimeResult | undefined> {
		const token = await this.getToken(
			this.apiKeys[Math.floor(Math.random() * this.apiKeys.length)],
		);

		interface TVDBExtendedInfo {
			aliases: { name: string }[];
			firstAired: string;
			averageRuntime: number;
			characters: {
				name: string;
				image: string;
				peopleName?: string;
				personName?: string;
				peopleImageURL?: string;
				personImgURL?: string;
			}[];
			artworks: Artwork[];
			genres: { name: string }[];
			trailers: { url: string }[];
			tags: { name: string }[];
			year?: number;
			airsDays: unknown;
		}

		const { data, error } = await this.client.get<{ data: TVDBExtendedInfo }>(`${id}/extended`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (error || !data) return undefined;

		const info = data.data;

		const aliases = info.aliases;
		const firstAired = info.firstAired ? parseISO(info.firstAired) : undefined;
		const relativeAirDate = firstAired
			? formatDistanceToNow(firstAired, { addSuffix: true })
			: undefined;
		const formattedAirDate = firstAired ? dateFormat(firstAired, 'MMMM do, yyyy') : undefined;

		const averageRunTime = info.averageRuntime;

		const characters: Character[] = (info.characters ?? [])
			.map((character) => {
				return {
					name: character.name,
					image: character.image,
					voiceActor: [
						{
							name: character.peopleName ?? character.personName,
							image: character.peopleImageURL ?? character.personImgURL,
						},
					],
				};
			})
			.filter(Boolean);

		const artwork: Artwork[] = info.artworks;

		const artworkIds = {
			banner: [1, 16, 6],
			poster: [2, 7, 14, 27],
			backgrounds: [3, 8, 15],
			icon: [5, 10, 18, 19, 26],
			clearArt: [22, 24],
			clearLogo: [23, 25],
			fanart: [11, 12],
			actorPhoto: [13],
			cinemagraphs: [20, 21],
		};

		const coverImages = artwork.filter((art) => artworkIds.poster.includes(Number(art.type)));
		coverImages.sort((a, b) => b.score - a.score);

		const banners = artwork.filter((art) => artworkIds.backgrounds.includes(Number(art.type)));
		banners.sort((a, b) => b.score - a.score);

		const genres = info.genres;

		//const trailers = info.trailers;

		const airsDays = info.airsDays;

		const artworkData = artwork
			.map((art): ArtworkType | undefined => {
				const type = artworkIds.backgrounds.includes(art.type)
					? 'banner'
					: artworkIds.banner.includes(art.type)
						? 'top_banner'
						: artworkIds.clearLogo.includes(art.type)
							? 'clear_logo'
							: artworkIds.poster.includes(art.type)
								? 'poster'
								: artworkIds.icon.includes(art.type)
									? 'icon'
									: artworkIds.clearArt.includes(art.type)
										? 'clear_art'
										: null;
				if (!type) return;
				return {
					type: type,
					image: art.image,
					provider: 'tvdb',
					language: art.language ?? undefined,
				};
			})
			.filter((art): art is ArtworkType => art !== undefined);

		const coverImage = !hasPrequelRelation
			? (coverImages[0]?.image ?? mediaCoverImage ?? null)
			: (mediaCoverImage ?? null);

		return {
			id: id,
			title: {
				english: null,
				romaji: null,
				native: null,
			},
			currentEpisode: undefined,
			trailer: undefined,
			duration: String(averageRunTime) ?? undefined,
			color: undefined,
			bannerImage: banners[0]?.image ?? undefined,
			coverImage,
			status: undefined,
			format: Format.UNKNOWN,
			season: 'Unknown',
			synonyms: aliases?.map((alias) => alias.name) ?? [],
			description: undefined,
			year: Number(info.year ?? firstAired?.getFullYear()) ?? undefined,
			totalEpisodes: 0,
			genres: genres ? genres.map((genre) => genre.name) : [],
			rating: undefined,
			popularity: undefined,
			countryOfOrigin: undefined,
			tags: info.tags?.map((tag) => tag.name) ?? [],
			relations: [],
			artwork: artworkData,
			characters: characters.slice(0, 10),
			totalChapters: undefined,
			totalVolumes: undefined,
			airDate: formattedAirDate,
			airDateRelative: relativeAirDate,
			airDateIso: firstAired ? firstAired.toISOString() : undefined,
			airsDays,
		};
	}

	// Fix this
	// async getEpisodes(id: string, yearRange?: string): Promise<Episode[] | undefined> {
	// 	const token = await this.getToken(
	// 		this.apiKeys[Math.floor(Math.random() * this.apiKeys.length)],
	// 	);
	// 	if (!token) return undefined;

	// 	let startYear: number | undefined;
	// 	let endYear: number | undefined;
	// 	const isYearRange = yearRange?.includes('-');

	// 	if (yearRange) {
	// 		const parts = yearRange.split('-');
	// 		if (parts.length === 2) {
	// 			startYear = Number(parts[0]);
	// 			endYear = Number(parts[1]);
	// 		} else {
	// 			startYear = Number(yearRange);
	// 		}
	// 	}

	// 	const { data: extendedInfo, error } = await this.client.get<{
	// 		data: { seasons: { id: string }[] };
	// 	}>(`${id}/extended`, {
	// 		headers: {
	// 			Authorization: `Bearer ${token}`,
	// 		},
	// 	});

	// 	if (error || !extendedInfo?.data?.seasons) return undefined;

	// 	const episodes: Episode[] = [];
	// 	const seasons = extendedInfo.data.seasons;

	// 	for (const season of seasons) {
	// 		const { data: seasonData, error: seasonError } = await this.client.get<{
	// 			data: {
	// 				episodes: {
	// 					id: string;
	// 					name: string;
	// 					overview: string;
	// 					image: string;
	// 					number: number;
	// 					seasonNumber: number;
	// 					aired: string;
	// 				}[];
	// 			};
	// 		}>(`seasons/${season.id}/extended`, {
	// 			headers: {
	// 				Authorization: `Bearer ${token}`,
	// 			},
	// 		});

	// 		if (seasonError || !seasonData?.data?.episodes) continue;

	// 		const relevantEpisodes = seasonData.data.episodes.filter((episode) => {
	// 			if (!startYear) return true;

	// 			const episodeYear = new Date(episode.aired).getFullYear();
	// 			if (isYearRange && endYear) {
	// 				return episodeYear >= startYear && episodeYear <= endYear;
	// 			}
	// 			return episodeYear === startYear;
	// 		});

	// 		for (const episode of relevantEpisodes) {
	// 			const { data: translation } = await this.client
	// 				.get<{
	// 					data: { name: string; overview: string };
	// 				}>(`episodes/${episode.id}/translations/eng`, {
	// 					headers: {
	// 						Authorization: `Bearer ${token}`,
	// 					},
	// 				})
	// 				.catch(() => ({ data: { data: { name: episode.name, overview: episode.overview } } }));

	// 			episodes.push({
	// 				id: episode.id,
	// 				title: translation?.data.name || 'TBD',
	// 				description: translation?.data.overview || 'TBD',
	// 				number: episode.number,
	// 				image: episode.image,
	// 				airDate: new Date(episode.aired).toISOString(),
	// 				seasonNumber: episode.seasonNumber,
	// 				updatedAt: new Date(episode.aired).getTime(),
	// 			});
	// 		}
	// 	}

	// 	return episodes.sort((a, b) => {
	// 		const yearA = new Date(a.airDate ?? '').getFullYear();
	// 		const yearB = new Date(b.airDate ?? '').getFullYear();
	// 		if (yearA !== yearB) return yearA - yearB;
	// 		return (a.number ?? 0) - (b.number ?? 0);
	// 	});
	// }
}

interface Artwork {
	id: number;
	image: string;
	thumbnail: string;
	language: null | string;
	type: number;
	score: number;
	width: number;
	height: number;
	includesText: boolean;
	thumbnailWidth: number;
	thumbnailHeight: number;
	updatedAt: number;
	status: {
		id: number;
		name: null | string;
	};
	tagOptions: null;
}

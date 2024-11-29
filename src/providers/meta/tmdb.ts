import { RequestClient } from '../../lib/request';
import type { Artwork, IAnimeResult } from '../../types/main';
import { FloweryFormat } from '../../lib/utils/format';
import { formatDate, formatDistanceToNow } from 'date-fns';
import { write } from 'bun';

function capitalize(str: string) {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

type TMDBResult = {
	adult: boolean;
	backdrop_path: string | null;
	id: number;
	title?: string;
	name: string;
	original_language: string;
	original_title?: string;
	original_name: string;
	overview: string;
	poster_path: string | null;
	media_type: string;
	genre_ids: number[];
	popularity: number;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	origin_country: string[];
};

export class TmdbProvider {
	private readonly client: RequestClient;

	private readonly apiKeys = [
		'5201b54eb0968700e693a30576d7d4dc',
		'90e16ce333e4cf24f75af1eff2727dd1',
	];

	private getApiKey(): string {
		return this.apiKeys[Math.floor(Math.random() * this.apiKeys.length)];
	}

	constructor() {
		this.client = new RequestClient('https://api.themoviedb.org/3');
	}

	async search(query: string): Promise<IAnimeResult[]> {
		const results: IAnimeResult[] = [];
		const { data, error } = await this.client.get<{ results: TMDBResult[] }>(
			`search/multi?query=${query}&api_key=${this.getApiKey()}`,
		);
		if (error || !data) {
			console.error(error);
			return [];
		}

		for (const result of data.results) {
			if (result.media_type === 'tv') {
				results.push({
					id: `tv/${result.id}`,
					title: {
						english: result.title || result.name,
						romaji: result.original_title || result.original_name,
						native: result.original_title || result.original_name,
						userPreferred: result.title || result.name,
					},
					synonyms: [result.original_title || result.original_name, result.title || result.name],
					image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
					format: FloweryFormat.UNKNOWN,
					year: result.first_air_date ? new Date(result.first_air_date).getFullYear() : 0,
				});
			} else if (result.media_type === 'movie') {
				results.push({
					id: `movie/${result.id}`,
					title: result.title || result.name,
					synonyms: [result.original_title || result.original_name, result.title || result.name],
					image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
					format: FloweryFormat.MOVIE,
					year: result.first_air_date ? new Date(result.first_air_date).getFullYear() : 0,
				});
			}
		}
		return results;
	}

	async getInfo(id: string) {
		const res = this.client.get<{
			first_air_date: string;
			episode_run_time: number[];
			name: string;
			original_name: string;
			last_episode_to_air: { episode_number: number };
			backdrop_path: string;
			poster_path: string;
			overview: string;
			genres: { id: number; name: string }[];
			vote_average: number;
			popularity: number;
			origin_country: string[];
			number_of_episodes: number;
		}>(`${id}?api_key=${this.getApiKey()}`);

		const artRes = this.client.get<{
			backdrops: {
				file_path: string;
				aspect_ratio: number;
				height: number;
				width: number;
				vote_average: number;
				vote_count: number;
			}[];
			posters: {
				file_path: string;
				aspect_ratio: number;
				height: number;
				width: number;
				vote_average: number;
				vote_count: number;
			}[];
			logos: {
				file_path: string;
				aspect_ratio: number;
				height: number;
				width: number;
				vote_average: number;
				vote_count: number;
			}[];
		}>(`${id}/images?api_key=${this.getApiKey()}`);
		const keywordsRes = this.client.get<{
			results: { id: number; name: string }[];
		}>(`${id}/keywords?api_key=${this.getApiKey()}`);

		const [
			{ data: info, error: infoError },
			{ data: artData, error: artError },
			{ data: keywordsData, error: keywordsError },
		] = await Promise.all([res, artRes, keywordsRes]);

		if (infoError || !info || artError || !artData || keywordsError || !keywordsData) {
			console.error(infoError || artError);
			return null;
		}

		const sortedBackdrops = artData.backdrops.toSorted((a, b) => b.vote_average - a.vote_average);
		const sortedPosters = artData.posters.toSorted((a, b) => b.vote_average - a.vote_average);
		const sortedLogos = artData.logos.toSorted((a, b) => b.vote_average - a.vote_average);

		const artwork = new Set([
			...sortedBackdrops.map((backdrop) => ({
				provider: 'tmdb',
				image: `https://image.tmdb.org/t/p/w500${backdrop.file_path}`,
				type: 'backdrops',
			})),
			...sortedPosters.map((poster) => ({
				provider: 'tmdb',
				image: `https://image.tmdb.org/t/p/w500${poster.file_path}`,
				type: 'poster',
			})),
			...sortedLogos.map((logo) => ({
				provider: 'tmdb',
				image: `https://image.tmdb.org/t/p/w500${logo.file_path}`,
				type: 'clear_logo',
			})),
		]) as Set<Artwork>;

		return {
			id: id,
			title: {
				english: info?.name,
				romaji: null,
				native: info?.original_name,
			},
			currentEpisode: info?.last_episode_to_air?.episode_number,
			trailer: null,
			duration: info?.episode_run_time?.length ? info.episode_run_time[0] : null,
			color: null,
			bannerImage: info?.backdrop_path
				? `https://image.tmdb.org/t/p/w500${info.backdrop_path}`
				: null,
			coverImage: info?.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : null,
			status: null,
			format: FloweryFormat.UNKNOWN,
			season: 'Unknown',
			synonyms: [],
			description: info?.overview,
			year: info?.first_air_date ? new Date(info.first_air_date).getFullYear() : 0,
			aired: info?.first_air_date ? formatDate(info.first_air_date, 'dd MMMM, yyyy') : null,
			airedRelative: info?.first_air_date ? formatDistanceToNow(info.first_air_date) : null,
			totalEpisodes: info?.number_of_episodes,
			genres: info?.genres?.map((genre: { id: number; name: string }) => genre.name),
			rating: info?.vote_average,
			popularity: info?.popularity,
			countryOfOrigin: info?.origin_country[0] ?? null,
			tags: keywordsData?.results?.map((keyword) => capitalize(keyword.name)) ?? [],
			relations: [],
			artwork: Array.from(artwork) ?? [],
			characters: [],
			totalChapters: null,
			totalVolumes: null,
		};
	}

	// Date format: YYYY-MM-DD
	async getSeason(id: string, startDate?: string, endDate?: string) {
		const { data, error } = await this.client.get<{
			seasons: {
				air_date: string;
				season_number: number;
				id: number;
				name: string;
				overview: string;
				poster_path: string;
				episode_count: number;
				vote_average: number;
			}[];
		}>(`${id}?api_key=${this.getApiKey()}`);

		if (error || !data) {
			console.error(error);
			return [];
		}

		if (!data.seasons) return [];

		const formattedSeasons = data.seasons.map((season) => ({
			...season,
			year: new Date(season.air_date).getFullYear(),
			month: new Date(season.air_date).getMonth() + 1,
		}));

		if (formattedSeasons.length === 0) return [];

		if (!startDate) return formattedSeasons;

		const date = new Date(startDate as string);
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const endDateObj = endDate ? new Date(endDate) : null;
		const endYear = endDateObj ? endDateObj.getFullYear() : null;
		const endMonth = endDateObj ? endDateObj.getMonth() + 1 : null;

		const relevantSeasonStartIndex = formattedSeasons.findIndex(
			(season) => season.year === year && season.month === month,
		);

		const relevantSeasonEndIndex = endDateObj
			? formattedSeasons.findIndex((season) => season.year === endYear && season.month === endMonth)
			: formattedSeasons.length;

		// If relevantSeasonStartIndex or relevantSeasonEndIndex is not -1, then we need to slice the seasons
		// If relevantSeasonStartIndex is zero and relevantSeasonEndIndex is the last index, then we return all seasons
		// Otherwise, we return the seasons between the two indexes (For animes like Attack On Titan where the first season is not the first season in the array)
		// For animes like One Piece, where there is no end date, we return all seasons
		const seasons =
			relevantSeasonStartIndex !== -1 ||
			relevantSeasonEndIndex !== formattedSeasons.length ||
			relevantSeasonEndIndex !== 0
				? formattedSeasons.slice(
						relevantSeasonStartIndex,
						relevantSeasonEndIndex === -1 ? undefined : relevantSeasonEndIndex,
					)
				: formattedSeasons;

		return seasons;
	}

	async getEpisode(id: string, startDate?: string, endDate?: string) {
		const seasons = await this.getSeason(id, startDate, endDate);
		const episodes = [];

		for (const season of seasons) {
			const { data, error } = await this.client.get<{
				episodes: {
					id: number;
					overview: string;
					still_path: string;
					episode_number: number;
					air_date: string;
					name: string;
					vote_average: number;
				}[];
			}>(`${id}/season/${season.season_number}?api_key=${this.getApiKey()}`);

			if (error || !data) {
				console.error(error);
				return [];
			}

			for (const episode of data.episodes) {
				episodes.push({
					id: episode.id ? String(episode.id) : null,
					description: episode?.overview ?? null,
					image: episode?.still_path
						? `https://image.tmdb.org/t/p/w500${episode.still_path}`
						: null,
					number: episode.episode_number,
					title: episode.name,
					airDateRelative: episode.air_date ? formatDistanceToNow(episode.air_date) : null,
					airDateIso: episode.air_date ? new Date(episode.air_date).toISOString() : null,
					updatedAt: episode.air_date ? new Date(episode.air_date).getTime() : null,
					rating: episode.vote_average,
					season: {
						name: season.name ?? `Season ${season.season_number ?? 1}`,
						number: season.season_number ?? 1,
						aired: {
							relative: season.air_date ? formatDistanceToNow(season.air_date) : null,
							iso: season.air_date ? new Date(season.air_date).toISOString() : null,
							unix: season.air_date ? new Date(season.air_date).getTime() : null,
							formatted: season.air_date ? formatDate(season.air_date, 'dd MMMM, yyyy') : null,
						},
						description: season.overview ?? null,
						image: season.poster_path
							? `https://image.tmdb.org/t/p/w500${season.poster_path}`
							: null,
						totalEpisodes: season.episode_count ?? null,
						rating: season.vote_average ?? null,
					},
				});
			}
		}

		return episodes;
	}
}

const tmdb = new TmdbProvider();

write('episodes.json', JSON.stringify(await tmdb.getEpisode('tv/46260', '2002-10-03', '2024')));

import { load } from 'cheerio';
import { HIANIME_URL } from '../../lib/constants';
import { flowery, RequestClient } from '../../lib/request';
import type { IAnimeResult, ITitle } from '../../types/main';
import { cleanTitle } from '../../lib/string-sim';

export interface HiAnimeEpisode {
	id: string;
	isFiller: boolean;
	title: string;
	number: number;
}

interface AnimeInfo {
	id: string | null;
	name: string | null;
	description: string | null;
	poster: string | null;
	anilistId: number | null;
	malId: number | null;
	stats: {
		rating: string | null;
		quality: string | null;
		episodes: {
			sub: number | null;
			dub: number | null;
		};
		type: string | null;
		duration: string | null;
	};
	promotionalVideos: {
		title: string | undefined;
		source: string | undefined;
		thumbnail: string | undefined;
	}[];
	charactersVoiceActors: {
		character: {
			id: string;
			poster: string;
			name: string;
			cast: string;
		};
		voiceActor: {
			id: string;
			poster: string;
			name: string;
			cast: string;
		};
	}[];
	moreInfo: {
		[key: string]: string | string[];
	};
}

interface AnimeSeasons {
	id: string | null;
	name: string | null;
	title: string | null;
	poster: string | null;
	isCurrent: boolean;
}

export interface AnimeResult {
	anime: {
		info: AnimeInfo;
		moreInfo: { [key: string]: string | string[] };
	};
	seasons: AnimeSeasons[];
}

/**
 * Represents a provider for fetching anime data from Hianime.
 */
export class HianimeProvider {
	private client: RequestClient;
	private ajaxUrl = `${HIANIME_URL}/ajax`;

	/**
	 * Initializes a new instance of the HianimeProvider.
	 */
	constructor() {
		this.client = new RequestClient(HIANIME_URL);
	}

	/**
	 * Searches for anime titles based on a given query.
	 * @param {string} query - The search query.
	 * @returns {Promise<IAnimeResult[]>} - A promise that resolves to an array of search results.
	 */
	async search(query: string): Promise<IAnimeResult[]> {
		const { data, error } = await this.client.get<string>(
			`search?keyword=${encodeURIComponent(query)}`,
		);

		if (error) throw error;

		const $ = load(data as string);

		const results = new Set<IAnimeResult>();

		$('.film_list-wrap > .flw-item').each((_, el) => {
			const titleEnglish = $(el).find('.film-name').text().trim();
			const titleRomaji = $(el).find('.film-name a').attr('data-jname');
			const urlToPage = $(el).find('.film-name a').attr('href');
			const coverImage = $(el).find('.film-poster img').attr('data-src');
			const id = $(el).find('.film-poster a').attr('data-id');
			const type = $(el).find('.fd-infor .fdi-item').first().text().trim();
			const episodeLength = $(el).find('.fd-infor .fdi-item.fdi-duration').text().trim();
			const totalEpisodeSub = $(el).find('.tick-item.tick-sub').text().trim() || undefined;
			const totalEpisodeDub = $(el).find('.tick-item.tick-dub').text().trim() || undefined;
			const totalEpisodes =
				$(el).find('.tick-item.tick-eps').text().trim() ||
				totalEpisodeSub ||
				totalEpisodeDub ||
				undefined;
			const slug = urlToPage?.split('/').pop()?.split('?ref=')[0];

			const title: ITitle = {
				english: cleanTitle(titleEnglish),
				romaji: cleanTitle(titleRomaji),
				userPreferred: cleanTitle(titleRomaji || titleEnglish),
			};

			const url = `${HIANIME_URL}${urlToPage}`;

			results.add({
				id: Number(id) || String(slug),
				title,
				url,
				coverImage,
				type,
				totalEpisodes: Number(totalEpisodes),
				slug,
				totalEpisodesSub: totalEpisodeSub ? Number(totalEpisodeSub) : undefined,
				totalEpisodesDub: totalEpisodeDub ? Number(totalEpisodeDub) : undefined,
				episodeLength,
			});
		});

		return Array.from(results);
	}

	async getInfo(id: string) {
		const { data, error } = await this.client.get<string>(`${id}`);

		if (error || !data) return undefined;

		const $ = load(data as string);

		const res: AnimeResult = {
			anime: {
				info: {
					id: null,
					name: null,
					description: null,
					poster: null,
					anilistId: null,
					malId: null,
					stats: {
						rating: null,
						quality: null,
						episodes: { sub: null, dub: null },
						type: null,
						duration: null,
					},
					promotionalVideos: [],
					charactersVoiceActors: [],
					moreInfo: {},
				},
				moreInfo: {},
			},
			seasons: [],
		};

		try {
			res.anime.info.anilistId = Number(
				JSON.parse($('body').find('#syncData').text() || '{}')?.anilist_id,
			);
			res.anime.info.malId = Number(JSON.parse($('body').find('#syncData').text() || '{}')?.mal_id);
		} catch (_err) {
			res.anime.info.anilistId = null;
			res.anime.info.malId = null;
		}

		const selector = '#ani_detail .container .anis-content';

		res.anime.info.id =
			$(selector)
				?.find('.anisc-detail .film-buttons a.btn-play')
				?.attr('href')
				?.split('/')
				?.pop() || null;
		res.anime.info.name =
			$(selector)?.find('.anisc-detail .film-name.dynamic-name')?.text()?.trim() || null;
		res.anime.info.description =
			$(selector)
				?.find('.anisc-detail .film-description .text')
				.text()
				?.split('[')
				?.shift()
				?.trim() || null;
		res.anime.info.poster =
			$(selector)?.find('.film-poster .film-poster-img')?.attr('src')?.trim() || null;

		res.anime.info.stats.rating =
			$(`${selector} .film-stats .tick .tick-pg`)?.text()?.trim() || null;
		res.anime.info.stats.quality =
			$(`${selector} .film-stats .tick .tick-quality`)?.text()?.trim() || null;
		res.anime.info.stats.episodes = {
			sub: Number($(`${selector} .film-stats .tick .tick-sub`)?.text()?.trim()) || null,
			dub: Number($(`${selector} .film-stats .tick .tick-dub`)?.text()?.trim()) || null,
		};
		res.anime.info.stats.type =
			$(`${selector} .film-stats .tick`)
				?.text()
				?.trim()
				?.replace(/[\s\n]+/g, ' ')
				?.split(' ')
				?.at(-2) || null;
		res.anime.info.stats.duration =
			$(`${selector} .film-stats .tick`)
				?.text()
				?.trim()
				?.replace(/[\s\n]+/g, ' ')
				?.split(' ')
				?.pop() || null;

		$('.block_area.block_area-promotions .block_area-promotions-list .screen-items .item').each(
			(_, el) => {
				res.anime.info.promotionalVideos.push({
					title: $(el).attr('data-title'),
					source: $(el).attr('data-src'),
					thumbnail: $(el).find('img').attr('src'),
				});
			},
		);

		$('.block_area.block_area-actors .block-actors-content .bac-list-wrap .bac-item').each(
			(_, el) => {
				res.anime.info.charactersVoiceActors.push({
					character: {
						id: $(el).find($('.per-info.ltr .pi-avatar')).attr('href')?.split('/')[2] || '',
						poster: $(el).find($('.per-info.ltr .pi-avatar img')).attr('data-src') || '',
						name: $(el).find($('.per-info.ltr .pi-detail a')).text(),
						cast: $(el).find($('.per-info.ltr .pi-detail .pi-cast')).text(),
					},
					voiceActor: {
						id: $(el).find($('.per-info.rtl .pi-avatar')).attr('href')?.split('/')[2] || '',
						poster: $(el).find($('.per-info.rtl .pi-avatar img')).attr('data-src') || '',
						name: $(el).find($('.per-info.rtl .pi-detail a')).text(),
						cast: $(el).find($('.per-info.rtl .pi-detail .pi-cast')).text(),
					},
				});
			},
		);

		$(`${selector} .anisc-info-wrap .anisc-info .item:not(.w-hide)`).each((_, el) => {
			let key = $(el).find('.item-head').text().toLowerCase().replace(':', '').trim();
			key = key.includes(' ') ? key.replace(' ', '') : key;

			const value = [
				...$(el)
					.find('*:not(.item-head)')
					.map((_, el) => $(el).text().trim()),
			]
				.map((i) => `${i}`)
				.toString()
				.trim();

			if (key === 'genres') {
				res.anime.moreInfo[key] = value.split(',').map((i) => i.trim());
				return;
			}
			if (key === 'producers') {
				res.anime.moreInfo[key] = value.split(',').map((i) => i.trim());
				return;
			}
			res.anime.moreInfo[key] = value;
		});

		const seasonsSelector = '#main-content .os-list a.os-item';
		$(seasonsSelector).each((_, el) => {
			res.seasons.push({
				id: $(el)?.attr('href')?.slice(1)?.trim() || null,
				name: $(el)?.attr('title')?.trim() || null,
				title: $(el)?.find('.title')?.text()?.trim(),
				poster:
					$(el)
						?.find('.season-poster')
						?.attr('style')
						?.split(' ')
						?.pop()
						?.split('(')
						?.pop()
						?.split(')')[0] || null,
				isCurrent: $(el).hasClass('active'),
			});
		});

		return res;
	}

	async getEpisodes(id: string, slug: string) {
		const { data, error } = await flowery.get<{ html: string }>(
			`${this.ajaxUrl}/v2/episode/list/${id}`,
			{
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
					Referer: `${HIANIME_URL}/watch/${slug}`,
				},
			},
		);

		if (error || !data) {
			console.error(`Failed to fetch episodes for ${id}:`, error);
			return [];
		}

		const $ = load(data.html);

		const episodes = $('.ssl-item.ep-item')
			.map((_, el) => {
				const $el = $(el);
				return {
					id: $el.attr('data-id') || '',
					title: $el.find('.ep-name').text()?.trim() || '',
					number: Number($el.attr('data-number')) || 0,
					isFiller: $el.hasClass('ssl-item-filler'),
				};
			})
			.get() as HiAnimeEpisode[];

		return episodes;
	}
}

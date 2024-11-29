import { load } from 'cheerio';
import { ANITAKU_URL } from '../../lib/constants';
import { flowery, RequestClient } from '../../lib/request';
import type { IAnimeResult } from '../../types/main';
import type { Format } from '../../lib/utils/format';
import { FloweryStatus } from '../../lib/utils/status';

/**
 * Represents a provider for fetching anime data from Anitaku.
 */
export class AnitakuProvider {
	private client: RequestClient;
	private readonly ajaxUrl = 'https://ajax.gogocdn.net/ajax';

	/**
	 * Initializes a new instance of the AnitakuProvider with a default base URL.
	 */
	constructor() {
		this.client = new RequestClient(ANITAKU_URL);
	}

	/**
	 * Searches for anime titles on Anitaku based on a given query.
	 * @param {string} query - The search query.
	 * @returns {Promise<IAnimeResult[]>} - A promise that resolves to an array of search results.
	 */
	async search(query: string): Promise<IAnimeResult[]> {
		const { data, error } = await this.client.get<string>(
			`search.html?keyword=${encodeURIComponent(query)}`,
		);

		if (error) throw error;

		const $ = load(data as string);

		const results = new Set<IAnimeResult>();

		$('ul.items li').each((_, el) => {
			const title = $(el).find('.name').text().trim();
			const coverImage = $(el).find('.img img').attr('src');
			const categoryUrl = $(el).find('.name a').attr('href');
			const url = `${ANITAKU_URL}${categoryUrl}`;
			const released = $(el).find('.released').text().trim();
			const year = Number.parseInt(released.split(': ')[1]);

			const slug = categoryUrl?.split('/').pop();
			const id = slug;

			results.add({
				id: id as string,
				slug: slug as string,
				year,
				title,
				coverImage,
				url,
			});
		});

		return Array.from(results);
	}
	async getInfo(id: string) {
		const { data, error } = await this.client.get<string>(`category/${id}`);

		if (error || !data) return undefined;

		const animeInfo: IAnimeResult = {
			id: '',
			title: '',
			url: '',
			genres: [],
			totalEpisodes: 0,
		};

		const $ = load(data as string);

		animeInfo.id = id;
		animeInfo.title = $(
			'section.content_left > div.main_body > div:nth-child(2) > div.anime_info_body_bg > h1',
		)
			.text()
			.trim();
		animeInfo.url = `${ANITAKU_URL}/category/${id}`;
		animeInfo.image = $('div.anime_info_body_bg > img').attr('src');
		animeInfo.releaseDate = $('div.anime_info_body_bg > p:nth-child(8)')
			.text()
			.trim()
			.split('Released: ')[1];
		animeInfo.description = $('div.anime_info_body_bg > div:nth-child(6)')
			.text()
			.trim()
			.replace('Plot Summary: ', '');

		animeInfo.subOrDub = animeInfo.title.toLowerCase().includes('dub') ? 'DUB' : 'SUB';

		animeInfo.type = $('div.anime_info_body_bg > p:nth-child(4) > a')
			.text()
			.trim()
			.toUpperCase() as Format;

		animeInfo.status = 'UNKNOWN';

		switch ($('div.anime_info_body_bg > p:nth-child(9) > a').text().trim()) {
			case 'Ongoing':
				animeInfo.status = FloweryStatus.RELEASING;
				break;
			case 'Completed':
				animeInfo.status = FloweryStatus.FINISHED;
				break;
			case 'Upcoming':
				animeInfo.status = FloweryStatus.NOT_YET_RELEASED;
				break;
			default:
				animeInfo.status = FloweryStatus.UNKNOWN;
				break;
		}
		animeInfo.otherName = $('.other-name a').text().trim();

		$('div.anime_info_body_bg > p:nth-child(7) > a').each((_i, el) => {
			animeInfo.genres?.push($(el).attr('title') as string);
		});

		const ep_start = $('#episode_page > li').first().find('a').attr('ep_start');
		const ep_end = $('#episode_page > li').last().find('a').attr('ep_end');
		const movie_id = $('#movie_id').attr('value');
		const alias = $('#alias_anime').attr('value');

		const html = await flowery.get(
			`${
				this.ajaxUrl
			}/load-list-episode?ep_start=${ep_start}&ep_end=${ep_end}&id=${movie_id}&default_ep=${0}&alias=${alias}`,
		);
		const $$ = load(html.data as string);

		animeInfo.episodes = [];
		$$('#episode_related > li').each((i, el) => {
			animeInfo.episodes?.push({
				id: $(el).find('a').attr('href')?.split('/')[1] as string,
				number: Number.parseFloat($(el).find('div.name').text().replace('EP ', '')) || i + 1,
			});
		});
		animeInfo.episodes = animeInfo.episodes.reverse();

		animeInfo.totalEpisodes = Number.parseInt(ep_end ?? '0');

		return animeInfo;
	}
}

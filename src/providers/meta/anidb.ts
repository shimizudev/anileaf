import { ANIDB_URL } from '../../lib/constants';
import type { Character, Episode, IAnimeResult } from '../../types/main';
import { RequestClient } from '../../lib/request';
import { Format } from '../../lib/utils/format';
import { load } from 'cheerio';
import { FloweryStatus } from '../../lib/utils/status';
import type { Season } from '../../lib/utils/season';
import { formatDistanceToNow, formatISO, format } from 'date-fns';

export class AniDBProvider {
	private readonly client: RequestClient;

	constructor() {
		this.client = new RequestClient(ANIDB_URL);
	}

	private readonly formatMapping = {
		MOVIE: 'type.movie=1',
		MUSIC: 'type.musicvideo=1',
		OVA: 'type.ova=1',
		TV: 'type.tvseries=1',
		SPECIAL: 'type.tvspecial=1',
	};

	async search(query: string, format?: Format): Promise<IAnimeResult[]> {
		const results = new Set<IAnimeResult>();

		const formatParam =
			format && format !== Format.UNKNOWN
				? `&${this.formatMapping[format.toUpperCase() as keyof typeof this.formatMapping]}`
				: '';

		const { data, error } = await this.client.get<string>(
			`search/fulltext/?adb.search=${encodeURIComponent(query)}&do.search=1&entity.animetb=1&field.titles=1${formatParam}`,
			{
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
					'upgrade-insecure-requests': '1',
				},
			},
		);

		if (error || !data) {
			console.error(error);
			throw new Error('Failed to fetch anime info');
		}

		const $ = load(data);

		const promises: Promise<void>[] = [];

		$('table.search_results tbody tr').map((_i, el) => {
			promises.push(
				new Promise((resolve) => {
					const id = ($(el).find('td.relid a').attr('href') ?? '')
						.split('/anime/')[1]
						?.split('?')[0];

					this.client.get(`anime/${id}`).then(({ data: animeData }) => {
						const $$ = load(animeData as string);

						const english = $$('div.info div.titles tr.official')
							.first()
							?.find('td.value label')
							.text();
						const romaji = $$('div.info div.titles tr.romaji td.value span').text();
						const native = $$('div.info div.titles tr.official')
							.last()
							?.find('td.value label')
							.text();
						let synonyms =
							$$('div.info div.titles tr.syn td.value')
								.text()
								?.split(', ')
								.map((data) => data.trim())
								.concat($$('div.titles tr.short td.value').text()?.split(', ')) ?? [];
						const year = Number.isNaN(
							new Date(
								$$('div.info tr.year td.value span').first()?.attr('content')?.trim() ?? '',
							).getFullYear(),
						)
							? 0
							: new Date(
									$$('div.info tr.year td.value span').first()?.attr('content')?.trim() ?? '',
								).getFullYear();

						synonyms = [english, romaji, native, ...synonyms].filter(Boolean);

						results.add({
							id: `/anime/${id}`,
							synonyms,
							title: $(el).find('td.relid a').text()?.trim(),
							format: format ? format : Format.UNKNOWN,
							image: $(el).find('td.thumb img').attr('src') ?? '',
							year,
						});

						resolve();
					});
				}),
			);
		});

		await Promise.all(promises);

		return Array.from(results);
	}

	async getInfo(id: string): Promise<IAnimeResult> {
		const { data, error } = await this.client.get<string>(id.slice(1)); // Remove the leading '/'

		if (error || !data) {
			console.error(error);
			throw new Error('Failed to fetch anime info');
		}

		const $ = load(data);

		const characters: Character[] = [];

		$('div#characterlist div.character div.column div.g_bubble').map((_, el) => {
			characters.push({
				image: $(el).find('div.thumb img').attr('src') ?? '',
				name: $(el).find('div.data div.name a.name-colored span').text()?.trim(),
				voiceActors: [
					{
						image: '',
						name: $('div.info div.seiyuu span.name a.primary span').first().text()?.trim(),
					},
				],
			});
		});

		$('div#characterlist div.cast div.column div.g_bubble').map((_, el) => {
			characters.push({
				image: $(el).find('div.thumb img').attr('src') ?? '',
				name: $(el).find('div.data div.name a.name-colored span').text()?.trim(),
				voiceActors: [
					{
						image: '',
						name: $('div.info div.seiyuu span.name a.primary span').first().text()?.trim(),
					},
				],
			});
		});

		return {
			id: id,
			type: undefined,
			year: new Date($('div.info tr.year td.value span').first()?.text().trim()).getFullYear(),
			trailer: undefined,
			status:
				new Date($('div.info tr.year td.value span').last()?.text().trim()) > new Date()
					? FloweryStatus.RELEASING
					: FloweryStatus.FINISHED,
			totalEpisodes: Number($('div.info tr.type td.value span').html()),
			totalChapters: undefined,
			totalVolumes: undefined,
			title: {
				english: $('div.info div.titles tr.official').first()?.find('td.value label').text(),
				romaji: $('div.info div.titles tr.romaji td.value span').text(),
				native: $('div.info div.titles tr.official').last()?.find('td.value label').text(),
			},
			synonyms:
				$('div.info div.titles tr.syn td.value')
					.text()
					?.split(', ')
					.map((data) => data.trim())
					.concat($('div.titles tr.short td.value').text()) ?? [],
			tags: [],
			coverImage: $('div.info div.image div.container img').attr('src') ?? undefined,
			bannerImage: undefined,
			characters,
			season: $('div.info tr.season td.value a')
				.text()
				?.split(' ')[0]
				.toUpperCase()
				.replace(/"/g, '') as Season,
			countryOfOrigin: undefined,
			relations: [],
			rating: Number($('div.info tr.rating td.value a span.value').text() ?? 0),
			popularity: Number($('div.info tr.rating td.value span.count').attr('content') ?? 0),
			artwork: [],
			color: undefined,
			currentEpisode: undefined,
			description: $('div.desc').text()?.trim(),
			duration: undefined,
			format: Format.UNKNOWN,
			genres: [],
		};
	}

	async getEpisodesMetadata(id: string): Promise<Episode[]> {
		const { data, error } = await this.client.get<string>(id.slice(1)); // Remove the leading '/'

		if (error || !data) {
			console.error(error);
			throw new Error('Failed to fetch anime info');
		}

		const $ = load(data);

		const episodesList: Episode[] = [];

		$('div.episodes table#eplist tr').map((_i, el) => {
			if ($(el).find('td.id a abbr').attr('title') === 'Regular Episode') {
				const airDate = new Date($(el).find('td.date').attr('content') ?? '');

				episodesList.push({
					id: $(el).find('td.id a').attr('href') ?? '',
					number: Number($(el).find('td.id').text()),
					title: $(el).find('td.episode label').text()?.trim() ?? '', // The title attribute contains synonyms
					duration: $(el).find('td.duration').text(),
					airDate: format(airDate, 'PPP'),
					airDateRelative: formatDistanceToNow(airDate, { addSuffix: true }),
					airDateIso: formatISO(airDate),
				});
			}
		});

		const episodePromises = episodesList.map((episode) => this.getEpisodes(episode as Episode));

		const episodes = await Promise.all(episodePromises);

		return episodes.filter((episode) => episode !== undefined) as Episode[];
	}

	async getEpisodes(episode: Episode): Promise<Episode> {
		const { data, error } = await this.client.get<string>(
			episode.id?.toString().startsWith('/')
				? episode.id.toString().slice(1)
				: (episode.id?.toString() as string),
		); // Remove the leading '/'

		if (error || !data) {
			console.error(error);
			throw new Error('Failed to fetch episode info');
		}

		const $ = load(data);

		const description = $('div.desc div.summary').text()?.trim() || null;
		const rating = Number($('div.info tr.rating td.value a span.value').text());
		const updatedAt = new Date($('div.info tr.date td.value span').text()?.trim() || '');

		return {
			id: episode.id,
			description,
			hasDub: false,
			image: null,
			isFiller: false,
			number: episode.number,
			rating,
			title: episode.title,
			airDate: episode.airDate,
			airDateRelative: episode.airDateRelative,
			airDateIso: episode.airDateIso,
			updatedAt: !Number.isNaN(updatedAt.getTime()) ? format(updatedAt, 'PPPp') : undefined,
		};
	}
}

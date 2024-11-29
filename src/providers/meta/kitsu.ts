import { RequestClient } from '../../lib/request';
import type { Artwork, IAnimeResult } from '../../types/main';
import { KITSU_URL } from '../../lib/constants';
import { formatISO, parseISO } from 'date-fns';
import { FloweryFormat } from '../../lib/utils/format';

type KitsuResult = {
	id: string;
	type: string;
	links: {
		self: string;
	};
	attributes: {
		createdAt: string;
		updatedAt: string;
		slug: string;
		synopsis: string;
		description: string;
		coverImageTopOffset: number;
		titles: {
			en: string;
			en_us: string;
			en_kr: string;
			en_cn: string;
			en_jp: string;
			fr_fr: string;
			ja_jp: string;
			ko_kr: string;
			pt_pt: string;
			ru_ru: string;
			th_th: string;
			zh_cn: string;
		};
		canonicalTitle: string;
		abbreviatedTitles: string[];
		averageRating: string;
		ratingFrequencies: {
			[key: string]: string;
		};
		userCount: number;
		favoritesCount: number;
		startDate: string;
		endDate: string | null;
		nextRelease: string | null;
		popularityRank: number;
		ratingRank: number;
		ageRating: string;
		ageRatingGuide: string | null;
		subtype: string;
		status: string;
		tba: string | null;
		posterImage: {
			tiny: string;
			large: string;
			small: string;
			medium: string;
			original: string;
			meta: {
				dimensions: {
					tiny: {
						width: number;
						height: number;
					};
					large: {
						width: number;
						height: number;
					};
					small: {
						width: number;
						height: number;
					};
					medium: {
						width: number;
						height: number;
					};
				};
			};
		};
		coverImage: {
			tiny: string;
			large: string;
			small: string;
			original: string;
			meta: {
				dimensions: {
					tiny: {
						width: number;
						height: number;
					};
					large: {
						width: number;
						height: number;
					};
					small: {
						width: number;
						height: number;
					};
				};
			};
		};
		chapterCount: number | null;
		volumeCount: number | null;
		serialization: string;
		mangaType: string;
	};
	relationships: {
		genres: {
			links: {
				self: string;
				related: string;
			};
		};
		categories: {
			links: {
				self: string;
				related: string;
			};
		};
		castings: {
			links: {
				self: string;
				related: string;
			};
		};
		installments: {
			links: {
				self: string;
				related: string;
			};
		};
		mappings: {
			links: {
				self: string;
				related: string;
			};
		};
		reviews: {
			links: {
				self: string;
				related: string;
			};
		};
		mediaRelationships: {
			links: {
				self: string;
				related: string;
			};
		};
		characters: {
			links: {
				self: string;
				related: string;
			};
		};
		staff: {
			links: {
				self: string;
				related: string;
			};
		};
		productions: {
			links: {
				self: string;
				related: string;
			};
		};
		quotes: {
			links: {
				self: string;
				related: string;
			};
		};
		chapters: {
			links: {
				self: string;
				related: string;
			};
		};
		mangaCharacters: {
			links: {
				self: string;
				related: string;
			};
		};
		mangaStaff: {
			links: {
				self: string;
				related: string;
			};
		};
	};
};

type KitsuResponse = {
	data: {
		attributes: {
			titles: {
				en: string | null;
				en_jp: string | null;
				ja_jp: string | null;
			};
			description: string | null;
			subtype: string;
			status: string;
			showType: string;
			synopsis: string | null;
			episodeLength: number | null;
			posterImage: {
				original: string | null;
			};
			coverImage: {
				original: string | null;
			};
			averageRating: string | null;
			episodeCount: number | null;
		};
	};
};

export class KitsuProvider {
	private readonly client: RequestClient;
	private readonly headers = {
		Accept: 'application/vnd.api+json',
		'Content-Type': 'application/vnd.api+json',
	};

	constructor() {
		this.client = new RequestClient(KITSU_URL);
	}

	private processResult(result: KitsuResult): IAnimeResult {
		const titles = result.attributes.titles;
		const synonyms = [
			...Object.values(titles).filter(Boolean),
			...result.attributes.abbreviatedTitles,
		];
		const format = result.attributes.subtype.toUpperCase() as
			| 'TV'
			| 'MOVIE'
			| 'OVA'
			| 'ONA'
			| 'SPECIAL'
			| 'UNKNOWN';
		const startDate = result.attributes.startDate ? parseISO(result.attributes.startDate) : null;

		return {
			title:
				titles.en_us ||
				titles.en_jp ||
				titles.ja_jp ||
				titles.en ||
				titles.en_kr ||
				titles.ko_kr ||
				titles.en_cn ||
				titles.zh_cn ||
				result.attributes.canonicalTitle ||
				Object.values(titles).find(Boolean) ||
				'Unknown Title',
			synonyms,
			id: `${result.type}/${result.id}`,
			image: result.attributes.posterImage?.original ?? null,
			format,
			year: startDate?.getFullYear() ?? 0,
			startDate: startDate ? formatISO(startDate) : null,
			endDate: result.attributes.endDate ? formatISO(parseISO(result.attributes.endDate)) : null,
			status: result.attributes.status,
			rating: Number.parseFloat(result.attributes.averageRating) || 0,
			popularity: result.attributes.popularityRank,
		};
	}

	async search(query: string): Promise<IAnimeResult[]> {
		const results: IAnimeResult[] = [];

		const fetchAndProcess = async (endpoint: string) => {
			try {
				const { data, error } = await this.client.get<{ data: KitsuResult[] }>(
					`api/edge/${endpoint}?filter[text]=${encodeURIComponent(query)}`,
					{ headers: this.headers },
				);

				if (error || !data) {
					if (error) console.error(`Kitsu ${endpoint} search error:`, error);
					return;
				}

				results.push(...data.data.map(this.processResult));
			} catch (_err) {
				// Ignore
			}
		};

		await Promise.all([fetchAndProcess('anime'), fetchAndProcess('manga')]);

		return results;
	}

	async getInfo(id: string): Promise<IAnimeResult | undefined> {
		const { data: kitsuData, error } = await this.client.get<KitsuResponse>(`api/edge/${id}`, {
			headers: this.headers,
		});

		if (error || !kitsuData) {
			if (error) console.error(`Kitsu ${id} info error:`, error);
			return undefined;
		}

		const data = kitsuData.data;

		const { data: genresData, error: genresError } = await this.client.get<{
			data: { attributes: { name: string } }[];
		}>(`api/edge/${id}/genres`, {
			headers: this.headers,
		});

		if (genresError || !genresData) {
			if (genresError) console.error(`Kitsu ${id} genres error:`, genresError);
			return undefined;
		}

		const genres = genresData.data.map((genre) => genre.attributes.name);

		const artwork: Artwork[] = [];

		if (data.attributes.coverImage?.original)
			artwork.push({
				type: 'banner',
				image: data.attributes.coverImage.original,
				provider: 'kitsu',
			});
		if (data.attributes.posterImage?.original)
			artwork.push({
				type: 'poster',
				image: data.attributes.posterImage.original,
				provider: 'kitsu',
			});

		return {
			id: id.split('/')[1],
			title: {
				english: data.attributes.titles.en ?? undefined,
				romaji: data.attributes.titles.en_jp ?? undefined,
				native: data.attributes.titles.ja_jp ?? undefined,
			},
			currentEpisode: undefined,
			trailer: undefined,
			duration: data.attributes.episodeLength
				? data.attributes.episodeLength.toString()
				: undefined,
			color: undefined,
			bannerImage: data.attributes.coverImage?.original ?? undefined,
			coverImage: data.attributes.posterImage?.original ?? undefined,
			status: undefined,
			format: FloweryFormat.UNKNOWN,
			season: 'Unknown',
			synonyms: [],
			description: data.attributes.synopsis ?? undefined,
			year: undefined,
			totalEpisodes: data.attributes.episodeCount ?? 0,
			genres: genres ? genres : [],
			rating: data.attributes.averageRating
				? Number.parseFloat((Number.parseFloat(data.attributes.averageRating) / 10).toFixed(2))
				: undefined,
			popularity: undefined,
			countryOfOrigin: undefined,
			tags: [],
			relations: [],
			artwork,
			characters: [],
			totalChapters: undefined,
			totalVolumes: undefined,
			type: data.attributes.subtype,
		};
	}
}

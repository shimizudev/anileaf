import { ANILIST_GRAPHQL } from '../../lib/constants';
import { flowery } from '../../lib/request';
import { parseFormatInfo, type FloweryFormat, type Format } from '../../lib/utils/format';
import type { FormatColor } from '../../lib/utils/format';
import { generateRelatedAnimeId } from '../../lib/utils/id';
import {
	parseSeasonInfo,
	type Season,
	type FlowerySeason,
	type SeasonColor,
	type SeasonNumber,
} from '../../lib/utils/season';
import {
	type FloweryStatus,
	parseStatusAndColor,
	type Status,
	type StatusColor,
} from '../../lib/utils/status';
import { format, formatDistanceToNow, isValid, parse } from 'date-fns';
import {
	ensureAnimeInfo,
	ensureNumber,
	ensureString,
	ensureArray,
	ensureDate,
	ensureObject,
} from '../../lib/utils/defaults';
import type { AniListCharacter, AniListResult } from '../../types/providers';
import type { Character } from '../../types/main';

/**
 * Builds the GraphQL query for fetching anime information from Anilist.
 * @param {number} id - The ID of the anime to fetch.
 * @returns {string} - The GraphQL query string.
 */
const anilistInfoQuery = (id: number) => `
	query {
		Media(id: ${id}) {
			title {
				romaji
				english
				native
				userPreferred
			}
			description
			coverImage {
				extraLarge
				large
				medium
				color
			}
			bannerImage
			episodes
			duration
			season
			seasonYear
			format
			studios {
				nodes {
					name
				}
			}
			genres
			tags {
				name
				description
				rank
				isAdult
				category
			}
			trailer {
				id
				site
				thumbnail
			}
			type
			status
			updatedAt
			id
			idMal
			hashtag
			endDate {
				year
				month
				day
			}
			startDate {
				year
				month
				day
			}
			countryOfOrigin
			averageScore
			relations {
				edges {
					relationType
					node {
						id
						title {
							userPreferred
							english
							romaji
							native
						}
						format
						type
						status
						coverImage {
							large
							medium
						}
					}
				}
			}
			characters {
				edges {
					role
					node {
						age
						bloodType
						id
						image {
							large
							medium
						}
						description
						dateOfBirth {
							year
							month
							day
						}
						name {
							first
							middle
							last
							full
							native
							alternative
							alternativeSpoiler
							userPreferred
						}
						gender
					}
					voiceActors {
						age
						bloodType
						gender
						image {
							large
							medium
						}
						name {
							first
							middle
							last
							full
							native
							alternative
							userPreferred
						}
					}
				}
			}
		}
	}
`;

/**
 * Represents the response from Anilist for anime information.
 */
interface IAnilistInfoResponse {
	data: {
		Media: IAnimeInfo;
	};
}

/**
 * Represents the anime information fetched from Anilist.
 */
interface IAnimeInfo {
	title: {
		romaji: string | null;
		english: string | null;
		native: string | null;
		userPreferred: string | null;
	};
	description: string | null;
	coverImage: {
		extraLarge: string | null;
		large: string | null;
		medium: string | null;
		color: string | null;
	};
	bannerImage: string | null;
	episodes: number | null;
	duration: number | null;
	season: Season | null;
	seasonYear: number | null;
	format: Format | null;
	studios: {
		nodes: {
			name: string;
		}[];
	};
	genres: string[];
	tags: {
		name: string;
		description: string;
		rank: number;
		isAdult: boolean;
		category: string;
	}[];
	trailer: {
		id: string;
		site: string;
		thumbnail: string;
	} | null;
	type: string;
	status: Status;
	updatedAt: number;
	id: number;
	idMal: number | null;
	hashtag: string | null;
	endDate: {
		year: number | null;
		month: number | null;
		day: number | null;
	};
	startDate: {
		year: number | null;
		month: number | null;
		day: number | null;
	};
	countryOfOrigin: string;
	averageScore: number;
	relations: {
		edges: {
			relationType: string;
			node: {
				id: number;
				title: {
					userPreferred: string | null;
					english: string | null;
					romaji: string | null;
					native: string | null;
				};
				format: Format | null;
				type: string;
				status: Status;
				coverImage: {
					large: string | null;
					medium: string | null;
				};
			};
		}[];
	};
	characters: {
		edges: {
			role: string;
			node: {
				age: number | null;
				bloodType: string | null;
				id: number;
				image: {
					large: string | null;
					medium: string | null;
				};
				description: string | null;
				dateOfBirth: {
					year: number | null;
					month: number | null;
					day: number | null;
				};
				name: {
					first: string | null;
					middle: string | null;
					last: string | null;
					full: string | null;
					native: string | null;
					alternative: string[] | null;
					alternativeSpoiler: string[] | null;
					userPreferred: string | null;
				};
				gender: string | null;
			};
			voiceActors: {
				age: number | null;
				bloodType: string | null;
				gender: string | null;
				image: {
					large: string | null;
					medium: string | null;
				};
				name: {
					first: string | null;
					middle: string | null;
					last: string | null;
					full: string | null;
					native: string | null;
					alternative: string[] | null;
					userPreferred: string | null;
				};
			}[];
		}[];
	};
}

/**
 * Represents a provider for fetching anime data from Anilist.
 */
export class AnilistProvider {
	/**
	 * Fetches anime information from Anilist.
	 * @param {string | number} id - The ID of the anime to fetch.
	 * @returns {Promise<ParsedInfo>} - A promise that resolves to the parsed anime information.
	 */
	async getInfo(id: string | number): Promise<AniListResult> {
		try {
			const { data, error } = await flowery.post<IAnilistInfoResponse>(ANILIST_GRAPHQL, {
				json: { query: anilistInfoQuery(Number(id)) },
			});
			if (error || !data?.data?.Media) {
				return ensureAnimeInfo({ id: String(id) }, 'anilist');
			}

			return this.parseInfo(data);
		} catch (error) {
			console.error('AniList getInfo error:', error);
			return ensureAnimeInfo({ id: String(id) }, 'anilist');
		}
	}

	private parseInfo(data: IAnilistInfoResponse): AniListResult {
		try {
			const info = data.data.Media;
			const titles = ensureObject(info.title, {
				romaji: null,
				english: null,
				native: null,
				userPreferred: null,
			});

			const startDate = ensureObject(info.startDate, { year: null, month: null, day: null });
			const endDate = ensureObject(info.endDate, { year: null, month: null, day: null });

			return ensureAnimeInfo(
				{
					id: ensureString(info.id, String(info.id)),
					malId: ensureNumber(info.idMal, undefined),
					title: {
						english: ensureString(titles.english, null),
						romaji: ensureString(titles.romaji, null),
						native: ensureString(titles.native, null),
						userPreferred: ensureString(
							titles.userPreferred || titles.english || titles.romaji || titles.native,
							'Unknown Title',
						),
					},
					description: ensureString(info.description, null),
					coverImage: ensureString(
						info.coverImage?.extraLarge || info.coverImage?.large || info.coverImage?.medium,
						null,
					),
					bannerImage: ensureString(info.bannerImage, null),
					genres: ensureArray(info.genres, []),
					color: ensureString(info.coverImage?.color, null),
					year: ensureNumber(info.seasonYear),
					status: parseStatusAndColor(info.status || 'UNKNOWN'),
					format: info.format ? parseFormatInfo(info.format) : null,
					season:
						info.season && info.seasonYear ? parseSeasonInfo(info.season, info.seasonYear) : null,
					totalEpisodes: ensureNumber(info.episodes),
					rating: ensureNumber(info.averageScore) / 100,
					duration: ensureString(info.duration?.toString(), null),
					type: ensureString(info.type, 'UNKNOWN'),
					startDate: this.formatDate(startDate),
					endDate: this.formatDate(endDate),
					trailer: info.trailer
						? {
								id: ensureString(info.trailer.id, null),
								site: ensureString(info.trailer.site, null),
								thumbnail: ensureString(info.trailer.thumbnail, null),
							}
						: { id: null, site: null, thumbnail: null },
					characters: this.parseCharacters(info.characters?.edges) as AniListCharacter[],
					relations: this.parseRelations(info.relations?.edges).map((relation) => ({
						...relation,
						id: Number(relation.id),
					})),
					countryOfOrigin: ensureString(info.countryOfOrigin, null),
					studios: ensureArray(
						info.studios?.nodes?.map((studio) => studio.name),
						[],
					),
					tags: ensureArray(
						info.tags?.map((tag) => ({
							name: tag.name,
							description: tag.description,
							category: tag.category,
						})),
						[],
					),
				},
				'anilist',
			);
		} catch (error) {
			console.error('AniList parse error:', error);
			if (data?.data?.Media?.id) {
				return ensureAnimeInfo({ id: String(data.data.Media.id) }, 'anilist');
			}
			return ensureAnimeInfo({ id: 'unknown' }, 'anilist');
		}
	}

	private parseCharacters(edges: unknown): Character[] {
		try {
			if (!Array.isArray(edges)) return [];

			return edges.map((edge) => {
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				const char = ensureObject(edge, { node: {}, voiceActors: [] } as any);
				return {
					role: ensureString(char.role, 'Unknown Role'),
					name: ensureString(
						char.node?.name?.userPreferred || char.node?.name?.full,
						'Unknown Character',
					),
					image: ensureString(char.node?.image?.large || char.node?.image?.medium, null),
					voiceActors: ensureArray(char.voiceActors).map((value: unknown) => {
						const actor = value as {
							name?: { userPreferred?: string; full?: string };
							image?: { large?: string; medium?: string };
						};
						return {
							name: ensureString(actor?.name?.userPreferred || actor?.name?.full, 'Unknown Actor'),
							image: ensureString(actor?.image?.large || actor?.image?.medium, null),
						};
					}),
				};
			});
		} catch (error) {
			console.error('Character parse error:', error);
			return [];
		}
	}

	private formatDate(date: { year: number | null; month: number | null; day: number | null }):
		| string
		| null {
		if (!date.year || !date.month || !date.day) return null;

		const dateString = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
		const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());

		if (!isValid(parsedDate)) return null;

		return format(parsedDate, 'dd MMMM, yyyy');
	}

	private parseRelations(edges: unknown): {
		type: string;
		title: string;
		id: string;
		format: { format: FloweryFormat; color: FormatColor } | null;
		status: { status: FloweryStatus; color: StatusColor };
		image: string | null;
	}[] {
		try {
			if (!Array.isArray(edges)) return [];

			return edges.map((edge) => {
				const relation = ensureObject(edge, {
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					node: {} as any,
					relationType: 'Unknown Relation',
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				} as any);
				return {
					type: ensureString(relation.relationType, 'Unknown Relation'),
					title: ensureString(
						relation.node.title.userPreferred ||
							relation.node.title.english ||
							relation.node.title.romaji ||
							relation.node.title.native,
						'Unknown Title',
					),
					id: generateRelatedAnimeId(ensureNumber(relation.node.id)).toString(),
					format: relation.node.format ? parseFormatInfo(relation.node.format) : null,
					status: parseStatusAndColor(ensureString(relation.node.status, 'UNKNOWN')),
					image: ensureString(
						relation.node.coverImage?.large || relation.node.coverImage?.medium,
						null,
					),
				};
			});
		} catch (error) {
			console.error('Relation parse error:', error);
			return [];
		}
	}
}

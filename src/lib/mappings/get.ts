import { AniDBProvider } from '../../providers/meta/anidb';
import { HianimeProvider } from '../../providers/anime/hianime';
import { KitsuProvider } from '../../providers/meta/kitsu';
import { MalProvider } from '../../providers/meta/mal';
import { TVDBProvider } from '../../providers/meta/tvdb';
import { anidb } from './all/anidb';
import { hianime } from './all/hianime';
import { kitsu } from './all/kitsu';
import { mal } from './all/mal';
import { tvdb } from './all/tvdb';
import type {
	IAnimeResult,
	Episode,
	Character,
	VoiceActor,
	ITitle,
	Artwork,
	Staff,
} from '../../types/main';
import { generateRelatedAnimeId } from '../utils/id';
import { slugify } from '../utils/slugify';
import type { MatchResult } from '../string-sim';
import { AnilistProvider } from '../../providers/meta/anilist';
import { AnitakuProvider } from '../../providers/anime/anitaku';
import {
	getAniZip,
	getAniZipArtwork,
	getAniZipMappings,
	getAniZipSynonyms,
	type AniZipEpisode,
} from './anizip';
import { formatDistanceToNow } from 'date-fns';
import { anitaku } from './all/anitaku';
import { getColorFromImage } from '../utils/color';
import { FloweryStatus, type StatusColor } from '../utils/status';
import { tmdb } from './all/tmdb';
import { TmdbProvider } from '../../providers/meta/tmdb';
import { getTitle } from './helper';

interface StreamEpisode extends Episode {
	image?: string;
	hasDub?: boolean;
}

interface StreamProvider {
	sub: StreamEpisode[];
	dub: StreamEpisode[];
}

interface StreamEpisodes {
	tmdb: {
		hianime: StreamProvider;
		anitaku: StreamProvider;
	};
	tvdb: {
		hianime: StreamProvider;
		anitaku: StreamProvider;
	};
}

interface MergedAnimeInfo extends IAnimeResult {
	streamEpisodes: StreamEpisodes;
	themes?: string[];
	demographics?: string[];
	slug: string;
}

export async function get(id: number): Promise<MergedAnimeInfo> {
	const { data } = await getTitle(id);
	const malProvider = new MalProvider();
	const tvdbProvider = new TVDBProvider();
	const kitsuProvider = new KitsuProvider();
	const anidbProvider = new AniDBProvider();
	const hianimeProvider = new HianimeProvider();
	const anilistProvider = new AnilistProvider();
	const anitakuProvider = new AnitakuProvider();
	const tmdbProvider = new TmdbProvider();

	// Fetch initial data in parallel
	const [
		anilistData,
		malData,
		tvdbData,
		kitsuData,
		anidbData,
		hianimeData,
		anitakuData,
		tmdbData,
		anizipEpisodes,
		anizipArtwork,
		anizipMappings,
		anizipSynonyms,
	] = await Promise.all([
		anilistProvider.getInfo(id),
		mal(malProvider, id).catch(() => null),
		tvdb(tvdbProvider, id).catch(() => null),
		kitsu(kitsuProvider, id).catch(() => null),
		anidb(anidbProvider, id).catch(() => null),
		hianime(hianimeProvider, Number(data?.idMal)).catch(() => null),
		anitaku(anitakuProvider, id).catch(() => null),
		tmdb(tmdbProvider, id).catch(() => null),
		getAniZip(id),
		getAniZipArtwork(id),
		getAniZipMappings(id),
		getAniZipSynonyms(id),
	]);

	if (!anilistData) throw new Error('Failed to fetch AniList data');

	const hasPrequelRelation = anilistData.relations.some((relation) => relation.type === 'PREQUEL');

	// Fetch additional provider info in parallel
	const [tvdbInfo, kitsuInfo, anidbInfo, anitakuInfoSub, anitakuInfoDub, hianimeInfo, tmdbInfo] =
		await Promise.all([
			tvdbData
				? tvdbProvider.getInfo(
						(tvdbData as MatchResult)?.match?.id as string,
						hasPrequelRelation,
						anilistData.coverImage as string,
					)
				: Promise.resolve(undefined),
			kitsuData && (kitsuData as MatchResult)?.match?.id
				? kitsuProvider.getInfo((kitsuData as MatchResult)?.match?.id as string)
				: Promise.resolve(undefined),
			anidbData && (anidbData as MatchResult)?.match?.id
				? anidbProvider.getInfo((anidbData as MatchResult)?.match?.id as string)
				: Promise.resolve(undefined),
			anitakuData
				? anitakuProvider.getInfo(
						((anitakuData as { sub: MatchResult })?.sub as MatchResult)?.match?.id as string,
					)
				: Promise.resolve(undefined),
			anitakuData
				? anitakuProvider.getInfo(
						((anitakuData as { dub: MatchResult })?.dub as MatchResult)?.match?.id as string,
					)
				: Promise.resolve(undefined),
			hianimeData
				? hianimeProvider.getInfo((hianimeData as MatchResult)?.match?.id as string)
				: Promise.resolve(undefined),
			tmdbData
				? tmdbProvider.getInfo((tmdbData as MatchResult)?.match?.id as string)
				: Promise.resolve(undefined),
		]);

	const tmdbEpisodes = tmdbData
		? await tmdbProvider.getEpisode(
				tmdbInfo?.id as string,
				((malData as IAnimeResult)?.aired as { from: string; to: string | null })?.from,
				((malData as IAnimeResult)?.aired as { from: string; to: string | null })?.to ?? undefined,
			)
		: Promise.resolve(undefined);

	const customId = generateRelatedAnimeId(id);
	const slug = slugify(
		(anilistData.title as ITitle).userPreferred || (anilistData.title as ITitle).english || '',
	);

	const characters = mergeCharacters([
		anilistData.characters,
		(malData as IAnimeResult)?.characters,
		(tvdbData as MatchResult)?.match?.characters,
		(anidbData as MatchResult)?.match?.characters,
	]);

	// Set to avoid duplicates
	const genres = new Set([
		...(anilistData.genres || []),
		...((anidbInfo as IAnimeResult)?.genres || []),
		...((malData as IAnimeResult)?.genres || []),
		...((tvdbData as MatchResult)?.match?.genres || []),
		...(tmdbInfo?.genres || []),
		...((kitsuData as MatchResult)?.match?.genres || []),
		...((anitakuInfoSub as IAnimeResult)?.genres || []),
		...((anitakuInfoDub as IAnimeResult)?.genres || []),
		...(hianimeInfo?.anime.moreInfo.genres || []),
	]);
	const tags = new Set([
		...(anilistData.tags?.map((t) => t.name) || []),
		...((malData as IAnimeResult)?.tags || []),
		...((tvdbData as MatchResult)?.match?.tags || []),
		...(tmdbInfo?.tags || []),
	]);

	const artwork = new Set([
		...(((tvdbInfo as IAnimeResult)?.artwork as Artwork[]) || []),
		...(tmdbInfo?.artwork || []),
		...(((kitsuInfo as IAnimeResult)?.artwork as Artwork[]) || []),
		anidbInfo && {
			type: 'poster',
			image: (anidbInfo as IAnimeResult)?.coverImage,
			provider: 'anidb',
		},
		hianimeData && {
			type: 'poster',
			image: (hianimeData as MatchResult)?.match?.coverImage,
			provider: 'hianime',
		},
		anitakuData && {
			type: 'poster',
			image: ((anitakuData as { sub: MatchResult })?.sub as MatchResult)?.match?.coverImage,
			provider: 'anitaku',
		},
		...(anizipArtwork?.map((a) => ({
			type:
				a.coverType === 'Poster'
					? 'poster'
					: a.coverType === 'Banner'
						? 'banner'
						: a.coverType === 'Fanart'
							? 'fanart'
							: 'clear_logo',
			image: a.url,
			provider: 'tvdb',
		})) || []),
	]);

	const synonyms = new Set([
		...(((anidbInfo as IAnimeResult)?.synonyms as string[]) || []),
		...(((malData as IAnimeResult)?.synonyms as string[]) || []),
		...(((tvdbData as MatchResult)?.match?.synonyms as string[]) || []),
		...(anizipSynonyms || []),
	]);

	let streamEpisodes: StreamEpisodes = {
		tmdb: {
			hianime: {
				sub: [],
				dub: [],
			},
			anitaku: {
				sub: [],
				dub: [],
			},
		},
		tvdb: {
			hianime: {
				sub: [],
				dub: [],
			},
			anitaku: {
				sub: [],
				dub: [],
			},
		},
	};

	if (hianimeData || anitakuData) {
		streamEpisodes = await processStreamEpisodes(
			(hianimeData as MatchResult)?.match?.id as string,
			(hianimeData as MatchResult)?.match?.slug as string,
			{
				subId: ((anitakuData as { sub: MatchResult })?.sub as MatchResult)?.match?.id as string,
				dubId: ((anitakuData as { dub: MatchResult })?.dub as MatchResult)?.match?.id as string,
			},
			(malData as IAnimeResult)?.episodes,
			hianimeProvider,
			anitakuProvider,
			anizipEpisodes,
			tmdbEpisodes as Episode[],
		);
	}

	const coverImage =
		((tvdbInfo as IAnimeResult)?.coverImage as string) ||
		(anizipArtwork?.find((art) => art.coverType === 'Poster')?.url as string) ||
		(anilistData.coverImage as string);

	const [color, sliderImage] = await Promise.all([
		getColorFromImage(coverImage).then((c) => c?.toHex()),
		Promise.resolve(anizipArtwork?.find((art) => art.coverType === 'Fanart')?.url),
	]);

	// Construct merged info
	const mergedInfo: MergedAnimeInfo = {
		id: customId,
		slug,
		malId: Number((malData as IAnimeResult)?.mal_id) || Number(anilistData.malId),
		title: anilistData.title,
		synonyms: Array.from(synonyms),
		description: anilistData.description || '',
		coverImage: coverImage,
		bannerImage: (tvdbInfo as IAnimeResult)?.bannerImage || anilistData.bannerImage,
		sliderImage: sliderImage,
		logo: anizipArtwork?.find((art) => art.coverType === 'Clearlogo')?.url,
		aired: {
			data: (malData as IAnimeResult)?.aired,
			relative: anilistData.aired,
			airDays: (tvdbInfo as IAnimeResult)?.airDays || undefined, // The days of the week the anime airs on
		},
		startDate: anilistData.startDate,
		endDate: anilistData.endDate,
		duration: anilistData.duration ? `${anilistData.duration}m` : undefined,
		color: color || anilistData.color || undefined,
		genres: Array.from(genres),
		tags: Array.from(tags),
		themes: (malData as IAnimeResult)?.themes as string[],
		demographics: (malData as IAnimeResult)?.demographics as string[],
		status: anilistData.status,
		season: anilistData.season,
		year: anilistData.year,
		rating: (malData as IAnimeResult)?.rating || anilistData.rating,
		type: anilistData.type,
		format: anilistData.format,
		trailer: anilistData.trailer as
			| { id: string | null; site: string; thumbnail: string | null }
			| undefined,
		characters,
		staff: (malData as IAnimeResult)?.staff as Staff[],
		totalEpisodes:
			(malData as IAnimeResult)?.totalEpisodes || (anilistData.episodes as number) || undefined,
		isAiring:
			(malData as IAnimeResult)?.isAiring ||
			(anilistData.status as { status: FloweryStatus; color: StatusColor })?.status ===
				FloweryStatus.RELEASING,
		streamEpisodes,
		relations: anilistData.relations,
		artwork: Array.from(artwork),
		mappings: {
			anidb: anidbData as MatchResult,
			tvdb: tvdbData as MatchResult,
			tmdb: tmdbData as MatchResult,
			kitsu: kitsuData as MatchResult,
			anilist: id,
			anitaku: {
				sub: (anitakuData as { sub: MatchResult })?.sub as MatchResult,
				dub: (anitakuData as { dub: MatchResult })?.dub as MatchResult,
			},
			hianime: hianimeData as MatchResult,
			...anizipMappings,
		},
	};

	return mergedInfo;
}

function mergeCharacters(characterLists: (Character[] | undefined)[]): Character[] {
	const characterMap = new Map<string, Character>();

	for (const list of characterLists.filter(Boolean)) {
		for (const char of list || []) {
			const key = char.name?.toLowerCase() || '';
			if (!characterMap.has(key)) {
				characterMap.set(key, { ...char, voiceActors: [] });
			}

			// Merge voice actors
			const existing = characterMap.get(key);
			if (char.voiceActors && existing) {
				const vaMap = new Map<string, VoiceActor>();

				// Add existing VAs
				for (const va of existing.voiceActors || []) {
					if (va.name) vaMap.set(va.name.toLowerCase(), va);
				}

				// Add new VAs
				for (const va of char.voiceActors) {
					if (va.name && !vaMap.has(va.name.toLowerCase())) {
						vaMap.set(va.name.toLowerCase(), va);
					}
				}

				existing.voiceActors = Array.from(vaMap.values());
			}
		}
	}

	return Array.from(characterMap.values());
}

async function processStreamEpisodes(
	hianimeId: string,
	hianimeSlug: string,
	anitaku: {
		subId: string;
		dubId: string;
	},
	malEpisodes: Episode[] | undefined,
	hianimeProvider: HianimeProvider,
	anitakuProvider: AnitakuProvider,
	anizipEpisodes: AniZipEpisode[] | undefined,
	tmdbEpisodes: Episode[] | undefined,
): Promise<StreamEpisodes> {
	// Fetch all episodes data in parallel
	const [hianimeEpisodes, anitakuSub, anitakuDub] = await Promise.all([
		hianimeId ? hianimeProvider.getEpisodes(hianimeId, hianimeSlug) : null,
		anitaku.subId ? anitakuProvider.getInfo(anitaku.subId) : null,
		anitaku.dubId ? anitakuProvider.getInfo(anitaku.dubId) : null,
	]);

	// Helper function to get metadata for an episode
	const getEpisodeMetadata = (index: number) => {
		const malEp = malEpisodes?.[index];
		const anizipEp = anizipEpisodes?.[index];

		return {
			title:
				malEp?.title ||
				anizipEp?.title.en ||
				anizipEp?.title['x-jat'] ||
				anizipEp?.title.ja ||
				`Episode ${index + 1}`,
			description:
				malEp?.description || anizipEp?.summary || anizipEp?.overview || 'No description',
			image: anizipEp?.image,
			airDate: malEp?.airDate,
			airDateRelative: anizipEp?.airDateUtc
				? formatDistanceToNow(new Date(anizipEp.airDateUtc), { addSuffix: true })
				: undefined,
			isFiller: malEp?.isFiller || false,
			rating: Number(malEp?.rating) || Number(anizipEp?.rating) || 0,
			duration: malEp?.duration || anizipEp?.runtime || 0,
		};
	};

	const getTmdbEpisodeMetadata = (index: number) => {
		const tmdbEp = tmdbEpisodes?.[index];
		const anizipEp = anizipEpisodes?.[index];
		const malEp = malEpisodes?.[index];

		return {
			title:
				tmdbEp?.title ||
				malEp?.title ||
				anizipEp?.title.en ||
				anizipEp?.title['x-jat'] ||
				anizipEp?.title.ja ||
				`Episode ${index + 1}`,
			description:
				tmdbEp?.description ||
				malEp?.description ||
				anizipEp?.overview ||
				anizipEp?.summary ||
				'No description',
			isFiller: malEp?.isFiller || false,
			rating: Number(malEp?.rating) || Number(tmdbEp?.rating) || Number(anizipEp?.rating) || 0,
			duration: malEp?.duration || anizipEp?.runtime || 0,
			image: tmdbEp?.image as string | undefined,
			season: tmdbEp?.season,
		} as StreamEpisode;
	};

	const streamEpisodes: StreamEpisodes = {
		tmdb: {
			hianime: { sub: [], dub: [] },
			anitaku: { sub: [], dub: [] },
		},
		tvdb: {
			hianime: { sub: [], dub: [] },
			anitaku: { sub: [], dub: [] },
		},
	};

	// Process HiAnime episodes
	if (hianimeEpisodes) {
		streamEpisodes.tvdb.hianime.sub = hianimeEpisodes.map((ep, index) => ({
			id: ep.id,
			number: ep.number,
			hasDub: false,
			...getEpisodeMetadata(index),
		}));
		streamEpisodes.tmdb.hianime.sub = hianimeEpisodes.map((ep, index) => ({
			id: ep.id,
			number: ep.number,
			hasDub: false,
			...getTmdbEpisodeMetadata(index),
		}));

		streamEpisodes.tvdb.hianime.dub = hianimeEpisodes.map((ep, index) => ({
			id: ep.id,
			number: ep.number,
			hasDub: true,
			...getEpisodeMetadata(index),
		}));
		streamEpisodes.tmdb.hianime.dub = hianimeEpisodes.map((ep, index) => ({
			id: ep.id,
			number: ep.number,
			hasDub: true,
			...getTmdbEpisodeMetadata(index),
		}));

		// Trim dub episodes if total episodes is available
		if (anitakuDub?.totalEpisodes) {
			streamEpisodes.tvdb.hianime.dub = streamEpisodes.tvdb.hianime.dub.slice(
				0,
				anitakuDub.totalEpisodes,
			);
			streamEpisodes.tmdb.hianime.dub = streamEpisodes.tmdb.hianime.dub.slice(
				0,
				anitakuDub.totalEpisodes,
			);
		}
	}

	// Process Anitaku sub episodes
	if (anitakuSub?.episodes) {
		streamEpisodes.tvdb.anitaku.sub = anitakuSub.episodes.map((ep, index) => ({
			id: ep.id?.toString(),
			number: ep.number,
			hasDub: false,
			...getEpisodeMetadata(index),
		}));
		streamEpisodes.tmdb.anitaku.sub = anitakuSub.episodes.map((ep, index) => ({
			id: ep.id?.toString(),
			number: ep.number,
			hasDub: false,
			...getTmdbEpisodeMetadata(index),
		}));
	}

	// Process Anitaku dub episodes
	if (anitakuDub?.episodes) {
		streamEpisodes.tvdb.anitaku.dub = anitakuDub.episodes.map((ep, index) => ({
			id: ep.id?.toString(),
			number: ep.number,
			hasDub: true,
			...getEpisodeMetadata(index),
		}));
		streamEpisodes.tmdb.anitaku.dub = anitakuDub.episodes.map((ep, index) => ({
			id: ep.id?.toString(),
			number: ep.number,
			hasDub: true,
			...getTmdbEpisodeMetadata(index),
		}));
	}

	streamEpisodes.tvdb.hianime.dub = streamEpisodes.tvdb.hianime.dub.slice(
		0,
		streamEpisodes.tvdb.anitaku.dub.length || 0,
	);
	streamEpisodes.tmdb.hianime.dub = streamEpisodes.tmdb.hianime.dub.slice(
		0,
		streamEpisodes.tmdb.anitaku.dub.length || 0,
	);

	return streamEpisodes;
}

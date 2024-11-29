import type { TmdbProvider } from '../../../providers/meta/tmdb';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { flowery } from '../../request';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { Format } from '../../utils/format';
import { getTitle } from '../helper';

const getAniZipMatch = async (info: { id: number }) => {
	const { data, error } = await flowery.get<{ mappings: { themoviedb_id: string } }>(
		`https://api.ani.zip/mappings?anilist_id=${info.id}`,
	);

	if (error || !data) return undefined;

	const themoviedbId = data.mappings.themoviedb_id;

	return themoviedbId;
};

export const tmdb = async (tmdb: TmdbProvider, id: number) => {
	const { data, error } = await getTitle(id);

	if (error) {
		return error;
	}

	const result = await tmdb.search(cleanTitle((data?.title as ITitle).userPreferred || '') || '');

	const bestMatch = findBestMatch(data as IAnimeResult | undefined, result) || {
		similarity: 1,
		match: {
			id:
				data?.format === Format.TV ||
				data?.format === Format.OVA ||
				data?.format === Format.ONA ||
				data?.format === Format.SPECIAL ||
				data?.format === Format.MANGA ||
				data?.format === Format.NOVEL ||
				data?.format === Format.TV_SHORT
					? `tv/${await getAniZipMatch({ id })}`
					: `movie/${await getAniZipMatch({ id })}`,
			title: data?.title,
			year: data?.seasonYear ?? data?.year,
			format: data?.format,
		},
		matchType: 'partial',
		matchedTitle: data?.title,
		sanitizedTitle: 'Unneeded',
	};

	return {
		...bestMatch,
	};
};

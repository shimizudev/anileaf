import type { TVDBProvider } from '../../../providers/meta/tvdb';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { flowery } from '../../request';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { Format } from '../../utils/format';
import { getTitle } from '../helper';

const getAniZipMatch = async (info: { id: number }) => {
	const { data, error } = await flowery.get<{ mappings: { thetvdb_id: string } }>(
		`https://api.ani.zip/mappings?anilist_id=${info.id}`,
	);

	if (error || !data) return undefined;

	const thetvdbId = data.mappings.thetvdb_id;

	return thetvdbId;
};

export const tvdb = async (tvdb: TVDBProvider, id: number) => {
	const { data, error } = await getTitle(id);

	if (error) {
		return error;
	}

	const result = await tvdb.search(
		(data?.title as ITitle).english ||
			(data?.title as ITitle).romaji ||
			(data?.title as ITitle).userPreferred ||
			'',
		data?.format as Format,
		data?.year as number,
	);

	const bestMatch = findBestMatch(data as IAnimeResult | undefined, result) || {
		similarity: 1,
		match: {
			id:
				id === 21519
					? 'movies/197'
					: `${
							data?.format === Format.TV ||
							data?.format === Format.TV_SHORT ||
							data?.format === Format.SPECIAL
								? 'series'
								: data?.format === Format.MOVIE
									? 'movies'
									: undefined
						}/${await getAniZipMatch(data as unknown as { id: number })}`,
			title: data?.title,
			format: data?.format,
			year: data?.year,
			synonyms: [
				(data?.title as ITitle).english,
				(data?.title as ITitle).romaji,
				(data?.title as ITitle).native,
				(data?.title as ITitle).userPreferred,
			],
		},
		matchType: 'partial',
	};

	return {
		...bestMatch,
	};
};

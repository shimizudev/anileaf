import type { AniDBProvider } from '../../../providers/meta/anidb';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { getTitle } from '../helper';

export const anidb = async (anidb: AniDBProvider, id: number) => {
	const { data, error } = await getTitle(id);

	if (error) {
		return error;
	}

	const result = await anidb.search(
		cleanTitle(
			(data?.title as ITitle).english ||
				(data?.title as ITitle).romaji ||
				(data?.title as ITitle).userPreferred ||
				'',
		) || '',
	);

	const bestMatch = findBestMatch(data as IAnimeResult | undefined, result);

	return {
		...bestMatch,
	};
};

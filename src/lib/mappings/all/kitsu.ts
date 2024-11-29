import type { KitsuProvider } from '../../../providers/meta/kitsu';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { getTitle } from '../helper';

export const kitsu = async (kitsu: KitsuProvider, id: number) => {
	const { data, error } = await getTitle(id);

	if (error) {
		return error;
	}

	const result = await kitsu.search(
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

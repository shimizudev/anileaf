import type { HianimeProvider } from '../../../providers/anime/hianime';
import { MalProvider } from '../../../providers/meta/mal';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { getTitle } from '../helper';

export const hianime = async (hianime: HianimeProvider, id: number) => {
	const data = await new MalProvider().getInfo(id);

	if (!data) {
		return undefined;
	}

	const result = await hianime.search(
		cleanTitle(
			(data.title as ITitle).english ||
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

import type { AnitakuProvider } from '../../../providers/anime/anitaku';
import type { IAnimeResult, ITitle } from '../../../types/main';
import { cleanTitle, findBestMatch } from '../../string-sim';
import { getTitle } from '../helper';

export const anitaku = async (anitaku: AnitakuProvider, id: number) => {
	const { data, error } = await getTitle(id);

	if (error) {
		return error;
	}

	const result = await anitaku.search(
		cleanTitle(
			(data?.title as ITitle).english ||
				(data?.title as ITitle).romaji ||
				(data?.title as ITitle).userPreferred ||
				'',
		) || '',
	);

	const subResults = result.filter((r) => !(r.title as string).includes('(Dub)'));
	const dubResults = result.filter((r) => (r.title as string).includes('(Dub)'));

	const bestSub = findBestMatch(data as IAnimeResult | undefined, subResults);
	const bestDub = findBestMatch(data as IAnimeResult | undefined, dubResults);

	return {
		sub: bestSub,
		dub: bestDub,
	};
};

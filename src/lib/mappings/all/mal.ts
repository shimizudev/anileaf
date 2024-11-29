import type { MalProvider } from '../../../providers/meta/mal';
import type { IAnimeResult } from '../../../types/main';
import { getTitle } from '../helper';

export const mal = async (malProvider: MalProvider, id: number): Promise<IAnimeResult> => {
	const malId = ((await getTitle(id)).data as IAnimeResult).idMal;

	const malInfo = await malProvider.getInfo(Number(malId));

	return malInfo;
};

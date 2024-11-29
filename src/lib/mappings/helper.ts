import type { IAnimeResult } from '../../types/main';
import { ANILIST_GRAPHQL } from '../constants';
import { flowery } from '../request';
import type { Format } from '../utils/format';

export const titleGql = (id: number) => `
	query {
		Media(id: ${id}) {
		  id
			idMal
			seasonYear
			format
			title {
				romaji
				english
				native
				userPreferred
			}
		}
	}
`;

export const getTitle = async (
	id: number,
): Promise<{
	data: IAnimeResult | null;
	error: Error | null;
}> => {
	const { data, error } = await flowery.post<{
		data: {
			Media: {
				id: number;
				idMal: number;
				seasonYear: number;
				format: Format;
				title: { romaji: string; english: string; native: string; userPreferred: string };
			};
		};
	}>(ANILIST_GRAPHQL, {
		json: {
			query: titleGql(id),
		},
	});

	return {
		data: {
			...data?.data.Media,
			year: data?.data.Media.seasonYear,
		} as IAnimeResult | null,
		error,
	};
};

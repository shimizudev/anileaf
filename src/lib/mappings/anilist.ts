import { flowery } from '../request';

interface PageInfo {
	total: number;
	currentPage: number;
	lastPage: number;
	hasNextPage: boolean;
	perPage: number;
}

interface AnilistResponse {
	data: {
		Page: {
			pageInfo: {
				total: number;
				currentPage: number;
				lastPage: number;
				hasNextPage: boolean;
				perPage: number;
			};
			media: Array<{
				id: number;
				popularity: number;
				trending: number;
				averageScore: number;
			}>;
		};
	};
}

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: $sort) {
      id
      popularity
      trending
      averageScore
    }
  }
}
`;

export async function getAnilistIds(options: {
	sort?: string[];
	season?: string;
	year?: number;
	page?: number;
	perPage?: number;
}): Promise<{ ids: number[]; pageInfo: PageInfo }> {
	const variables = {
		page: options.page || 1,
		perPage: options.perPage || 50,
		sort: options.sort || ['TRENDING_DESC'],
		season: options.season?.toUpperCase(),
		seasonYear: options.year,
	};

	const { data } = await flowery.post<AnilistResponse>('https://graphql.anilist.co', {
		json: {
			query: ANILIST_QUERY,
			variables,
		},
	});

	return {
		ids: data?.data.Page.media.map((m) => m.id) || [],
		pageInfo: data?.data.Page.pageInfo || {
			total: 0,
			currentPage: 1,
			lastPage: 1,
			hasNextPage: false,
			perPage: variables.perPage,
		},
	};
}

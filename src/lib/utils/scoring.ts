import { formatDistanceToNow } from 'date-fns';
import type { IAnimeResult } from '../../types/main';

interface ScoreWeights {
	views?: number;
	rating?: number;
	completion?: number;
	engagement?: number;
	recency?: number;
	seasonality?: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
	views: 0.3,
	rating: 0.2,
	completion: 0.15,
	engagement: 0.15,
	recency: 0.1,
	seasonality: 0.1,
};

export function calculateTrendingScore(anime: IAnimeResult, weights = DEFAULT_WEIGHTS): number {
	let score = 0;

	// Base view score (normalized to 0-1)
	const viewScore = Math.log10((anime.views as number) || 1) / 6; // Assuming max views ~1M
	score += viewScore * (weights.views || 0);

	// Rating score (already 0-1)
	const ratingScore = (anime.rating || 0) / 100;
	score += ratingScore * (weights.rating || 0);

	// Completion score
	const completionScore = ((anime.completed as number) || 0) / ((anime.views as number) || 1);
	score += completionScore * (weights.completion || 0);

	// Engagement score
	const engagementScore =
		Math.log10(((anime.comments as number) || 1) + ((anime.likes as number) || 1)) / 4;
	score += engagementScore * (weights.engagement || 0);

	// Recency score
	const daysSinceUpdate = formatDistanceToNow(
		new Date((anime.updatedAt as Date) || Date.now()),
	).includes('day')
		? Number.parseInt(formatDistanceToNow(new Date((anime.updatedAt as Date) || Date.now())))
		: 30;
	const recencyScore = Math.max(0, 1 - daysSinceUpdate / 30); // Decay over 30 days
	score += recencyScore * (weights.recency || 0);

	// Seasonal relevance
	const isCurrentSeason =
		anime.season === getCurrentSeason() && anime.year === new Date().getFullYear();
	const seasonalityScore = isCurrentSeason ? 1 : 0;
	score += seasonalityScore * (weights.seasonality || 0);

	return score;
}

export function calculatePopularityScore(anime: IAnimeResult): number {
	const weights: ScoreWeights = {
		views: 0.4,
		rating: 0.3,
		completion: 0.2,
		engagement: 0.1,
	};

	return calculateTrendingScore(anime, weights);
}

export function getCurrentSeason(): string {
	const month = new Date().getMonth();
	if (month >= 0 && month <= 2) return 'WINTER';
	if (month >= 3 && month <= 5) return 'SPRING';
	if (month >= 6 && month <= 8) return 'SUMMER';
	return 'FALL';
}

export enum TimeFrame {
	ALL_TIME = 'all_time',
	THIS_WEEK = 'this_week',
	LAST_WEEK = 'last_week',
	THIS_MONTH = 'this_month',
	LAST_MONTH = 'last_month',
	THIS_SEASON = 'this_season',
	LAST_SEASON = 'last_season',
}

export function getTimeFrameDates(timeFrame: TimeFrame): { start: Date; end: Date } {
	const now = new Date();
	const start = new Date();
	const end = new Date();

	switch (timeFrame) {
		case TimeFrame.THIS_WEEK:
			start.setDate(now.getDate() - now.getDay()); // Start of week
			break;
		case TimeFrame.LAST_WEEK:
			start.setDate(now.getDate() - now.getDay() - 7);
			end.setDate(start.getDate() + 6);
			break;
		case TimeFrame.THIS_MONTH:
			start.setDate(1);
			break;
		case TimeFrame.LAST_MONTH:
			start.setMonth(now.getMonth() - 1, 1);
			end.setMonth(now.getMonth(), 0);
			break;
		case TimeFrame.THIS_SEASON: {
			const currentSeason = getCurrentSeason();
			start.setMonth(getSeasonStartMonth(currentSeason));
			end.setMonth(getSeasonStartMonth(currentSeason) + 2, 31);
			break;
		}
		case TimeFrame.LAST_SEASON: {
			const lastSeason = getPreviousSeason();
			start.setMonth(getSeasonStartMonth(lastSeason));
			end.setMonth(getSeasonStartMonth(lastSeason) + 2, 31);
			break;
		}
		default:
			start.setFullYear(2000); // Set a reasonable start date for all time
			break;
	}

	start.setHours(0, 0, 0, 0);
	end.setHours(23, 59, 59, 999);

	return { start, end };
}

function getSeasonStartMonth(season: string): number {
	switch (season) {
		case 'WINTER':
			return 0; // January
		case 'SPRING':
			return 3; // April
		case 'SUMMER':
			return 6; // July
		case 'FALL':
			return 9; // October
		default:
			return 0;
	}
}

export function getPreviousSeason(): string {
	const current = getCurrentSeason();
	switch (current) {
		case 'WINTER':
			return 'FALL';
		case 'SPRING':
			return 'WINTER';
		case 'SUMMER':
			return 'SPRING';
		case 'FALL':
			return 'SUMMER';
		default:
			return 'WINTER';
	}
}

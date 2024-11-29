import { Router } from 'express';
import AnimeModel from '../models/anime';
import { calculateTrendingScore, calculatePopularityScore } from '../lib/utils/scoring';
import type { IAnimeResult } from '../types/main';

const router = Router();

// This is used to update the metrics of an anime
// Metrics are used to calculate the trending and popularity scores
// @ts-expect-error
router.post('/metrics/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const { views, completed, dropped, comments, likes } = req.body;

		const anime = await AnimeModel.findOne({ id: Number(id) });
		if (!anime) {
			return res.status(404).json({ error: 'Anime not found' });
		}

		const updates = {
			views: (anime.views || 0) + (views || 0),
			completed: (anime.completed || 0) + (completed || 0),
			dropped: (anime.dropped || 0) + (dropped || 0),
			comments: (anime.comments || 0) + (comments || 0),
			likes: (anime.likes || 0) + (likes || 0),
			updatedAt: new Date(),
		};

		const animeData = { ...anime.toObject(), ...updates, id: Number(id) };
		const trendingScore = calculateTrendingScore(animeData as IAnimeResult);
		const popularityScore = calculatePopularityScore(animeData as IAnimeResult);

		await AnimeModel.updateOne(
			{ id: Number(id) },
			{
				$set: {
					...updates,
					trendingScore,
					popularityScore,
				},
			},
		);

		res.json({ success: true });
	} catch (error) {
		console.error('Error updating metrics:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;

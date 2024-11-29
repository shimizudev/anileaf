import { connect } from '../lib/db';
import AnimeModel from '../models/anime';
import { get } from '../lib/mappings/get';
import { FloweryStatus, type StatusColor } from '../lib/utils/status';
import { clearCache } from '../lib/cache';
import { setTimeout } from 'node:timers/promises';

interface UpdaterConfig {
	// Update intervals in minutes
	intervals: {
		RELEASING: number;
		NOT_YET_RELEASED: number;
		HIATUS: number;
	};
	// Batch size for each update cycle
	batchSize: number;
	// Delay between batches in milliseconds
	batchDelay: number;
	// Delay between full update cycles in minutes
	cycleDelay: number;
}

const config: UpdaterConfig = {
	intervals: {
		RELEASING: 60, // Update airing anime every hour
		NOT_YET_RELEASED: 720, // Update upcoming anime every 12 hours
		HIATUS: 360, // Update on-hold anime every 6 hours
	},
	batchSize: 50,
	batchDelay: 5000, // 5 seconds between batches
	cycleDelay: 30, // 30 minutes between cycles
};

class AnimeUpdater {
	private isRunning = false;
	private shouldStop = false;

	constructor(private readonly config: UpdaterConfig) {
		// Handle graceful shutdown
		process.on('SIGINT', () => {
			console.info('\nGracefully shutting down...');
			this.shouldStop = true;
		});
	}

	private async updateAnime(anime: { id: number; status: { status: FloweryStatus } }) {
		try {
			console.info(`Updating anime ${anime.id}`);
			const animeInfo = await get(anime.id);
			await AnimeModel.updateOne({ 'mappings.anilist': anime.id }, { $set: animeInfo });
			console.info(`Successfully updated anime ${anime.id}`);
		} catch (error) {
			console.error(`Failed to update anime ${anime.id}:`, error);
		}
	}

	private async processBatch(
		animes: Array<{
			id: number;
			status: { status: FloweryStatus | undefined; color: StatusColor | undefined };
			[key: string]: unknown;
		}>,
		lastUpdate: Date,
	) {
		const updatePromises = animes.map(async (anime) => {
			const status = anime.status.status as unknown as keyof typeof this.config.intervals;
			const interval = this.config.intervals[status];
			const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60);

			if (minutesSinceUpdate >= interval) {
				await this.updateAnime(anime as { id: number; status: { status: FloweryStatus } });
			}
		});

		await Promise.all(updatePromises);
	}

	private async getAnimesToUpdate() {
		return AnimeModel.find({
			'status.status': {
				$in: [FloweryStatus.RELEASING, FloweryStatus.NOT_YET_RELEASED, FloweryStatus.HIATUS],
			},
			'mappings.anilist': { $exists: true },
		})
			.select('mappings.anilist status updatedAt')
			.lean();
	}

	async start() {
		if (this.isRunning) {
			console.warn('Updater is already running');
			return;
		}

		this.isRunning = true;
		this.shouldStop = false;

		console.info('Starting anime updater...');

		while (!this.shouldStop) {
			try {
				const animes = await this.getAnimesToUpdate();
				console.info(`Found ${animes.length} anime to check for updates`);

				// Process in batches
				for (let i = 0; i < animes.length; i += this.config.batchSize) {
					if (this.shouldStop) break;
					const batch = animes.slice(i, i + this.config.batchSize).map((anime) => ({
						id: (anime.mappings as { anilist: number })?.anilist,
						status: anime.status as {
							status: FloweryStatus | undefined;
							color: StatusColor | undefined;
						},
					}));
					await this.processBatch(batch, new Date());

					// Wait between batches
					if (i + this.config.batchSize < animes.length) {
						await setTimeout(this.config.batchDelay);
					}
				}

				// Clear cache after update cycle
				await clearCache();
				console.info('Cache cleared after update cycle');

				// Wait before starting next cycle
				if (!this.shouldStop) {
					console.info(`Waiting ${this.config.cycleDelay} minutes before next cycle...`);
					await setTimeout(this.config.cycleDelay * 60 * 1000);
				}
			} catch (error) {
				console.error('Error in update cycle:', error);
				// Wait before retrying
				await setTimeout(60 * 1000); // 1 minute
			}
		}

		this.isRunning = false;
		console.info('Updater stopped');
	}
}

async function main() {
	try {
		await connect();
		console.info('Connected to database');

		const updater = new AnimeUpdater(config);
		await updater.start();
	} catch (error) {
		console.error('Failed to start updater:', error);
		process.exit(1);
	}
}

// Start the updater
main();

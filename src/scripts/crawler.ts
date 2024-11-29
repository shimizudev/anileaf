import { get } from '../lib/mappings/get';
import AnimeModel from '../models/anime';
import { flowery } from '../lib/request';
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'date-fns';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { connect } from '../lib/db';

interface CrawlerState {
	lastId: number;
	lastUpdate: string;
	totalProcessed: number;
	errors: number;
	successes: number;
}

class AnimeCrawler {
	private readonly logDir = join(process.cwd(), 'logs');
	private readonly stateFile = join(this.logDir, 'crawler-state.json');
	private readonly errorLogFile: string;
	private readonly infoLogFile: string;
	private state: CrawlerState;
	private spinner: Ora;

	constructor() {
		const date = format(new Date(), 'yyyy-MM-dd');
		this.errorLogFile = join(this.logDir, `errors-${date}.log`);
		this.infoLogFile = join(this.logDir, `info-${date}.log`);
		this.state = {
			lastId: 0,
			lastUpdate: new Date().toISOString(),
			totalProcessed: 0,
			errors: 0,
			successes: 0,
		};
		this.spinner = ora('Initializing crawler...');
	}

	private async initializeLogger(): Promise<void> {
		if (!existsSync(this.logDir)) {
			await mkdir(this.logDir, { recursive: true });
		}
	}

	private async loadState(): Promise<void> {
		try {
			if (existsSync(this.stateFile)) {
				const data = await readFile(this.stateFile, 'utf-8');
				this.state = JSON.parse(data);
			}
		} catch (error) {
			await this.logError('Failed to load state', error);
		}
	}

	private async saveState(): Promise<void> {
		try {
			this.state.lastUpdate = new Date().toISOString();
			await writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
		} catch (error) {
			await this.logError('Failed to save state', error);
		}
	}

	private async logError(message: string, error: unknown): Promise<void> {
		const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
		const errorMessage = error instanceof Error ? error.stack : String(error);
		const logEntry = `[${timestamp}] ${message}\n${errorMessage}\n\n`;

		await appendFile(this.errorLogFile, logEntry);
	}

	private async logInfo(message: string): Promise<void> {
		const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
		const logEntry = `[${timestamp}] ${message}\n`;

		await appendFile(this.infoLogFile, logEntry);
	}

	private updateSpinner(): void {
		const { totalProcessed, errors, successes } = this.state;
		this.spinner.text = chalk.blue(
			`Processed: ${totalProcessed} | ` +
				`Successes: ${chalk.green(successes)} | ` +
				`Errors: ${chalk.red(errors)} | ` +
				`Current ID: ${chalk.yellow(this.state.lastId)}`,
		);
	}

	private async fetchIds(): Promise<number[]> {
		try {
			const { data } = await flowery.get<string>(
				'https://raw.githubusercontent.com/5H4D0WILA/IDFetch/main/ids.txt',
			);

			if (!data) throw new Error('No data received from IDs endpoint');

			return data
				.split('\n')
				.map((id) => Number.parseInt(id.trim()))
				.filter((id) => !Number.isNaN(id) && id > this.state.lastId)
				.sort((a, b) => a - b);
		} catch (error) {
			await this.logError('Failed to fetch IDs', error);
			throw error;
		}
	}

	private async processAnime(id: number): Promise<void> {
		try {
			const animeInfo = await get(id);

			// Check if anime already exists
			const existingAnime = await AnimeModel.findOne({
				'mappings.anilist': id,
			});

			if (existingAnime) {
				// Update existing anime
				await AnimeModel.updateOne({ 'mappings.anilist': id }, animeInfo);
				await this.logInfo(`Updated anime: ${id}`);
			} else {
				// Create new anime
				const anime = new AnimeModel(animeInfo);
				await anime.save();
				await this.logInfo(`Added new anime: ${id} with custom id ${animeInfo.id}`);
			}

			this.state.successes++;
		} catch (error) {
			this.state.errors++;
			await this.logError(`Failed to process anime ID: ${id}`, error);
		} finally {
			this.state.totalProcessed++;
			this.state.lastId = id;
			this.updateSpinner();
		}
	}

	public async start(): Promise<void> {
		try {
			await this.initializeLogger();
			await this.loadState();
			await connect();

			this.spinner.start();

			const ids = await this.fetchIds();
			if (ids.length === 0) {
				this.spinner.succeed(chalk.green('No new IDs to process'));
				return;
			}

			this.spinner.info(chalk.blue(`Found ${ids.length} new IDs to process`));
			this.spinner.start();

			for (const id of ids) {
				await this.processAnime(id);

				// Save state every 10 processed items
				if (this.state.totalProcessed % 10 === 0) {
					await this.saveState();
				}
			}

			await this.saveState();
			this.spinner.succeed(chalk.green('Crawling completed successfully'));
			// Final statistics
			this.spinner.info(chalk.blue('\nFinal Statistics:'));
			this.spinner.info(chalk.white(`Total Processed: ${this.state.totalProcessed}`));
			this.spinner.info(chalk.green(`Successes: ${this.state.successes}`));
			this.spinner.info(chalk.red(`Errors: ${this.state.errors}`));
		} catch (error) {
			this.spinner.fail(chalk.red('Crawler failed'));
			await this.logError('Crawler failed', error);
			throw error;
		}
	}
}

export default AnimeCrawler;

export async function run(): Promise<void> {
	const crawler = new AnimeCrawler();
	await crawler.start();
}

if (require.main === module) {
	run().catch((error) => {
		console.error(chalk.red('Fatal error:'), error.message);
		process.exit(1);
	});
}

import chalk from 'chalk';
import mongoose from 'mongoose';

export const connect = async () => {
	await mongoose.connect(process.env.MONGO_URI as string);
	console.info(chalk.green('Connected to MongoDB'));
};

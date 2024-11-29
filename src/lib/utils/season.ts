/**
 * Enum for defining the seasons of the year.
 * @enum {string}
 */
export enum Season {
	WINTER = 'WINTER',
	SPRING = 'SPRING',
	SUMMER = 'SUMMER',
	FALL = 'FALL',
}

/**
 * Enum for defining the seasons of the year with flowery names.
 * @enum {string}
 */
export enum FlowerySeason {
	WINTER = 'Winter',
	SPRING = 'Spring',
	SUMMER = 'Summer',
	FALL = 'Fall',
}

/**
 * Enum for defining the colors associated with each season.
 * @enum {string}
 */
export enum SeasonColor {
	WINTER = '#B0C4DE',
	SPRING = '#98FB98',
	SUMMER = '#FFB6C1',
	FALL = '#F0E68C',
}

/**
 * Enum for defining the numerical order of the seasons.
 * @enum {number}
 */
export enum SeasonNumber {
	WINTER = 1,
	SPRING = 2,
	SUMMER = 3,
	FALL = 4,
}

/**
 * Converts a Season enum to its corresponding FlowerySeason enum.
 * @param {Season} season - The season to convert.
 * @returns {FlowerySeason} - The flowery season corresponding to the input season.
 */
export const parseSeason = (season: Season): FlowerySeason => {
	return FlowerySeason[season];
};

/**
 * Converts a Season enum to its corresponding SeasonNumber enum.
 * @param {Season} season - The season to convert.
 * @returns {SeasonNumber} - The season number corresponding to the input season.
 */
export const parseSeasonNumber = (season: Season): SeasonNumber => {
	return SeasonNumber[season];
};

/**
 * Converts a Season enum to its corresponding SeasonColor enum.
 * @param {Season} season - The season to convert.
 * @returns {SeasonColor} - The season color corresponding to the input season.
 */
export const parseSeasonColor = (season: Season): SeasonColor => {
	return SeasonColor[season];
};

/**
 * Generates month range for a given season and year.
 * @param {Season} season - The season to generate the range for.
 * @returns {[number, number]} - An array containing the start and end months for the given season.
 */
export const generateMonthRange = (season: Season): [number, number] => {
	const seasonNumber = parseSeasonNumber(season);
	const startMonth = (seasonNumber - 1) * 3 + 1;
	const endMonth = seasonNumber * 3;
	return [startMonth, endMonth];
};

/**
 * Parses season information including the flowery name, number, color, and a formatted string.
 * @param {Season} season - The season to parse.
 * @param {number} [year] - The year to include in the formatted string.
 * @returns {{ season: FlowerySeason; number: SeasonNumber; color: SeasonColor; formatted: string }} - An object containing the parsed season information.
 */
export const parseSeasonInfo = (
	season: Season,
	year?: number,
): {
	season: FlowerySeason;
	number: SeasonNumber;
	color: SeasonColor;
	monthRange: [number, number];
	formatted: string;
} => {
	return {
		season: parseSeason(season),
		number: parseSeasonNumber(season),
		color: parseSeasonColor(season),
		monthRange: generateMonthRange(season),
		formatted: year ? `${parseSeason(season)} ${year}` : parseSeason(season),
	};
};

import { distance } from 'fastest-levenshtein';
import type { IAnimeResult, ITitle } from '../types/main';

/**
 * Represents the result of a match between the target and a candidate anime.
 * @property {number} similarity - The similarity score between the target and the match.
 * @property {IAnimeResult} match - The matched anime result.
 * @property {'strict' | 'loose' | 'partial' | 'year-strict' | 'year-loose'} matchType - The type of match found.
 * @property {string} sanitizedTitle - The sanitized version of the target title that was matched.
 * @property {string} matchedTitle - The title from the candidate that matched.
 */
export interface MatchResult {
	similarity: number;
	match: IAnimeResult;
	matchType: 'strict' | 'loose' | 'partial' | 'year-strict' | 'year-loose';
	sanitizedTitle: string;
	matchedTitle: string;
}

/**
 * Cleans and normalizes a given title string for comparison.
 * @param {string | undefined} title - The title string to clean.
 * @returns {string | undefined} - The cleaned and normalized title string, or undefined if the input was undefined.
 */
export function cleanTitle(title?: string): string | undefined {
	if (!title) return undefined;

	// Normalize the string to remove accents and other diacritical marks
	return (
		title
			.normalize('NFKC')
			// Replace non-word characters with spaces
			.replace(/[^\w\s]/g, ' ')
			// Remove duplicate spaces
			.replace(/\s+/g, ' ')
			// Trim leading and trailing spaces
			.trim()
			// Limit the length of the title to 100 characters
			.slice(0, 100)
	);
}

/**
 * Sanitizes a title string by removing unnecessary words and characters for comparison.
 * @param {string | undefined} title - The title string to sanitize.
 * @returns {string | undefined} - The sanitized title string, or undefined if the input was undefined.
 */
export function sanitizeTitle(title?: string): string | undefined {
	if (!title) return undefined;

	let sanitized = title
		.toLowerCase()
		.replaceAll('chapters', 'chapter')
		// Remove specific words related to anime seasons or parts
		.replace(/\b(season|cour|part|chapter|special)\b/g, '')
		// Remove specific words related to anime seasons or parts with numbers
		.replace(/(\d+)(?:th|rd|nd|st)?\s*(?:season|cour|part|chapter|special)\b/gi, ' $1 ')
		// Remove non-alphanumeric characters
		.replace(/[^a-z0-9\s]/g, '')
		// Replace specific words to ensure consistency
		.replace(/yuu/g, 'yu')
		.replace(/ouh/g, 'oh')
		.replace(/yaa/g, 'ya')
		// Remove specific words related to anime formats or additional information
		.replace(
			/\b(?:uncut|uncensored|dub(?:bed)?|censored|sub(?:bed)?|the final chapters)\b|\([^)]*\)|\bBD\b|\(TV\)/gi,
			'',
		);

	// Normalize the string to remove accents and other diacritical marks, and then remove diacritical marks
	sanitized = sanitized.normalize('NFD').replace(/\p{M}/gu, '');
	return cleanTitle(sanitized);
}

/**
 * Extracts the year from a given title string.
 * @param {string} title - The title string to extract the year from.
 * @returns {number | null} - The extracted year, or null if no year was found.
 */
function extractYear(title: string): number | null {
	const yearMatch = title.match(/\b(19|20)\d{2}\b/);
	return yearMatch ? Number.parseInt(yearMatch[0]) : null;
}

/**
 * Gets all available titles from an ITitle object or returns an array with just the string if given a string
 * @param {ITitle | string} title - The title to get all variations from
 * @returns {string[]} - Array of all available title variations
 */
function getAllTitles(title: ITitle | string): string[] {
	if (typeof title === 'string') return [title];
	return [title.userPreferred, title.english, title.romaji, title.native].filter(
		(t): t is string => !!t,
	);
}

/**
 * Finds the best match between a target anime and a list of candidate anime.
 * @param {IAnimeResult | undefined} target - The target anime to find a match for.
 * @param {IAnimeResult[] | undefined} candidates - The list of candidate anime to match against.
 * @returns {MatchResult | null} - The best match found, or null if no match was found.
 */
export function findBestMatch(
	target: IAnimeResult | undefined,
	candidates: IAnimeResult[] | undefined,
): MatchResult | null {
	if (!target || !candidates || !candidates.length) return null;
	if (Object.values(target.title).every((title) => !title)) return null;

	if (process.env.DEBUG_ENABLED && Boolean(process.env.DEBUG_ENABLED) === true) {
		console.dir(target, { depth: null });
		console.dir(candidates, { depth: null });
	}

	const targetTitles = getAllTitles(target.title);
	const targetYear =
		(target.year as number) || targetTitles.map(extractYear).find((y) => y !== null) || 0;
	const sanitizedTargetTitles = targetTitles.map(sanitizeTitle).filter((t): t is string => !!t);

	// 1. Try exact title match with year
	if (targetYear) {
		for (const candidate of candidates) {
			const candidateTitles = getAllTitles(candidate.title);
			const candidateYear =
				(candidate.year as number) || candidateTitles.map(extractYear).find((y) => y !== null) || 0;

			if (candidateYear === targetYear) {
				for (const targetTitle of targetTitles) {
					if (candidateTitles.includes(targetTitle)) {
						return {
							similarity: 1,
							match: candidate,
							matchType: 'year-strict',
							sanitizedTitle: 'Unneeded',
							matchedTitle: targetTitle,
						};
					}
				}
			}
		}
	}

	// 2. Try sanitized title match with year
	if (targetYear) {
		for (const candidate of candidates) {
			const candidateTitles = getAllTitles(candidate.title);
			const candidateYear =
				(candidate.year as number) || candidateTitles.map(extractYear).find((y) => y !== null) || 0;
			const sanitizedCandidateTitles = candidateTitles
				.map(sanitizeTitle)
				.filter((t): t is string => !!t);

			if (candidateYear === targetYear) {
				for (const sanitizedTargetTitle of sanitizedTargetTitles) {
					if (sanitizedCandidateTitles.includes(sanitizedTargetTitle)) {
						return {
							similarity: 1,
							match: candidate,
							matchType: 'year-loose',
							sanitizedTitle: sanitizedTargetTitle,
							matchedTitle: sanitizedTargetTitle,
						};
					}
				}
			}
		}
	}

	// 3. Try exact title match without year
	for (const candidate of candidates) {
		const candidateTitles = getAllTitles(candidate.title);
		for (const targetTitle of targetTitles) {
			if (candidateTitles.includes(targetTitle)) {
				return {
					similarity: 1,
					match: candidate,
					matchType: 'strict',
					sanitizedTitle: 'Unneeded',
					matchedTitle: targetTitle,
				};
			}
		}
	}

	// 4. Try sanitized title match without year
	for (const candidate of candidates) {
		const candidateTitles = getAllTitles(candidate.title);
		const sanitizedCandidateTitles = candidateTitles
			.map(sanitizeTitle)
			.filter((t): t is string => !!t);

		for (const sanitizedTargetTitle of sanitizedTargetTitles) {
			if (sanitizedCandidateTitles.includes(sanitizedTargetTitle)) {
				return {
					similarity: 1,
					match: candidate,
					matchType: 'loose',
					sanitizedTitle: sanitizedTargetTitle,
					matchedTitle: sanitizedTargetTitle,
				};
			}
		}
	}

	// 5. Try loose match with high similarity
	let bestMatch: MatchResult | null = null;
	for (const candidate of candidates) {
		const candidateTitles = getAllTitles(candidate.title);
		const sanitizedCandidateTitles = candidateTitles
			.map(sanitizeTitle)
			.filter((t): t is string => !!t);

		for (const sanitizedTargetTitle of sanitizedTargetTitles) {
			for (const sanitizedCandidateTitle of sanitizedCandidateTitles) {
				const dist = distance(sanitizedCandidateTitle, sanitizedTargetTitle);
				const maxLength = Math.max(sanitizedCandidateTitle.length, sanitizedTargetTitle.length);
				const similarity = 1 - dist / maxLength;

				if (similarity >= 0.8 && (!bestMatch || similarity > bestMatch.similarity)) {
					bestMatch = {
						similarity,
						match: candidate,
						matchType: 'loose',
						sanitizedTitle: sanitizedTargetTitle,
						matchedTitle: sanitizedCandidateTitle,
					};
				}
			}
		}
	}

	if (bestMatch) return bestMatch;

	// 6. Try partial match as last resort
	let highestSimilarity = 0;
	let partialMatch: IAnimeResult | null = null;
	let bestSanitizedTargetTitle = '';
	let bestSanitizedCandidateTitle = '';

	for (const candidate of candidates) {
		const candidateTitles = getAllTitles(candidate.title);
		const sanitizedCandidateTitles = candidateTitles
			.map(sanitizeTitle)
			.filter((t): t is string => !!t);

		for (const sanitizedTargetTitle of sanitizedTargetTitles) {
			for (const sanitizedCandidateTitle of sanitizedCandidateTitles) {
				const dist = distance(sanitizedCandidateTitle, sanitizedTargetTitle);
				const maxLength = Math.max(sanitizedCandidateTitle.length, sanitizedTargetTitle.length);
				const similarity = 1 - dist / maxLength;

				if (similarity > highestSimilarity && similarity >= 0.6) {
					highestSimilarity = similarity;
					partialMatch = candidate;
					bestSanitizedTargetTitle = sanitizedTargetTitle;
					bestSanitizedCandidateTitle = sanitizedCandidateTitle;
				}
			}
		}
	}

	if (partialMatch) {
		return {
			similarity: highestSimilarity,
			match: partialMatch,
			matchType: 'partial',
			sanitizedTitle: bestSanitizedTargetTitle,
			matchedTitle: bestSanitizedCandidateTitle,
		};
	}

	return null;
}

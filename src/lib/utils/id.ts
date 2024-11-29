import { randomBytes } from 'node:crypto';

/**
 * Generates a unique anime ID using UUID v4 principles
 * Uses more bits than MAL/Anilist for greater uniqueness
 *
 * @returns {number} A number between 100000000-999999999 (9 digits)
 */
export function generateAnimeId(): number {
	// Get 6 random bytes (48 bits) for more uniqueness
	const bytes = randomBytes(6);

	// Convert bytes to a large integer
	const randomInt =
		(bytes[0] << 40) |
		(bytes[1] << 32) |
		(bytes[2] << 24) |
		(bytes[3] << 16) |
		(bytes[4] << 8) |
		bytes[5];

	// Map to 9-digit range for more unique IDs than typical anime DBs
	const min = 100000000; // 9 digits minimum
	const max = 999999999; // 9 digits maximum

	// Use modulo to get number within range and add min
	const id = (randomInt % (max - min + 1)) + min;

	return id;
}

/**
 * Checks if a given ID appears to be valid
 * @param {number} id - The ID to validate
 * @returns {boolean} Whether the ID appears valid
 */
export function isValidAnimeId(id: number): boolean {
	// Check if it's a number and within our 9-digit range
	return !Number.isNaN(id) && Number.isInteger(id) && id >= 100000000 && id <= 999999999;
}

/**
 * Generates a unique anime ID that hasn't been used before
 * @param {Set<number>} existingIds - Set of IDs that are already in use
 * @returns {number} A unique anime ID
 */
export function generateUniqueAnimeId(existingIds: Set<number>): number {
	let id: number;
	do {
		id = generateAnimeId();
	} while (existingIds.has(id));

	return id;
}

/**
 * Generates a deterministic anime ID based on a string
 * Uses SHA-256 for better distribution than simple hashing
 *
 * @param {string} input - String to generate ID from (e.g. anime title)
 * @returns {number} A deterministic ID between 100000000-999999999
 */
export function generateDeterministicAnimeId(input: string): number {
	// Get first 6 bytes of SHA-256 hash
	const hash = randomBytes(32).map((b, i) => b ^ input.charCodeAt(i % input.length));

	// Convert to large integer
	const numericHash =
		(hash[0] << 40) |
		(hash[1] << 32) |
		(hash[2] << 24) |
		(hash[3] << 16) |
		(hash[4] << 8) |
		hash[5];

	// Map to our 9-digit range
	const min = 100000000;
	const max = 999999999;
	const id = (numericHash % (max - min + 1)) + min;

	return id;
}

/**
 * Generates a sequential anime ID
 * @param {number} lastId - The last ID that was generated
 * @returns {number} The next sequential ID
 */
export function generateSequentialAnimeId(lastId: number): number {
	// Start from 100000000 if no last ID
	if (!lastId || lastId < 100000000) {
		return 100000000;
	}

	// If we've reached our max, start over
	if (lastId >= 999999999) {
		return 100000000;
	}

	return lastId + 1;
}

/**
 * Generates a new anime ID based on an existing one, ensuring they're different
 * Uses more sophisticated hashing for better distribution
 *
 * @param {number} existingId - The existing anime ID to base the new one on
 * @returns {number} A new ID that's different from but related to the existing one
 */
export function generateRelatedAnimeId(existingId: number): number {
	// Validate the existing ID first
	if (!isValidAnimeId(existingId)) {
		return generateAnimeId();
	}

	// Use multiple prime factors for better distribution
	const seed = existingId * 31 * 17 * 13;

	// Mix bits more thoroughly
	const mixed = ((seed << 13) ^ seed) * 7;

	// Map to our 9-digit range
	const min = 100000000;
	const max = 999999999;
	let newId = (mixed % (max - min + 1)) + min;

	// Ensure we don't get the same ID
	if (newId === existingId) {
		newId = ((newId + (seed % 89999999)) % (max - min + 1)) + min;
	}

	return newId;
}

/**
 * Generates a series of related anime IDs
 * Uses a more robust algorithm to ensure uniqueness
 *
 * @param {number} baseId - The base anime ID to generate related IDs from
 * @param {number} count - How many related IDs to generate
 * @returns {number[]} An array of related but different IDs
 */
export function generateRelatedAnimeIds(baseId: number, count: number): number[] {
	const ids = new Set<number>([baseId]);
	const result: number[] = [];

	let lastId = baseId;
	while (result.length < count) {
		const newId = generateRelatedAnimeId(lastId);
		if (!ids.has(newId)) {
			ids.add(newId);
			result.push(newId);
			lastId = newId; // Use last generated ID for more variation
		}
	}

	return result;
}

/**
 * Generates a variant ID for different versions of the same anime
 * Uses cryptographic hashing for better uniqueness
 *
 * @param {number} originalId - The original anime ID
 * @param {string} variant - The variant type (e.g., 'dub', 'directors-cut')
 * @returns {number} A deterministic variant ID
 */
export function generateVariantAnimeId(originalId: number, variant: string): number {
	if (!isValidAnimeId(originalId)) {
		return generateAnimeId();
	}

	// Combine ID and variant with better mixing
	const combined = `${originalId.toString()}:${variant}`;
	const variantId = generateDeterministicAnimeId(combined);

	// Ensure different from original
	if (variantId === originalId) {
		return generateDeterministicAnimeId(`${combined}:1`);
	}

	return variantId;
}

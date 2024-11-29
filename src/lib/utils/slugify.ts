/**
 * Slugifies a given title string.
 * @param {string} title - The title to slugify.
 * @returns {string} - The slugified title.
 */
export const slugify = (title: string): string => {
	// Normalize unicode characters
	const slug = title
		.normalize('NFKD')
		// Convert to lowercase
		.toLowerCase()
		// Replace accented characters with non-accented
		// biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
		.replace(/[\u0300-\u036f]/g, '')
		// Replace common special characters with more readable alternatives
		.replace(/[&]/g, 'and')
		.replace(/[œ]/g, 'oe')
		.replace(/[æ]/g, 'ae')
		.replace(/[ø]/g, 'o')
		// Remove emojis and other special unicode
		.replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '')
		// Replace multiple spaces with single hyphen
		.replace(/\s+/g, '-')
		// Remove all non-alphanumeric characters except hyphens
		.replace(/[^a-z0-9-]/g, '')
		// Replace multiple consecutive hyphens with single hyphen
		.replace(/-+/g, '-')
		// Remove leading and trailing hyphens
		.replace(/^-+|-+$/g, '')
		// Limit length while preserving whole words where possible
		.split('-')
		.reduce((acc, part) => {
			if ((acc + (acc ? '-' : '') + part).length <= 100) {
				return acc + (acc ? '-' : '') + part;
			}
			return acc;
		}, '');

	return slug || 'untitled';
};

/**
 * Enum for defining the format of a media.
 * @enum {string}
 */
export enum Format {
	TV = 'TV',
	TV_SHORT = 'TV_SHORT',
	MOVIE = 'MOVIE',
	SPECIAL = 'SPECIAL',
	OVA = 'OVA',
	ONA = 'ONA',
	MANGA = 'MANGA',
	NOVEL = 'NOVEL',
	UNKNOWN = 'UNKNOWN',
}

/**
 * Enum for defining the format of a media with more descriptive names.
 * @enum {string}
 */
export enum FloweryFormat {
	TV = 'TV Show',
	TV_SHORT = 'TV Show',
	MOVIE = 'Movie',
	SPECIAL = 'Special',
	OVA = 'OVA',
	ONA = 'ONA',
	MANGA = 'Manga',
	NOVEL = 'Novel',
	UNKNOWN = 'Unknown',
}

/**
 * Enum for defining the colors associated with each format.
 * @enum {string}
 */
export enum FormatColor {
	TV = '#B0C4DE',
	TV_SHORT = '#ADD8E6',
	MOVIE = '#98FB98',
	SPECIAL = '#DDA0DD',
	OVA = '#FFB6C1',
	ONA = '#F0E68C',
	MANGA = '#E6E6FA',
	NOVEL = '#FFE4E1',
	UNKNOWN = '#D3D3D3',
}

/**
 * Converts a Format enum to its corresponding FloweryFormat enum.
 * @param {Format} format - The format to convert.
 * @returns {FloweryFormat} - The flowery format corresponding to the input format.
 */
export const parseFormat = (format: Format): FloweryFormat => {
	return FloweryFormat[format] || FloweryFormat.UNKNOWN;
};

/**
 * Converts a Format enum to its corresponding FormatColor enum.
 * @param {Format} format - The format to convert.
 * @returns {FormatColor} - The format color corresponding to the input format.
 */
export const parseFormatColor = (format: Format): FormatColor => {
	return FormatColor[format] || FormatColor.UNKNOWN;
};

/**
 * Parses format information including the flowery name and color.
 * @param {Format} format - The format to parse.
 * @returns {{ format: FloweryFormat; color: FormatColor }} - An object containing the parsed format information.
 */
export const parseFormatInfo = (format: Format): { format: FloweryFormat; color: FormatColor } => {
	return {
		format: parseFormat(format),
		color: parseFormatColor(format),
	};
};

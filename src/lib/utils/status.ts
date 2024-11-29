/**
 * Enum for defining the status of an anime.
 * @enum {string}
 */
export enum Status {
	FINISHED = 'FINISHED',
	RELEASING = 'RELEASING',
	NOT_YET_RELEASED = 'NOT_YET_RELEASED',
	CANCELLED = 'CANCELLED',
	HIATUS = 'HIATUS',
}

/**
 * Enum for defining the status of an anime with more descriptive names.
 * @enum {string}
 */
export enum FloweryStatus {
	FINISHED = 'Series Completed',
	RELEASING = 'Currently Airing',
	NOT_YET_RELEASED = 'Coming Soon',
	CANCELLED = 'Cancelled',
	HIATUS = 'On Hiatus',
	UNKNOWN = 'Unknown',
}

/**
 * Enum for defining the colors associated with each status.
 * @enum {string}
 */
export enum StatusColor {
	FINISHED = '#90EE90',
	RELEASING = '#FFFACD',
	NOT_YET_RELEASED = '#FFD580',
	CANCELLED = '#FFB6C1',
	HIATUS = '#D3D3D3',
	UNKNOWN = '#A9A9A9',
}

/**
 * Converts a Status enum to its corresponding FloweryStatus enum.
 * @param {Status | keyof typeof StatusColor} status - The status to convert.
 * @returns {FloweryStatus} - The flowery status corresponding to the input status.
 */
export const parseStatus = (status: Status | keyof typeof StatusColor): FloweryStatus => {
	const statusLower = status.toLowerCase();

	switch (statusLower) {
		case Status.FINISHED:
		case 'finished':
			return FloweryStatus.FINISHED;
		case Status.RELEASING:
		case 'releasing':
			return FloweryStatus.RELEASING;
		case Status.NOT_YET_RELEASED:
		case 'not_yet_released':
			return FloweryStatus.NOT_YET_RELEASED;
		case Status.CANCELLED:
		case 'cancelled':
			return FloweryStatus.CANCELLED;
		case Status.HIATUS:
		case 'hiatus':
			return FloweryStatus.HIATUS;
		default:
			return FloweryStatus.UNKNOWN;
	}
};

/**
 * Converts a Status enum to its corresponding FloweryStatus and StatusColor.
 * @param {Status | keyof typeof StatusColor} status - The status to convert.
 * @returns {{ status: FloweryStatus; color: StatusColor }} - An object containing the flowery status and color corresponding to the input status.
 */
export const parseStatusAndColor = (
	status: Status | keyof typeof StatusColor,
): { status: FloweryStatus; color: StatusColor } => {
	const floweryStatus = parseStatus(status);
	const color = StatusColor[status as keyof typeof StatusColor] || StatusColor.UNKNOWN;

	return { status: floweryStatus, color };
};

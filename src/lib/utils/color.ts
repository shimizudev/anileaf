import Vibrant from 'node-vibrant';

class ImageColor {
	private rgb: [number, number, number];

	constructor(rgb: [number, number, number]) {
		this.rgb = rgb;
	}

	async toHex(): Promise<string> {
		return `#${this.rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
	}

	async toRgb(): Promise<[number, number, number]> {
		return this.rgb;
	}

	async toHsl(): Promise<[number, number, number]> {
		const [r, g, b] = this.rgb.map((x) => x / 255);
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const delta = max - min;
		let h = 0;
		let s = 0;
		const l = (max + min) / 2;

		if (delta) {
			s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
			switch (max) {
				case r:
					h = (g - b) / delta + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / delta + 2;
					break;
				case b:
					h = (r - g) / delta + 4;
					break;
			}
			h *= 60;
		}

		return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
	}
}

export async function getColorFromImage(imageUrl: string): Promise<ImageColor | undefined> {
	try {
		const palette = await Vibrant.from(imageUrl).getPalette();

		const vibrantSwatch = palette.Vibrant;
		if (vibrantSwatch?.rgb) {
			return new ImageColor(vibrantSwatch.rgb as [number, number, number]);
		}

		const lightVibrantSwatch = palette.LightVibrant;
		if (lightVibrantSwatch?.rgb) {
			return new ImageColor(lightVibrantSwatch.rgb as [number, number, number]);
		}

		const swatches = Object.values(palette).filter(Boolean);
		const dominantSwatch = swatches.sort((a, b) => (b?.population || 0) - (a?.population || 0))[0];

		if (dominantSwatch?.rgb) {
			return new ImageColor(dominantSwatch.rgb as [number, number, number]);
		}
		return undefined;
	} catch (error) {
		throw new Error(`Failed to extract color: ${(error as Error).message}`);
	}
}

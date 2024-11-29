import { Schema, model, Types } from 'mongoose';

const AnimeSchema = new Schema(
	{
		id: { type: Number, required: true, index: true },
		slug: { type: String, required: true, index: true },
		malId: { type: Schema.Types.Mixed },

		// Titles and Descriptions
		title: { type: Schema.Types.Mixed },
		synonyms: [{ type: Schema.Types.Mixed }],
		description: { type: Schema.Types.Mixed },

		// Images
		coverImage: { type: Schema.Types.Mixed },
		bannerImage: { type: Schema.Types.Mixed },
		sliderImage: { type: Schema.Types.Mixed },
		logo: { type: Schema.Types.Mixed },

		// Dates and Status
		aired: {
			type: Schema.Types.Mixed,
			default: {
				data: null,
				relative: null,
				airDays: null,
			},
		},
		startDate: { type: Schema.Types.Mixed },
		endDate: { type: Schema.Types.Mixed },

		// Metadata
		duration: { type: Schema.Types.Mixed },
		color: { type: Schema.Types.Mixed },
		genres: [{ type: Schema.Types.Mixed }],
		tags: [{ type: Schema.Types.Mixed }],
		themes: [{ type: Schema.Types.Mixed }],
		demographics: [{ type: Schema.Types.Mixed }],

		// Status and Type Info
		status: { type: Schema.Types.Mixed },
		season: { type: Schema.Types.Mixed },
		year: { type: Schema.Types.Mixed },
		rating: { type: Schema.Types.Mixed },
		type: { type: Schema.Types.Mixed },
		format: { type: Schema.Types.Mixed },

		// Media
		trailer: { type: Schema.Types.Mixed },

		// Related Content
		characters: [{ type: Schema.Types.Mixed }],
		staff: [{ type: Schema.Types.Mixed }],

		// Episodes
		totalEpisodes: { type: Schema.Types.Mixed },
		isAiring: { type: Schema.Types.Mixed },
		streamEpisodes: {
			type: Schema.Types.Mixed,
			default: {
				tmdb: {
					hianime: {
						sub: [],
						dub: [],
					},
					anitaku: {
						sub: [],
						dub: [],
					},
				},
				tvdb: {
					hianime: {
						sub: [],
						dub: [],
					},
					anitaku: {
						sub: [],
						dub: [],
					},
				},
			},
		},

		// Relations and Additional Data
		relations: [{ type: Schema.Types.Mixed }],
		artwork: [{ type: Schema.Types.Mixed }],

		// Provider Mappings
		mappings: {
			type: Schema.Types.Mixed,
			default: {
				anidb: null,
				tvdb: null,
				tmdb: null,
				kitsu: null,
				anilist: null,
				anitaku: {
					sub: null,
					dub: null,
				},
				hianime: null,
			},
		},

		// Metrics
		views: { type: Number, default: 0 },
		completed: { type: Number, default: 0 },
		dropped: { type: Number, default: 0 },
		comments: { type: Number, default: 0 },
		likes: { type: Number, default: 0 },

		// Scores
		trendingScore: { type: Number, default: 0, index: true },
		popularityScore: { type: Number, default: 0, index: true },

		// Update timestamp
		updatedAt: { type: Date, default: Date.now },
	},
	{
		timestamps: true,
		strict: false,
		minimize: false,
		toJSON: {
			virtuals: true,
			transform: (_doc, ret) => {
				ret._id = undefined;
				ret.__v = undefined;
				return ret;
			},
		},
	},
);

AnimeSchema.index({ slug: 1 }, { unique: true });
AnimeSchema.index({ malId: 1 }, { sparse: true });
AnimeSchema.index({ 'mappings.anilist': 1 }, { sparse: true });
AnimeSchema.index({ 'mappings.tvdb': 1 }, { sparse: true });
AnimeSchema.index({ year: 1 });
AnimeSchema.index({ status: 1 });
AnimeSchema.index({ 'title.english': 'text', 'title.romaji': 'text' });
AnimeSchema.index({ trendingScore: -1 });
AnimeSchema.index({ popularityScore: -1 });

AnimeSchema.methods = {
	getTitle(preferredLanguage = 'english') {
		const title = this.title || {};
		return (
			title[preferredLanguage] ||
			title.userPreferred ||
			title.english ||
			title.romaji ||
			'Unknown Title'
		);
	},

	getEpisodes(provider = 'hianime', type = 'sub') {
		return this.streamEpisodes?.[provider]?.[type] || [];
	},
};

AnimeSchema.statics = {
	async findByProviderMapping(provider: string, id: string | number) {
		const query =
			provider === 'anitaku'
				? {
						$or: [{ 'mappings.anitaku.sub': id }, { 'mappings.anitaku.dub': id }],
					}
				: { [`mappings.${provider}`]: id };

		return this.findOne(query);
	},

	async findByTitle(title: string) {
		return this.find({
			$text: { $search: title },
		}).sort({ score: { $meta: 'textScore' } });
	},
};

const AnimeModel = model('AnimeDatabase', AnimeSchema);

export default AnimeModel;

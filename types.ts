export type PostImageComplex = {
	src: string,
	alt: string,
};

export type PostSource = 'twitter'|'reddit'|'youtube';

export type Sourceable = {
	source: PostSource,
	date:string,
	id:string,
};

export type Post = Sourceable & {
	title: string,
	author: string,
	image?:PostImageComplex[],
	via?: Sourceable & {
		name:string,
	},
};

export type PostPredictable = Post & {
	image: PostImageComplex[]
};

export type PostPredictableYouTube = Post & {
	source: 'youtube',
	url: string,
	screenshot_timestamp: number,
};

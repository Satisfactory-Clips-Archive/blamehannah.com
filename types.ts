export type PostImage = string;

export type PostSource = 'twitter'|'reddit';

export type Sourceable = {
	source: PostSource,
	date:string,
	id:string,
};

export type Post = Sourceable & {
	title: string,
	author: string,
	image?:PostImage|PostImage[],
	via?: Sourceable & {
		name:string,
	},
};

export type PostPredictable = Post & {
	image: PostImage[]
};

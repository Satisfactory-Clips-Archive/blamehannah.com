export type PostImage = string;

export type Post = {
	title: string,
	source: 'twitter'|'reddit',
	id:string,
	author: string,
	date: string,
	image?:PostImage|PostImage[],
};

export type PostPredictable = Post & {
	image: PostImage[]
};

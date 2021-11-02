export type Post = {
	title: string,
	source: 'twitter'|'reddit',
	id:string,
	author: string,
	date: string,
	image?:string,
};

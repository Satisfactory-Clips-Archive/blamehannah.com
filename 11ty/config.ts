import {
	PostPredictableYouTube,
	PostPredictable,
	PostImageComplex,
} from '../types';

const {
	DateTime,
} = require('luxon');
const {
	createHash,
} = require('crypto');
const {
	promisify,
} = require('util');
const {
	exists:existsAsync,
} = require('fs');
const {
	ImagePool,
} = require('@squoosh/lib');

const [
	exists,
] = [
	promisify(existsAsync),
];

function meta(post:PostPredictable|PostPredictableYouTube, image:PostImageComplex) : {
	url: string,
	width: number,
	height: number,
} {
	return require(`${__dirname}/../cache/${post.source}/${
		createHash('sha256').update(image.src).digest('hex')
	}.json`);
}

async function localImageSrcset(post:PostPredictable|PostPredictableYouTube, image:PostImageComplex, format:'webp'|'jpg') : Promise<string> {
	const file = `${post.source}/${
		createHash('sha256').update(image.src).digest('hex')
	}`;
	const {width} = meta(post, image);

	const srcset:string[] = [];

	for (let dim of [320, 375, 425, 768]) {
		const x1 = `/img/${file}-${dim}.webp`;

		if (dim <= width && await exists(`${__dirname}/../src/${x1}`)) {
			srcset.push(`${x1} ${dim}w`);
		}
	}

	return srcset.join(', ');
}

async function localImageDimensions(post:PostPredictable|PostPredictableYouTube, post_image:PostImageComplex) : Promise<[number, number]> {
	const file = `${post.source}/${
		createHash('sha256').update(post_image.src).digest('hex')
	}`;
	const {width, height} = meta(post, post_image);

	let src:string|undefined;

	for (let dim of [320, 375, 425, 768]) {
		const x1 = `${__dirname}/../src/img/${file}-${dim}.webp`;

		if (dim <= width && await exists(x1)) {
			src = x1;
		}
	}

	if (undefined === src) {
		return [width, height];
	}

	const imagePool = new ImagePool();
	const image = imagePool.ingestImage(src);

	const {width:src_width, height:src_height} = (await image.decoded).bitmap;

	await imagePool.close();

	return [src_width, src_height];
};

module.exports = (e) => {
	e.addFilter('postDate', (date:string):string => {
		if (/^\d{4,}\-\d{2}\-\d{2}$/.test(date)) {
			return DateTime.fromISO(date).toISODate();
		}

		return DateTime.fromISO(date).toISO();
	});
	e.addFilter('postDateHuman', (date:string):string => {
		if (/^\d{4,}\-\d{2}\-\d{2}$/.test(date)) {
			return DateTime.fromISO(date).toFormat('MMMM dd, yyyy');
		}

		return DateTime.fromISO(date).toFormat('MMMM dd, yyyy h:mma');
	});
	e.addFilter('localImagePrefix', (arg:[PostPredictable, PostImageComplex]) => {
		return `/img/${arg[0].source}/${
			createHash('sha256').update(arg[1].src).digest('hex')
		}`;
	});
	e.addFilter('youtubeImagePrefix', (arg:[PostPredictableYouTube]) => {
		const hash = createHash('sha256').update(
			`${arg[0].id}@${arg[0].screenshot_timestamp}`
		).digest('hex');
		return `/img/${arg[0].source}/${hash}`;
	});
	e.addNunjucksAsyncFilter(
		'localImageWidth',
		(arg:[PostPredictable, PostImageComplex], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], arg[1]).then((dim) => {
				callback(null, dim[0]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageHeight',
		(arg:[PostPredictable, PostImageComplex], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], arg[1]).then((dim) => {
				callback(null, dim[1]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'youtubeImageWidth',
		(arg:[PostPredictableYouTube], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], {alt: '', src: `${arg[0].id}@${arg[0].screenshot_timestamp}`}).then((dim) => {
				callback(null, dim[0]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'youtubeImageHeight',
		(arg:[PostPredictableYouTube], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], {alt: '', src: `${arg[0].id}@${arg[0].screenshot_timestamp}`}).then((dim) => {
				callback(null, dim[1]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetWebp',
		(arg:[PostPredictable, PostImageComplex], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], arg[1], 'webp').then((src) => {
				callback(null, src)
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'youtubeImageSrcsetWebp',
		(arg:[PostPredictableYouTube], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], {alt: '', src: `${arg[0].id}@${arg[0].screenshot_timestamp}`}, 'webp').then((src) => {
				callback(null, src)
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetJpeg',
		(arg:[PostPredictable, PostImageComplex], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], arg[1], 'jpg').then((src) => {
				callback(null, src)
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'youtubeImageSrcsetJpeg',
		(arg:[PostPredictableYouTube], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], {alt: '', src: `${arg[0].id}@${arg[0].screenshot_timestamp}`}, 'jpg').then((src) => {
				callback(null, src)
			});
		}
	);

	function pathSoftWrap (path:string) : string {
		return path.replace(/([^\/])\//g, '$1\u200b/');
	}

	e.addFilter('pathSoftWrap', pathSoftWrap);
	e.addFilter('twitterPathSoftWrap', (post:PostPredictable) : string => {
		return pathSoftWrap(
			`twitter.com/${post.author}/status/${post.id}`
		);
	});

	return {
		dir: {
			input: './11ty/input/',
			layouts: '../layouts/',
			data: '../data/',
			output: './src/',
		},
	};
};

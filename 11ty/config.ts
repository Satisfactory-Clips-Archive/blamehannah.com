import {
	PostPredictable,
	PostImage,
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

function meta(post:PostPredictable, image:PostImage) : {
	url: string,
	width: number,
	height: number,
} {
	return require(`${__dirname}/../cache/${post.source}/${
		createHash('sha256').update(image).digest('hex')
	}.json`);
}

async function localImageSrcset(post:PostPredictable, image:PostImage, format:'webp'|'jpg') : Promise<string> {
	const file = `${post.source}/${
		createHash('sha256').update(image).digest('hex')
	}`;
	const {width} = meta(post, image);

	const srcset:string[] = [];

	for (let dim of [320, 375, 425, 768]) {
		const x1 = `/img/${file}-${dim}.webp`;

		if (dim <= width && await exists(`${__dirname}/../tmp/${x1}`)) {
			srcset.push(`${x1} ${dim}w`);
		}
	}

	return srcset.join(', ');
}

async function localImageDimensions(post:PostPredictable, post_image:PostImage) : Promise<[number, number]> {
	const file = `${post.source}/${
		createHash('sha256').update(post_image).digest('hex')
	}`;
	const {width, height} = meta(post, post_image);

	let src:string|undefined;

	for (let dim of [320, 375, 425, 768]) {
		const x1 = `${__dirname}/../tmp/img/${file}-${dim}.webp`;

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
	e.addFilter('localImagePrefix', (arg:[PostPredictable, PostImage]) => {
		return `/img/${arg[0].source}/${
			createHash('sha256').update(arg[1]).digest('hex')
		}`;
	});
	e.addNunjucksAsyncFilter(
		'localImageWidth',
		(arg:[PostPredictable, PostImage], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], arg[1]).then((dim) => {
				callback(null, dim[0]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageHeight',
		(arg:[PostPredictable, PostImage], callback:(any, number) => any) : void => {
			localImageDimensions(arg[0], arg[1]).then((dim) => {
				callback(null, dim[1]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetWebp',
		(arg:[PostPredictable, PostImage], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], arg[1], 'webp').then((src) => {
				callback(null, src)
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetJpeg',
		(arg:[PostPredictable, PostImage], callback:(any, string) => any) : void => {
			localImageSrcset(arg[0], arg[1], 'jpg').then((src) => {
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

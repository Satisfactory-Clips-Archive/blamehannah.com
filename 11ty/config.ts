import {
	Post,
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

function meta(post:Post) : {
	url: string,
	width: number,
	height: number,
} {
	return require(`${__dirname}/../cache/${post.source}/${
		createHash('sha256').update(post.image).digest('hex')
	}.json`);
}

async function localImageSrcset(post:Post, format:'webp'|'jpg') : Promise<string> {
	const file = `${post.source}/${
		createHash('sha256').update(post.image).digest('hex')
	}`;
	const {width} = meta(post);

	const srcset:string[] = [];

	for (let dim of [320, 375, 425, 768]) {
		const x1 = `/img/${file}-${dim}.webp`;

		if (dim <= width && await exists(`${__dirname}/../tmp/${x1}`)) {
			srcset.push(`${x1} ${dim}w`);
		}
	}

	return srcset.join(', ');
}

async function localImageDimensions(post) : Promise<[number, number]> {
	const file = `${post.source}/${
		createHash('sha256').update(post.image).digest('hex')
	}`;
	const {width, height} = meta(post);

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

	const {src_width, src_height} = await image.decoded;

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
	e.addFilter('localImagePrefix', (post:Post) => {
		return `/img/${post.source}/${
			createHash('sha256').update(post.image).digest('hex')
		}`;
	});
	e.addNunjucksAsyncFilter(
		'localImageWidth',
		(post:Post, callback:(any, number) => any) : void => {
			localImageDimensions(post).then((dim) => {
				callback(null, dim[0]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageHeight',
		(post:Post, callback:(any, number) => any) : void => {
			localImageDimensions(post).then((dim) => {
				callback(null, dim[1]);
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetWebp',
		(post:Post, callback:(any, string) => any) : void => {
			localImageSrcset(post, 'webp').then((src) => {
				callback(null, src)
			});
		}
	);
	e.addNunjucksAsyncFilter(
		'localImageSrcsetJpeg',
		(post:Post, callback:(any, string) => any) : void => {
			localImageSrcset(post, 'jpg').then((src) => {
				callback(null, src)
			});
		}
	);

	e.addFilter('pathSoftWrap', (path:string) : string => {
		return path.replace(/([^\/])\//g, '$1\u200b/');
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

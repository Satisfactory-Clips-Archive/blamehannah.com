const {
	promisify,
} = require('util');
const {
	exists:existsAsync,
	writeFile:writeFileAsync,
} = require('fs');
const {
	series,
	parallel,
	task,
	src,
	dest,
} = require('gulp');
const {
	createHash,
} = require('crypto');
const {
	ImagePool,
} = require('@squoosh/lib');
const htmlmin = require('gulp-htmlmin');
const changed = require('gulp-changed');
const postcss = require('gulp-postcss');
const postcss_plugins = {
	nested: require('postcss-nested'),
	import: require('postcss-import'),
	calc: require('postcss-calc'),
};
const cssnano = require('cssnano');

const [
	exists,
	writeFile,
] = [
	promisify(existsAsync),
	promisify(writeFileAsync),
];


task('sync-images', async (cb) => {
	const {
		default:fetch,
	} = await import('node-fetch');

	const imagePool = new ImagePool();

	const posts_with_images = (
		await require('./11ty/data/posts.js')()
	).filter((maybe) => {
		return 'image' in maybe;
	});

	for (let post of posts_with_images) {
		const hash = createHash('sha256').update(post.image).digest('hex');
		const file = `${__dirname}/cache/${post.source}/${hash}`;
		const filename = `${file}.png`;
		const metafile = `${file}.json`;

		if (await exists(filename) && await exists(metafile)) {
			continue;
		}

		const buffer = await (await fetch(post.image)).buffer();

		const image = imagePool.ingestImage(buffer);

		const meta = await image.decoded;

		await writeFile(metafile, JSON.stringify(
			{
				url: post.image,
				width: meta.bitmap.width,
				height: meta.bitmap.height,
			},
			null,
			'\t'
		));

		await image.encode({
			oxipng: {
				level: 3,
			}
		});

		await writeFile(filename, (await image.encodedWith.oxipng).binary);
	}

	const images = [
		[
			{
				resize: {
					enabled: true,
					width: 16,
					height: 16,
					premultiply: true,
					linearRGB: true,
				},
			},
			{
				mozjpeg: {
					quality: 40,
					chroma_quality: 5,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_multipass: true,
					trellis_loop: 50,
					progressive: false,
				},
			}
		],
		[
			{
				resize: {
					enabled: true,
					width: 320,
					premultiply: true,
					linearRGB: true,
				},
			},
			{
				mozjpeg: {
					quality: 40,
					chroma_quality: 60,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_multipass: true,
					trellis_loop: 50,
					progressive: true,
				},
				webp: {
					quality: 60,
					alpha_compression: 80,
					use_sharp_yuv: 1,
					pass: 10,
				},
			},
		],
		[
			{
				resize: {
					enabled: true,
					width: 375,
					premultiply: true,
					linearRGB: true,
				},
			},
			{
				mozjpeg: {
					quality: 40,
					chroma_quality: 60,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_multipass: true,
					trellis_loop: 50,
					progressive: true,
				},
				webp: {
					quality: 60,
					alpha_compression: 80,
					use_sharp_yuv: 1,
					pass: 10,
				},
			},
		],
		[
			{
				resize: {
					enabled: true,
					width: 425,
					premultiply: true,
					linearRGB: true,
				},
			},
			{
				mozjpeg: {
					quality: 40,
					chroma_quality: 60,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_multipass: true,
					trellis_loop: 50,
					progressive: true,
				},
				webp: {
					quality: 60,
					alpha_compression: 80,
					use_sharp_yuv: 1,
					pass: 10,
				},
			},
		],
		[
			{
				resize: {
					enabled: true,
					width: 768,
					premultiply: true,
					linearRGB: true,
				},
			},
			{
				mozjpeg: {
					quality: 40,
					chroma_quality: 60,
					trellis_opt_zero: true,
					trellis_opt_table: true,
					trellis_multipass: true,
					trellis_loop: 50,
					progressive: true,
				},
				webp: {
					quality: 60,
					alpha_compression: 80,
					use_sharp_yuv: 1,
					pass: 10,
				},
			},
		],
	];

	for (let post of posts_with_images) {
		const hash = createHash('sha256').update(post.image).digest('hex');
		const file = `${post.source}/${hash}`;
		const cache_file = `${__dirname}/cache/${file}.png`;
		const meta = require(`${__dirname}/cache/${file}.json`);

		for (let config of images.filter((rule) => {
			return rule[0].resize.width <= meta.width;
		})) {
			const [preprocess, encode_rules] = config;

			const resized = `${__dirname}/tmp/img/${file}-${
				'height' in preprocess.resize
					? `${preprocess.resize.width}x${preprocess.resize.height}`
					: `${preprocess.resize.width}`
				}`;

			const encode = {};

			const filenames = {
				mozjpeg: `${resized}.jpg`,
				webp: `${resized}.webp`,
				oxipng: `${resized}.png`,
			};

			for (let rule of Object.entries(encode_rules)) {
				const [codec, codec_rules] = rule;

				if ( ! await exists(filenames[codec])) {
					encode[codec] = codec_rules;
				}
			}

			if (Object.keys(encode).length < 1) {
				continue;
			}

			const image = imagePool.ingestImage(cache_file);

			await image.decoded;

			await image.preprocess(preprocess);

			await image.encode(encode);

			const write = [];

			if ('mozjpeg' in image.encodedWith) {
				write.push(writeFile(
					filenames.mozjpeg,
					(await image.encodedWith.mozjpeg).binary
				));
			}

			if ('webp' in image.encodedWith) {
				write.push(writeFile(
					filenames.webp,
					(await image.encodedWith.webp).binary
				));
			}

			if ('oxipng' in image.encodedWith) {
				write.push(writeFile(
					filenames.oxipng,
					(await image.encodedWith.oxipng).binary
				));
			}

			await Promise.all(write);
		}
	}

	await imagePool.close();

	cb();
});

task('html', () => {
	return src('./src/**/*.html').pipe(
		htmlmin({
			collapseInlineTagWhitespace: false,
			collapseWhitespace: true,
			minifyCSS: true,
			minifyJs: true,
			removeAttributeQuotes: true,
			preserveLineBreaks: true,
			removeComments: true,
			useShortDoctype: true,
		})
	).pipe(
		dest('./tmp/')
	)
});

task('css', () => {
	return src('./src/**/*.css').pipe(
		postcss([
			postcss_plugins.import(),
			postcss_plugins.nested(),
			postcss_plugins.calc(),
			cssnano({
				cssDeclarationSorter: 'concentric-css',
			}),
		])
	).pipe(
		dest('./tmp/')
	)
});

task('sync', () => {
	return src('./tmp/**/*.{html,png,webp,jpg,json,css}').pipe(
		changed(
			'./dist/',
			{
				hasChagned: changed.compareContents,
			}
		)
	).pipe(
		dest('./dist/')
	);
});

task('default', series(...[
	parallel(...[
		'css',
	]),
	'html',
	'sync',
]));

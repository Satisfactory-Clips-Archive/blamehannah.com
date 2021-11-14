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
const newer = require('gulp-newer');
const brotli = require('gulp-brotli');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const [
	exists,
	writeFile,
] = [
	promisify(existsAsync),
	promisify(writeFileAsync),
];
const glob = promisify(require('glob'));


task('sync-images', async (cb) => {
	const {
		default:fetch,
	} = await import('node-fetch');

	const imagePool = new ImagePool();

	const posts = (
		await require('./11ty/data/posts.js')()
	);

	const posts_with_images = (
		posts
	).filter((maybe) => {
		return 'image' in maybe && maybe.image.length > 0;
	});

	const posts_with_videos = [];

	for (let maybe of posts) {
		let video;
		if (
			'youtube' === maybe.source
			&& 'id' in maybe
			&& (
				/^yt-[^,]+,[^,]*,[^,]*$/.test(maybe.id)
				|| /^yt-[^,]+$/.test(maybe.id)
			)
			&& (video = await glob(`${__dirname}/cache/youtube/satisfactory-clips-archive/${maybe.id}.*`)).length > 0
		) {
			posts_with_videos.push([maybe, video[0]]);
		}
	}

	for (let post of posts_with_images) {
		for (let post_image of post.image) {
			const hash = createHash('sha256').update(post_image).digest('hex');
			const file = `${__dirname}/cache/${post.source}/${hash}`;
			const filename = `${file}.png`;
			const metafile = `${file}.json`;

			if (await exists(filename) && await exists(metafile)) {
				continue;
			}

			const buffer = await (await fetch(post_image)).buffer();

			const image = imagePool.ingestImage(buffer);

			const meta = await image.decoded;

			await writeFile(metafile, JSON.stringify(
				{
						url: post_image,
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
	}

	for (let data of posts_with_videos) {
		const [post, video] = data;
		let start = 0;

		if (/^yt-[^,]+,[^,]+,[^,]*$/.test(post.id)) {
			[, start] = post.id.split(',');

			start = parseFloat(start);
		}

		const offset_start = post.screenshot_timestamp - start;
		const hash = createHash('sha256').update(
			`${post.id}@${post.screenshot_timestamp}`
		).digest('hex');

		const file = `${__dirname}/cache/youtube/${hash}`;
		const filename = `${file}.png`;
		const metafile = `${file}.json`;

		if (await exists(filename) && await exists(metafile)) {
			continue;
		}

		console.log(`generating video screenshot of ${post.id}`);

		await new Promise((yup, nope) => {
			ffmpeg(video).seekInput(offset_start).frames(1).on('end', yup).on('error', nope).on('strderr', nope).on(
				'progress',
				(progress) => {
					console.log(
						`progress on ${post.id}: ${progress.percent}%`
					);
				}
			).on('start', (cli) => {
				console.log(cli);
			}).save(
				filename
			);
		});

		const image = imagePool.ingestImage(filename);

		const meta = await image.decoded;

		await writeFile(metafile, JSON.stringify(
			{
				url: filename,
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

	async function handle_images(
		file,
		cache_file,
		meta
	) {
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

	for (let post of posts_with_images) {
		for (let post_image of post.image) {
			const hash = createHash('sha256').update(post_image).digest('hex');
			const file = `${post.source}/${hash}`;
			const cache_file = `${__dirname}/cache/${file}.png`;
			const meta = require(`${__dirname}/cache/${file}.json`);

			handle_images(file, cache_file, meta);
		}
	}

	for (let data of posts_with_videos) {
		const [post] = data;
		const hash = createHash('sha256').update(
			`${post.id}@${post.screenshot_timestamp}`
		).digest('hex');

		const cached_file = `${__dirname}/cache/youtube/${hash}`;
		const filename = `${cached_file}.png`;
		const meta = require(`${cached_file}.json`);

		await handle_images(`${post.source}/${hash}`, filename, meta);
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

task('sync-schema', () => {
	return src('./src/data-schema.json').pipe(changed(
		'./tmp',
		{
			hasChanged: changed.compareContents,
		}
	)).pipe(dest('./tmp/'));
});

task('brotli', () => {
	return src('./tmp/**/*.{css,html,json}').pipe(
		newer({
			dest: './tmp/',
			ext: '.br',
		})
	).pipe(
		brotli.compress({
			quality: 11,
		})
	).pipe(
		dest('./tmp/')
	);
});

task('sync', () => {
	return src('./tmp/**/*.{html,png,webp,jpg,json,css,br}').pipe(
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
	'sync-images',
	parallel(...[
		'sync-schema',
		'css',
	]),
	'html',
	'brotli',
	'sync',
]));

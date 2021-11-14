import {
	DateTime,
} from 'luxon';
import {
	Post,
	PostImageComplex,
	PostPredictable,
} from '../../types';

const {
	promisify,
} = require('util');
const glob = promisify(require('glob'));
const Ajv = require('ajv');

const data_schema = (new Ajv()).compile(
	require(`${__dirname}/../../src/data-schema.json`)
);

const posts:Promise<string[]> = glob(`${__dirname}/../../data/**/*.json`);


module.exports = async ():Promise<PostPredictable[]> => {
	const datemap:WeakMap<Post, DateTime> = new WeakMap();

	function date(post:Post) : DateTime {
		if ( ! datemap.has(post)) {
			if ('via' in post) {
				datemap.set(post, DateTime.fromISO(post.via.date));
			} else {
				datemap.set(post, DateTime.fromISO(post.date));
			}
		}

		return datemap.get(post);
	};

	return (await posts).filter((maybe):boolean => {
		const data = require(maybe);

		const result = data_schema(data);

		if ( ! result) {
			console.error(data);

			throw data_schema.errors;
		}

		return result;
	}).map((filename:string) : PostPredictable => {
		const post = require(filename) as Post;

		if ('image' in post) {
			const image:PostImageComplex[] = post.image;

				post.image = image;
		} else {
			post.image = [] as PostImageComplex[];
		}

		return post as PostPredictable;
	}).sort((a, b) => {
		return date(b).toMillis() - date(a).toMillis();
	});
};

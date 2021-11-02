import {
	DateTime,
} from 'luxon';
import {
	Post,
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


module.exports = async ():Promise<Post[]> => {
	const datemap:WeakMap<Post, DateTime> = new WeakMap();

	function date(post:Post) : DateTime {
		if ( ! datemap.has(post)) {
			datemap.set(post, DateTime.fromISO(post.date));
		}

		return datemap.get(post);
	};

	return (await posts).filter((maybe):boolean => {
		const data = require(maybe);

		return data_schema(data);
	}).map((filename:string) : Post => {
		return require(filename) as Post;
	}).sort((a, b) => {
		return date(b).toMillis() - date(a).toMillis();
	});
};

import {
	S3Client,
	HeadBucketCommand,
	PutObjectCommand
} from '@aws-sdk/client-s3';

import { throttle } from './throttle.js';

type Logger = (message: unknown) => void;

let s3: S3Client | false | undefined;

const getAPI = (log: Logger): S3Client | false => {
	if (s3 === undefined) {
		let accessKeyId = process.env.DECK_MONSTERS_AWS_ACCESS_KEY_ID;
		let secretAccessKey = process.env.DECK_MONSTERS_AWS_SECRET_ACCESS_KEY;

		if (!accessKeyId && process.env.HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID) {
			log('Warning: HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID is deprecated. Use DECK_MONSTERS_AWS_ACCESS_KEY_ID instead.');
			accessKeyId = process.env.HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID;
		}
		if (!secretAccessKey && process.env.HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY) {
			log('Warning: HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY is deprecated. Use DECK_MONSTERS_AWS_SECRET_ACCESS_KEY instead.');
			secretAccessKey = process.env.HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY;
		}

		if (accessKeyId && secretAccessKey) {
			s3 = new S3Client({
				region: 'us-east-2',
				credentials: {
					accessKeyId,
					secretAccessKey
				}
			});
		} else {
			log('Credentials not provided for AWS S3');
			s3 = false;
		}
	}

	return s3 as S3Client | false;
};

const bucket = { Bucket: 'deckmonsters-backups' };

const save = (key: string, buffer: Buffer, log: Logger = () => {}): void => {
	try {
		const api = getAPI(log);

		if (!api) return;

		const upload = (): void => {
			const params = {
				...bucket,
				Key: `${key}.txt.gzip`,
				Body: buffer
			};

			s3 && (s3 as S3Client).send(new PutObjectCommand(params)).catch((err: unknown) => {
				log('Failed to save backup to AWS S3');
				log(err);
			});
		};

		const head = (): void => {
			api.send(new HeadBucketCommand(bucket))
				.then(() => {
					upload();
				})
				.catch((err: unknown) => {
					log('Backup bucket does not exist on AWS S3');
					log(err);
				});
		};

		head();
	} catch (err) {
		log(err);
	}
};

export const throttledSave = throttle(save, 300000);

export { throttledSave as save };

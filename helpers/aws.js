const AWS = require('aws-sdk');

let s3;
function getAPI (log) {
	if (s3 === undefined) {
		// Set the region
		AWS.config.update({ region: 'us-east-2' });

		// Set the credentials
		const credentials = new AWS.EnvironmentCredentials('HUBOT_DECK_MONSTERS_AWS');

		if (credentials.accessKeyId && credentials.secretAccessKey) {
			AWS.config.credentials = credentials;

			// Create S3 service object
			s3 = new AWS.S3({ apiVersion: '2006-03-01' });
		} else {
			log('Credentials not provided for AWS S3');
			s3 = false;
		}
	}

	return s3;
}

const bucket = { Bucket: 'deckmonsters-backups' };

function save (Key, Body, log = () => {}) {
	try {
		const api = getAPI(log);

		if (!api) return;

		const upload = () => {
			const params = {
				...bucket,
				Key: `${Key}.txt`,
				Body
			};

			s3.upload(params, (err) => {
				if (err) {
					log('Failed to save backup to AWS S3');
					log(err);
				} else {
					log('here');
				}
			});
		};

		const head = () => {
			api.headBucket(bucket, (err) => {
				if (err) {
					log('Backup bucket does not exist on AWS S3');
					log(err);
				} else {
					upload();
				}
			});
		};

		head();
	} catch (err) {
		log(err);
	}
}

module.exports = {
	save
};

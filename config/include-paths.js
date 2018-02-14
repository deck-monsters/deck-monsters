// Copyright (c) 2015-present, salesforce.com, inc. All rights reserved

const path = require('path');

module.exports = function (paths) {
	paths.src = [
		path.resolve('./announcements'),
		path.resolve('./build'),
		path.resolve('./cards'),
		path.resolve('./channel'),
		path.resolve('./characters'),
		path.resolve('./constants'),
		path.resolve('./creatures'),
		path.resolve('./exploration'),
		path.resolve('./helpers'),
		path.resolve('./items'),
		path.resolve('./monsters'),
		path.resolve('./ring'),
		path.resolve('./build'),
		path.resolve('./shared'),
		path.resolve('./game'),
		path.resolve('./index')
	];

	return paths;
};

// Copyright (c) 2015-present, salesforce.com, inc. All rights reserved

import chai, { assert, expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

export {
	assert,
	chai,
	expect,
	sinon
};

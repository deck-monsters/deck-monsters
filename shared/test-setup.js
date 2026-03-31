const chai = require('chai');
const sinon = require('sinon');
const sinonChaiModule = require('sinon-chai');
const chaiAsPromisedModule = require('chai-as-promised');
const sinonChai = sinonChaiModule.default || sinonChaiModule;
const chaiAsPromised = chaiAsPromisedModule.default || chaiAsPromisedModule;

const { assert, expect } = chai;
chai.use(sinonChai);
chai.use(chaiAsPromised);

chai.use((_chai, utils) => {
	_chai.Assertion.addProperty('defined', function () {
		this.assert(
			utils.flag(this, 'object') !== undefined,
			'expected #{this} to be defined',
			'expected #{this} to be undefined'
		);
	});
});

const patchSinonReset = (obj) => {
	if (obj && typeof obj.resetHistory === 'function' && typeof obj.reset !== 'function') {
		obj.reset = obj.resetHistory.bind(obj);
	}
};

patchSinonReset(sinon.spy());
patchSinonReset(sinon.stub());

const sandboxProto = Object.getPrototypeOf(sinon.createSandbox());
if (sandboxProto && typeof sandboxProto.resetHistory === 'function' && typeof sandboxProto.reset !== 'function') {
	sandboxProto.reset = sandboxProto.resetHistory;
}

module.exports = {
	assert,
	chai,
	expect,
	sinon
};

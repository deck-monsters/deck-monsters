const { expect, sinon } = require('../shared/test-setup');

const BaseClass = require('./baseClass');

describe('./shared/baseClass.js', () => {
	let test;
	let Test;

	before(() => {
		Test = class Test extends BaseClass {};
		Test.eventPrefix = 'test';
		Test.defaults = { d: 'd' };
	});

	beforeEach(() => {
		const d = 'e';
		test = new Test({ d });
	});

	it('must be extended', () => {
		expect(function(){
			let base = new BaseClass();
		}).to.throw('The BaseClass should not be instantiated directly!');

		expect(function(){
			let BadTest = class Test extends BaseClass {};
			let badTest = new BadTest();
		}).to.throw('An eventPrefix is required.');
	});

	it('can get instanceId on original', () => {
		expect(test.instanceId.toString()).to.equal('Symbol(instanceId)');
	});

	it('can get instanceId on clone', () => {
		const clone = test.clone();
		expect(clone.instanceId.toString()).to.equal('Symbol(instanceId)');
	});

	it('can cast to string', () => {
		expect(test.toString()).to.equal('{"name":"Test","options":{"d":"e"}}');
	})

	it('can cast to JSON', () => {
		expect(test.toJSON()).to.deep.equal({ name: 'Test', options: { d: 'e' } });
	})
});

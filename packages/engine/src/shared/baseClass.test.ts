import { expect } from 'chai';
import { EventEmitter } from 'node:events';

import { BaseClass, type BaseClassOptions } from './baseClass.js';

type TestConstructor = {
	new (options?: BaseClassOptions, semaphore?: EventEmitter): BaseClass;
	eventPrefix?: string;
	defaults?: BaseClassOptions;
};

describe('./shared/baseClass.ts', () => {
	let Test: TestConstructor;

	beforeEach(() => {
		class TestClass extends BaseClass {}
		Test = TestClass as unknown as TestConstructor;
		Test.defaults = { i: 'i' };
	});

	it('must be extended', () => {
		expect(() => {
			const base = new BaseClass();
			base.toString();
		}).to.throw('The BaseClass should not be instantiated directly!');

		expect(() => {
			const badTest = new Test();
			badTest.toString();
		}).to.throw('An eventPrefix is required.');
	});

	it('can get instanceId on original', () => {
		Test.eventPrefix = 'test';
		const test = new Test();

		expect(test.instanceId.toString()).to.equal('Symbol(instanceId)');
	});

	it('can get instanceId on clone', () => {
		Test.eventPrefix = 'test';
		const test = new Test();

		const clone = test.clone();
		expect(clone.instanceId.toString()).to.equal('Symbol(instanceId)');
	});

	it('can cast to string', () => {
		Test.eventPrefix = 'test';
		const test = new Test();

		expect(test.toString()).to.equal('{"name":"TestClass","options":{}}');
	});

	it('can cast to string with options', () => {
		Test.eventPrefix = 'test';
		const i = 'e';
		const test = new Test({ i });

		expect(test.toString()).to.equal('{"name":"TestClass","options":{"i":"e"}}');
	});

	it('can cast to JSON', () => {
		Test.eventPrefix = 'test';
		const i = 'e';
		const test = new Test({ i });

		expect(test.toJSON()).to.deep.equal({ name: 'TestClass', options: { i: 'e' } });
	});
});

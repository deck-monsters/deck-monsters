/**
 * Vendored from `roll@1.3.2` (MIT) with a fix: upstream used module-level `filler`,
 * `sumResult`, and `cleaner`, corrupting nested rolls (e.g. primary + bonus dice).
 */
(function () {
	'use strict';

	const InvalidInputError = require('./input-error.js');
	const transformationFunctions = require('./transforms');
	const transformationKeys = require('./keys');
	const regex =
		/^(\d*)d(\d+|\%)(([\+\-\/\*bw])(\d+))?(([\+\-\/\*])(\d+|(\d*)d(\d+|\%)(([\+\-\/\*bw])(\d+))?))*$/;

	function Roll(random) {
		this.random = random || Math.random.bind(Math);
	}

	Roll.prototype.validate = function (s) {
		return regex.test(s);
	};

	Roll.prototype.parse = function (s) {
		if (!this.validate(s)) {
			throw new InvalidInputError(s);
		}

		const match = regex.exec(s);
		const quantity = match[1];
		const sides = match[2];
		const hasTransformation = !!match[3];
		let operator;
		let transformationParameter;
		const transforms = [];
		let opIndex = 0;
		const segments = s.split(/[\+\-]/);
		let outsideRoll;

		if (segments[0].indexOf('b') > -1 || segments[0].indexOf('w') > -1) {
			transforms.push(transformationKeys[match[4]](parseInt(match[5], 10)));
		}

		for (let seg = 1; seg < segments.length; seg += 1) {
			opIndex += segments[seg - 1].length;
			operator = s[opIndex];
			opIndex += 1;
			transformationParameter = segments[seg];
			if (transformationParameter.indexOf('d') > -1) {
				outsideRoll = this.roll(transformationParameter, true);
				transforms.push(transformationKeys[operator](outsideRoll.result));
			} else {
				transforms.push(
					transformationKeys[operator](parseInt(transformationParameter, 10)),
				);
			}
		}

		return {
			quantity: quantity ? parseInt(quantity, 10) : 1,
			sides: sides === '%' ? 100 : parseInt(sides, 10),
			transformations:
				hasTransformation || transforms.length > 0
					? transforms.length > 0
						? transforms
						: transformationKeys[match[4]](parseInt(match[5], 10))
					: ['sum'],
			toString: function () {
				return s;
			},
		};
	};

	Roll.prototype.roll = function (input, invokedByParse) {
		const scratch = {
			cleaner: undefined,
			sumResult: false,
			filler: [],
		};

		if (!input) {
			throw new InvalidInputError();
		} else if (typeof input === 'string') {
			input = this.parse(input);
		}

		const rolled = [];
		while (rolled.length < input.quantity) {
			rolled.push(Math.floor(this.random() * input.sides + 1));
		}

		scratch.filler.push(rolled);

		const calculations = input.transformations.reduce(
			function (previous, transformation) {
				let transformationFunction;
				let transformationAdditionalParameter;
				let sumParam = false;
				if (typeof transformation === 'function') {
					transformationFunction = transformation;
				} else if (typeof transformation === 'string') {
					transformationFunction = transformationFunctions[transformation];
				} else if (transformation instanceof Array) {
					if (transformation[0] instanceof Array) {
						scratch.sumResult = true;
						scratch.cleaner = transformation[1];
						transformation = transformation[0];
					} else if (transformation[1] instanceof Array) {
						sumParam = true;
						scratch.cleaner = transformation[0];
						transformation = transformation[1];
					}
					transformationFunction = transformationFunctions[transformation[0]];
					transformationAdditionalParameter = transformation[1];
				}
				if (sumParam === true && previous[0] instanceof Array) {
					previous[0] = transformationFunctions[scratch.cleaner](previous[0]);
				}
				previous.unshift(
					transformationFunction(
						previous[0],
						transformationAdditionalParameter,
					),
				);
				return previous;
			},
			[rolled],
		);

		if (scratch.sumResult === true && calculations[0] instanceof Array) {
			calculations[1] = calculations[0];
			calculations[0] = transformationFunctions[scratch.cleaner](calculations[0]);
		}

		let carryFiller = [];
		if (!invokedByParse) {
			const f = scratch.filler;
			if (f.length > 1) {
				f.unshift(f.pop());
			}
			carryFiller = f.length === 1 ? f[0] : f;
			scratch.filler = [];
		}

		return {
			input: input,
			calculations: calculations,
			rolled: carryFiller,
			result: calculations[0],
		};
	};

	module.exports = Roll;
	module.exports.InvalidInputError = InvalidInputError;
})();

const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
	prettierConfig,
	{
		linterOptions: {
			noInlineConfig: true
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: {
				...globals.node
			}
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-console': 'off'
		}
	},
	{
		files: ['**/*.mocha.node.js'],
		languageOptions: {
			globals: {
				...globals.mocha
			}
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json'
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		}
	},
	{
		// Chai's fluent assertion API (expect(x).to.equal(y)) produces expressions
		// that ESLint's no-unused-expressions rule flags as having no effect.
		// Test stubs routinely use `any` for mock typing — disable both rules for test files.
		files: ['**/*.test.ts'],
		rules: {
			'no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		}
	},
	{
		// The engine package is a migration of legacy JavaScript.  Replacing every
		// `any` annotation and `self = this` pattern across ~170 files is a separate
		// migration task (tracked in the TypeScript modernisation roadmap).  Downgrade
		// the two pervasive rules to warnings so the lint step exits cleanly while the
		// real type-safety work proceeds incrementally.
		files: ['packages/engine/src/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-this-alias': 'warn',
		}
	},
	{
		ignores: ['node_modules/', 'coverage/', 'dist/']
	}
];

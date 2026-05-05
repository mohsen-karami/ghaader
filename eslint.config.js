import js from '@eslint/js';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import promisePlugin from 'eslint-plugin-promise';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/coverage/**',
			'**/logs/**',
			'**/tmp/**',
		]
	},
	js.configs.recommended,
	{
		files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
		languageOptions: {
			ecmaVersion: 2024,
			globals: {
				...globals.node,
			},
			sourceType: 'module',
		},
		plugins: {
			import: importPlugin,
			jsdoc: jsdocPlugin,
			promise: promisePlugin,
			sonarjs: sonarjsPlugin,
		},
		rules: {
			// General
			'no-console': ['error', { allow: ['warn', 'error'] }],
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

			// Object Formatting
			'object-curly-spacing': ['error', 'always'],

			// Variable Declaration
			'no-var': 'error',
			'prefer-const': 'error',

			// String Consistency
			'prefer-template': 'error',
			'quotes': ['error', 'single', {
				'allowTemplateLiterals': true,
				'avoidEscape': true,
			}],

			// Basic Formatting
			'comma-spacing': ['error', {
				'after': true,
				'before': false,
			}],
			'no-trailing-spaces': 'error',

			// Clean Code
			'indent': ['error', 'tab', { 'SwitchCase': 1 }],

			// Line Length
			'max-len': ['error', {
				code: 120,
				comments: 120,
				ignoreComments: false,
				ignoreRegExpLiterals: true,
				ignoreStrings: true,
				ignoreTemplateLiterals: true,
				ignoreUrls: true,
				tabWidth: 4,
			}],

			// Prevents Multiple Spaces
			'no-multi-spaces': 'error',

			// Force Semicolons
			'no-extra-semi': 'error',
			'semi': ['error', 'always'],
			'semi-spacing': ['error', { 'after': true, 'before': false }],

			// Force File Extensions in Imports
			'import/extensions': ['error', 'always', {
				'cjs': 'always',
				'js': 'always',
				'mjs': 'always',
			}],

			// Max File Length
			'max-lines': ['error', {
				max: 500,
				skipBlankLines: true,
				skipComments: true,
			}],

			// Sort Keys Alphabetically
			'sort-keys': ['error', 'asc', {
				'caseSensitive': false,
				'minKeys': 2,
				'natural': true,
			}],

			// Cyclomatic Complexity
			'complexity': ['error', 10],

			// Function Length
			'max-lines-per-function': ['error', {
				max: 30,
				skipBlankLines: true,
				skipComments: true,
			}],

			// Max Parameters
			'max-params': ['error', 3],

			// Max Nesting Depth
			'max-depth': ['error', 3],

			// No Nested Ternary
			'no-nested-ternary': 'error',

			// Variable Naming
			'camelcase': ['error', {
				ignoreDestructuring: false,
				ignoreGlobals: false,
				ignoreImports: false,
				properties: 'always',
			}],
			'id-length': ['error', {
				exceptions: ['$', 'cb', 'el', 'fn', 'fs', 'i', 'id', 'j', 'js', 'k', 'ts', 'vm'],
				max: 30,
				min: 3,
			}],
			'no-underscore-dangle': ['error', {
				allow: ['_id', '__dirname', '__filename'],
				allowAfterSuper: false,
				allowAfterThis: false,
				enforceInMethodNames: true,
			}],

			// JSDoc
			'jsdoc/require-description': 'error',
			'jsdoc/require-jsdoc': ['error', {
				'require': {
					'ArrowFunctionExpression': false,
					'ClassDeclaration': true,
					'FunctionDeclaration': true,
					'FunctionExpression': false,
					'MethodDefinition': true,
				}
			}],
			'jsdoc/require-param-description': 'error',
			'jsdoc/require-returns-description': 'error',

			// Import Order
			'import/order': ['error', {
				'alphabetize': {
					'caseInsensitive': true,
					'order': 'asc',
				},
				'groups': [
					'builtin',
					'external',
					'internal',
					['parent', 'sibling'],
					'index'
				],
				'newlines-between': 'always',
			}],

			// Capitalized Comments
			'capitalized-comments': ['error', 'always', {
				ignoreConsecutiveComments: true,
			}],
		}
	}
];

var assert = require('assert'),
	celery = require('../src/celery.js').utils;

describe('Utilities', function() {

	describe('getMessageId()', function() {
		it('should return uuidv4 string', function() {
			var token = celery.getMessageId();
			assert.equal(token.length, 36, 'Incorrect length.');
			assert.equal(token[8], '-');
			assert.equal(token[13], '-');
			assert.equal(token[18], '-');
		})
	});

	describe('formatDate()', function() {
		it('should return a date from <number> without Z timezone', function() {
			var token = celery.formatDate(1000);
			assert.equal(token.length, 23);
			assert(token.slice(-1) !== 'Z')
		});
	});

	describe('upperFirst()', function() {
		it('should uppercase the first letter of a string', function() {

		});
	});

	describe('lowerFirst()', function() {
		it('should lowercase the first letter of a string', function() {

		});
	});

	describe('toCamelCase()', function() {
		it('should convert an under_scored_string into camelCase', function() {

		});
	});

	describe('fixUnderscoreAttributes()', function() {
		it('should convert all under_scored_attributes into camelCase on obj', function() {

		});
	});
})
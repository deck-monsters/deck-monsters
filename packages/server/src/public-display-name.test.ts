import { expect } from 'chai';
import { publicDisplayName } from './public-display-name.js';

describe('publicDisplayName', () => {
	it('keeps an ordinary display name untouched', () => {
		expect(publicDisplayName('Santi Brainer')).to.equal('Santi Brainer');
	});

	it('reduces an email to its local part', () => {
		expect(publicDisplayName('dave@brainerbanker.com')).to.equal('dave');
	});

	it('drops a plus-address suffix, which is routing detail not identity', () => {
		expect(publicDisplayName('david+levy@brainerbanker.com')).to.equal('david');
	});

	it('handles subdomains and multi-dot domains', () => {
		expect(publicDisplayName('someone@mail.example.co.uk')).to.equal('someone');
	});

	it('leaves a handle that merely contains @ alone', () => {
		expect(publicDisplayName('@stary')).to.equal('@stary');
		expect(publicDisplayName('best@game')).to.equal('best@game');
	});

	it('falls back to Player for empty or missing names', () => {
		expect(publicDisplayName('')).to.equal('Player');
		expect(publicDisplayName('   ')).to.equal('Player');
		expect(publicDisplayName(null)).to.equal('Player');
		expect(publicDisplayName(undefined)).to.equal('Player');
	});

	it('falls back to Player when the local part is empty', () => {
		expect(publicDisplayName('+tag@example.com')).to.equal('Player');
	});

	it('trims surrounding whitespace', () => {
		expect(publicDisplayName('  Ada  ')).to.equal('Ada');
	});
});

const assert = require('assert');
const icore = require('..');

describe('Interface module', () => {
  it('The module must return a Object', () => {
    assert(Object.getPrototypeOf(icore) === Object.prototype);
  });

  it('Collection contents', () => {
    assert.deepStrictEqual(Object.keys(icore), [
      'Application',
      'Inquiry',
      'Route',
      'View'
    ]);
  });

  it('Everyone must be a function type i.e class', () => {
    const all = Object.keys(icore).every(i => {
      return typeof icore[i] === 'function';
    });

    assert(all);
  });
});

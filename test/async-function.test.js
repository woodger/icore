const assert = require('assert');
const AsyncFunction = require('../src/async-function');

describe('class AsyncFunction', () => {
  it('The module must return a constructor', () => {
    assert(
      Object.getPrototypeOf(async () => {}).constructor === AsyncFunction
    );
  });

  it('The returned object must be frozen', () => {
    assert(Object.isFrozen(AsyncFunction));
  });
});

const assert = require('assert');
const {View} = require('../src');



describe(`class View`, () => {
  describe(`constructor: new View()`, () => {
    it(`Throw an exception if the arguments are not of type`, () => {
      assert.throws(() => {
        new View();
      });
    });
  });
});

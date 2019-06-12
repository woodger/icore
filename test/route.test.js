const assert = require('assert');
const mock = require('mock-http');
const Route = require('../src/route');

describe('class Route', () => {
  describe('constructor: new Route()', () => {
    it(`Only a 'handler' option is required to create a route.`, () => {
      const root = new Route({
        async handler() {}
      });

      assert(root instanceof Route);
    });

    it(`The 'path' option can be a RegExp object`, () => {
      const abc = new Route({
        path: /abc/,
        async handler() {}
      });

      assert(abc.pattern instanceof RegExp);
    });

    it('Throw an exception if the arguments are not of object type', () => {
      try {
        const root = new Route();
      }
      catch (e) {
        assert(
          e.message ===
          "Cannot destructure property `path` of 'undefined' or 'null'."
        );
      }
    });

    it(`The 'handler' is a required parameter options`, () => {
      try {
        const root = new Route({});
      }
      catch (e) {
        assert(
          e.message === "Invalid value 'handler' in order 'constructor: " +
          "new Route()'. Expected AsyncFunction"
        );
      }
    });

    it(`Throw an exception if the 'path' option not type string ` +
    `or not a RegExp object`, () => {
      try {
        const root = new Route({
          path: null,
          async handler() {}
        });
      }
      catch (e) {
        assert(
          e.message ===
          `Invalid option 'path'. Expected 'string' or RegExp object`
        );
      }
    });

    it(`Throw an exception if the 'methods' option is not a string type`, () => {
      try {
        const root = new Route({
          method: null,
          async handler() {}
        });
      }
      catch (e) {
        assert(e.message === `Invalid value 'method' in order ` +
        `'constructor: new Route()'. Expected String`
        );
      }
    });

    it(`Throw an exception if the 'finish' option is not a boolean`, () => {
      try {
        const root = new Route({
          finish: null,
          async handler() {}
        });
      }
      catch (e) {
        assert(e.message === `Invalid value 'finish' in order ` +
        `'constructor: new Route()'. Expected Boolean`
        );
      }
    });

    it(`Throw an exception if the reserved character in RFC 3986 2.2 ` +
    `is used to specify the 'path'`, () => {
      try {
        const root = new Route({
          path: 'root#hash',
          async handler() {}
        });
      }
      catch (e) {
        assert(e.message === 'Invalid character in path naming');
      }
    });

    it(`Throw an exception if the symbol '^' is used at the beginning ` +
    `of the regular expression to specify the 'path'`, () => {
      try {
        const abc = new Route({
          path: /^abc/,
          async handler() {}
        });
      }
      catch (e) {
        assert(e.message === `The use of the anchor '^' at the beginning ` +
        `of the path is not allowed`);
      }
    });

    it(`Throw an exception if the symbol '$' is used at the ending ` +
    `of the regular expression to specify the 'path'`, () => {
      try {
        const abc = new Route({
          path: /abc$/,
          async handler() {}
        });
      }
      catch (e) {
        assert(e.message === `The use of the anchor '$' at the ending ` +
        `of the path is not allowed`);
      }
    });

    it(`The default 'path' field have empty string`, () => {
      const root = new Route({
        async handler() {}
      });

      assert(root.path === '');
    });

    it(`The default 'method' field have value 'get'`, () => {
      const root = new Route({
        async handler() {}
      });

      assert(root.method === 'get');
    });

    it(`The default 'finish' field is have false`, () => {
      const root = new Route({
        async handler() {}
      });

      assert(root.finish === false);
    });
  });

  describe('#route()', () => {
    it('The router must put the route', () => {
      const root = new Route({
        async handler() {}
      });

      root.route({
        path: 'example',
        async handler() {}
      });

      assert(root.childs.length === 1);
    });

    it(`Throw an exception if the first arguments is non object`, () => {
      try {
        const root = new Route({
          async handler() {}
        });

        root.route(null);
      }
      catch (e) {
        assert(
          e.message ===
          "Cannot destructure property `path` of 'undefined' or 'null'."
        );
      }
    });
  });

  describe('#find()', () => {
    const root = new Route({
      async handler() {}
    });

    const foo = root.route({
      path: /foo\d/,
      async handler() {}
    });

    const bar = foo.route({
      path: 'bar',
      async handler() {}
    });

    it(`For the 'uri' must find and return the node`, () => {
      assert(
        root.find(['']) === root &&
        root.find(['', 'foo5']) === foo &&
        root.find(['', 'foo7', 'bar']) === bar
      );
    });

    it('A router is a tree of ways', () => {
      const laf = new Route({
        path: 'laf',
        async handler() {}
      });

      foo.childs.push(laf);

      assert(root.find(['', 'foo3', 'laf']) === laf);
    });

    it(`Must return 'null' if route is not found`, () => {
      assert(root.find(['', 'bar']) === null);
    });
  });
});

const EventEmitter = require('events');
const TypeEnforcement = require('type-enforcement');
const AsyncFunction = require('./async-function');

const te = new TypeEnforcement({
  'constructor: new Route()': {
    method: String,
    handler: AsyncFunction,
    finish: Boolean
  }
});

/**
 * RFC 3986 2.2. Reserved Characters
 * ":" "/" "?" "#" "[" "]" "@"
 *
 */

const re = {
  rfc398622: /[^\x21\x22\x24-\x2E\x30-\x39\x3B-\x3E\x41-\x5A\x5C\x5E-\x7E]/
};

class Route extends EventEmitter {
  constructor({path = '', method = 'get', handler, finish = false}) {
    super();

    const err = te.validate('constructor: new Route()', {
      method,
      handler,
      finish
    });

    if (err) {
      throw err;
    }

    if (typeof path === 'string') {
      if (re.rfc398622.test(path)) {
        throw new Error('Invalid character in path naming');
      }

      this.path = path;
    }
    else if (path instanceof RegExp) {
      const re = path.toString().slice(1, -1);

      if (re[0] === '^') {
        throw new Error(
          `The use of the anchor '^' at the beginning ` +
          `of the path is not allowed`
        );
      }

      if (re[re.length - 1] === '$') {
        throw new Error(
          `The use of the anchor '$' at the ending ` +
          `of the path is not allowed`
        );
      }

      this.pattern = new RegExp(`^${re}$`);
    }
    else {
      throw new Error(
        `Invalid option 'path'. Expected 'string' or RegExp object`
      );
    }

    this.method = method.toLowerCase();
    this.handler = handler;
    this.finish = finish;
    this.childs = [];
  }

  route(options) {
    const route = new Route(options);
    this.childs.push(route);

    return route;
  }

  find(paths, index = 0) {
    const path = paths[index];
    const found = this.pattern === undefined ?
      this.path === path : this.pattern.test(path);

    if (found === false) {
      return null;
    }

    index++;

    if (paths.length === index || this.finish === true) {
      return this;
    }

    for (let i of this.childs) {
      const route = i.find(paths, index);

      if (route !== null) {
        return route;
      }
    }

    return null;
  }
}

module.exports = Route;

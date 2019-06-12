const assert = require('assert');
const proxyquire = require('proxyquire');
const {BufferWritableMock} = require('stream-mock');
const {Request, Response} = require('mock-http');

describe('class Inquiry', () => {
  const parsed = {
    url: {
      protocol: 'https:',
      slashes: true,
      auth: null,
      host: 'example.com:443',
      port: '443',
      hostname: 'example.com',
      hash: null,
      search: '?query=search',
      query: 'query=search',
      pathname: '/path',
      path: '/path?query=search',
      href: 'https://example.com:443/path?query=search'
    },
    queries: {
      query: 'search'
    }
  };

  const CookieHttpOnly = proxyquire('../node_modules/cookie-httponly', {
    http: {
      IncomingMessage: Request,
      ServerResponse: Response
    }
  });

  const Inquiry = proxyquire('../src/inquiry', {
    querystring: {
      parse() {
        return parsed.queries;
      }
    },
    url: {
      parse() {
        return parsed.url;
      }
    },
    'cookie-httponly': CookieHttpOnly
  });

  const req = new Request({
    url: '/',
    method: 'GET',
    headers: {
      host: 'example.com:443/path?query=search',
      cookie: 'git=041ab08b'
    }
  });

  const res = new Response();

  describe('constructor: new Inquiry()', () => {
    it('Throw an exception if the arguments are not of type', () => {
      try {
        const inq = new Inquiry();
      }
      catch (e) {
        assert(e.message === `Cannot read property 'on' of undefined`);
      }
    });

    it(`The property 'cookie' is an instance 'Map' object`, () => {
      const {entries} = new CookieHttpOnly(req, res);
      const inq = new Inquiry(req, entries);

      assert(
        inq.cookie instanceof Map &&
        inq.cookie === entries
      );
    });

    it(`The property 'url' is an instance of the class 'url.Url'`, () => {
      const inq = new Inquiry(req);
      assert.deepStrictEqual(inq.url, parsed.url);
    });

    it(`The property 'queries' is an Object`, () => {
      const inq = new Inquiry(req);
      assert.strictEqual(inq.queries, parsed.queries);
    });

    it(
      `Required property 'method' - must contain the name of` +
      `the 'REST' method in lowercase`,
      () => {
      const inq = new Inquiry(req);
      assert(inq.method === 'get');
    });

    it(`The property 'type' is the number type`, () => {
      const inq = new Inquiry(req);
      assert.strictEqual(typeof inq.type, 'number');
    });
  });

  describe('#pipe()', () => {
    it('Throw an exception if the argument is not a stream.Writable object', () => {
      const inq = new Inquiry(req);

      try {
        inq.pipe();
      }
      catch (e) {
        assert(e.message === 'Expected stream.Writable object');
      }
    });

    it('The method should return a stream.Writable object', () => {
      const writer = new BufferWritableMock();
      const inq = new Inquiry(req);
      const buf = inq.pipe(writer);

      assert(buf === writer);
    });
  });

  describe('#read()', () => {
    it('The method should return a string type', async () => {
      const inq = new Inquiry(req);
      const msg = await inq.read();

      assert(msg === '');
    });
  });
});

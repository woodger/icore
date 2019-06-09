const assert = require('assert');
const freeport = require('get-port');
const request = require('superagent');
const proxyquire = require('proxyquire');
const {ObjectReadableMock} = require('stream-mock');
const {Application, Route} = require('..');

describe('class Application', () => {
  describe('constructor: new Application()', () => {
    it(
    'Throw an exception if the first argument is not a instance Object',
    () => {
      try {
        const app = new Application();
      }
      catch (e) {
        assert(
         e.message ===
          "Cannot destructure property `port` of 'undefined' or 'null'."
        );
      }
    });

    const options = {
      host: String,
      timeout: Number,
      maxHeadersCount: Number
    };

    for (let i of Object.keys(options)) {
      const {name} = options[i];

      it(`Throw an exception if '${i}' value is not a ${name}`, () => {
        try {
          const app = new Application({
            port: 8080,
            [i]: null
          });
        }
        catch (e) {
          assert(
            e.message ===
            `Invalid value '${i}' in order '#constructor()'. Expected ${name}`
          );
        }
      });
    }

    it('Throw an exception if TCP port in not integer', () => {
      try {
        const app = new Application({
          port: 80.08
        });
      }
      catch (e) {
        assert(e.message === 'TCP port value must be an integer');
      }
    });

    it('Throw an exception if the TCP port uses an invalid range', () => {
      try {
        const app = new Application({
          port: 65536
        });
      }
      catch (e) {
        assert(e.message === 'TCP port must be in use allowed range');
      }
    });
  });

  describe('#listenHttp()', () => {
    it(
    'Throw an exception if the first argument is not a instance Route',
    async () => {
      try {
        const app = new Application({
          port: 8080
        });

        await app.listenHttp();
      }
      catch (e) {
        assert(
         e.message ===
          `Invalid value 'router' in order '#listenHttp()'. Expected Route`
        );
      }
    });
  });

  describe('Routing incoming TCP connections', () => {
    let port, app;

    const router = new Route({
      async handler(inq) {
        switch (inq.queries.status) {
          case 'null':
            return { status: null };
          case 'string':
            return { status: '200' };
          case 'float':
            return { status: 201.1 };
          case '201':
            return { status: 201 };
          case '<100':
            return { status: 99 };
          case '>599':
            return { status: 600 };
        }

        if (inq.queries.exception === 'on') {
          throw new Error('Exception');
        }
      }
    });

    router.on('error', () => {});

    before(async () => {
      port = await freeport();

      app = new Application({ port });
      await app.listenHttp(router);
    });

    after(async () => {
      await app.close();
    });

    it(
    'The server must return status code  404 if the path is not routed',
    async () => {
      try {
        await request.get(`http://localhost:${port}/example`);
      }
      catch (e) {
        assert(e.status === 404);
      }
    });

    it(
    'The server must return status code 405 if the method not support',
    async () => {
      try {
        await request.post(`http://localhost:${port}`);
      }
      catch (e) {
        assert(e.status === 405);
      }
    });

    it(
    'The server must return status code 500 if handler throw an exception',
    async () => {
      try {
        const res = await request.get(`http://localhost:${port}?exception=on`);
      }
      catch (e) {
        assert(e.status === 500);
      }
    });
  });

  describe('Handling incoming TCP connections', () => {
    let port, app;

    const router = new Route({
      async handler(inq) {
        switch (inq.queries.body) {
          case 'string':
            return { body: 'Hello!' };
          case 'stream':
            return { body: new ObjectReadableMock('') };
          case 'null':
            return { body: null };
          case 'number':
            return { body: 1 };
          case 'object':
            return { body: {} };
        }

        switch (inq.queries.cookie) {
          case 'array':
            return {
              cookie: [{
                name: 'operator',
                value: '+new'
              }]
            };
          case 'null':
            return { cookie: null };
          case 'number':
            return { cookie: 0 };
          case 'string':
            return {
              cookie: 'name=new; expires=Fri, 31 Dec 2010 23:59:59 GMT; ' +
              'path=/; domain=.example.org'
            };
          case 'object':
            return { cookie: {} };
        }

        switch (inq.queries.return) {
          case 'undefined':
            return undefined;
          case 'null':
            return null;
          case 'number':
            return 200;
          case 'string':
            return '';
          case 'boolean':
            return true;
          default:
            return {};
        }
      }
    });

    router.on('error', () => {});

    before(async () => {
      port = await freeport();

      app = new Application({ port });
      await app.listenHttp(router);
    });

    after(async () => {
      await app.close();
    });

    for (let i of ['undefined', 'null', 'number', 'string', 'boolean']) {
      it(
      `The server must return status code 500 if the handler value is ${i}`,
      async () => {
        try {
          await request.get(`http://localhost:${port}?return=${i}`);
        }
        catch (e) {
          assert(e.status === 500);
        }
      });
    }

    it(
    'The server must return status code 200 by default if user return object',
    async () => {
      const res = await request.get(`http://localhost:${port}`);
      assert(res.status === 200);
    });

    describe('#handler => { status: number }', () => {
      it(
      'The server should return a 201 status code if user status is set to 201',
      async () => {
        try {
          await request.get(`http://localhost:${port}?status=201`);
        }
        catch (e) {
          assert(e.status === 201);
        }
      });

      for (let i of ['null', 'string', 'float', '<100', '>599']) {
        it(
        `The server must return status code 500 if the handler field status code is ${i}`,
        async () => {
          try {
            await request.get(`http://localhost:${port}?status=${i}`);
          }
          catch (e) {
            assert(e.status === 500);
          }
        });
      }
    });

    describe('#handler => { cookie: array }', () => {
      it(
      'The server should return cookie httponly in the headers ' +
      'if the user’s cookie is passed in an array',
      async () => {
        const res = await request.get(`http://localhost:${port}?cookie=array`);
        const cookie = res.headers['set-cookie'];

        assert(cookie[0] === 'operator=%2Bnew; HttpOnly');
      });

      for (let i of ['null', 'number', 'string', 'object']) {
        it(
        `The server must return status code 500 if the handler field cookie is ${i}`,
        async () => {
          try {
            await request.get(`http://localhost:${port}?cookie=${i}`);
          }
          catch (e) {
            assert(e.status === 500);
          }
        });
      }
    });

    describe('#handler => { body: string | stream.Readable }', () => {
      it(
      `The server should return 'text-content' if the user’s set a string in body`,
      async () => {
        const res = await request.get(`http://localhost:${port}?body=string`);

        assert(res.text === 'Hello!');
      });

      it(
      `The server should return 'application/octet-stream' ` +
      `if the user’s set a stream of unknown type in body`,
      async () => {
        const res = await request.get(`http://localhost:${port}?body=stream`);

        assert(res.type === 'application/octet-stream');
      });

      for (let i of ['null', 'number', 'object']) {
        it(
        `The server must return status code 500 if the handler field body is ${i}`,
        async () => {
          try {
            await request.get(`http://localhost:${port}?body=${i}`);
          }
          catch (e) {
            assert(e.status === 500);
          }
        });
      }
    });
  });
});

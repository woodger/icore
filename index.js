/**
 * Icore is a framework a high-level to build fast web application
 *
 * This module for Node.js® implemented by following the ECMAScript® 2018
 * Language Specification Standard
 *
 * https://www.ecma-international.org/ecma-262/9.0/index.html
 */

const http = require('http');
const stream = require('stream');
const mime = require('mime-types');
const CookieHttpOnly = require('cookie-httponly');
const TypeEnforcement = require('type-enforcement');
const AsyncFunction = require('./src/async-function');
const Inquiry = require('./src/inquiry');
const Route = require('./src/route');
const View = require('./src/view');

const te = new TypeEnforcement({
  '#listenHttp()': {
    router: Route,
    logger: Function,
    host: String,
    port: Number,
    timeout: Number,
    maxHeadersCount: Number
  },
  '#handler()': {
    status: Number,
    cookie: Array,
    headers: Object
  }
});

module.exports = {
  Inquiry,
  Route,
  View,

  listenHttp({
    router, logger = ()=>{}, host = 'localhost', port, timeout = 12e4, maxHeadersCount = 2e3
  }) {
    const err = te.validate('#listenHttp()', {
      router,
      logger,
      host,
      port,
      timeout,
      maxHeadersCount
    });

    if (err) {
      throw err;
    }

    if (Number.isInteger(port) === false) {
      throw new Error('TCP port value must be an integer');
    }

    const incomingHandler = async (inq, coookieHttpOnly) => {
      const paths = inq.url.pathname === '/' ?
        [''] : inq.url.pathname.split('/');

      const route = router.find(paths);

      if (route === null) {
        return {
          status: 404
        };
      }

      if (route.method !== inq.method && inq.method !== 'head') {
        return {
          status: 405
        };
      }

      const {
        status = 200,
        cookie = [],
        headers = {},
        body = ''
      } = await route.handler(inq);

      const err = te.validate('#handler()', {
        status,
        cookie,
        headers
      });

      if (err) {
        throw err;
      }

      if (Number.isInteger(status) === false || status < 100 || status > 599) {
        throw new Error('Invalid HTTP status code');
      }

      const isStream = body instanceof stream.Readable;

      if (isStream === false && typeof body !== 'string') {
        throw new Error(
          `Invalid value 'body'. Expected 'string' or stream.Readable object`
        );
      }

      if (isStream === true) {
        headers['Content-Type'] = mime.lookup(body.path) || 'application/octet-stream';
      }

      if (cookie.length > 0) {
        for (let {name, value, domain, path, expires} of cookie) {
          coookieHttpOnly.set(name, value, {
            domain,
            path,
            expires
          });
        }
      }

      for (let i in headers) {
        if (headers.hasOwnProperty(i)) {
          headers[i] = Buffer.from(headers[i]).toString('binary');
        }
      }

      return {
        status,
        headers,
        body
      };
    };

    return new Promise((resolve, reject) => {
      const srv = http.createServer();

      srv.on('request', (req, res) => {
        const coookie = new CookieHttpOnly(req, res);
        const inq = new Inquiry(req, coookie.entries);


        incomingHandler(inq, coookie).catch((err) => {
          logger(err);

          return {
            status: 500
          };
        })
        .then(({status, headers = {}, body = ''}) => {
          const bodyless = inq.method === 'head';

          if (body instanceof stream.Readable) {
            res.writeHead(status, headers);

            if (bodyless === true) {
              if (body.finished === false) {
                body.destroy();
              }

              res.end();
            }
            else {
              body.pipe(res);
            }
          }
          else {
            res.writeHead(status, headers);

            if (bodyless === false) {
              res.write(body);
            }

            res.end();
          }
        });
      });

      srv.on('listening', () => {
        resolve(srv);
      });

      srv.on('error', (err) => {
        reject(err);
      });

      srv.maxHeadersCount = maxHeadersCount;
      srv.timeout = timeout;

      srv.listen({
        host,
        port
      });
    });
  }
};

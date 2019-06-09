const http = require('http');
const stream = require('stream');
const mime = require('mime-types');
const CookieHttpOnly = require('cookie-httponly');
const TypeEnforcement = require('type-enforcement');
const AsyncFunction = require('./async-function');
const Inquiry = require('./inquiry');
const Route = require('./route');
const View = require('./view');

const te = new TypeEnforcement({
  '#constructor()': {
    port: Number,
    host: String,
    timeout: Number,
    maxHeadersCount: Number
  },
  '#listenHttp()': {
    router: Route
  },
  '#handler()': {
    status: Number,
    cookie: Array,
    headers: Object
  }
});

class Application {
  constructor({
    port, host = 'localhost', timeout = 12e4, maxHeadersCount = 2e3
  }) {
    const err = te.validate('#constructor()', {
      port,
      host,
      timeout,
      maxHeadersCount
    });

    if (err) {
      throw err;
    }

    if (Number.isInteger(port) === false) {
      throw new Error('TCP port value must be an integer');
    }

    if (port < 1 || port > 65535) {
      throw new Error('TCP port must be in use allowed range');
    }

    this.port = port;
    this.host = host;
    this.timeout = timeout;
    this.maxHeadersCount = maxHeadersCount;
    this.server = null;
    this.context = {};
  }

  listenHttp(router) {
    const err = te.validate('#listenHttp()', {
      router
    });

    if (err) {
      throw err;
    }

    const incomingHandler = async (inq, coookieHttpOnly) => {
      Object.assign(inq.context, this.context);

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
      this.server = http.createServer();

      this.server.on('request', (req, res) => {
        const coookie = new CookieHttpOnly(req, res);
        const inq = new Inquiry(req, coookie.entries);

        incomingHandler(inq, coookie).catch((err) => {
          router.emit('error', err);

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

      this.server.once('listening', () => {
        console.log(`Server started on http://${this.host}:${this.port}`);
        resolve();
      });

      this.server.once('error', (err) => {
        reject(err);
      });

      this.server.maxHeadersCount = this.maxHeadersCount;
      this.server.timeout = this.timeout;

      this.server.listen({
        host: this.host,
        port: this.port
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        }

        console.log(`Server stoped on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }
}

module.exports = Application;

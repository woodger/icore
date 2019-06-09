const url = require('url');
const stream = require('stream');
const querystring = require('querystring');
const EventEmitter = require('events');
const TypeEnforcement = require('type-enforcement');

const te = new TypeEnforcement({
  '#pipe()': {
    maxSize: Number
  },
  '#read()': {
    maxSize: Number
  }
});

const symbolIncoming = Symbol('incoming');

class Inquiry extends EventEmitter {
  constructor(req, cookie) {
    super();

    this[symbolIncoming] = req;

    req.on('aborted', (err) => {
      this.emit('aborted', err);
    });

    this.cookie = cookie;
    this.type = 0;

    let [domain, port = 80] = req.headers.host.split(':');
    port = Number(port);

    const protocol = port === 443 ?
      'https:' : 'http:';

    this.url = url.parse(`${protocol}//${domain}:${port}${req.url}`);
    this.paths = [];

    if (this.url.pathname !== '/') {
      let paths = this.url.pathname.substr(1).split('/');

      for (let i of paths) {
        this.paths.push(decodeURI(i));
      }
    }

    this.queries = querystring.parse(this.url.query);
    this.method = req.method.toLowerCase();
    this.headers = req.headers;
    this.context = {};
  }

  pipe(dest, {maxSize = Infinity} = {}) {
    const err = te.validate('#pipe()', {
      maxSize
    });

    if (err) {
      throw err;
    }

    if (dest instanceof stream.Writable === false) {
      throw new Error('Expected stream.Writable object');
    }

    const pipe = () => {
      this[symbolIncoming].on('data', (chunk) => {
        if (dest.bytesWritten + chunk.byteLength > maxSize) {
          const err = new Error('Exceeding maximum body size');

          /**
           * this[symbolIncoming].on('aborted') -> this[symbolIncoming].on('close')
           *
           */

          dest.destroy(err);
        }
        else if (dest.write(chunk) === false) {
          this[symbolIncoming].pause();

          dest.once('drain', () => {
            this[symbolIncoming].resume();
          });
        }
      });
    };

    dest.on('ready', pipe);

    dest.on('error', (err) => {
      this[symbolIncoming].destroy();
    });

    this[symbolIncoming].on('end', () => {
      dest.end(); // -> dest.on('close')
    });

    this[symbolIncoming].on('aborted', () => {
      dest.end();
    });

    return dest;
  }

  async read({maxSize = Infinity} = {}) {
    const err = te.validate('#read()', {
      maxSize
    });

    if (err) {
      throw err;
    }

    return new Promise((resolve, reject) => {
      let data = '';

      this[symbolIncoming].on('data', (chunk) => {
        if (data.length + chunk.length > maxSize) {
          const err = new Error(`Exceeding maximum body size`);

          this[symbolIncoming].destroy(err);
        }
        else {
          data += chunk;
        }
      });

      this[symbolIncoming].on('end', () => {
        resolve(data);
      });

      this[symbolIncoming].on('aborted', () => {
        const err = new Error(`Socket aborted`);
        reject(err);
      });

      this[symbolIncoming].on('error', reject);
    });
  }
}

module.exports = Inquiry;

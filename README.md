# Iсore

[![License](https://img.shields.io/npm/l/express.svg)](https://github.com/woodger/icore/blob/master/LICENSE)
[![Build Status](https://travis-ci.com/woodger/icore.svg?branch=master)](https://travis-ci.com/woodger/icore)
[![Coverage Status](https://coveralls.io/repos/github/woodger/icore/badge.svg?branch=master)](https://coveralls.io/github/woodger/icore?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/woodger/icore/badge.svg?targetFile=package.json)](https://snyk.io/test/github/woodger/icore?targetFile=package.json)

`Icore` is a framework a high-level to build strict web application. Allows the developer to focus on the final handler.

## Features

This module for [Node.js®](https://nodejs.org) implemented by following the [ECMAScript® 2018 Language Specification Standard](https://www.ecma-international.org/ecma-262/9.0/index.html)

* strict interface
* not immutable context
* routing implements a binary tree
* all asynchronous functions on promises
* error handling

## Install

To use `iсore` in your project, run:

```bash
npm i icore
```

## Table of Contents

[class Application](#class-application)

* [constructor: new Application(options)](#constructor-new-Applicationoptions)
* [app.listenHttp(router)](#applistenhttprouter)
* [app.close()](#appclose)
* [app.server](#appserver)
* [app.context](#appcontext)

[class Route](#class-route)

* [Event: 'error'](#event-error)
* [constructor: new Route(options)](#constructor-new-routeoptions)
* [route.route(options)](#routerouteoptions)
* [route.find(paths[, index])](#routefindpaths-index)
* [route.method](#routemethod)
* [route.handler](#routehandler)
* [route.finish](#routefinish)
* [route.childs](#routechilds)

[class Inquiry](#class-inquiry)

* [constructor: new Inquiry(req, cookie)](#constructor-new-inquiryreq-cookie)
* [inq.read(options)](#inqreadoptions)
* [inq.pipe(stream[, options])](#inqpipestream-options)
* [inq.queries](#inqqueries)
* [inq.method](#inqmethod)
* [inq.headers](#inqheaders)
* [inq.context](#inqcontext)

### class Application

#### constructor: new Application(options)

* `options` <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>

  * `host` <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> To start the development server using a different default `hostname` or `IP address`. This will start a TCP server listening for connections on the provided host. **Default:** `'localhost'`.

  * `port` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> TCP port of remote server. Is required parameter.

  * `timeout` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> The number of milliseconds of inactivity before a socket is presumed to have timed out. A value of `0` will disable the timeout behavior on incoming connections. **Default:** `12e4` (2 minutes).

  * `maxHeadersCount` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> Limits maximum incoming headers count. If set to `0`, no limit will be applied. **Default:** `2e3`.

For example:

```js
const icore = require('icore');

const app = new icore.Application({
  port: 3000
});
```

#### app.listenHttp(router)

* `router` <[Router](#class-route)> Is instance class Route this module.
* returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Following successful listen, the Promise is resolved with an value with a `undefined`.

Starts the HTTP server listening for connections. These arguments are documented on [nodejs.org](https://nodejs.org/api/http.html#http_server_listen).

**index.js**

```js
const icore = require('icore');
const router = require('./router');

const app = new icore.Application({
  port: 3000
});

app.listenHttp(router);
```

Start script in terminal:

```console
$ node index.js
Server started on http://localhost:3000
```

#### app.close()

* returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Following successful listen, the Promise is resolved with an value with a `undefined`.

Stops the server from accepting new connections.

#### app.server

In this variable, an instance of the server will be assigned after a successful listen installation.

#### app.context

This empty <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>. You may add additional properties to [inq.context](#inqcontext) by editing `app.context`.

```js
app.context.db = db();
```

#### class Route

The router is made up of instances class `Route`.

![router](http://yuml.me/woodger/diagram/scruffy;dir:LR/class/['']%2F-get[%2Flogs_\d%2F{bg:violet}],[''{bg:yellowgreen}]%2F-get['catalog'{bg:yellowgreen}],['catalog']%2F-post['books'{bg:yellowgreen}].svg)

Routing will be done:

| Method | URL                              |
|--------|----------------------------------|
| GET    | http://example.com               |
| GET    | http://example.com/catalog       |
| GET    | http://example.com/logs_0        |
| GET    | http://example.com/logs_1        |
| POST   | http://example.com/catalog/books |

Extends the Node.js [events](https://nodejs.org/api/events.html) module.

##### Event: 'error'

The `'error'` event is emitted if throw an exception. The listener callback is passed a single `Error` argument when called.
The server is not closed when the `'error'` event is emitted.

##### constructor: new Route(options)

When defining a route in `icore` you need one basic element - the `handler`.

* `options` <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>
  * `handler` <[AsyncFunction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)> takes an instance of a [class Inquiry](#class-inquiry) as context. The handler option must return a object, a promise, or throw an error.
  * `path` <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> The path option must be a string, though it can contain regular expression. **Default:** `''`.
  * `method` <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> The property of the method can be any valid HTTP method in lower case letters. **Default:** `'get'`.
  * `finish` <[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)> If set to `true`, the find returns the current route. **Default:** `false`.

Simple example use Route class:

```js
const homepage = new Route({
  async handler(inq) {
    return {
      status: 200,
      header: {
        'Content-Type': 'text/html; charset=utf-8'
      },
      body: 'Hello World!'
    };
  }
});
```

#### route.route(options)

Uses the same interface as the class constructor.

```js
const catalog = homepage.route({
  method: 'catalog',
  async handler(inq) {
    return {};
  }
});
```

#### route.find(paths[, index])

This method is intended for [class Application](#class-application) use.

* `paths` <[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)> The result of the transform of the URL.
* `index` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> Is cursor for next call find. **Default:** `0`.
* returns: <this> Returns `null` if the route is not found.

#### route.method

* <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> The property of the method can be any valid HTTP method in lower case letters. **Default:** `'get'`.

#### route.handler

* <[AsyncFunction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)> takes an instance of a [class Inquiry](#class-inquiry) as context. The handler option must return a object, a promise, or throw an error.

#### route.finish

* <[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)> If set to `true`, the find returns the current route. **Default:** `false`.

#### route.childs

* <[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)> Nested route list.

#### class Inquiry

A  [class Application](#class-application) context encapsulates node's request and response objects into a single object which provides many helpful methods for writing web applications and APIs.

#### constructor: new Inquiry(req, cookie)

The constructor will be auto called whenever a new `request` is established.

* `req` <[http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)> Node's request object.
* `cookie` <[coookie.entries](https://www.npmjs.com/package/cookie-httponly#cookieentries)> The values of the incoming cookie.

#### inq.read(options)

* `options` <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>
  * `maxSize` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> Limits the amount of memory all fields together (except files) can allocate in bytes. If this value is exceeded, an 'error' event is emitted. **Default:** `Infinity`.
* returns: <[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)> Following successful listen, the Promise is resolved with an value with a `string` type.

To start reading the body of the incoming message.

```js
async handler(inq) {
  const data = await inq.read();
}
```

#### inq.pipe(stream[, options])

  * `stream` <[stream.Writable](https://nodejs.org/api/stream.html#stream_class_stream_writable)>
  * `options` <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>
    * `maxSize` <[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)> Limits the amount of memory all fields together (except files) can allocate in bytes. If this value is exceeded, an 'error' event is emitted. **Default:** `Infinity`.

To start reading the body of an incoming message as a stream

```js
async handler(inq) {
  inq.pipe(writeStream);
}
```

#### inq.queries

* <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Get raw query string void of `?`.

#### inq.method

* <[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)> The property of the method can be any valid HTTP method in lower case letters. **Default:** `'get'`.

#### inq.headers

* <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Response header object.

#### inq.context

* <[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)> Inherit [app.context](#appcontext)

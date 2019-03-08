ICore
=======

Проект находится в разработке. Использовать не рекомендуется!

Under development. Do not use!

ICore is a simple node.js framework for make an HTTP / Socket server.
Idea is one base class for MVC at the component level.
Implemented in the environment of the language specification ECMAScript 6 (ES6).

## Install

Requires node v7.6.0 or higher for ES2015 and async-function support.

```
$ npm i icore
```

## Features

* Linking of async operations in a stack of promises, for building MVC logic on components.
* Catch errors right in the controller.
* Use ES6 strings template as a template. Write the usual CSS and HTML.
* Simple REST routing using regular expressions.
* It is not necessary to use the database as a database Mongo.

## API

The base class ICore includes four groups of objects:
* **http**: This object for creates TCP server or send request.
* **tmpl**: Simple implementation of template strings as a template engine. Contains one method.
* **fs**: Implements interaction with the file system.
* **db**: Gear of interaction with the database Mongo.

## Example

```javascript
const ICore = require('icore');
global.icore = new ICore();

const routes = require('./routes');

icore.http.server({ host: 'localhost', port: 3000 }, inq => {
  inq.router()
    .route({
        method: 'GET',
        path: '/'
      },
      routes.index
    })

    .route({
        method: ['GET', 'POST'],
        path: '/article.*'
      },
      routes.article
    })

    .not(() => {
      inq.echo({ status: 400, body: 'Sorry, page not found!' });
    });
});
```

## [RU] На русском
ICore - это простой node.js фреймворк для организации HTTP/Socket сервера.
Философия - один базовый класс для MVC на уровне компонентов.
Реализован в среде языковой спецификации ECMAScript 6 (ES6).

## Установка

Требуется node v7.6.0 и выше.

```
$ npm i icore
```

## Фичи

* Cвязывание асинхронных операций в стек обещаний, для построения логики на компонентах.
* Отлов ошибок прямо в контроллере.
* Использование ES6 строк-шаблонов в качестве шаблонизатора. Пишем обычный CSS и HTML.
* Простая REST маршрутизация с применением регулярных выражений.
* Нет необходимости использовать базу данных Mongo.

## API

Основной класс ICore реализует четыре группы свойств-объектов:
* **http**: Объект для создания TCP-сервера или отправки запросов.
* **tmpl**: Простая реализация шаблонизатора на основе ES6 строк-шаблонов. Содержит всего один метод.
* **fs**: Организация взаимодествия с файловой системой.
* **db**: Механизм взаимодествия с MongoDB.
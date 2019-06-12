/**
 * Icore is a framework a high-level to build strict web application
 *
 * This module for Node.js® implemented by following the ECMAScript® 2018
 * Language Specification Standard
 *
 * https://www.ecma-international.org/ecma-262/9.0/index.html
 */

const Application = require('./src/application');
const Inquiry = require('./src/inquiry');
const Route = require('./src/route');

module.exports = {
  Application,
  Inquiry,
  Route
};

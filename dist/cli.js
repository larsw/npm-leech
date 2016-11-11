#!/usr/bin/env node
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultOpts = undefined;

var _meow = require('meow');

var _meow2 = _interopRequireDefault(_meow);

var _leech = require('./leech');

var _leech2 = _interopRequireDefault(_leech);

var _pace = require('pace');

var _pace2 = _interopRequireDefault(_pace);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var opts = {
  boolean: ['dev', 'verbose', 'progress'],
  string: ['input', 'output', 'registry'],
  alias: {
    'input': 'i',
    'output': 'o',
    'concurrency': 'c',
    'dev': 'd',
    'transitive-dev': 'D',
    'registry': 'r',
    'verbose': 'v',
    'progress': 'p'
  },
  default: {
    'registry': 'http://registry.npmjs.org/',
    'input': './package.json',
    'output': './npm-tarballs.tar',
    'concurrency': 3,
    'dev': false,
    'transitive-dev': false,
    'verbose': false,
    'progress': false
  }
};
/* @flow */

var defaultOpts = exports.defaultOpts = opts.default;

var cli = (0, _meow2.default)('\n    usage\n      $ npm-leech [-i ../package.json] [-o foo.tar] [-c] [-d] [-D] \n\n    options\n      --input, -i            source package.json (default: ./package.json)\n      --output, -o           target tarballs tar (default: ./npm-tarballs.tar)\n      --concurrency, -c      number of concurrent retrieval tasks for meta/pkg (default: 4)\n      --dev, -d              leech devDependencies in source. (default: false)\n      --transitive-dev, -D   CAUTION! leech all transitive devDependencies. (default: false)\n      --registry, -r         NPM registry. (default: http://registry.npmjs.org/)\n      --verbose, -v          Verbose output. (default: false)\n      --progress, -p         Progress bar. Should not be used with -v (default: true)\n\n    examples\n      $ npm-leech -i ../../package.json -o foo.tar -c 8 -d\n      \n', opts);

if (!module.parent) {
  if (cli.flags.help) {
    cli.showHelp(1);
  } else {
    if (!cli.flags.verbose) {
      console.log('leeching...');
    }
    if (cli.flags.progress) {
      (function () {
        var bar = new _pace2.default({
          total: -1
        });
        cli.flags.decreaseTotal = bar.op;
        cli.flags.decreaseTotal = cli.flags.decreaseTotal.bind(bar);
        cli.flags.increaseTotal = function (amount) {
          if (bar.total === -1) {
            bar.total = amount;
          } else {
            bar.total = bar.total + amount;
          }
        };
        cli.flags.increaseTotal = cli.flags.increaseTotal.bind(bar);
      })();
    }
    (0, _leech2.default)(cli.flags);
  }
}
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _es6Set = require('es6-set');

var _es6Set2 = _interopRequireDefault(_es6Set);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _archiver = require('archiver');

var _archiver2 = _interopRequireDefault(_archiver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*:: declare function P(amount: ?number):void;*/ /* @flow */

/*:: type LeechOpts = {
  registry: string,
  input: string,
  output: string,
  concurrency: number,
  dev: boolean,
  'transitive-dev': boolean,
  verbose: boolean,
  done: ?() => void,
  increaseTotal: P,
  decreaseTotal: P
}*/


var composeImpl = function composeImpl(f, g) {
  return function (x) {
    return g(f(x));
  };
};

/* eslint-disable */
/*:: type fn<T,U> = (x: T) => U;*/

var compose /*:
              (<T,U,V>(m1: fn<U,V>, m2: fn<T,U>, end: void) => fn<T,V>)*/ = (composeImpl /*: any*/);
/* eslint-enable */

exports.default = function (opts /*: LeechOpts*/) {

  var noop = function noop() {};
  var log = opts.verbose ? compose(_chalk2.default.white, console.log) : noop;
  var warn = opts.verbose ? compose(_chalk2.default.yellow, console.warn) : noop;
  var error = opts.verbose ? compose(_chalk2.default.red, console.error) : noop;

  var inputFilePath = _path2.default.resolve(opts.input);

  if (!_fs2.default.existsSync(inputFilePath)) {
    console.log('The input file', inputFilePath, 'does not exist.');
    process.exit(0);
  }

  var packageFileContent = _fs2.default.readFileSync(inputFilePath, 'utf-8');
  var packageJson = JSON.parse(packageFileContent);

  var tarStream = _fs2.default.createWriteStream(opts.output);
  var tar = (0, _archiver2.default)('tar', {
    store: true
  });

  tarStream.on('close', function () {
    log(tar.pointer() + ' bytes written to ' + opts.output);
    if (opts.done) {
      opts.done();
    }
  });

  tar.on('entry', function (entry) {
    entry.finished();
    if (opts.progress) opts.decreaseTotal();
    log(entry.name, 'added to archive.');
  });

  tar.on('error', function (err) {
    throw err;
  });

  tar.pipe(tarStream);

  var downloaded = new _es6Set2.default();

  var getOutputFileName = function getOutputFileName(task) {
    var re = /.*\/(.*)$/g;
    var fileName = re.exec(task);
    return fileName[1];
  };

  /*:: declare function Worker(url: string, cb: ((err:?string) => any)): any;*/


  var tarballQueue = _async2.default.queue(function (task, finished) /*: Worker*/ {
    log('[pkg]', task);
    var fileName = getOutputFileName(task);
    _axios2.default.get(task, {
      // this is important or else the response will be of type string
      responseType: 'stream'
    }).then(function (response) {

      tar.append(response.data, {
        name: fileName,
        finished: finished
      });
    }).catch(function (err) {
      finished(err);
      error('[meta-err]', err);
    });
  }, opts.concurrency);

  tarballQueue.drain = function () {
    tarStream.close();
  };

  var metaQueue = _async2.default.queue(function (task, finished) /*: Worker*/ {
    log('[meta]', task);
    downloaded.add(task);
    _axios2.default.get(task).then(function (response) {

      if (response.data.dependencies) {
        metaQueue.push(toUrls(response.data.dependencies));
      }
      if (opts['transitive-dev'] && response.data.devDependencies) {
        metaQueue.push(toUrls(response.data.devDependencies));
      }
      if (opts.progress) opts.increaseTotal(1);
      tarballQueue.push(response.data.dist.tarball);
      finished();
    }).catch(function (err) {
      error('[pkg-err]', err);
      finished(err);
    });
  }, opts.concurrency);

  /*:: type DependencyMap = { [key: string]: string };*/


  var toUrls = function toUrls(deps /*: DependencyMap*/) {
    return Object.getOwnPropertyNames(deps).map(function (id /*: string*/) {
      return '' + opts.registry + id + '/' + deps[id];
    }).filter(function (x) {
      return !downloaded.has(x);
    });
  };

  if (!packageJson.dependencies) {
    warn('No dependencies section in the specified input', opts.input);
  } else {
    metaQueue.push(toUrls(packageJson.dependencies));
  }

  if (opts.dev) {
    if (!packageJson.devDependencies) {
      warn('No devDependencies section in the specified input', opts.input);
    } else {
      metaQueue.push(toUrls(packageJson.devDependencies));
    }
  }
};
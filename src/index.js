var fs = require('fs')
var async = require('async')
var axios = require('axios/lib/axios.js')
var Set = require('es6-set')
var package = require('../package.json');
var parseArgs = require('minimist')
var archiver = require('archiver')

var opts = {
  string: ['output'],
  boolean: ['zip'],
  alias: {
    'zip': 'z',
    'output': 'o',
    'concurrency': 'c'
  },
  default: {
    'zip': true,
    'output': './npm-tarballs.tar',
    'concurrency': 2
  }
}

var args = parseArgs(process.argv.slice(2), opts)

var zipStream = fs.createWriteStream(args.output)
var zipArchive = archiver('tar', {
  store: true
})

zipStream.on('close', function() {
  console.log(zipArchive.pointer() + ' bytes written to ' + args.output)
})

zipArchive.on('entry', function(entry) {
  entry.finished()
  console.log(entry.name, 'added to archive.')
})

zipArchive.on('error', function(err) {
  throw err
})

zipArchive.pipe(zipStream)

var registryBaseUrl = 'http://registry.npmjs.org/';
var downloadFolder = './packages';

var downloaded = new Set()

function getOutputFileName(task) {
  var re = /.*\/(.*)$/g;
  fileName = re.exec(task)
  return fileName[1] //'./packages/' + fileName[1]
}

var tarballQueue = async.queue(function (task, finished) {
  console.log('[pkg]', task)
  var fileName = getOutputFileName(task)
  axios.get(task, { responseType: 'stream', headers: {
    'Accept': 'application/octet-stream'
  } }).then(function (response) {

    // append tarball to zip
    zipArchive.append(response.data, {
        name: fileName,
        finished: finished
      })
    // if (!fs.existsSync(fileName)) {
    //   var writeStream = fs.createWriteStream(fileName)
    //   response.data.pipe(writeStream)
    // }
  }).catch(function (err) {
    finished(err)
    console.log('meta-err', err)
  })
}, 1 /*args.concurrency*/)

var metaQueue = async.queue(function (task, finished) {
  console.log('[meta]', task)
  downloaded.add(task)
  axios.get(task).then(function (response) {
    if (response.data.dependencies) {
      metaQueue.push(generateMetaUrls(response.data.dependencies))
    }
    tarballQueue.push(response.data.dist.tarball)
    finished()
  }).catch(function (err) {
     console.log('pkg-err', err)
  })
}, args.concurrency);

function generateMetaUrls(deps) {
  return Object.getOwnPropertyNames(deps).map(function (x) {
    return registryBaseUrl + x + '/' + deps[x]
  }).filter(function (x) { return !downloaded.has(x) })
}

var urls = generateMetaUrls(package.dependencies);

metaQueue.push(urls, function (err) {
  if (err) {
    console.log(err)
  }
})

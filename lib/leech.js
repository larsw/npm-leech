/* @flow */

import fs from 'fs'
import Set from 'es6-set'
import path from 'path'
import async from 'async'
import axios from 'axios'
import chalk from 'chalk'
import archiver from 'archiver'

declare function P(amount: ?number):void;

type LeechOpts = {
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
}

const composeImpl = (f, g) => x => g(f(x))

/* eslint-disable */
type fn<T,U> = (x: T) => U;
const compose:
  (<T,U,V>(m1: fn<U,V>, m2: fn<T,U>, end: void) => fn<T,V>)
  = (composeImpl: any)
/* eslint-enable */

export default (opts : LeechOpts) => {

  const noop = () => {}
  const log = opts.verbose ? compose(chalk.white, console.log) : noop
  const warn = opts.verbose ? compose(chalk.yellow, console.warn) : noop
  const error = opts.verbose ? compose(chalk.red, console.error) : noop

  const inputFilePath = path.resolve(opts.input)

  if (!fs.existsSync(inputFilePath)) {
    console.log('The input file', inputFilePath, 'does not exist.')
    process.exit(0)
  }

  const packageFileContent = fs.readFileSync(inputFilePath, 'utf-8')
  const packageJson = JSON.parse(packageFileContent)

  const tarStream = fs.createWriteStream(opts.output)
  const tar = archiver('tar', {
    store: true
  })

  tarStream.on('close', () => {
    log(`${tar.pointer()} bytes written to ${opts.output}`)
    if (opts.done) {
      opts.done()
    }
  })

  tar.on('entry', (entry) => {
    entry.finished()
    if (opts.progress) opts.decreaseTotal()
    log(entry.name, 'added to archive.')
  })

  tar.on('error', (err) => {
    throw err
  })

  tar.pipe(tarStream)

  const downloaded = new Set()

  const getOutputFileName = (task) => {
    const re = /.*\/(.*)$/g
    const fileName = re.exec(task)
    return fileName[1]
  }

  declare function Worker(url: string, cb: ((err:?string) => any)): any;

  const tarballQueue = async.queue((task, finished) : Worker => {
    log('[pkg]', task)
    const fileName = getOutputFileName(task)
    axios.get(task, {
      // this is important or else the response will be of type string
      responseType: 'stream'
    }).then((response) => {

      tar.append(response.data, {
        name: fileName,
        finished: finished
      })

    }).catch((err) => {
      finished(err)
      error('[meta-err]', err)
    })
  }, opts.concurrency)

  tarballQueue.drain = () => {
    tarStream.close()
  }

  const metaQueue = async.queue((task, finished) : Worker => {
    log('[meta]', task)
    downloaded.add(task)
    axios.get(task).then((response) => {

      if (response.data.dependencies) {
        metaQueue.push(toUrls(response.data.dependencies))
      }
      if (opts['transitive-dev'] && response.data.devDependencies) {
        metaQueue.push(toUrls(response.data.devDependencies))
      }
      if (opts.progress) opts.increaseTotal(1)
      tarballQueue.push(response.data.dist.tarball)
      finished()
    }).catch((err) => {
      error('[pkg-err]', err)
      finished(err)
    })
  }, opts.concurrency)

  type DependencyMap = { [key: string]: string };

  const toUrls = (deps: DependencyMap) => {
    return Object.getOwnPropertyNames(deps)
      .map((id: string) => {
        return `${opts.registry}${id}/${deps[id]}`
      })
      .filter((x) => {
        return !downloaded.has(x)
      })
  }

  if (!packageJson.dependencies) {
    warn('No dependencies section in the specified input', opts.input)
  } else {
    metaQueue.push(toUrls(packageJson.dependencies))
  }

  if (opts.dev) {
    if (!packageJson.devDependencies) {
      warn('No devDependencies section in the specified input', opts.input)
    } else {
      metaQueue.push(toUrls(packageJson.devDependencies))
    }
  }
}

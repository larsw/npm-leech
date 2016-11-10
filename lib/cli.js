#!/usr/bin/env node
/* @flow */

import meow from 'meow'
import leech from './leech'
import pace from 'pace'

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
}

export const defaultOpts = opts.default

const cli = meow(`
    usage
      $ npm-leech <--i ../package.json> <--o foo.tar> <-c> <-d> <-D> 

    options
      --input, -i            source package.json (default: ./package.json)
      --output, -o           target tarballs tar (default: ./npm-tarballs.tar)
      --concurrency, -c      number of concurrent retrieval tasks for meta/pkg (default: 4)
      --dev, -d              leech devDependencies in source. (default: false)
      --transitive-dev, -D   CAUTION! leech all transitive devDependencies. (default: false)
      --registry, -r         NPM registry. (default: http://registry.npmjs.org/)
      --verbose, -v          Verbose output. (default: false)
      --progress, -p         Progress bar. Should not be used with -v (default: true)

    examples
      $ npm-leech -i ../../package.json -o foo.tar -c 8 -d
      
`, opts)

if (!module.parent) {
  if (cli.flags.help) {
    cli.showHelp(1)
  } else {
    if (!cli.flags.verbose) {
      console.log('leeching...')
    }
    if (cli.flags.progress) {
      const bar = new pace({
        total: -1
      })
      cli.flags.decreaseTotal = bar.op
      cli.flags.decreaseTotal = cli.flags.decreaseTotal.bind(bar)
      cli.flags.increaseTotal = (amount) => {
        if (bar.total === -1) {
          bar.total = amount
        } else {
          bar.total = bar.total + amount
        }
      }
      cli.flags.increaseTotal = cli.flags.increaseTotal.bind(bar)
    }
    leech(cli.flags)
  }
}

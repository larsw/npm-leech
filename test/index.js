import fs from 'fs'
import path from 'path'
import test from 'ava'
import {defaultOpts} from '../lib/cli'
import leech from '../lib/leech'
import rimraf from 'rimraf'

test.cb('dogfooding works', t => {
  let opts = Object.assign({}, defaultOpts)
  opts.input = path.join(__dirname, '../package.json')
  rimraf.sync(opts.output)  
  opts.done = () => {
    t.true(fs.existsSync(opts.output))
    rimraf.sync(opts.output)  
    t.end()
  }
  try {
    leech(opts)
  } catch (error) {
    console.log(error)
  }
})

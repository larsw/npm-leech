import fs from 'fs'
import path from 'path'
import test from 'ava'
import defaultOpts from '../lib/cli'
import leech from '../lib/leech'

test('dogfooding works', t => {
  let opts = Object.assign({}, defaultOpts)
  opts.input = path.join(__dirname, '../package.json')
  opts.verbose = true
  opts.done = () => {
    t.true(fs.existsSync(opts.output))
    t.end()
  }
  try {
    leech(opts)
  } catch (error) {
    console.log(error)
  }
})

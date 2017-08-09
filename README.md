npm-leech
===========

Small utility to leech all direct and transitive npm packages for a given package.json file.

Ideal for mirroring a given set of packages to a private repository like Artifactory. 

```
    usage
      $ npm-leech [-i ../package.json] [-o foo.tar] [-c] [-d] [-D] 

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
```
License
-------
MIT - [@larsw](https://github.com/larsw/)
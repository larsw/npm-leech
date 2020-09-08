#!/usr/bin/env node

import { EntryData, ArchiverError } from "archiver";

var fs = require("fs");
var path = require("path");
var async = require("async");
var axios = require("axios/lib/axios.js");
//var Set = require('es6-set')
var parseArgs = require("minimist");
var archiver = require("archiver");

var opts = {
  boolean: ["dev"],
  string: ["input", "output", "registry"],
  alias: {
    input: "i",
    output: "o",
    concurrency: "c",
    dev: "d",
    "transitive-dev": "D",
    registry: "r",
  },
  default: {
    registry: "http://registry.npmjs.org/",
    input: "./package-lock.json",
    output: "./npm-tarballs.tar",
    concurrency: 4,
    dev: false,
    "transitive-dev": false,
  },
};

var args = parseArgs(process.argv.slice(2), opts);

if (!fs.existsSync(args.input)) {
  console.log("The input file", args.input, "does not exist.");
  process.exit(-1);
}


interface PackageLockJson {
  dependencies:  {
    [key: string]: PackageLockJson,
  },
  resolved: string
}

interface PackageJson {
  dependencies?:  {
    [key: string]: PackageJson,
  },
  devDependencies?:  {
    [key: string]: PackageJson,
  },
}

var pkg: PackageJson = undefined!;
var packageLock: PackageLockJson = undefined!;
if (args.input.indexOf("package-lock.json") > -1) {
  packageLock = require(path.resolve(args.input));
} else {
  pkg = require(path.resolve(args.input));
}

var zipStream = fs.createWriteStream(args.output);
var zipArchive = archiver("tar", {
  store: true,
});

zipStream.on("close", function () {
  console.log(zipArchive.pointer() + " bytes written to " + args.output);
});

zipArchive.on("entry", function (entry: EntryData) {
  //entry.finished()
  console.log(entry.name, "added to archive.");
});

zipArchive.on("error", function (err: ArchiverError) {
  throw err;
});

zipArchive.pipe(zipStream);

var downloaded = new Set();
var packages = new Set();

function getOutputFileName(task: string) {
  if (task.indexOf("@") === -1) {
    const re = /.*\/(.*)$/g;
    const fileName = re.exec(task);
    if (!fileName) {
      throw new Error("getOutputFileName: regexp didn't match on input");
    }
    return fileName[1];
  } else {
    const re = /(@[^\/]+\/).*(?:\/(.*))$/g;
    const fileName = re.exec(task);
    if (!fileName) {
      throw new Error("getOutputFileName: regexp didn't match on input");
    }
    return fileName[1] + fileName[2];
  }
}

var tarballQueue = async.queue((task: string, finished: (error?:Error) => void) => {
  console.log("[pkg]", task);
  var fileName = getOutputFileName(task);
  if (packages.has(fileName)) {
    finished();
  } else {
    packages.add(fileName);
    axios
      .get(task, {
        responseType: "stream",
        headers: {
          Accept: "application/octet-stream",
        },
      })
      .then((response:MetadataResponse) => {
        zipArchive.append(response.data, {
          name: fileName,
          finished: finished,
        });
      })
      .catch((err:Error) => {
        finished(err);
        console.log("meta-err", err);
      });
  }
}, args.concurrency);

interface MetadataResponse {
  data: {
    dependencies?: string[],
    devDependencies?: string[],
    dist: {
      tarball: string
    }
  }
}

var metaQueue = async.queue((task:string, finished: (error?:Error) => void) => {
  console.log("[meta]", task);
  downloaded.add(task);
  axios
    .get(task)
    .then((response:MetadataResponse) => {
      if (response.data.dependencies) {
        metaQueue.push(generateMetaUrls(response.data.dependencies));
      }
      if (args["transitive-dev"] && response.data.devDependencies) {
        metaQueue.push(generateMetaUrls(response.data.devDependencies));
      }
      tarballQueue.push(response.data.dist.tarball);
      finished();
    })
    .catch(function (err: Error) {
      console.log("pkg-err", err);
      finished(err);
    });
}, args.concurrency);

function generateMetaUrls(dependencySection: any) {
  return Object.getOwnPropertyNames(dependencySection)
    .map((id) => {
      return (
        args.registry + uriencodeSpecific(id) + "/" + dependencySection[id]
      );
    })
    .filter((x: string) => {
      return !downloaded.has(x);
    });
}

function uriencodeSpecific(id: string) {
  return id.replace(/\//g, "%2F");
}

interface PackageLockJson {
  dependencies:  {
    [key: string]: PackageLockJson,
  },
  resolved: string
}

function findPackageLockResolvedUrls(obj: PackageLockJson) {
  var urls: string[] = [];
  if (obj.dependencies) {
    Object.getOwnPropertyNames(obj.dependencies).forEach((x) => {
      if (obj.dependencies[x].dependencies) {
        urls.push(...findPackageLockResolvedUrls(obj.dependencies[x]));
      }
      if (obj.dependencies[x].resolved) {
        urls.push(obj.dependencies[x].resolved);
      }
    });
  }
  return urls;
}

if (pkg) {
  if (!pkg.dependencies) {
    console.warn("No dependencies section in the specified input", args.input);
  } else {
    metaQueue.push(generateMetaUrls(pkg.dependencies));
  }
}

if (args.dev) {
  if (pkg && !pkg.devDependencies) {
    console.warn(
      "No devDependencies section in the specified input",
      args.input
    );
  } else {
    metaQueue.push(generateMetaUrls(pkg.devDependencies));
  }
}

if (packageLock) {
  tarballQueue.push(findPackageLockResolvedUrls(packageLock));
}

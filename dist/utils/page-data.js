"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.fixedPagePath = fixedPagePath;
exports.reverseFixedPagePath = reverseFixedPagePath;
exports.readPageData = readPageData;
exports.removePageData = removePageData;
exports.pageDataExists = pageDataExists;
exports.writePageData = writePageData;
exports.isFlushEnqueued = isFlushEnqueued;
exports.flush = flush;
exports.enqueueFlush = enqueueFlush;
exports.handleStalePageData = handleStalePageData;

var _fs = require("@nodelib/fs.walk");

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _fastq = _interopRequireDefault(require("fastq"));

var _path = _interopRequireDefault(require("path"));

var _websocketManager = require("./websocket-manager");

var _webpackStatus = require("./webpack-status");

var _redux = require("../redux");

var _queries = require("../redux/reducers/queries");

function fixedPagePath(pagePath) {
  return pagePath === `/` ? `index` : pagePath;
}

function reverseFixedPagePath(pageDataRequestPath) {
  return pageDataRequestPath === `index` ? `/` : pageDataRequestPath;
}

function getFilePath(publicDir, pagePath) {
  return _path.default.join(publicDir, `page-data`, fixedPagePath(pagePath), `page-data.json`);
}

async function readPageData(publicDir, pagePath) {
  const filePath = getFilePath(publicDir, pagePath);
  const rawPageData = await _fsExtra.default.readFile(filePath, `utf-8`);
  return JSON.parse(rawPageData);
}

async function removePageData(publicDir, pagePath) {
  const filePath = getFilePath(publicDir, pagePath);

  if (_fsExtra.default.existsSync(filePath)) {
    return await _fsExtra.default.remove(filePath);
  }

  return Promise.resolve();
}

function pageDataExists(publicDir, pagePath) {
  return _fsExtra.default.existsSync(getFilePath(publicDir, pagePath));
}

async function writePageData(publicDir, {
  componentChunkName,
  matchPath,
  path: pagePath,
  staticQueryHashes
}) {
  const inputFilePath = _path.default.join(publicDir, `..`, `.cache`, `json`, `${pagePath.replace(/\//g, `_`)}.json`);

  const outputFilePath = getFilePath(publicDir, pagePath);
  const result = await _fsExtra.default.readJSON(inputFilePath);
  const body = {
    componentChunkName,
    path: pagePath,
    matchPath,
    result,
    staticQueryHashes
  };
  const bodyStr = JSON.stringify(body); // transform asset size to kB (from bytes) to fit 64 bit to numbers

  const pageDataSize = Buffer.byteLength(bodyStr) / 1000;

  _redux.store.dispatch({
    type: `ADD_PAGE_DATA_STATS`,
    payload: {
      filePath: outputFilePath,
      size: pageDataSize
    }
  });

  await _fsExtra.default.outputFile(outputFilePath, bodyStr);
  return body;
}

let isFlushPending = false;
let isFlushing = false;

function isFlushEnqueued() {
  return isFlushPending;
}

async function flush() {
  if (isFlushing) {
    // We're already in the middle of a flush
    return;
  }

  isFlushPending = false;
  isFlushing = true;

  const {
    pendingPageDataWrites,
    pages,
    program,
    staticQueriesByTemplate,
    queries
  } = _redux.store.getState();

  const {
    pagePaths
  } = pendingPageDataWrites;
  const pagesToWrite = pagePaths.values();
  const flushQueue = (0, _fastq.default)(async (pagePath, cb) => {
    const page = pages.get(pagePath); // It's a gloomy day in Bombay, let me tell you a short story...
    // Once upon a time, writing page-data.json files were atomic
    // After this change (#24808), they are not and this means that
    // between adding a pending write for a page and actually flushing
    // them, a page might not exist anymore щ（ﾟДﾟщ）
    // This is why we need this check

    if (page) {
      var _program$_, _program$_2;

      if ((program === null || program === void 0 ? void 0 : (_program$_ = program._) === null || _program$_ === void 0 ? void 0 : _program$_[0]) === `develop` && process.env.GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND) {
        // check if already did run query for this page
        // with query-on-demand we might have pending page-data write due to
        // changes in static queries assigned to page template, but we might not
        // have query result for it
        const query = queries.trackedQueries.get(page.path);

        if (!query) {
          // this should not happen ever
          throw new Error(`We have a page, but we don't have registered query for it (???)`);
        }

        if ((0, _queries.hasFlag)(query.dirty, _queries.FLAG_DIRTY_NEW_PAGE)) {
          // query results are not written yet
          return cb(null, true);
        }
      }

      const staticQueryHashes = staticQueriesByTemplate.get(page.componentPath) || [];
      const result = await writePageData(_path.default.join(program.directory, `public`), { ...page,
        staticQueryHashes
      });

      if ((program === null || program === void 0 ? void 0 : (_program$_2 = program._) === null || _program$_2 === void 0 ? void 0 : _program$_2[0]) === `develop`) {
        _websocketManager.websocketManager.emitPageData({
          id: pagePath,
          result
        });
      }
    }

    _redux.store.dispatch({
      type: `CLEAR_PENDING_PAGE_DATA_WRITE`,
      payload: {
        page: pagePath
      }
    });

    return cb(null, true);
  }, 25);

  for (const pagePath of pagesToWrite) {
    flushQueue.push(pagePath, () => {});
  }

  if (!flushQueue.idle()) {
    await new Promise(resolve => {
      flushQueue.drain = resolve;
    });
  }

  isFlushing = false;
  return;
}

function enqueueFlush() {
  if ((0, _webpackStatus.isWebpackStatusPending)()) {
    isFlushPending = true;
  } else {
    flush();
  }
}

async function handleStalePageData() {
  if (!(await _fsExtra.default.pathExists(`public/page-data`))) {
    return;
  } // public directory might have stale page-data files from previous builds
  // we get the list of those and compare against expected page-data files
  // and remove ones that shouldn't be there anymore


  const activity = _reporter.default.activityTimer(`Cleaning up stale page-data`);

  activity.start();
  const pageDataFilesFromPreviousBuilds = await new Promise((resolve, reject) => {
    const results = new Set();
    const stream = (0, _fs.walkStream)(`public/page-data`);
    stream.on(`data`, data => {
      if (data.name === `page-data.json`) {
        results.add(data.path);
      }
    });
    stream.on(`error`, e => {
      reject(e);
    });
    stream.on(`end`, () => resolve(results));
  });
  const expectedPageDataFiles = new Set();

  _redux.store.getState().pages.forEach(page => {
    expectedPageDataFiles.add(getFilePath(`public`, page.path));
  });

  const deletionPromises = [];
  pageDataFilesFromPreviousBuilds.forEach(pageDataFilePath => {
    if (!expectedPageDataFiles.has(pageDataFilePath)) {
      deletionPromises.push(_fsExtra.default.remove(pageDataFilePath));
    }
  });
  await Promise.all(deletionPromises);
  activity.end();
}
//# sourceMappingURL=page-data.js.map
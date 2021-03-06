"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _path = _interopRequireDefault(require("path"));

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _signalExit = _interopRequireDefault(require("signal-exit"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _gatsbyTelemetry = _interopRequireDefault(require("gatsby-telemetry"));

var _buildHtml = require("./build-html");

var _buildJavascript = require("./build-javascript");

var _bootstrap = require("../bootstrap");

var _apiRunnerNode = _interopRequireDefault(require("../utils/api-runner-node"));

var _graphqlRunner = require("../query/graphql-runner");

var _getStaticDir = require("../utils/get-static-dir");

var _tracer = require("../utils/tracer");

var _db = _interopRequireDefault(require("../db"));

var _redux = require("../redux");

var appDataUtil = _interopRequireWildcard(require("../utils/app-data"));

var _pageData = require("../utils/page-data");

var WorkerPool = _interopRequireWildcard(require("../utils/worker/pool"));

var _webpackErrorUtils = require("../utils/webpack-error-utils");

var _feedback = require("../utils/feedback");

var buildUtils = _interopRequireWildcard(require("./build-utils"));

var _actions = require("../redux/actions");

var _waitUntilJobsComplete = require("../utils/wait-until-jobs-complete");

var _types = require("./types");

var _services = require("../services");

var _webpackStatus = require("../utils/webpack-status");

var _gatsbyCoreUtils = require("gatsby-core-utils");

let cachedPageData;
let cachedWebpackCompilationHash;

if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
  const {
    pageData,
    webpackCompilationHash
  } = (0, _redux.readState)(); // extract only data that we need to reuse and let v8 garbage collect rest of state

  cachedPageData = pageData;
  cachedWebpackCompilationHash = webpackCompilationHash;
}

module.exports = async function build(program) {
  _reporter.default.setVerbose((0, _gatsbyCoreUtils.isTruthy)(process.env.VERBOSE) || program.verbose);

  if (program.profile) {
    _reporter.default.warn(`React Profiling is enabled. This can have a performance impact. See https://www.gatsbyjs.org/docs/profiling-site-performance-with-react-profiler/#performance-impact`);
  }

  await (0, _gatsbyCoreUtils.updateSiteMetadata)({
    name: program.sitePackageJson.name,
    sitePath: program.directory,
    lastRun: Date.now(),
    pid: process.pid
  });
  (0, _webpackStatus.markWebpackStatusAsPending)();

  const publicDir = _path.default.join(program.directory, `public`);

  (0, _tracer.initTracer)(program.openTracingConfigFile);

  const buildActivity = _reporter.default.phantomActivity(`build`);

  buildActivity.start();

  _gatsbyTelemetry.default.trackCli(`BUILD_START`);

  (0, _signalExit.default)(exitCode => {
    _gatsbyTelemetry.default.trackCli(`BUILD_END`, {
      exitCode
    });
  });
  const buildSpan = buildActivity.span;
  buildSpan.setTag(`directory`, program.directory);
  const {
    gatsbyNodeGraphQLFunction
  } = await (0, _bootstrap.bootstrap)({
    program,
    parentSpan: buildSpan
  });
  const graphqlRunner = new _graphqlRunner.GraphQLRunner(_redux.store, {
    collectStats: true,
    graphqlTracing: program.graphqlTracing
  });
  const {
    queryIds
  } = await (0, _services.calculateDirtyQueries)({
    store: _redux.store
  });
  await (0, _services.runStaticQueries)({
    queryIds,
    parentSpan: buildSpan,
    store: _redux.store,
    graphqlRunner
  });
  await (0, _services.runPageQueries)({
    queryIds,
    graphqlRunner,
    parentSpan: buildSpan,
    store: _redux.store
  });
  await (0, _services.writeOutRequires)({
    store: _redux.store,
    parentSpan: buildSpan
  });
  await (0, _apiRunnerNode.default)(`onPreBuild`, {
    graphql: gatsbyNodeGraphQLFunction,
    parentSpan: buildSpan
  }); // Copy files from the static directory to
  // an equivalent static directory within public.

  (0, _getStaticDir.copyStaticDirs)();

  const buildActivityTimer = _reporter.default.activityTimer(`Building production JavaScript and CSS bundles`, {
    parentSpan: buildSpan
  });

  buildActivityTimer.start();
  let stats;

  try {
    stats = await (0, _buildJavascript.buildProductionBundle)(program, buildActivityTimer.span);
  } catch (err) {
    buildActivityTimer.panic((0, _webpackErrorUtils.structureWebpackErrors)(_types.Stage.BuildJavascript, err));
  } finally {
    buildActivityTimer.end();
  }

  const workerPool = WorkerPool.create();
  const webpackCompilationHash = stats.hash;

  if (webpackCompilationHash !== _redux.store.getState().webpackCompilationHash || !appDataUtil.exists(publicDir)) {
    _redux.store.dispatch({
      type: `SET_WEBPACK_COMPILATION_HASH`,
      payload: webpackCompilationHash
    });

    const rewriteActivityTimer = _reporter.default.activityTimer(`Rewriting compilation hashes`, {
      parentSpan: buildSpan
    });

    rewriteActivityTimer.start();
    await appDataUtil.write(publicDir, webpackCompilationHash);
    rewriteActivityTimer.end();
  }

  await (0, _pageData.flush)();
  (0, _webpackStatus.markWebpackStatusAsDone)();

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
    const {
      pages
    } = _redux.store.getState();

    if (cachedPageData) {
      cachedPageData.forEach((_value, key) => {
        if (!pages.has(key)) {
          _actions.boundActionCreators.removePageData({
            id: key
          });
        }
      });
    }
  }

  if (_gatsbyTelemetry.default.isTrackingEnabled()) {
    // transform asset size to kB (from bytes) to fit 64 bit to numbers
    const bundleSizes = stats.toJson({
      assets: true
    }).assets.filter(asset => asset.name.endsWith(`.js`)).map(asset => asset.size / 1000);
    const pageDataSizes = [..._redux.store.getState().pageDataStats.values()];

    _gatsbyTelemetry.default.addSiteMeasurement(`BUILD_END`, {
      bundleStats: _gatsbyTelemetry.default.aggregateStats(bundleSizes),
      pageDataStats: _gatsbyTelemetry.default.aggregateStats(pageDataSizes),
      queryStats: graphqlRunner.getStats()
    });
  }

  _actions.boundActionCreators.setProgramStatus(`BOOTSTRAP_QUERY_RUNNING_FINISHED`);

  await _db.default.saveState();
  await (0, _waitUntilJobsComplete.waitUntilAllJobsComplete)(); // we need to save it again to make sure our latest state has been saved

  await _db.default.saveState();
  let pagePaths = [..._redux.store.getState().pages.keys()]; // Rebuild subset of pages if user opt into GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES
  // if there were no source files (for example components, static queries, etc) changes since last build, otherwise rebuild all pages

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
    if (cachedWebpackCompilationHash === _redux.store.getState().webpackCompilationHash) {
      pagePaths = buildUtils.getChangedPageDataKeys(_redux.store.getState(), cachedPageData);
    } else if (cachedWebpackCompilationHash) {
      _reporter.default.info(_reporter.default.stripIndent(`
          One or more of your source files have changed since the last time you ran Gatsby. All
          pages will be rebuilt.
        `));
    }
  }

  const buildSSRBundleActivityProgress = _reporter.default.activityTimer(`Building HTML renderer`, {
    parentSpan: buildSpan
  });

  buildSSRBundleActivityProgress.start();
  let pageRenderer;

  try {
    pageRenderer = await (0, _buildHtml.buildRenderer)(program, _types.Stage.BuildHTML, buildSpan);
  } catch (err) {
    buildActivityTimer.panic((0, _webpackErrorUtils.structureWebpackErrors)(_types.Stage.BuildHTML, err));
  } finally {
    buildSSRBundleActivityProgress.end();
  }

  _gatsbyTelemetry.default.addSiteMeasurement(`BUILD_END`, {
    pagesCount: pagePaths.length,
    // number of html files that will be written
    totalPagesCount: _redux.store.getState().pages.size // total number of pages

  });

  const buildHTMLActivityProgress = _reporter.default.createProgress(`Building static HTML for pages`, pagePaths.length, 0, {
    parentSpan: buildSpan
  });

  buildHTMLActivityProgress.start();

  try {
    await (0, _buildHtml.doBuildPages)(pageRenderer, pagePaths, buildHTMLActivityProgress, workerPool);
  } catch (err) {
    let id = `95313`; // TODO: verify error IDs exist

    const context = {
      errorPath: err.context && err.context.path,
      ref: ``
    };
    const match = err.message.match(/ReferenceError: (window|document|localStorage|navigator|alert|location) is not defined/i);

    if (match && match[1]) {
      id = `95312`;
      context.ref = match[1];
    }

    buildHTMLActivityProgress.panic({
      id,
      context,
      error: err
    });
  }

  buildHTMLActivityProgress.end();

  if (!program.keepPageRenderer) {
    try {
      await (0, _buildHtml.deleteRenderer)(pageRenderer);
    } catch (err) {// pass through
    }
  }

  let deletedPageKeys = [];

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES) {
    const deletePageDataActivityTimer = _reporter.default.activityTimer(`Delete previous page data`);

    deletePageDataActivityTimer.start();
    deletedPageKeys = buildUtils.collectRemovedPageData(_redux.store.getState(), cachedPageData);
    await buildUtils.removePageFiles(publicDir, deletedPageKeys);
    deletePageDataActivityTimer.end();
  }

  const postBuildActivityTimer = _reporter.default.activityTimer(`onPostBuild`, {
    parentSpan: buildSpan
  });

  postBuildActivityTimer.start();
  await (0, _apiRunnerNode.default)(`onPostBuild`, {
    graphql: gatsbyNodeGraphQLFunction,
    parentSpan: buildSpan
  });
  postBuildActivityTimer.end(); // Wait for any jobs that were started in onPostBuild
  // This could occur due to queries being run which invoke sharp for instance

  await (0, _waitUntilJobsComplete.waitUntilAllJobsComplete)(); // Make sure we saved the latest state so we have all jobs cached

  await _db.default.saveState();

  _reporter.default.info(`Done building in ${process.uptime()} sec`);

  buildSpan.finish();
  await (0, _tracer.stopTracer)();
  workerPool.end();
  buildActivity.end();

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES && process.argv.includes(`--log-pages`)) {
    if (pagePaths.length) {
      _reporter.default.info(`Built pages:\n${pagePaths.map(path => `Updated page: ${path}`).join(`\n`)}`);
    }

    if (deletedPageKeys.length) {
      _reporter.default.info(`Deleted pages:\n${deletedPageKeys.map(path => `Deleted page: ${path}`).join(`\n`)}`);
    }
  }

  if (process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES && process.argv.includes(`--write-to-file`)) {
    const createdFilesPath = _path.default.resolve(`${program.directory}/.cache`, `newPages.txt`);

    const createdFilesContent = pagePaths.length ? `${pagePaths.join(`\n`)}\n` : ``;

    const deletedFilesPath = _path.default.resolve(`${program.directory}/.cache`, `deletedPages.txt`);

    const deletedFilesContent = deletedPageKeys.length ? `${deletedPageKeys.join(`\n`)}\n` : ``;
    await _fsExtra.default.writeFile(createdFilesPath, createdFilesContent, `utf8`);

    _reporter.default.info(`.cache/newPages.txt created`);

    await _fsExtra.default.writeFile(deletedFilesPath, deletedFilesContent, `utf8`);

    _reporter.default.info(`.cache/deletedPages.txt created`);
  }

  if (await (0, _feedback.userGetsSevenDayFeedback)()) {
    (0, _feedback.showSevenDayFeedbackRequest)();
  } else if (await (0, _feedback.userPassesFeedbackRequestHeuristic)()) {
    (0, _feedback.showFeedbackRequest)();
  }
};
//# sourceMappingURL=build.js.map
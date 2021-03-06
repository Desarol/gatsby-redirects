"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.startWebpackServer = startWebpackServer;

var _betterOpn = _interopRequireDefault(require("better-opn"));

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _formatWebpackMessages = _interopRequireDefault(require("react-dev-utils/formatWebpackMessages"));

var _chalk = _interopRequireDefault(require("chalk"));

var _lodash = require("lodash");

var _types = require("../commands/types");

var _webpackErrorUtils = require("../utils/webpack-error-utils");

var _printDeprecationWarnings = require("../utils/print-deprecation-warnings");

var _showExperimentNotice = require("../utils/show-experiment-notice");

var _printInstructions = require("../utils/print-instructions");

var _prepareUrls = require("../utils/prepare-urls");

var _startServer = require("../utils/start-server");

var _webpackStatus = require("../utils/webpack-status");

var _pageData = require("../utils/page-data");

var _mapTemplatesToStaticQueryHashes = _interopRequireDefault(require("../utils/map-templates-to-static-query-hashes"));

var _redux = require("../redux");

async function startWebpackServer({
  program,
  app,
  workerPool,
  store
}) {
  if (!program || !app || !store) {
    _reporter.default.panic(`Missing required params`);
  }

  let {
    compiler,
    webpackActivity,
    websocketManager,
    cancelDevJSNotice,
    webpackWatching
  } = await (0, _startServer.startServer)(program, app, workerPool);
  webpackWatching.suspend();
  compiler.hooks.invalid.tap(`log compiling`, function () {
    if (!webpackActivity) {
      // mark webpack as pending if we are not in the middle of compilation already
      // when input is invalidated during compilation, webpack will automatically
      // run another compilation round before triggering `done` event
      _reporter.default.pendingActivity({
        id: `webpack-develop`
      });

      (0, _webpackStatus.markWebpackStatusAsPending)();
    }
  });
  compiler.hooks.watchRun.tapAsync(`log compiling`, function (_, done) {
    if (!webpackActivity) {
      // there can be multiple `watchRun` events before receiving single `done` event
      // webpack will not emit assets or `done` event until all pending invalidated
      // inputs were compiled
      webpackActivity = _reporter.default.activityTimer(`Re-building development bundle`, {
        id: `webpack-develop`
      });
      webpackActivity.start();
    }

    done();
  });
  let isFirstCompile = true;
  return new Promise(resolve => {
    compiler.hooks.done.tapAsync(`print gatsby instructions`, async function (stats, done) {
      if (cancelDevJSNotice) {
        cancelDevJSNotice();
      } // "done" event fires when Webpack has finished recompiling the bundle.
      // Whether or not you have warnings or errors, you will get this event.
      // We have switched off the default Webpack output in WebpackDevServer
      // options so we are going to "massage" the warnings and errors and present
      // them in a readable focused way.


      const messages = (0, _formatWebpackMessages.default)(stats.toJson({}, true));
      const urls = (0, _prepareUrls.prepareUrls)(program.https ? `https` : `http`, program.host, program.proxyPort);
      const isSuccessful = !messages.errors.length;

      if (isSuccessful && isFirstCompile) {
        // Show notices to users about potential experiments/feature flags they could
        // try.
        (0, _showExperimentNotice.showExperimentNotices)();
        (0, _printInstructions.printInstructions)(program.sitePackageJson.name || `(Unnamed package)`, urls);
        (0, _printDeprecationWarnings.printDeprecationWarnings)();

        if (program.open) {
          try {
            await (0, _betterOpn.default)(urls.localUrlForBrowser);
          } catch {
            console.log(`${_chalk.default.yellow(`warn`)} Browser not opened because no browser was found`);
          }
        }
      }

      isFirstCompile = false;

      if (webpackActivity) {
        (0, _webpackErrorUtils.reportWebpackWarnings)(stats);

        if (!isSuccessful) {
          const errors = (0, _webpackErrorUtils.structureWebpackErrors)(_types.Stage.Develop, stats.compilation.errors);
          webpackActivity.panicOnBuild(errors);
        }

        webpackActivity.end();
        webpackActivity = null;
      }

      if (isSuccessful) {
        const state = store.getState();
        const mapOfTemplatesToStaticQueryHashes = (0, _mapTemplatesToStaticQueryHashes.default)(state, stats.compilation);
        mapOfTemplatesToStaticQueryHashes.forEach((staticQueryHashes, componentPath) => {
          if (!(0, _lodash.isEqual)(state.staticQueriesByTemplate.get(componentPath), staticQueryHashes)) {
            var _state$components$get, _state$components$get2;

            store.dispatch({
              type: `ADD_PENDING_TEMPLATE_DATA_WRITE`,
              payload: {
                componentPath,
                pages: (_state$components$get = (_state$components$get2 = state.components.get(componentPath)) === null || _state$components$get2 === void 0 ? void 0 : _state$components$get2.pages) !== null && _state$components$get !== void 0 ? _state$components$get : []
              }
            });
            store.dispatch({
              type: `SET_STATIC_QUERIES_BY_TEMPLATE`,
              payload: {
                componentPath,
                staticQueryHashes
              }
            });
          }
        });
        (0, _pageData.enqueueFlush)();
      }

      (0, _webpackStatus.markWebpackStatusAsDone)();
      done();

      _redux.emitter.emit(`COMPILATION_DONE`, stats);

      resolve({
        compiler,
        websocketManager,
        webpackWatching
      });
    });
  });
}
//# sourceMappingURL=start-webpack-server.js.map
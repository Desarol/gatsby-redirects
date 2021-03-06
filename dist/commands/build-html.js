"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.buildHTML = exports.doBuildPages = exports.deleteRenderer = exports.buildRenderer = exports.getDevSSRWebpack = void 0;

var _bluebird = _interopRequireDefault(require("bluebird"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _errors = require("gatsby-cli/lib/reporter/errors");

var _lodash = require("lodash");

var _webpack = _interopRequireDefault(require("webpack"));

var _redux = require("../redux");

var _webpack2 = _interopRequireDefault(require("../utils/webpack.config"));

var _webpackErrorUtils = require("../utils/webpack-error-utils");

let devssrWebpackCompiler;
let devssrWebpackWatcher;
let needToRecompileSSRBundle = true;

const getDevSSRWebpack = () => {
  if (process.env.gatsby_executing_command !== `develop`) {
    throw new Error(`This function can only be called in development`);
  }

  return {
    devssrWebpackWatcher,
    devssrWebpackCompiler,
    needToRecompileSSRBundle
  };
};

exports.getDevSSRWebpack = getDevSSRWebpack;
let oldHash = ``;
let newHash = ``;

const runWebpack = (compilerConfig, stage, directory) => new _bluebird.default((resolve, reject) => {
  if (!process.env.GATSBY_EXPERIMENTAL_DEV_SSR || stage === `build-html`) {
    (0, _webpack.default)(compilerConfig).run((err, stats) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(stats);
      }
    });
  } else if (process.env.GATSBY_EXPERIMENTAL_DEV_SSR && stage === `develop-html`) {
    devssrWebpackCompiler = (0, _webpack.default)(compilerConfig);
    devssrWebpackCompiler.hooks.invalid.tap(`ssr file invalidation`, file => {
      needToRecompileSSRBundle = true;
    });
    devssrWebpackWatcher = devssrWebpackCompiler.watch({
      ignored: /node_modules/
    }, (err, stats) => {
      needToRecompileSSRBundle = false;

      _redux.emitter.emit(`DEV_SSR_COMPILATION_DONE`);

      devssrWebpackWatcher.suspend();

      if (err) {
        return reject(err);
      } else {
        newHash = stats.hash || ``;

        const {
          restartWorker
        } = require(`../utils/dev-ssr/render-dev-html`); // Make sure we use the latest version during development


        if (oldHash !== `` && newHash !== oldHash) {
          restartWorker(`${directory}/public/render-page.js`);
        }

        oldHash = newHash;
        return resolve(stats);
      }
    });
  }
});

const doBuildRenderer = async ({
  directory
}, webpackConfig, stage) => {
  const stats = await runWebpack(webpackConfig, stage, directory);

  if (stats.hasErrors()) {
    _reporter.default.panic((0, _webpackErrorUtils.structureWebpackErrors)(stage, stats.compilation.errors));
  } // render-page.js is hard coded in webpack.config


  return `${directory}/public/render-page.js`;
};

const buildRenderer = async (program, stage, parentSpan) => {
  const {
    directory
  } = program;
  const config = await (0, _webpack2.default)(program, directory, stage, null, {
    parentSpan
  });
  return doBuildRenderer(program, config, stage);
};

exports.buildRenderer = buildRenderer;

const deleteRenderer = async rendererPath => {
  try {
    await _fsExtra.default.remove(rendererPath);
    await _fsExtra.default.remove(`${rendererPath}.map`);
  } catch (e) {// This function will fail on Windows with no further consequences.
  }
};

exports.deleteRenderer = deleteRenderer;

const renderHTMLQueue = async (workerPool, activity, htmlComponentRendererPath, pages) => {
  // We need to only pass env vars that are set programmatically in gatsby-cli
  // to child process. Other vars will be picked up from environment.
  const envVars = [[`NODE_ENV`, process.env.NODE_ENV], [`gatsby_executing_command`, process.env.gatsby_executing_command], [`gatsby_log_level`, process.env.gatsby_log_level]];
  const segments = (0, _lodash.chunk)(pages, 50);
  await _bluebird.default.map(segments, async pageSegment => {
    await workerPool.renderHTML({
      envVars,
      htmlComponentRendererPath,
      paths: pageSegment
    });

    if (activity && activity.tick) {
      activity.tick(pageSegment.length);
    }
  });
};

class BuildHTMLError extends Error {
  constructor(error) {
    super(error.message); // We must use getOwnProperty because keys like `stack` are not enumerable,
    // but we want to copy over the entire error

    this.codeFrame = ``;
    Object.getOwnPropertyNames(error).forEach(key => {
      this[key] = error[key];
    });
  }

}

const doBuildPages = async (rendererPath, pagePaths, activity, workerPool) => {
  try {
    await renderHTMLQueue(workerPool, activity, rendererPath, pagePaths);
  } catch (error) {
    const prettyError = await (0, _errors.createErrorFromString)(error.stack, `${rendererPath}.map`);
    const buildError = new BuildHTMLError(prettyError);
    buildError.context = error.context;
    throw buildError;
  }
}; // TODO remove in v4 - this could be a "public" api


exports.doBuildPages = doBuildPages;

const buildHTML = async ({
  program,
  stage,
  pagePaths,
  activity,
  workerPool
}) => {
  const rendererPath = await buildRenderer(program, stage, activity.span);
  await doBuildPages(rendererPath, pagePaths, activity, workerPool);
  await deleteRenderer(rendererPath);
};

exports.buildHTML = buildHTML;
//# sourceMappingURL=build-html.js.map
"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.reportWebpackWarnings = exports.structureWebpackErrors = void 0;

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _types = require("../commands/types");

const stageCodeToReadableLabel = {
  [_types.Stage.BuildJavascript]: `Generating JavaScript bundles`,
  [_types.Stage.BuildHTML]: `Generating SSR bundle`,
  [_types.Stage.DevelopHTML]: `Generating development SSR bundle`,
  [_types.Stage.Develop]: `Generating development JavaScript bundle`
};

const transformWebpackError = (stage, webpackError) => {
  var _webpackError$error, _webpackError$module, _webpackError$module2, _webpackError$error2;

  const handlers = [{
    regex: /Can't resolve '(.*?)' in '(.*?)'/m,
    cb: match => {
      return {
        id: `98124`,
        context: {
          sourceMessage: match[0],
          packageName: match[1]
        }
      };
    }
  }];
  const webpackMessage = (webpackError === null || webpackError === void 0 ? void 0 : (_webpackError$error = webpackError.error) === null || _webpackError$error === void 0 ? void 0 : _webpackError$error.message) || (webpackError === null || webpackError === void 0 ? void 0 : webpackError.message);
  const shared = {
    filePath: webpackError === null || webpackError === void 0 ? void 0 : (_webpackError$module = webpackError.module) === null || _webpackError$module === void 0 ? void 0 : _webpackError$module.resource,
    location: (webpackError === null || webpackError === void 0 ? void 0 : (_webpackError$module2 = webpackError.module) === null || _webpackError$module2 === void 0 ? void 0 : _webpackError$module2.resource) && (webpackError === null || webpackError === void 0 ? void 0 : (_webpackError$error2 = webpackError.error) === null || _webpackError$error2 === void 0 ? void 0 : _webpackError$error2.loc) ? {
      start: webpackError.error.loc
    } : undefined,
    context: {
      stage,
      stageLabel: stageCodeToReadableLabel[stage],
      sourceMessage: webpackMessage
    } // We use original error to display stack trace for the most part.
    // In case of webpack error stack will include internals of webpack
    // or one of loaders (for example babel-loader) and doesn't provide
    // much value to user, so it's purposely omitted.
    // error: webpackError?.error || webpackError,

  };
  let structured;

  for (const {
    regex,
    cb
  } of handlers) {
    const matched = webpackMessage === null || webpackMessage === void 0 ? void 0 : webpackMessage.match(regex);

    if (matched) {
      const match = cb(matched);
      structured = {
        id: match.id,
        ...shared,
        context: { ...shared.context,
          packageName: match.context.packageName,
          sourceMessage: match.context.sourceMessage
        }
      };
      break;
    }
  } // If we haven't found any known error


  if (!structured) {
    return {
      id: `98123`,
      ...shared
    };
  }

  return structured;
};

const structureWebpackErrors = (stage, webpackError) => {
  if (Array.isArray(webpackError)) {
    return webpackError.map(e => transformWebpackError(stage, e));
  }

  return transformWebpackError(stage, webpackError);
};

exports.structureWebpackErrors = structureWebpackErrors;

const reportWebpackWarnings = stats => {
  stats.compilation.warnings.forEach(webpackWarning => {
    if (webpackWarning.warning) {
      // grab inner Exception if it exists
      _reporter.default.warn(webpackWarning.warning.toString());
    } else {
      _reporter.default.warn(webpackWarning.message);
    }
  });
};

exports.reportWebpackWarnings = reportWebpackWarnings;
//# sourceMappingURL=webpack-error-utils.js.map
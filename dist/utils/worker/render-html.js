"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.renderHTML = void 0;

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _bluebird = _interopRequireDefault(require("bluebird"));

var _path = require("path");

var _pageHtml = require("../../utils/page-html");

const renderHTML = ({
  htmlComponentRendererPath,
  paths,
  stage,
  envVars
}) => {
  // This is being executed in child process, so we need to set some vars
  // for modules that aren't bundled by webpack.
  envVars.forEach(([key, value]) => process.env[key] = value);

  const htmlComponentRenderer = require(htmlComponentRendererPath);

  return _bluebird.default.map(paths, path => new _bluebird.default((resolve, reject) => {
    try {
      htmlComponentRenderer.default(path, (_throwAway, htmlString) => {
        if (stage === `develop-html`) {
          return resolve(htmlString);
        } else {
          return resolve(_fsExtra.default.outputFile((0, _pageHtml.getPageHtmlFilePath)((0, _path.join)(process.cwd(), `public`), path), htmlString));
        }
      });
    } catch (e) {
      // add some context to error so we can display more helpful message
      e.context = {
        path
      };
      reject(e);
    }
  }));
};

exports.renderHTML = renderHTML;
//# sourceMappingURL=render-html.js.map
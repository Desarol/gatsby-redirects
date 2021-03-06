"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.startRedirectListener = exports.writeRedirects = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _crypto = _interopRequireDefault(require("crypto"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _redux = require("../redux");

var _gatsbyCoreUtils = require("gatsby-core-utils");

let lastHash = null;
let bootstrapFinished = false;

const writeRedirects = async () => {
  bootstrapFinished = true;

  const {
    program,
    redirects
  } = _redux.store.getState(); // Filter for redirects that are meant for the browser.


  const browserRedirects = redirects.filter(r => r.redirectInBrowser) // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .map(({
    redirectInBrowser,
    isPermanent,
    ignoreCase,
    fromPath,
    ...rest
  }) => {
    return {
      fromPath: ignoreCase ? fromPath.toLowerCase() : fromPath,
      ignoreCase,
      ...rest
    };
  });

  const newHash = _crypto.default.createHash(`md5`).update(JSON.stringify(browserRedirects)).digest(`hex`);

  if (newHash === lastHash) {
    return;
  }

  lastHash = newHash;
  await _fsExtra.default.writeFile((0, _gatsbyCoreUtils.joinPath)(program.directory, `.cache/redirects.json`), JSON.stringify(browserRedirects, null, 2));
};

exports.writeRedirects = writeRedirects;

const debouncedWriteRedirects = _lodash.default.debounce(() => {
  // Don't write redirects again until bootstrap has finished.
  if (bootstrapFinished) {
    writeRedirects();
  }
}, 250);

const startRedirectListener = () => {
  _redux.emitter.on(`CREATE_REDIRECT`, () => {
    debouncedWriteRedirects();
  });
};

exports.startRedirectListener = startRedirectListener;
//# sourceMappingURL=redirects-writer.js.map
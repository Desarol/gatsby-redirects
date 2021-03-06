"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.buildProductionBundle = void 0;

var _webpack = _interopRequireDefault(require("webpack"));

var _lodash = require("lodash");

var _flatMap = _interopRequireDefault(require("lodash/flatMap"));

var _webpack2 = _interopRequireDefault(require("../utils/webpack.config"));

var _redux = require("../redux");

var _mapTemplatesToStaticQueryHashes = _interopRequireDefault(require("../utils/map-templates-to-static-query-hashes"));

var _webpackErrorUtils = require("../utils/webpack-error-utils");

const buildProductionBundle = async (program, parentSpan) => {
  const {
    directory
  } = program;
  const compilerConfig = await (0, _webpack2.default)(program, directory, `build-javascript`, null, {
    parentSpan
  });
  return new Promise((resolve, reject) => {
    const compiler = (0, _webpack.default)(compilerConfig);
    compiler.hooks.compilation.tap(`webpack-dep-tree-plugin`, compilation => {
      // "compilation" callback gets called for child compilers.
      // We only want to attach "seal" hook on main compilation
      // so we ignore compilations that have parent.
      // (mini-css-extract-plugin is one example of child compilations)
      const compilationCompiler = compilation.compiler;

      if (compilationCompiler.parentCompilation) {
        return;
      }

      compilation.hooks.seal.tap(`webpack-dep-tree-plugin`, () => {
        const state = _redux.store.getState();

        const mapOfTemplatesToStaticQueryHashes = (0, _mapTemplatesToStaticQueryHashes.default)(state, compilation);
        mapOfTemplatesToStaticQueryHashes.forEach((staticQueryHashes, componentPath) => {
          if (!(0, _lodash.isEqual)(state.staticQueriesByTemplate.get(componentPath), staticQueryHashes)) {
            var _state$components$get, _state$components$get2;

            _redux.store.dispatch({
              type: `ADD_PENDING_TEMPLATE_DATA_WRITE`,
              payload: {
                componentPath,
                pages: (_state$components$get = (_state$components$get2 = state.components.get(componentPath)) === null || _state$components$get2 === void 0 ? void 0 : _state$components$get2.pages) !== null && _state$components$get !== void 0 ? _state$components$get : []
              }
            });

            _redux.store.dispatch({
              type: `SET_STATIC_QUERIES_BY_TEMPLATE`,
              payload: {
                componentPath,
                staticQueryHashes
              }
            });
          }
        });
      });
    });
    compiler.run((err, stats) => {
      if (err) {
        return reject(err);
      }

      (0, _webpackErrorUtils.reportWebpackWarnings)(stats);

      if (stats.hasErrors()) {
        const flattenStatsErrors = stats => [...stats.compilation.errors, ...(0, _flatMap.default)(stats.compilation.children, child => flattenStatsErrors(child.getStats()))];

        return reject(flattenStatsErrors(stats));
      }

      return resolve(stats);
    });
  });
};

exports.buildProductionBundle = buildProductionBundle;
//# sourceMappingURL=build-javascript.js.map
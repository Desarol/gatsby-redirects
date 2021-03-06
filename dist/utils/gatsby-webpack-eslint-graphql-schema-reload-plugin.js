"use strict";

exports.__esModule = true;
exports.GatsbyWebpackEslintGraphqlSchemaReload = void 0;

var _redux = require("../redux");

var _eslintConfig = require("./eslint-config");

var _localEslintConfigFinder = require("./local-eslint-config-finder");

var _webpackUtils = require("./webpack-utils");

/**
 * The problem: after GraphQL schema rebuilds, eslint loader keeps validating against
 * the old schema.
 *
 * This plugin replaces options of eslint-plugin-graphql during develop
 */
function isEslintRule(rule) {
  var _rule$use, _rule$use$;

  const options = rule === null || rule === void 0 ? void 0 : (_rule$use = rule.use) === null || _rule$use === void 0 ? void 0 : (_rule$use$ = _rule$use[0]) === null || _rule$use$ === void 0 ? void 0 : _rule$use$.options;
  return options && typeof options.useEslintrc !== `undefined`;
}

class GatsbyWebpackEslintGraphqlSchemaReload {
  constructor() {
    this.plugin = {
      name: `GatsbyWebpackEslintGraphqlSchemaReload`
    };
    this.schema = null;
  }

  findEslintOptions(compiler) {
    var _compiler$options$mod, _compiler$options$mod2;

    const rules = (_compiler$options$mod = compiler.options.module) === null || _compiler$options$mod === void 0 ? void 0 : (_compiler$options$mod2 = _compiler$options$mod.rules.find(isEslintRule)) === null || _compiler$options$mod2 === void 0 ? void 0 : _compiler$options$mod2.use;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    return typeof rule === `object` ? rule === null || rule === void 0 ? void 0 : rule.options : undefined;
  }

  apply(compiler) {
    compiler.hooks.compile.tap(this.plugin.name, () => {
      const {
        schema,
        program
      } = _redux.store.getState();

      if (!this.schema) {
        // initial build
        this.schema = schema;
        return;
      }

      if (this.schema === schema || (0, _localEslintConfigFinder.hasLocalEslint)(program.directory)) {
        return;
      }

      this.schema = schema; // Original eslint config object from webpack rules

      const options = this.findEslintOptions(compiler);

      if (!options) {
        return;
      } // Hackish but works:
      // replacing original eslint options object with updated config


      Object.assign(options, (0, _eslintConfig.eslintConfig)(schema, (0, _webpackUtils.reactHasJsxRuntime)()));
    });
  }

}

exports.GatsbyWebpackEslintGraphqlSchemaReload = GatsbyWebpackEslintGraphqlSchemaReload;
//# sourceMappingURL=gatsby-webpack-eslint-graphql-schema-reload-plugin.js.map
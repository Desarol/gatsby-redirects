"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.setSiteConfig = exports.removeStaleJob = exports.clearDirtyQueriesListToEmitViaWebsocket = exports.queryStart = exports.pageQueryRun = exports.setProgramStatus = exports.queryExtractionBabelError = exports.queryExtractedBabelSuccess = exports.queryExtractionGraphQLError = exports.setGraphQLDefinitions = exports.queryExtracted = exports.replaceStaticQuery = exports.apiFinished = exports.replaceComponentQuery = exports.deleteComponentsDependencies = exports.createPageDependency = void 0;

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _joi = require("../../joi-schemas/joi");

var _didYouMean = require("../../utils/did-you-mean");

/**
 * Create a dependency between a page and data. Probably for
 * internal use only.
 * @private
 */
const createPageDependency = ({
  path,
  nodeId,
  connection
}, plugin = ``) => {
  return {
    type: `CREATE_COMPONENT_DEPENDENCY`,
    plugin,
    payload: {
      path,
      nodeId,
      connection
    }
  };
};
/**
 * Delete dependencies between an array of pages and data. Probably for
 * internal use only. Used when deleting pages.
 * @private
 */


exports.createPageDependency = createPageDependency;

const deleteComponentsDependencies = paths => {
  return {
    type: `DELETE_COMPONENTS_DEPENDENCIES`,
    payload: {
      paths
    }
  };
};
/**
 * When the query watcher extracts a GraphQL query, it calls
 * this to store the query with its component.
 * @private
 */


exports.deleteComponentsDependencies = deleteComponentsDependencies;

const replaceComponentQuery = ({
  query,
  componentPath
}) => {
  return {
    type: `REPLACE_COMPONENT_QUERY`,
    payload: {
      query,
      componentPath
    }
  };
};

exports.replaceComponentQuery = replaceComponentQuery;

const apiFinished = payload => {
  return {
    type: `API_FINISHED`,
    payload
  };
};
/**
 * When the query watcher extracts a "static" GraphQL query from <StaticQuery>
 * components, it calls this to store the query with its component.
 * @private
 */


exports.apiFinished = apiFinished;

const replaceStaticQuery = (args, plugin = null) => {
  return {
    type: `REPLACE_STATIC_QUERY`,
    plugin,
    payload: args
  };
};
/**
 *
 * Report that a query has been extracted from a component. Used by
 * query-compiler.js.
 * @private
 */


exports.replaceStaticQuery = replaceStaticQuery;

const queryExtracted = ({
  componentPath,
  query
}, plugin, traceId) => {
  return {
    type: `QUERY_EXTRACTED`,
    plugin,
    traceId,
    payload: {
      componentPath,
      query
    }
  };
};
/**
 * Set Definitions for fragment extraction, etc.
 *
 * Used by developer tools such as vscode-graphql & graphiql
 *
 * query-compiler.js.
 * @private
 */


exports.queryExtracted = queryExtracted;

const setGraphQLDefinitions = definitionsByName => {
  return {
    type: `SET_GRAPHQL_DEFINITIONS`,
    payload: definitionsByName
  };
};
/**
 *
 * Report that the Relay Compiler found a graphql error when attempting to extract a query
 * @private
 */


exports.setGraphQLDefinitions = setGraphQLDefinitions;

const queryExtractionGraphQLError = ({
  componentPath,
  error
}, plugin, traceId) => {
  return {
    type: `QUERY_EXTRACTION_GRAPHQL_ERROR`,
    plugin,
    traceId,
    payload: {
      componentPath,
      error
    }
  };
};
/**
 *
 * Report that babel was able to extract the graphql query.
 * Indicates that the file is free of JS errors.
 * @private
 */


exports.queryExtractionGraphQLError = queryExtractionGraphQLError;

const queryExtractedBabelSuccess = ({
  componentPath
}, plugin, traceId) => {
  return {
    type: `QUERY_EXTRACTION_BABEL_SUCCESS`,
    plugin,
    traceId,
    payload: {
      componentPath
    }
  };
};
/**
 *
 * Report that the Relay Compiler found a babel error when attempting to extract a query
 * @private
 */


exports.queryExtractedBabelSuccess = queryExtractedBabelSuccess;

const queryExtractionBabelError = ({
  componentPath,
  error
}, plugin, traceId) => {
  return {
    type: `QUERY_EXTRACTION_BABEL_ERROR`,
    plugin,
    traceId,
    payload: {
      componentPath,
      error
    }
  };
};
/**
 * Set overall program status e.g. `BOOTSTRAPING` or `BOOTSTRAP_FINISHED`.
 * @private
 */


exports.queryExtractionBabelError = queryExtractionBabelError;

const setProgramStatus = (status, plugin, traceId) => {
  return {
    type: `SET_PROGRAM_STATUS`,
    plugin,
    traceId,
    payload: status
  };
};
/**
 * Broadcast that a page's query was run.
 * @private
 */


exports.setProgramStatus = setProgramStatus;

const pageQueryRun = ({
  path,
  componentPath,
  isPage
}, plugin, traceId) => {
  return {
    type: `PAGE_QUERY_RUN`,
    plugin,
    traceId,
    payload: {
      path,
      componentPath,
      isPage
    }
  };
};

exports.pageQueryRun = pageQueryRun;

const queryStart = ({
  path,
  componentPath,
  isPage
}, plugin, traceId) => {
  return {
    type: `QUERY_START`,
    plugin,
    traceId,
    payload: {
      path,
      componentPath,
      isPage
    }
  };
};

exports.queryStart = queryStart;

const clearDirtyQueriesListToEmitViaWebsocket = () => {
  return {
    type: `QUERY_CLEAR_DIRTY_QUERIES_LIST_TO_EMIT_VIA_WEBSOCKET`
  };
};
/**
 * Remove jobs which are marked as stale (inputPath doesn't exists)
 * @private
 */


exports.clearDirtyQueriesListToEmitViaWebsocket = clearDirtyQueriesListToEmitViaWebsocket;

const removeStaleJob = (contentDigest, plugin, traceId) => {
  return {
    type: `REMOVE_STALE_JOB_V2`,
    plugin,
    traceId,
    payload: {
      contentDigest
    }
  };
};
/**
 * Set gatsby config
 * @private
 */


exports.removeStaleJob = removeStaleJob;

const setSiteConfig = config => {
  const result = _joi.gatsbyConfigSchema.validate(config || {});

  const normalizedPayload = result.value;

  if (result.error) {
    const hasUnknownKeys = result.error.details.filter(details => details.type === `object.allowUnknown`);

    if (Array.isArray(hasUnknownKeys) && hasUnknownKeys.length) {
      const errorMessages = hasUnknownKeys.map(unknown => {
        const {
          context,
          message
        } = unknown;
        const key = context === null || context === void 0 ? void 0 : context.key;
        const suggestion = key && (0, _didYouMean.didYouMean)(key);

        if (suggestion) {
          return `${message}. ${suggestion}`;
        }

        return message;
      });

      _reporter.default.panic({
        id: `10122`,
        context: {
          sourceMessage: errorMessages.join(`\n`)
        }
      });
    }

    _reporter.default.panic({
      id: `10122`,
      context: {
        sourceMessage: result.error.message
      }
    });
  }

  return {
    type: `SET_SITE_CONFIG`,
    payload: normalizedPayload
  };
};

exports.setSiteConfig = setSiteConfig;
//# sourceMappingURL=internal.js.map
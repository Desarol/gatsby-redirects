"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.createPages = createPages;

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _apiRunnerNode = _interopRequireDefault(require("../utils/api-runner-node"));

var _assertStore = require("../utils/assert-store");

var _actions = require("../redux/actions");

var _changedPages = require("../utils/changed-pages");

async function createPages({
  parentSpan,
  gatsbyNodeGraphQLFunction,
  store,
  deferNodeMutation
}) {
  var _store$getState$nodes, _store$getState$nodes2;

  (0, _assertStore.assertStore)(store);

  const activity = _reporter.default.activityTimer(`createPages`, {
    parentSpan
  });

  activity.start();
  const timestamp = Date.now();
  const currentPages = new Map(store.getState().pages);
  await (0, _apiRunnerNode.default)(`createPages`, {
    graphql: gatsbyNodeGraphQLFunction,
    traceId: `initial-createPages`,
    waitForCascadingActions: true,
    parentSpan: activity.span,
    deferNodeMutation
  }, {
    activity
  });

  _reporter.default.info(`Total nodes: ${store.getState().nodes.size}, SitePage nodes: ${(_store$getState$nodes = store.getState().nodesByType) === null || _store$getState$nodes === void 0 ? void 0 : (_store$getState$nodes2 = _store$getState$nodes.get(`SitePage`)) === null || _store$getState$nodes2 === void 0 ? void 0 : _store$getState$nodes2.size} (use --verbose for breakdown)`);

  if (process.env.gatsby_log_level === `verbose`) {
    _reporter.default.verbose(`Number of node types: ${store.getState().nodesByType.size}. Nodes per type: ${[...store.getState().nodesByType.entries()].map(([type, nodes]) => type + `: ` + nodes.size).join(`, `)}`);
  }

  activity.end();

  _reporter.default.verbose(`Checking for deleted pages`);

  const deletedPages = (0, _changedPages.deleteUntouchedPages)(store.getState().pages, timestamp);

  _reporter.default.verbose(`Deleted ${deletedPages.length} page${deletedPages.length === 1 ? `` : `s`}`);

  const tim = _reporter.default.activityTimer(`Checking for changed pages`);

  tim.start();
  const {
    changedPages
  } = (0, _changedPages.findChangedPages)(currentPages, store.getState().pages);

  _reporter.default.verbose(`Found ${changedPages.length} changed page${changedPages.length === 1 ? `` : `s`}`);

  tim.end();

  _actions.boundActionCreators.apiFinished({
    apiName: `createPages`
  });

  return {
    changedPages,
    deletedPages
  };
}
//# sourceMappingURL=create-pages.js.map
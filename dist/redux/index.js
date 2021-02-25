"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.saveState = exports.store = exports.configureStore = exports.readState = exports.emitter = void 0;

var _redux = require("redux");

var _gatsbyTelemetry = _interopRequireDefault(require("gatsby-telemetry"));

var _mett = require("../utils/mett");

var _reduxThunk = _interopRequireDefault(require("redux-thunk"));

var reducers = _interopRequireWildcard(require("./reducers"));

var _persist = require("./persist");

// Create event emitter for actions
const emitter = (0, _mett.mett)(); // Read old node data from cache.

exports.emitter = emitter;

const readState = () => {
  try {
    const state = (0, _persist.readFromCache)();

    if (state.nodes) {
      // re-create nodesByType
      state.nodesByType = new Map();
      state.nodes.forEach(node => {
        const {
          type
        } = node.internal;

        if (!state.nodesByType.has(type)) {
          state.nodesByType.set(type, new Map());
        } // The `.has` and `.set` calls above make this safe
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion


        state.nodesByType.get(type).set(node.id, node);
      });
    } // jsonDataPaths was removed in the per-page-manifest
    // changes. Explicitly delete it here to cover case where user
    // runs gatsby the first time after upgrading.


    delete state[`jsonDataPaths`];

    _gatsbyTelemetry.default.decorateEvent(`BUILD_END`, {
      cacheStatus: `WARM`
    });

    _gatsbyTelemetry.default.decorateEvent(`DEVELOP_STOP`, {
      cacheStatus: `WARM`
    });

    return state;
  } catch (e) {// ignore errors.
  } // BUG: Would this not cause downstream bugs? seems likely. Why wouldn't we just
  // throw and kill the program?


  _gatsbyTelemetry.default.decorateEvent(`BUILD_END`, {
    cacheStatus: `COLD`
  });

  _gatsbyTelemetry.default.decorateEvent(`DEVELOP_STOP`, {
    cacheStatus: `COLD`
  });

  return {};
};

exports.readState = readState;

/**
 * Redux middleware handling array of actions
 */
const multi = ({
  dispatch
}) => next => action => Array.isArray(action) ? action.filter(Boolean).map(dispatch) : next(action); // We're using the inferred type here becauise manually typing it would be very complicated
// and error-prone. Instead we'll make use of the createStore return value, and export that type.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type


const configureStore = initialState => (0, _redux.createStore)((0, _redux.combineReducers)({ ...reducers
}), initialState, (0, _redux.applyMiddleware)(_reduxThunk.default, multi));

exports.configureStore = configureStore;
const store = configureStore(readState()); // Persist state.

exports.store = store;

const saveState = () => {
  if (process.env.GATSBY_DISABLE_CACHE_PERSISTENCE) {
    // do not persist cache if above env var is set.
    // this is to temporarily unblock builds that hit the v8.serialize related
    // Node.js buffer size exceeding kMaxLength fatal crashes
    return undefined;
  }

  const state = store.getState();
  return (0, _persist.writeToCache)({
    nodes: state.nodes,
    status: state.status,
    components: state.components,
    jobsV2: state.jobsV2,
    staticQueryComponents: state.staticQueryComponents,
    webpackCompilationHash: state.webpackCompilationHash,
    pageDataStats: state.pageDataStats,
    pageData: state.pageData,
    pendingPageDataWrites: state.pendingPageDataWrites,
    staticQueriesByTemplate: state.staticQueriesByTemplate,
    queries: state.queries
  });
};

exports.saveState = saveState;
store.subscribe(() => {
  const lastAction = store.getState().lastAction;
  emitter.emit(lastAction.type, lastAction);
});
//# sourceMappingURL=index.js.map
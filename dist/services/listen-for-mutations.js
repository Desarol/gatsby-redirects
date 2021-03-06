"use strict";

exports.__esModule = true;
exports.listenForMutations = void 0;

var _redux = require("../redux");

const listenForMutations = callback => {
  const emitMutation = event => {
    callback({
      type: `ADD_NODE_MUTATION`,
      payload: event
    });
  };

  const emitSourceChange = event => {
    callback({
      type: `SOURCE_FILE_CHANGED`,
      payload: event
    });
  };

  const emitWebhook = event => {
    callback({
      type: `WEBHOOK_RECEIVED`,
      payload: event
    });
  };

  const emitQueryRunRequest = event => {
    callback({
      type: `QUERY_RUN_REQUESTED`,
      payload: event
    });
  };

  _redux.emitter.on(`ENQUEUE_NODE_MUTATION`, emitMutation);

  _redux.emitter.on(`WEBHOOK_RECEIVED`, emitWebhook);

  _redux.emitter.on(`SOURCE_FILE_CHANGED`, emitSourceChange);

  _redux.emitter.on(`QUERY_RUN_REQUESTED`, emitQueryRunRequest);

  return function unsubscribeFromMutationListening() {
    _redux.emitter.off(`ENQUEUE_NODE_MUTATION`, emitMutation);

    _redux.emitter.off(`WEBHOOK_RECEIVED`, emitWebhook);

    _redux.emitter.off(`SOURCE_FILE_CHANGED`, emitSourceChange);

    _redux.emitter.off(`QUERY_RUN_REQUESTED`, emitQueryRunRequest);
  };
};

exports.listenForMutations = listenForMutations;
//# sourceMappingURL=listen-for-mutations.js.map
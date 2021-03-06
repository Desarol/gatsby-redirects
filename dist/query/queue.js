"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.createAppropriateQueue = exports.processBatch = exports.createDevelopQueue = exports.createBuildQueue = void 0;

var _betterQueue = _interopRequireDefault(require("better-queue"));

var _redux = require("../redux");

var _betterQueueCustomStore = require("../query/better-queue-custom-store");

var _queryRunner = require("../query/query-runner");

var _websocketManager = require("../utils/websocket-manager");

var _graphqlRunner = require("./graphql-runner");

if (process.env.GATSBY_EXPERIMENTAL_QUERY_CONCURRENCY) {
  console.info(`GATSBY_EXPERIMENTAL_QUERY_CONCURRENCY: Running with concurrency set to \`${process.env.GATSBY_EXPERIMENTAL_QUERY_CONCURRENCY}\``);
}

const createBaseOptions = () => {
  return {
    concurrent: Number(process.env.GATSBY_EXPERIMENTAL_QUERY_CONCURRENCY) || 4,
    store: (0, _betterQueueCustomStore.memoryStoreWithPriorityBuckets)()
  };
};

const createBuildQueue = (graphqlRunner, runnerOptions = {}) => {
  if (!graphqlRunner) {
    graphqlRunner = new _graphqlRunner.GraphQLRunner(_redux.store, runnerOptions);
  }

  const queueOptions = { ...createBaseOptions(),

    async process({
      job,
      activity
    }, callback) {
      try {
        const result = await (0, _queryRunner.queryRunner)(graphqlRunner, job, activity === null || activity === void 0 ? void 0 : activity.span);
        callback(null, result);
      } catch (e) {
        callback(e);
      }
    }

  };
  return new _betterQueue.default(queueOptions);
};

exports.createBuildQueue = createBuildQueue;

const createDevelopQueue = getRunner => {
  const queueOptions = { ...createBaseOptions(),
    priority: ({
      job
    }, cb) => {
      if (job.id && _websocketManager.websocketManager.activePaths.has(job.id)) {
        cb(null, 10);
      } else {
        cb(null, 1);
      }
    },
    merge: (_oldTask, newTask, cb) => {
      cb(null, newTask);
    },

    async process({
      job: queryJob,
      activity
    }, callback) {
      try {
        const result = await (0, _queryRunner.queryRunner)(getRunner(), queryJob, activity === null || activity === void 0 ? void 0 : activity.span);

        if (!queryJob.isPage) {
          _websocketManager.websocketManager.emitStaticQueryData({
            result,
            id: queryJob.hash
          });
        }

        callback(null, result);
      } catch (e) {
        callback(e);
      }
    }

  };
  return new _betterQueue.default(queueOptions);
};

exports.createDevelopQueue = createDevelopQueue;

const createAppropriateQueue = (graphqlRunner, runnerOptions = {}) => {
  if (process.env.NODE_ENV === `production`) {
    return createBuildQueue(graphqlRunner, runnerOptions);
  }

  if (!graphqlRunner) {
    graphqlRunner = new _graphqlRunner.GraphQLRunner(_redux.store, runnerOptions);
  }

  return createDevelopQueue(() => graphqlRunner);
};
/**
 * Returns a promise that pushes jobs onto queue and resolves onces
 * they're all finished processing (or rejects if one or more jobs
 * fail)
 * Note: queue is reused in develop so make sure to thoroughly cleanup hooks
 */


exports.createAppropriateQueue = createAppropriateQueue;

const processBatch = async (queue, jobs, activity) => {
  if (jobs.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let taskFinishCallback;

    const gc = () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      queue.off(`task_failed`, taskFailedCallback); // eslint-disable-next-line @typescript-eslint/no-use-before-define

      queue.off(`drain`, drainCallback);

      if (taskFinishCallback) {
        queue.off(`task_finish`, taskFinishCallback);
      } // We don't want to allow the variable to be null any other time,
      // just when marking it as eligible for garbage collection.
      // @ts-ignore


      queue = null;
    };

    if (activity.tick) {
      taskFinishCallback = () => activity.tick();

      queue.on(`task_finish`, taskFinishCallback);
    }

    const taskFailedCallback = (...err) => {
      gc();
      reject(err);
    };

    const drainCallback = () => {
      gc();
      resolve();
    };

    queue // Note: the first arg is the path, the second the error
    .on(`task_failed`, taskFailedCallback) // Note: `drain` fires when all tasks _finish_
    //       `empty` fires when queue is empty (but tasks are still running)
    .on(`drain`, drainCallback);
    jobs.forEach(job => queue.push({
      job,
      activity
    }));
  });
};

exports.processBatch = processBatch;
//# sourceMappingURL=queue.js.map
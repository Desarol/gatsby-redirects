"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.renderDevHTML = exports.restartWorker = exports.initDevWorkerPool = void 0;

var _jestWorker = _interopRequireDefault(require("jest-worker"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _gatsbyCoreUtils = require("gatsby-core-utils");

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _requiresWriter = require("../../bootstrap/requires-writer");

var _findPageByPath = require("../find-page-by-path");

var _getPageData = require("../get-page-data");

var _buildHtml = require("../../commands/build-html");

var _redux = require("../../redux");

const startWorker = () => {
  const newWorker = new _jestWorker.default(require.resolve(`./render-dev-html-child`), {
    exposedMethods: [`renderHTML`, `deleteModuleCache`, `warmup`],
    numWorkers: 1,
    forkOptions: {
      silent: false,
      env: { ...process.env,
        NODE_ENV: (0, _gatsbyCoreUtils.isCI)() ? `production` : `development`,
        forceColors: true,
        GATSBY_EXPERIMENTAL_DEV_SSR: true
      }
    }
  }); // jest-worker is lazy with forking but we want to fork immediately so the user
  // doesn't have to wait.
  // @ts-ignore

  newWorker.warmup();
  return newWorker;
};

let worker;

const initDevWorkerPool = () => {
  worker = startWorker();
};

exports.initDevWorkerPool = initDevWorkerPool;
let changeCount = 0;

const restartWorker = htmlComponentRendererPath => {
  changeCount += 1; // Forking is expensive — each time we re-require the outputted webpack
  // file, memory grows ~10 mb — 25 regenerations means ~250mb which seems
  // like an accepatable amount of memory to grow before we reclaim it
  // by rebooting the worker process.

  if (changeCount > 25) {
    const oldWorker = worker;
    const newWorker = startWorker();
    worker = newWorker;
    oldWorker.end();
    changeCount = 0;
  } else {
    worker.deleteModuleCache(htmlComponentRendererPath);
  }
};

exports.restartWorker = restartWorker;

const searchFileForString = (substring, filePath) => new Promise(resolve => {
  // See if the chunk is in the newComponents array (not the notVisited).
  const chunkRegex = RegExp(`exports.ssrComponents.*${substring}.*}`, `gs`);

  const stream = _fsExtra.default.createReadStream(filePath);

  let found = false;
  stream.on(`data`, function (d) {
    if (chunkRegex.test(d.toString())) {
      found = true;
      stream.close();
      resolve(found);
    }
  });
  stream.on(`error`, function () {
    resolve(found);
  });
  stream.on(`close`, function () {
    resolve(found);
  });
});

const ensurePathComponentInSSRBundle = async (page, directory) => {
  // This shouldn't happen.
  if (!page) {
    _reporter.default.panic(`page not found`, page);
  } // Now check if it's written to public/render-page.js


  const htmlComponentRendererPath = (0, _gatsbyCoreUtils.joinPath)(directory, `public/render-page.js`); // This search takes 1-10ms
  // We do it as there can be a race conditions where two pages
  // are requested at the same time which means that both are told render-page.js
  // has changed when the first page is complete meaning the second
  // page's component won't be in the render meaning its SSR will fail.

  let found = await searchFileForString(page.componentChunkName, htmlComponentRendererPath);

  if (!found) {
    await new Promise(resolve => {
      let readAttempts = 0;
      const searchForStringInterval = setInterval(async () => {
        readAttempts += 1;
        found = await searchFileForString(page.componentChunkName, htmlComponentRendererPath);

        if (found || readAttempts > 5) {
          clearInterval(searchForStringInterval);
          resolve();
        }
      }, 300);
    });
  }

  return found;
};

const renderDevHTML = ({
  path,
  page,
  skipSsr = false,
  store,
  htmlComponentRendererPath,
  directory
}) => new Promise(async (resolve, reject) => {
  (0, _requiresWriter.startListener)();
  let pageObj;

  if (!page) {
    pageObj = (0, _findPageByPath.findPageByPath)(store.getState(), path);
  } else {
    pageObj = page;
  }

  let isClientOnlyPage = false;

  if (pageObj.matchPath) {
    isClientOnlyPage = true;
  }

  const {
    boundActionCreators
  } = require(`../../redux/actions`);

  const {
    createServerVisitedPage
  } = boundActionCreators; // Record this page was requested. This will kick off adding its page
  // component to the ssr bundle (if that's not already happened)

  createServerVisitedPage(pageObj.componentChunkName); // Ensure the query has been run and written out.

  try {
    await (0, _getPageData.getPageData)(pageObj.path);
  } catch {
    // If we can't get the page, it was probably deleted recently
    // so let's just do a 404 page.
    return reject(`404 page`);
  } // Resume the webpack watcher and wait for any compilation necessary to happen.
  // We timeout after 1.5s as the user might not care per se about SSR.
  //
  // We pause and resume so there's no excess webpack activity during normal development.


  const {
    devssrWebpackCompiler,
    devssrWebpackWatcher,
    needToRecompileSSRBundle
  } = (0, _buildHtml.getDevSSRWebpack)();

  if (devssrWebpackWatcher && devssrWebpackCompiler && needToRecompileSSRBundle) {
    let isResolved = false;
    await new Promise(resolve => {
      function finish(stats) {
        _redux.emitter.off(`DEV_SSR_COMPILATION_DONE`, finish);

        if (!isResolved) {
          resolve(stats);
        }
      }

      _redux.emitter.on(`DEV_SSR_COMPILATION_DONE`, finish);

      devssrWebpackWatcher.resume(); // Suspending is just a flag, so it's safe to re-suspend right away

      devssrWebpackWatcher.suspend(); // Timeout after 1.5s.

      setTimeout(() => {
        isResolved = true;
        resolve();
      }, 1500);
    });
  } // Wait for public/render-page.js to update w/ the page component.


  const found = await ensurePathComponentInSSRBundle(pageObj, directory); // If we can't find the page, just force set isClientOnlyPage
  // which skips rendering the body (so we just serve a shell)
  // and the page will render normally on the client.
  //
  // This only happens on the first time we try to render a page component
  // and it's taking a while to bundle its page component.

  if (!found) {
    isClientOnlyPage = true;
  } // If the user added the query string `skip-ssr`, we always just render an empty shell.


  if (skipSsr) {
    isClientOnlyPage = true;
  }

  try {
    const htmlString = await worker.renderHTML({
      path,
      componentPath: pageObj.component,
      htmlComponentRendererPath,
      directory,
      isClientOnlyPage
    });
    return resolve(htmlString);
  } catch (error) {
    return reject(error);
  }
});

exports.renderDevHTML = renderDevHTML;
//# sourceMappingURL=render-dev-html.js.map
"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.initialize = initialize;

var _lodash = _interopRequireDefault(require("lodash"));

var _gatsbyCoreUtils = require("gatsby-core-utils");

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _md5File = _interopRequireDefault(require("md5-file"));

var _crypto = _interopRequireDefault(require("crypto"));

var _del = _interopRequireDefault(require("del"));

var _path = _interopRequireDefault(require("path"));

var _gatsbyTelemetry = _interopRequireDefault(require("gatsby-telemetry"));

var _apiRunnerNode = _interopRequireDefault(require("../utils/api-runner-node"));

var _handleFlags = _interopRequireDefault(require("../utils/handle-flags"));

var _browserslist = require("../utils/browserslist");

var _preferDefault = require("../bootstrap/prefer-default");

var WorkerPool = _interopRequireWildcard(require("../utils/worker/pool"));

var _pluginRunner = require("../redux/plugin-runner");

var _loadPlugins = require("../bootstrap/load-plugins");

var _redux = require("../redux");

var _loadThemes = _interopRequireDefault(require("../bootstrap/load-themes"));

var _reporter = _interopRequireDefault(require("gatsby-cli/lib/reporter"));

var _getReactHotLoaderStrategy = require("../utils/get-react-hot-loader-strategy");

var _getConfigFile = require("../bootstrap/get-config-file");

var _removeStaleJobs = require("../bootstrap/remove-stale-jobs");

var _actions = require("../redux/actions");

var _flags = _interopRequireDefault(require("../utils/flags"));

// If the env variable GATSBY_EXPERIMENTAL_FAST_DEV is set, enable
// all DEV experimental changes (but only during development & not on CI).
if (process.env.gatsby_executing_command === `develop` && process.env.GATSBY_EXPERIMENTAL_FAST_DEV && !(0, _gatsbyCoreUtils.isCI)()) {
  process.env.GATSBY_EXPERIMENTAL_DEV_SSR = `true`;
  process.env.PRESERVE_FILE_DOWNLOAD_CACHE = `true`;
  process.env.PRESERVE_WEBPACK_CACHE = `true`;

  _reporter.default.info(`
Three fast dev experiments are enabled: Development SSR, preserving file download cache and preserving webpack cache.

Please give feedback on their respective umbrella issues!

- https://gatsby.dev/dev-ssr-feedback
- https://gatsby.dev/cache-clearing-feedback
  `);

  _gatsbyTelemetry.default.trackFeatureIsUsed(`FastDev`);
} // Show stack trace on unhandled promises.


process.on(`unhandledRejection`, reason => {
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/33636
  _reporter.default.panic(reason || `Unhandled rejection`);
}); // Override console.log to add the source file + line number.
// Useful for debugging if you lose a console.log somewhere.
// Otherwise leave commented out.
// require(`../bootstrap/log-line-function`)

async function initialize({
  program: args,
  parentSpan
}) {
  if (process.env.GATSBY_DISABLE_CACHE_PERSISTENCE) {
    _reporter.default.info(`GATSBY_DISABLE_CACHE_PERSISTENCE is enabled. Cache won't be persisted. Next builds will not be able to reuse any work done by current session.`);

    _gatsbyTelemetry.default.trackFeatureIsUsed(`DisableCachePersistence`);
  }

  if (!args) {
    _reporter.default.panic(`Missing program args`);
  }
  /* Time for a little story...
   * When running `gatsby develop`, the globally installed gatsby-cli starts
   * and sets up a Redux store (which is where logs are now stored). When gatsby
   * finds your project's locally installed gatsby-cli package in node_modules,
   * it switches over. This instance will have a separate redux store. We need to
   * ensure that the correct store is used which is why we call setStore
   * (/packages/gatsby-cli/src/reporter/redux/index.js)
   *
   * This function
   * - copies over the logs from the global gatsby-cli to the local one
   * - sets the store to the local one (so that further actions dispatched by
   * the global gatsby-cli are handled by the local one)
   */


  if (args.setStore) {
    args.setStore(_redux.store);
  } // Start plugin runner which listens to the store
  // and invokes Gatsby API based on actions.


  (0, _pluginRunner.startPluginRunner)();
  const directory = (0, _gatsbyCoreUtils.slash)(args.directory);
  const program = { ...args,
    browserslist: (0, _browserslist.getBrowsersList)(directory),
    // Fix program directory path for windows env.
    directory
  };

  _redux.store.dispatch({
    type: `SET_PROGRAM`,
    payload: program
  });

  let activityForJobs;

  _redux.emitter.on(`CREATE_JOB`, () => {
    if (!activityForJobs) {
      activityForJobs = _reporter.default.phantomActivity(`Running jobs`);
      activityForJobs.start();
    }
  });

  const onEndJob = () => {
    if (activityForJobs && _redux.store.getState().jobs.active.length === 0) {
      activityForJobs.end();
      activityForJobs = null;
    }
  };

  _redux.emitter.on(`END_JOB`, onEndJob); // Try opening the site's gatsby-config.js file.


  let activity = _reporter.default.activityTimer(`open and validate gatsby-configs`, {
    parentSpan
  });

  activity.start();
  const {
    configModule,
    configFilePath
  } = await (0, _getConfigFile.getConfigFile)(program.directory, `gatsby-config`);
  let config = (0, _preferDefault.preferDefault)(configModule); // The root config cannot be exported as a function, only theme configs

  if (typeof config === `function`) {
    _reporter.default.panic({
      id: `10126`,
      context: {
        configName: `gatsby-config`,
        path: program.directory
      }
    });
  } // Setup flags


  if (config) {
    var _config$flags;

    // TODO: this should be handled in FAST_REFRESH configuration and not be one-off here.
    if (((_config$flags = config.flags) === null || _config$flags === void 0 ? void 0 : _config$flags.FAST_REFRESH) && process.env.GATSBY_HOT_LOADER && process.env.GATSBY_HOT_LOADER !== `fast-refresh`) {
      delete config.flags.FAST_REFRESH;

      _reporter.default.warn(_reporter.default.stripIndent(`
          Both FAST_REFRESH gatsby-config flag and GATSBY_HOT_LOADER environment variable is used with conflicting setting ("${process.env.GATSBY_HOT_LOADER}").

          Will use react-hot-loader.

          To use Fast Refresh either do not use GATSBY_HOT_LOADER environment variable or set it to "fast-refresh".
        `));
    } // Get flags


    const {
      enabledConfigFlags,
      unknownFlagMessage,
      message
    } = (0, _handleFlags.default)(_flags.default, config.flags);

    if (unknownFlagMessage !== ``) {
      _reporter.default.warn(unknownFlagMessage);
    } //  set process.env for each flag


    enabledConfigFlags.forEach(flag => {
      process.env[flag.env] = `true`;
    }); // Print out message.

    if (message !== ``) {
      _reporter.default.info(message);
    } //  track usage of feature


    enabledConfigFlags.forEach(flag => {
      if (flag.telemetryId) {
        _gatsbyTelemetry.default.trackFeatureIsUsed(flag.telemetryId);
      }
    }); // Track the usage of config.flags

    if (config.flags) {
      _gatsbyTelemetry.default.trackFeatureIsUsed(`ConfigFlags`);
    }
  }

  process.env.GATSBY_HOT_LOADER = (0, _getReactHotLoaderStrategy.getReactHotLoaderStrategy)(); // TODO: figure out proper way of disabling loading indicator
  // for now GATSBY_QUERY_ON_DEMAND_LOADING_INDICATOR=false gatsby develop
  // will work, but we don't want to force users into using env vars

  if (process.env.GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND && !process.env.GATSBY_QUERY_ON_DEMAND_LOADING_INDICATOR) {
    // if query on demand is enabled and GATSBY_QUERY_ON_DEMAND_LOADING_INDICATOR was not set at all
    // enable loading indicator
    process.env.GATSBY_QUERY_ON_DEMAND_LOADING_INDICATOR = `true`;
  } // theme gatsby configs can be functions or objects


  if (config && config.__experimentalThemes) {
    _reporter.default.warn(`The gatsby-config key "__experimentalThemes" has been deprecated. Please use the "plugins" key instead.`);

    const themes = await (0, _loadThemes.default)(config, {
      useLegacyThemes: true,
      configFilePath,
      rootDir: program.directory
    });
    config = themes.config;

    _redux.store.dispatch({
      type: `SET_RESOLVED_THEMES`,
      payload: themes.themes
    });
  } else if (config) {
    const plugins = await (0, _loadThemes.default)(config, {
      useLegacyThemes: false,
      configFilePath,
      rootDir: program.directory
    });
    config = plugins.config;
  }

  if (config && config.polyfill) {
    _reporter.default.warn(`Support for custom Promise polyfills has been removed in Gatsby v2. We only support Babel 7's new automatic polyfilling behavior.`);
  }

  _redux.store.dispatch(_actions.internalActions.setSiteConfig(config));

  activity.end();

  if (process.env.GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND) {
    if (process.env.gatsby_executing_command !== `develop`) {
      // we don't want to ever have this flag enabled for anything than develop
      // in case someone have this env var globally set
      delete process.env.GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND;
    } else if ((0, _gatsbyCoreUtils.isCI)()) {
      delete process.env.GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND;

      _reporter.default.verbose(`Experimental Query on Demand feature is not available in CI environment. Continuing with eager query running.`);
    }
  } // run stale jobs


  _redux.store.dispatch((0, _removeStaleJobs.removeStaleJobs)(_redux.store.getState()));

  activity = _reporter.default.activityTimer(`load plugins`, {
    parentSpan
  });
  activity.start();
  const flattenedPlugins = await (0, _loadPlugins.loadPlugins)(config, program.directory);
  activity.end(); // Multiple occurrences of the same name-version-pair can occur,
  // so we report an array of unique pairs

  const pluginsStr = _lodash.default.uniq(flattenedPlugins.map(p => `${p.name}@${p.version}`));

  _gatsbyTelemetry.default.decorateEvent(`BUILD_END`, {
    plugins: pluginsStr
  });

  _gatsbyTelemetry.default.decorateEvent(`DEVELOP_STOP`, {
    plugins: pluginsStr
  }); // onPreInit


  activity = _reporter.default.activityTimer(`onPreInit`, {
    parentSpan
  });
  activity.start();
  await (0, _apiRunnerNode.default)(`onPreInit`, {
    parentSpan: activity.span
  });
  activity.end(); // During builds, delete html and css files from the public directory as we don't want
  // deleted pages and styles from previous builds to stick around.

  if (!process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES && process.env.NODE_ENV === `production`) {
    activity = _reporter.default.activityTimer(`delete html and css files from previous builds`, {
      parentSpan
    });
    activity.start();
    await (0, _del.default)([`public/**/*.{html,css}`, `!public/page-data/**/*`, `!public/static`, `!public/static/**/*.{html,css}`]);
    activity.end();
  }

  activity = _reporter.default.activityTimer(`initialize cache`, {
    parentSpan
  });
  activity.start(); // Check if any plugins have been updated since our last run. If so
  // we delete the cache is there's likely been changes
  // since the previous run.
  //
  // We do this by creating a hash of all the version numbers of installed
  // plugins, the site's package.json, gatsby-config.js, and gatsby-node.js.
  // The last, gatsby-node.js, is important as many gatsby sites put important
  // logic in there e.g. generating slugs for custom pages.

  const pluginVersions = flattenedPlugins.map(p => p.version);
  const hashes = await Promise.all([!!process.env.GATSBY_EXPERIMENTAL_PAGE_BUILD_ON_DATA_CHANGES, (0, _md5File.default)(`package.json`), (0, _md5File.default)(`${program.directory}/gatsby-config.js`).catch(() => {}), // ignore as this file isn't required),
  (0, _md5File.default)(`${program.directory}/gatsby-node.js`).catch(() => {}) // ignore as this file isn't required),
  ]);

  const pluginsHash = _crypto.default.createHash(`md5`).update(JSON.stringify(pluginVersions.concat(hashes))).digest(`hex`);

  const state = _redux.store.getState();

  const oldPluginsHash = state && state.status ? state.status.PLUGINS_HASH : ``; // Check if anything has changed. If it has, delete the site's .cache
  // directory and tell reducers to empty themselves.
  //
  // Also if the hash isn't there, then delete things just in case something
  // is weird.

  if (oldPluginsHash && pluginsHash !== oldPluginsHash) {
    _reporter.default.info(_reporter.default.stripIndent`
      One or more of your plugins have changed since the last time you ran Gatsby. As
      a precaution, we're deleting your site's cache to ensure there's no stale data.
    `);
  }

  const cacheDirectory = `${program.directory}/.cache`;
  const publicDirectory = `${program.directory}/public`; // .cache directory exists in develop at this point
  // so checking for .cache/json as a heuristic (could be any expected file)

  const cacheIsCorrupt = _fsExtra.default.existsSync(`${cacheDirectory}/json`) && !_fsExtra.default.existsSync(publicDirectory);

  if (cacheIsCorrupt) {
    _reporter.default.info(_reporter.default.stripIndent`
      We've detected that the Gatsby cache is incomplete (the .cache directory exists
      but the public directory does not). As a precaution, we're deleting your site's
      cache to ensure there's no stale data.
    `);
  }

  if (!oldPluginsHash || pluginsHash !== oldPluginsHash || cacheIsCorrupt) {
    try {
      // Comment out inviet until we can test perf impact
      //
      // let sourceFileSystemVersion = flattenedPlugins.find(
      // plugin => plugin.name === `gatsby-source-filesystem`
      // )?.version
      // // The site might be using a plugin which uses "createRemoteFileNode" but
      // // doesn't have gatsby-source-filesystem in their gatsby-config.js. So lets
      // // also try requiring it.
      // if (!sourceFileSystemVersion) {
      // try {
      // sourceFileSystemVersion = require(`gatsby-source-filesystem/package.json`)
      // ?.version
      // } catch {
      // // ignore require errors
      // }
      // }
      // } else if (
      // sourceFileSystemVersion &&
      // semver.lt(sourceFileSystemVersion, `2.9.0`)
      // ) {
      // // If the site has more than 50 downloaded files in it, tell them
      // // how to save time.
      // try {
      // // Divide by two as the directory as both cache files + the actual downloaded files so
      // // two results / downloaded file.
      // const filesCount =
      // (await fs.readdir(`.cache/caches/gatsby-source-filesystem`))
      // .length / 2
      // if (filesCount > 50) {
      // reporter.info(stripIndent`\n\n
      // Your local development experience is about to get better, faster, and stronger!
      // Your friendly Gatsby maintainers detected your site downloads quite a few files and that we're about to delete all ${Math.round(
      // filesCount
      // )} of them 😅. We're working right now to make our caching smarter which means we won't delete your downloaded files any more.
      // If you're interested in trialing the new caching behavior *today* — which should make your local development environment faster, go ahead and enable the PRESERVE_FILE_DOWNLOAD_CACHE flag and run your develop server again.
      // To do so, add to your gatsby-config.js:
      // flags: {
      // preserve_file_download_cache: true,
      // }
      // visit the umbrella issue to learn more: https://github.com/gatsbyjs/gatsby/discussions/28331
      // `)
      // }
      // } catch {
      // // ignore errors (mostly will just be directory not found).
      // }
      // }
      if (process.env.GATSBY_EXPERIMENTAL_PRESERVE_FILE_DOWNLOAD_CACHE || process.env.GATSBY_EXPERIMENTAL_PRESERVE_WEBPACK_CACHE) {
        const deleteGlobs = [// By default delete all files & subdirectories
        `${cacheDirectory}/**`, `${cacheDirectory}/*/`];

        if (process.env.GATSBY_EXPERIMENTAL_PRESERVE_FILE_DOWNLOAD_CACHE) {
          // Add gatsby-source-filesystem
          deleteGlobs.push(`!${cacheDirectory}/caches/gatsby-source-filesystem`);
        }

        if (process.env.GATSBY_EXPERIMENTAL_PRESERVE_WEBPACK_CACHE) {
          // Add webpack
          deleteGlobs.push(`!${cacheDirectory}/webpack`);
        }

        await (0, _del.default)(deleteGlobs);
      } else {
        // Attempt to empty dir if remove fails,
        // like when directory is mount point
        await _fsExtra.default.remove(cacheDirectory).catch(() => _fsExtra.default.emptyDir(cacheDirectory));
      }
    } catch (e) {
      _reporter.default.error(`Failed to remove .cache files.`, e);
    } // Tell reducers to delete their data (the store will already have
    // been loaded from the file system cache).


    _redux.store.dispatch({
      type: `DELETE_CACHE`,
      cacheIsCorrupt
    }); // in future this should show which plugin's caches are purged
    // possibly should also have which plugins had caches


    _gatsbyTelemetry.default.decorateEvent(`BUILD_END`, {
      pluginCachesPurged: [`*`]
    });

    _gatsbyTelemetry.default.decorateEvent(`DEVELOP_STOP`, {
      pluginCachesPurged: [`*`]
    });
  } // Update the store with the new plugins hash.


  _redux.store.dispatch({
    type: `UPDATE_PLUGINS_HASH`,
    payload: pluginsHash
  }); // Now that we know the .cache directory is safe, initialize the cache
  // directory.


  await _fsExtra.default.ensureDir(cacheDirectory); // Ensure the public/static directory

  await _fsExtra.default.ensureDir(`${publicDirectory}/static`);
  activity.end();
  activity = _reporter.default.activityTimer(`copy gatsby files`, {
    parentSpan
  });
  activity.start();
  const srcDir = `${__dirname}/../../cache-dir`;
  const siteDir = cacheDirectory;
  const tryRequire = `${__dirname}/../utils/test-require-error.js`;

  try {
    await _fsExtra.default.copy(srcDir, siteDir);
    await _fsExtra.default.copy(tryRequire, `${siteDir}/test-require-error.js`);
    await _fsExtra.default.ensureDirSync(`${cacheDirectory}/json`); // Ensure .cache/fragments exists and is empty. We want fragments to be
    // added on every run in response to data as fragments can only be added if
    // the data used to create the schema they're dependent on is available.

    await _fsExtra.default.emptyDir(`${cacheDirectory}/fragments`);
  } catch (err) {
    _reporter.default.panic(`Unable to copy site files to .cache`, err);
  } // Find plugins which implement gatsby-browser and gatsby-ssr and write
  // out api-runners for them.


  const hasAPIFile = (env, plugin) => {
    // The plugin loader has disabled SSR APIs for this plugin. Usually due to
    // multiple implementations of an API that can only be implemented once
    if (env === `ssr` && plugin.skipSSR === true) return undefined;
    const envAPIs = plugin[`${env}APIs`]; // Always include gatsby-browser.js files if they exist as they're
    // a handy place to include global styles and other global imports.

    try {
      if (env === `browser`) {
        return (0, _gatsbyCoreUtils.slash)(require.resolve(_path.default.join(plugin.resolve, `gatsby-${env}`)));
      }
    } catch (e) {// ignore
    }

    if (envAPIs && Array.isArray(envAPIs) && envAPIs.length > 0) {
      return (0, _gatsbyCoreUtils.slash)(_path.default.join(plugin.resolve, `gatsby-${env}`));
    }

    return undefined;
  };

  const isResolved = plugin => !!plugin.resolve;

  const ssrPlugins = flattenedPlugins.map(plugin => {
    return {
      resolve: hasAPIFile(`ssr`, plugin),
      options: plugin.pluginOptions
    };
  }).filter(isResolved);
  const browserPlugins = flattenedPlugins.map(plugin => {
    return {
      resolve: hasAPIFile(`browser`, plugin),
      options: plugin.pluginOptions
    };
  }).filter(isResolved);
  const browserPluginsRequires = browserPlugins.map(plugin => {
    // we need a relative import path to keep contenthash the same if directory changes
    const relativePluginPath = _path.default.relative(siteDir, plugin.resolve);

    return `{
      plugin: require('${(0, _gatsbyCoreUtils.slash)(relativePluginPath)}'),
      options: ${JSON.stringify(plugin.options)},
    }`;
  }).join(`,`);
  const browserAPIRunner = `module.exports = [${browserPluginsRequires}]\n`;
  let sSRAPIRunner = ``;

  try {
    sSRAPIRunner = _fsExtra.default.readFileSync(`${siteDir}/api-runner-ssr.js`, `utf-8`);
  } catch (err) {
    _reporter.default.panic(`Failed to read ${siteDir}/api-runner-ssr.js`, err);
  }

  const ssrPluginsRequires = ssrPlugins.map(plugin => `{
      plugin: require('${plugin.resolve}'),
      options: ${JSON.stringify(plugin.options)},
    }`).join(`,`);
  sSRAPIRunner = `var plugins = [${ssrPluginsRequires}]\n${sSRAPIRunner}`;

  _fsExtra.default.writeFileSync(`${siteDir}/api-runner-browser-plugins.js`, browserAPIRunner, `utf-8`);

  _fsExtra.default.writeFileSync(`${siteDir}/api-runner-ssr.js`, sSRAPIRunner, `utf-8`);

  activity.end();
  /**
   * Start the main bootstrap processes.
   */
  // onPreBootstrap

  activity = _reporter.default.activityTimer(`onPreBootstrap`, {
    parentSpan
  });
  activity.start();
  await (0, _apiRunnerNode.default)(`onPreBootstrap`, {
    parentSpan: activity.span
  });
  activity.end(); // Collect resolvable extensions and attach to program.

  const extensions = [`.mjs`, `.js`, `.jsx`, `.wasm`, `.json`]; // Change to this being an action and plugins implement `onPreBootstrap`
  // for adding extensions.

  const apiResults = await (0, _apiRunnerNode.default)(`resolvableExtensions`, {
    traceId: `initial-resolvableExtensions`,
    parentSpan
  });

  _redux.store.dispatch({
    type: `SET_PROGRAM_EXTENSIONS`,
    payload: _lodash.default.flattenDeep([extensions, apiResults])
  });

  const workerPool = WorkerPool.create();
  return {
    store: _redux.store,
    workerPool
  };
}
//# sourceMappingURL=initialize.js.map
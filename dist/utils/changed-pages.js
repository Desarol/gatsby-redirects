"use strict";

exports.__esModule = true;
exports.deleteUntouchedPages = deleteUntouchedPages;
exports.findChangedPages = findChangedPages;

var _actions = require("../redux/actions");

var _lodash = require("lodash");

const {
  deletePage
} = _actions.boundActionCreators;

function deleteUntouchedPages(currentPages, timeBeforeApisRan) {
  const deletedPages = []; // Delete pages that weren't updated when running createPages.

  currentPages.forEach(page => {
    if (!page.isCreatedByStatefulCreatePages && page.updatedAt < timeBeforeApisRan && page.path !== `/404.html`) {
      deletePage(page);
      deletedPages.push(page.path, `/page-data${page.path}`);
    }
  });
  return deletedPages;
}

function findChangedPages(oldPages, currentPages) {
  const changedPages = [];

  const compareWithoutUpdated = (_left, _right, key) => key === `updatedAt` || undefined;

  currentPages.forEach((newPage, path) => {
    const oldPage = oldPages.get(path);

    if (!oldPage || !(0, _lodash.isEqualWith)(newPage, oldPage, compareWithoutUpdated)) {
      changedPages.push(path);
    }
  });
  const deletedPages = [];
  oldPages.forEach((_page, key) => {
    if (!currentPages.has(key)) {
      deletedPages.push(key);
    }
  });
  return {
    changedPages,
    deletedPages
  };
}
//# sourceMappingURL=changed-pages.js.map
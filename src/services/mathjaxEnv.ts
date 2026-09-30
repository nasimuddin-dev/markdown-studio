/**
 * MathJax's version module reads a global PACKAGE_VERSION (defined by its own
 * bundles) and otherwise calls `require`, which doesn't exist in a browser.
 * Imported before MathJax, this provides it.
 */
(globalThis as { PACKAGE_VERSION?: string }).PACKAGE_VERSION ??= "3.2.2";

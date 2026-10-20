// Learn more https://docs.expo.io/guides/customizing-metro
//
// This file exists only for Sentry. `getSentryExpoConfig` is `getDefaultConfig`
// plus one thing: it stamps a unique Debug ID into every bundle and its source
// map, which is what lets Sentry match a minified stack frame back to a line of
// TypeScript. Without it a crash report is a wall of `index.android.bundle:1:84213`
// and the whole feature is worth nothing.
//
// There was no metro.config.js before this, so Metro was using the default
// config implicitly. This is that same default, wrapped.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;

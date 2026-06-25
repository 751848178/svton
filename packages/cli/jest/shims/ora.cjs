// Jest shim for ora (ora@8 is ESM-only). Provides a no-op spinner chain.
module.exports = () => ({
  start() { return this; },
  succeed() {},
  fail() {},
  stop() {},
  warn() {},
  info() {},
  text: '',
});

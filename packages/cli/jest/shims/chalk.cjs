// Jest shim for chalk (chalk@5 is ESM-only and not transformed from node_modules).
// Returns any chalk.<color>(...) / chalk(...) as the input string unchanged.
const id = (s) => s;
module.exports = new Proxy(id, { get: () => id });

// Jest shim for chalk (chalk@5 is ESM-only and not transformed from node_modules).
// Self-referential proxy: any access (incl. `.default` from __importDefault interop,
// and chained `chalk.green.bold`) returns the proxy itself, and calling it returns
// the input unchanged. So `chalk.green('x')`, `chalk_1.default.yellow('x')` all → 'x'.
let chalk;
chalk = new Proxy(function (s) { return s; }, { get: () => chalk });
module.exports = chalk;

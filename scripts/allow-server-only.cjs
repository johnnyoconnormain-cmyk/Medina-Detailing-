/**
 * Test-only loader shim. `server-only` throws outside a React Server Component,
 * which is correct at runtime but blocks CLI verification scripts. This maps it
 * to a no-op for scripts only; application code is untouched.
 */
const Module = require("node:module");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, parent, isMain);
};

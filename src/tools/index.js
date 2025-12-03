/**
 * Tool Registration Index
 * Loads and registers all built-in tools
 */
const logger = require('../utils/logger');

const toolModules = [
  './webSearch',
  './codeExecution',
  './aiChat',
  './utilities',
];

let loadedCount = 0;

for (const modulePath of toolModules) {
  try {
    require(modulePath);
    loadedCount++;
  } catch (error) {
    logger.error(`Failed to load tool module: ${modulePath}`, { error: error.message });
  }
}

logger.debug(`Loaded ${loadedCount}/${toolModules.length} tool modules`);

module.exports = {
  toolModules,
  loadedCount,
};

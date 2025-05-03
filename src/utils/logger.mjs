// src/utils/logger.mjs
import pino from 'pino';

// Basic logger configuration
// We can enhance this later to add context like AWS Request ID
const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', configurable via env var
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }; // Standardize level format
    },
    // You could add more formatters here if needed
  },
  timestamp: pino.stdTimeFunctions.isoTime, // Use ISO 8601 format timestamps
  // Base can be used to add static context to all logs
  base: {
    // Example: Add function name/version if available from environment
    lambdaFunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'local',
  },
});

export default logger;

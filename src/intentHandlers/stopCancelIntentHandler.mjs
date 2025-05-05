// src/intentHandlers/stopCancelIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';

const GOODBYE_MESSAGE = 'Goodbye!';

/**
 * Handles AMAZON.StopIntent and AMAZON.CancelIntent by ending the session with a simple goodbye.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {object} - The Alexa response object.
 */
// --- Make sure the export name is exactly handleStopCancelIntent ---
export const handleStopCancelIntent = (event, log /*, config */) => {
  // Use event.request?.intent?.name for safety, although it should always exist here
  const intentName = event.request?.intent?.name || 'Unknown Stop/Cancel';
  log.info(`Handling ${intentName}.`);
  return buildTellResponse(GOODBYE_MESSAGE);
};
// ------------------------------------------------------------------

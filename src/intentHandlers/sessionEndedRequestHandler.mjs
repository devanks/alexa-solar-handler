// src/intentHandlers/sessionEndedRequestHandler.mjs

/**
 * Handles SessionEndedRequest - logs the reason for session end.
 * No response is sent back to Alexa for this request type.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when logging is complete.
 */
export const handleSessionEndedRequest = async (event, log) => {
  const reason = event?.request?.reason; // e.g., "USER_INITIATED", "ERROR", "EXCEEDED_MAX_REPROMPTS"
  const error = event?.request?.error; // Only present if reason is "ERROR"

  log.info({ reason, error }, 'Handling SessionEndedRequest.');

  // Perform any cleanup tasks here if needed (e.g., clearing session attributes in a database)
  // For this skill, we just log.

  // No response is needed or allowed for SessionEndedRequest.
  // Return a resolved promise to signify completion.
  return Promise.resolve();
};

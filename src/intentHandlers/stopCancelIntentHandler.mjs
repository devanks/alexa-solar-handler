// src/intentHandlers/stopCancelIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';

/**
 * Handles AMAZON.StopIntent and AMAZON.CancelIntent - ends the session.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleStopOrCancelIntent = async (event, log) => {
    const intentName = event?.request?.intent?.name; // Get the specific intent name for logging
    log.info(`Handling ${intentName}.`);

    const speechText = 'Goodbye!'; // Simple farewell message

    // Use buildTellResponse which automatically sets shouldEndSession to true.
    return buildTellResponse(speechText);
};


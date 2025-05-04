// src/router.mjs
import logger from './utils/logger.mjs'; // Use the base logger for routing logs if needed
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
// Import other handlers here as they are created
// import { handleGetSolarDataIntent } from './intentHandlers/getSolarDataIntentHandler.mjs';
// import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
// import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';
// import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';

const log = logger.child({ module: 'router' }); // Create a child logger specific to the router

/**
 * Determines the appropriate handler function based on the Alexa request type and intent.
 *
 * @param {object} event - The incoming Alexa event object.
 * @returns {Function|null} The handler function to execute, or null if no match is found.
 */
export const routeRequest = (event) => {
    const requestType = event?.request?.type;
    const intentName = event?.request?.intent?.name;

    log.info({ requestType, intentName }, 'Routing request');

    // --- Request Type Routing ---
    if (requestType === 'LaunchRequest') {
        log.info('Routing to LaunchRequest handler.');
        return handleLaunchRequest;
    }

    if (requestType === 'IntentRequest') {
        log.info({ intentName }, 'Routing IntentRequest.');
        // --- Intent Name Routing (within IntentRequest) ---
        switch (intentName) {
            // case 'GetSolarDataIntent': // Example for later
            //     log.info('Routing to GetSolarDataIntent handler.');
            //     return handleGetSolarDataIntent;
            // case 'AMAZON.HelpIntent': // Example for later
            //      log.info('Routing to AMAZON.HelpIntent handler.');
            //      return handleHelpIntent;
            // case 'AMAZON.StopIntent':
            // case 'AMAZON.CancelIntent':
            //      log.info('Routing to Stop/Cancel handler (likely SessionEnded or a Tell response).');
            //      // Often handled similarly to SessionEnded or a simple Tell response handler
            //      return handleStopOrCancelIntent; // Need to create this simple handler
            default:
                log.warn({ intentName }, 'No specific handler found for this intent name. Routing to fallback.');
                // return handleFallbackIntent; // Return a fallback handler when created
                return null; // Or return null if no fallback exists yet
        }
    }

    if (requestType === 'SessionEndedRequest') {
        log.info('Routing to SessionEndedRequest handler.');
        // return handleSessionEndedRequest; // Return the handler when created
        // SessionEndedRequests don't return a response to Alexa, so the handler might just log/clean up.
        // Often, we can just return null and let the main index handle it gracefully.
        return null; // For now, SessionEnded requires no response body.
    }

    // --- Fallback for unknown request types ---
    log.warn({ requestType }, 'Received unknown request type. No handler available.');
    return null;
};

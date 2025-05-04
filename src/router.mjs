// src/router.mjs
import logger from './utils/logger.mjs';
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
// --- Import the new handlers ---
import { handleGetCurrentPowerIntent } from './intentHandlers/getCurrentPowerIntentHandler.mjs';
import { handleGetDailyProductionIntent } from './intentHandlers/getDailyProductionIntentHandler.mjs';
// Import other handlers here as they are created (Help, Stop, Fallback, etc.)
// import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
// import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';
// import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';
// import { handleStopOrCancelIntent } from './intentHandlers/stopCancelIntentHandler.mjs'; // Example

const log = logger.child({ module: 'router' });

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
            // --- Add cases for the new intents ---
            case 'GetCurrentPowerIntent':
                log.info('Routing to GetCurrentPowerIntent handler.');
                return handleGetCurrentPowerIntent;
            case 'GetDailyProductionIntent':
                log.info('Routing to GetDailyProductionIntent handler.');
                return handleGetDailyProductionIntent;
            // --- Add cases for other intents later ---
            // case 'GetOnlineStatusIntent':
            //     log.info('Routing to GetOnlineStatusIntent handler.');
            //     return handleGetOnlineStatusIntent;
            // case 'GetSummaryIntent':
            //     log.info('Routing to GetSummaryIntent handler.');
            //     return handleGetSummaryIntent;
            // case 'AMAZON.HelpIntent':
            //      log.info('Routing to AMAZON.HelpIntent handler.');
            //      return handleHelpIntent;
            // case 'AMAZON.StopIntent':
            // case 'AMAZON.CancelIntent':
            //      log.info('Routing to Stop/Cancel handler.');
            //      return handleStopOrCancelIntent;
            // case 'AMAZON.FallbackIntent':
            //      log.info('Routing to FallbackIntent handler.');
            //      return handleFallbackIntent;
            default:
                log.warn({ intentName }, 'No specific handler found for this intent name. Routing to fallback/null.');
                // return handleFallbackIntent; // Return a fallback handler when created
                return null; // Or return null if no fallback exists yet
        }
    }

    if (requestType === 'SessionEndedRequest') {
        log.info('Routing to SessionEndedRequest handler.');
        // return handleSessionEndedRequest; // Return the handler when created
        return null; // SessionEnded requires no response body.
    }

    // --- Fallback for unknown request types ---
    log.warn({ requestType }, 'Received unknown request type. No handler available.');
    return null;
};

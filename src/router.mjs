// src/router.mjs
import logger from './utils/logger.mjs';
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
import { handleGetCurrentPowerIntent } from './intentHandlers/getCurrentPowerIntentHandler.mjs';
import { handleGetDailyProductionIntent } from './intentHandlers/getDailyProductionIntentHandler.mjs';
import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
import { handleStopOrCancelIntent } from './intentHandlers/stopCancelIntentHandler.mjs';
// --- Import the Fallback handler ---
import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';
// Import other handlers here as they are created
// import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';

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
      case 'GetCurrentPowerIntent':
        log.info('Routing to GetCurrentPowerIntent handler.');
        return handleGetCurrentPowerIntent;
      case 'GetDailyProductionIntent':
        log.info('Routing to GetDailyProductionIntent handler.');
        return handleGetDailyProductionIntent;
      case 'AMAZON.HelpIntent':
        log.info('Routing to AMAZON.HelpIntent handler.');
        return handleHelpIntent;
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
        log.info(`Routing ${intentName} to Stop/Cancel handler.`);
        return handleStopOrCancelIntent;
        // --- Add explicit case for Fallback Intent ---
        // Although it's the default, explicitly handling it is clearer
        // and prevents it being caught by a future, more specific default.
      case 'AMAZON.FallbackIntent':
        log.info('Routing to AMAZON.FallbackIntent handler.');
        return handleFallbackIntent;
        // --- Add cases for other specific intents later ---
        // case 'GetOnlineStatusIntent':
        //     log.info('Routing to GetOnlineStatusIntent handler.');
        //     return handleGetOnlineStatusIntent;
        // case 'GetSummaryIntent':
        //     log.info('Routing to GetSummaryIntent handler.');
        //     return handleGetSummaryIntent;
      default:
        // --- Update default to use Fallback ---
        log.warn({ intentName }, 'No specific handler found for this intent name. Routing to FallbackIntent handler.');
        return handleFallbackIntent; // Use Fallback for unhandled intents
    }
  }

  if (requestType === 'SessionEndedRequest') {
    log.info('Routing to SessionEndedRequest handler.');
    // return handleSessionEndedRequest; // Return the handler when created
    return null; // SessionEnded requires no response body.
  }

  // --- Fallback for unknown request types ---
  log.warn({ requestType }, 'Received unknown request type. No handler available.');
  return null; // Still return null for non-Intent/Launch/SessionEnded requests
};

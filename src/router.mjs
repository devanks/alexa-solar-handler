// src/router.mjs
import logger from './utils/logger.mjs';
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
import { handleGetCurrentPowerIntent } from './intentHandlers/getCurrentPowerIntentHandler.mjs';
import { handleGetDailyProductionIntent } from './intentHandlers/getDailyProductionIntentHandler.mjs';
import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
import { handleStopOrCancelIntent } from './intentHandlers/stopCancelIntentHandler.mjs';
import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';
import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';
// --- Import the GetOnlineStatus handler ---
import { handleGetOnlineStatusIntent } from './intentHandlers/getOnlineStatusIntentHandler.mjs';
// Import other handlers here as they are created
// import { handleGetSummaryIntent } from './intentHandlers/getSummaryIntentHandler.mjs';


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
        // --- Add case for GetOnlineStatusIntent ---
      case 'GetOnlineStatusIntent':
        log.info('Routing to GetOnlineStatusIntent handler.');
        return handleGetOnlineStatusIntent;
      case 'AMAZON.HelpIntent':
        log.info('Routing to AMAZON.HelpIntent handler.');
        return handleHelpIntent;
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
        log.info(`Routing ${intentName} to Stop/Cancel handler.`);
        return handleStopOrCancelIntent;
      case 'AMAZON.FallbackIntent':
        log.info('Routing to AMAZON.FallbackIntent handler.');
        return handleFallbackIntent;
        // --- Add cases for other specific intents later ---
        // case 'GetSummaryIntent':
        //     log.info('Routing to GetSummaryIntent handler.');
        //     return handleGetSummaryIntent;
      default:
        log.warn({ intentName }, 'No specific handler found for this intent name. Routing to FallbackIntent handler.');
        return handleFallbackIntent;
    }
  }

  if (requestType === 'SessionEndedRequest') {
    log.info('Routing to SessionEndedRequest handler.');
    return handleSessionEndedRequest;
  }

  // --- Fallback for unknown request types ---
  log.warn({ requestType }, 'Received unknown request type. No handler available.');
  return null;
};

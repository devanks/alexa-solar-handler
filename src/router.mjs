// src/router.mjs
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
import { handleGetCurrentPowerIntent } from './intentHandlers/getCurrentPowerIntentHandler.mjs';
import { handleGetDailyProductionIntent } from './intentHandlers/getDailyProductionIntentHandler.mjs';
import { handleGetOnlineStatusIntent } from './intentHandlers/getOnlineStatusIntentHandler.mjs';
import { handleGetSummaryIntent } from './intentHandlers/getSummaryIntentHandler.mjs';
import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
// --- Ensure this import matches the export in stopCancelIntentHandler.mjs ---
import { handleStopCancelIntent } from './intentHandlers/stopCancelIntentHandler.mjs';
// ---------------------------------------------------------------------------
import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';
import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';

/**
 * Routes the incoming Alexa request to the appropriate handler based on request type and intent name.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Function | null} - The handler function to execute, or null if no handler matches.
 */
export const routeRequest = (event, log) => {
  // --- Debug Log: Log the entire request object at the start (optional, can be verbose) ---
  // log.debug({ request: event.request }, 'Incoming request object details.');
  // ------------------------------------------------------------------------------------

  // Safer access to request type
  const requestType = event?.request?.type;
  log.info({ requestType }, 'Routing request type.'); // Changed to info for better visibility

  if (!requestType) {
    log.error('Request object or request type is missing.');
    return null; // Cannot route without a request type
  }

  if (requestType === 'LaunchRequest') {
    log.debug('Matched LaunchRequest.');
    return handleLaunchRequest;
  } else if (requestType === 'IntentRequest') {
    // Safer access to intent name
    const intentName = event.request?.intent?.name;
    log.info({ intentName }, 'Routing intent name.'); // Changed to info

    if (!intentName) {
      log.error('IntentRequest is missing intent name.');
      // Decide how to handle this - fallback or null? Let's use fallback.
      return handleFallbackIntent;
    }

    switch (intentName) {
      case 'GetCurrentPowerIntent':
        log.debug('Matched GetCurrentPowerIntent.');
        return handleGetCurrentPowerIntent;
      case 'GetDailyProductionIntent':
        log.debug('Matched GetDailyProductionIntent.');
        return handleGetDailyProductionIntent;
      case 'GetOnlineStatusIntent':
        log.debug('Matched GetOnlineStatusIntent.');
        return handleGetOnlineStatusIntent;
      case 'GetSummaryIntent':
        log.debug('Matched GetSummaryIntent.');
        return handleGetSummaryIntent;
      case 'AMAZON.HelpIntent':
        log.debug('Matched AMAZON.HelpIntent.');
        return handleHelpIntent;
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
        log.debug(`Matched ${intentName}.`);
        return handleStopCancelIntent;
      case 'AMAZON.FallbackIntent':
        log.debug('Matched AMAZON.FallbackIntent.');
        return handleFallbackIntent;
      default:
        log.warn(`Unknown intent name encountered: ${intentName}`);
        log.debug('Routing unknown intent to FallbackIntent.');
        return handleFallbackIntent; // Route unknown intents to Fallback
    }
  } else if (requestType === 'SessionEndedRequest') {
    log.debug('Matched SessionEndedRequest.');
    return handleSessionEndedRequest;
  } else {
    log.warn(`Unknown request type encountered: ${requestType}`);
    return null; // Return null for completely unknown request types
  }
};

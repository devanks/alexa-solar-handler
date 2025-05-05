// src/router.mjs
import { handleLaunchRequest } from './intentHandlers/launchRequestHandler.mjs';
import { handleGetCurrentPowerIntent } from './intentHandlers/getCurrentPowerIntentHandler.mjs';
import { handleGetDailyProductionIntent } from './intentHandlers/getDailyProductionIntentHandler.mjs';
import { handleGetOnlineStatusIntent } from './intentHandlers/getOnlineStatusIntentHandler.mjs';
import { handleGetSummaryIntent } from './intentHandlers/getSummaryIntentHandler.mjs';
import { handleHelpIntent } from './intentHandlers/amazonHelpIntentHandler.mjs';
import { handleStopCancelIntent } from './intentHandlers/stopCancelIntentHandler.mjs';
import { handleFallbackIntent } from './intentHandlers/fallbackIntentHandler.mjs';
import { handleSessionEndedRequest } from './intentHandlers/sessionEndedRequestHandler.mjs';

export const routeRequest = (event, log) => {
  // +++ DEBUG LOGGING +++
  log.info('--- Router received event ---');
  // +++ END DEBUG +++

  const requestType = event?.request?.type;
  log.info({ requestType }, 'Determined request type.');

  if (!requestType) {
    log.error('Router Error: Event missing request type.');
    return null; // Cannot route without type
  }

  if (requestType === 'LaunchRequest') {
    // +++ DEBUG LOGGING +++
    log.info('Matched LaunchRequest');
    // +++ END DEBUG +++
    return handleLaunchRequest;
  }

  if (requestType === 'SessionEndedRequest') {
    // +++ DEBUG LOGGING +++
    log.info('Matched SessionEndedRequest');
    // +++ END DEBUG +++
    return handleSessionEndedRequest;
  }

  if (requestType === 'IntentRequest') {
    const intentName = event.request.intent?.name;
    // +++ DEBUG LOGGING +++
    log.info({ intentName }, 'Determined intent name.');
    // +++ END DEBUG +++

    if (!intentName) {
      log.error('Router Error: IntentRequest missing intent name.');
      return handleFallbackIntent; // Or null, depending on desired behavior
    }

    switch (intentName) {
      case 'GetCurrentPowerIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched GetCurrentPowerIntent');
        // +++ END DEBUG +++
        return handleGetCurrentPowerIntent;
      case 'GetDailyProductionIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched GetDailyProductionIntent');
        // +++ END DEBUG +++
        return handleGetDailyProductionIntent;
      case 'GetOnlineStatusIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched GetOnlineStatusIntent');
        // +++ END DEBUG +++
        return handleGetOnlineStatusIntent;
      case 'GetSummaryIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched GetSummaryIntent');
        // +++ END DEBUG +++
        return handleGetSummaryIntent;
      case 'AMAZON.HelpIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched AMAZON.HelpIntent');
        // +++ END DEBUG +++
        return handleHelpIntent;
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
        // +++ DEBUG LOGGING +++
        log.info('Matched AMAZON.Stop/CancelIntent');
        // +++ END DEBUG +++
        return handleStopCancelIntent;
      case 'AMAZON.FallbackIntent': // Explicit fallback intent
        // +++ DEBUG LOGGING +++
        log.info('Matched AMAZON.FallbackIntent');
        // +++ END DEBUG +++
        return handleFallbackIntent;
      default:
        // +++ DEBUG LOGGING +++
        log.warn({ intentName }, 'Unknown intent name encountered.');
        // +++ END DEBUG +++
        return handleFallbackIntent; // Use specific fallback handler for unknown intents
    }
  }

  log.warn({ requestType }, 'No matching route found, returning null.');
  // +++ END DEBUG +++
  return null; // Should not be reached if logic is correct
};

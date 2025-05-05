// src/intentHandlers/getCurrentPowerIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';
import { formatPower } from '../utils/formatters.mjs';

/**
 * Handles the GetCurrentPowerIntent - fetches current solar power from the GCP backend.
 * Assumes GCP always returns: {"dailyProductionKWh":N,"currentPowerW":N,"isOnline":B,"timestamp":N}
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @param {function} gcpClient - The function to call the GCP backend (callGcpFunction).
 * @param {object} config - Application configuration (targetAudience, idToken).
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleGetCurrentPowerIntent = async (
  event,
  log,
  gcpClient,
  config
) => {
  log.info('Handling GetCurrentPowerIntent.');

  // Payload still indicates intent, even if GCP response is always full
  const gcpPayload = {
    action: 'GET_SOLAR_DATA',
    dataType: 'current',
  };

  try {
    log.info(
      { payload: gcpPayload },
      'Calling GCP function to get current power data.'
    );

    const gcpResponse = await gcpClient(
      config.targetAudience,
      config.idToken,
      gcpPayload,
      log
    );

    log.info({ gcpResponse }, 'Received response from GCP function.');

    // --- Process GCP Response (NEW STRUCTURE) ---
    // Check if the specific field we need exists and is a number
    if (gcpResponse && typeof gcpResponse.currentPowerW !== 'undefined') {
      // Check if it's actually a number (could be null, string etc. if backend has issues)
      if (typeof gcpResponse.currentPowerW !== 'number') {
        log.error(
          { gcpResponse },
          'GCP response field currentPowerW was not a number.'
        );
        return buildTellResponse(
          'Sorry, I received unexpected data format from the solar monitor. Please try again later.'
        );
      }

      const speechText = `Your current solar production is ${formatPower(gcpResponse.currentPowerW)}.`;

      return buildTellResponse(speechText);
    } else {
      // Handle cases where GCP returned success but the specific field is missing
      log.error(
        { gcpResponse },
        'GCP function response was successful but missing expected field (currentPowerW).'
      );
      return buildTellResponse(
        'Sorry, I received an incomplete response from the solar monitor. Please try again later.'
      );
    }
  } catch (error) {
    // --- Handle Errors from GCP Client (Error handling logic remains the same) ---
    log.error(
      { err: error },
      'Error calling GCP function for GetCurrentPowerIntent.'
    );

    let errorSpeech =
      "Sorry, I couldn't connect to the solar monitor right now.";
    if (error.statusCode === 503) {
      errorSpeech =
        'The solar monitor service seems to be temporarily unavailable. Please try again soon.';
    } else if (error.statusCode >= 500) {
      errorSpeech =
        'There was a problem retrieving the current power data from the backend.';
    } else if (
      error.message &&
      error.message.toLowerCase().includes('timed out')
    ) {
      errorSpeech =
        'The request to the solar monitor timed out. Please try again.';
    }

    return buildTellResponse(errorSpeech);
  }
};

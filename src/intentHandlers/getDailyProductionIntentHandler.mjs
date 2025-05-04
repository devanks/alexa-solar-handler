// src/intentHandlers/getDailyProductionIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';

/**
 * Handles the GetDailyProductionIntent - fetches daily solar production from the GCP backend.
 * Assumes GCP always returns: {"dailyProductionKWh":N,"currentPowerW":N,"isOnline":B,"timestamp":N}
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @param {function} gcpClient - The function to call the GCP backend (callGcpFunction).
 * @param {object} config - Application configuration (targetAudience, idToken).
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleGetDailyProductionIntent = async (
  event,
  log,
  gcpClient,
  config
) => {
  log.info('Handling GetDailyProductionIntent.');

  const gcpPayload = {
    action: 'GET_SOLAR_DATA',
    dataType: 'daily',
  };

  try {
    log.info(
      { payload: gcpPayload },
      'Calling GCP function to get daily production data.'
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
    if (gcpResponse && typeof gcpResponse.dailyProductionKWh !== 'undefined') {
      // Check if it's actually a number
      if (typeof gcpResponse.dailyProductionKWh !== 'number') {
        log.error(
          { gcpResponse },
          'GCP response field dailyProductionKWh was not a number.'
        );
        return buildTellResponse(
          'Sorry, I received unexpected data format from the solar monitor. Please try again later.'
        );
      }

      const value = gcpResponse.dailyProductionKWh;
      const unit = 'kilowatt hours'; // Unit is implicit in the key name 'dailyProductionKWh'

      const speechText = `Your total solar production for the day is ${value} ${unit}.`;

      return buildTellResponse(speechText);
    } else {
      // Handle cases where GCP returned success but the specific field is missing
      log.error(
        { gcpResponse },
        'GCP function response was successful but missing expected field (dailyProductionKWh).'
      );
      return buildTellResponse(
        'Sorry, I received an incomplete response from the solar monitor. Please try again later.'
      );
    }
  } catch (error) {
    // --- Handle Errors from GCP Client (Error handling logic remains the same) ---
    log.error(
      { err: error },
      'Error calling GCP function for GetDailyProductionIntent.'
    );

    let errorSpeech =
      "Sorry, I couldn't connect to the solar monitor right now.";
    if (error.statusCode === 503) {
      errorSpeech =
        'The solar monitor service seems to be temporarily unavailable. Please try again soon.';
    } else if (error.statusCode >= 500) {
      errorSpeech =
        'There was a problem retrieving the daily production data from the backend.';
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

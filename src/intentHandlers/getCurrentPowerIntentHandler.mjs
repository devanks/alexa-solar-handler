// src/intentHandlers/getCurrentPowerIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';
// callGcpFunction is passed in as gcpClient

/**
 * Handles the GetCurrentPowerIntent - fetches current solar power from the GCP backend.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @param {function} gcpClient - The function to call the GCP backend (callGcpFunction).
 * @param {object} config - Application configuration (targetAudience, idToken).
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleGetCurrentPowerIntent = async (event, log, gcpClient, config) => {
    log.info('Handling GetCurrentPowerIntent.');

    // --- Prepare Payload for GCP Function ---
    // The intent name itself tells us what data is needed.
    const gcpPayload = {
        action: 'GET_SOLAR_DATA', // Or maybe 'GET_CURRENT_POWER' if your backend prefers
        dataType: 'current',
        // Add any other relevant info if needed, e.g., userId
        // userId: event?.session?.user?.userId
    };

    try {
        log.info({ payload: gcpPayload }, 'Calling GCP function to get current power data.');

        // --- Call GCP Function ---
        const gcpResponse = await gcpClient(
            config.targetAudience,
            config.idToken,
            gcpPayload,
            log // Pass logger
        );

        log.info({ gcpResponse }, 'Received response from GCP function.');

        // --- Process GCP Response ---
        // **IMPORTANT:** Adapt this section based on the *actual* JSON structure
        // your GCP function returns successfully for current power.
        if (gcpResponse && typeof gcpResponse.value !== 'undefined' && gcpResponse.unit) {
            const value = gcpResponse.value;
            // Clean up unit presentation if needed (e.g., 'W' to 'watts')
            const unit = gcpResponse.unit.toLowerCase() === 'w' ? 'watts' : gcpResponse.unit;

            const speechText = `Your current solar production is ${value} ${unit}.`;

            // Use buildTellResponse to provide the data and end the session.
            return buildTellResponse(speechText);

        } else {
            // Handle cases where GCP returned success (e.g., HTTP 200) but the data is missing/malformed
            log.error({ gcpResponse }, 'GCP function response was successful but malformed or missing expected data (value, unit) for current power.');
            return buildTellResponse("Sorry, I received an unexpected response from the solar monitor. Please try again later.");
        }

    } catch (error) {
        // --- Handle Errors from GCP Client ---
        log.error({ err: error }, 'Error calling GCP function for GetCurrentPowerIntent.');

        // Inside the catch block...

        let errorSpeech = "Sorry, I couldn't connect to the solar monitor right now.";
        if (error.statusCode === 503) {
            errorSpeech = "The solar monitor service seems to be temporarily unavailable. Please try again soon.";
        } else if (error.statusCode >= 500) {
            errorSpeech = "There was a problem retrieving the current power data from the backend.";
        } else if (error.message && error.message.toLowerCase().includes('timed out')) {
            errorSpeech = "The request to the solar monitor timed out. Please try again.";
        }

        // Add more specific error handling if needed

        return buildTellResponse(errorSpeech); // End session on error
    }
};

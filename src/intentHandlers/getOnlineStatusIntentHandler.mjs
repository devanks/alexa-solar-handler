// src/intentHandlers/getOnlineStatusIntentHandler.mjs
import {buildTellResponse} from '../utils/responseBuilder.mjs';

const INTENT_NAME = 'GetOnlineStatusIntent';

/**
 * Handles GetOnlineStatusIntent - checks if the solar system is online.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @param {object} gcpClient - The client for interacting with the backend service.
 * @param {object} config - The application configuration.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleGetOnlineStatusIntent = async (event, log, gcpClient, handlerConfig) => {
    log.info(`Handling ${INTENT_NAME}.`);

    let speechText;

    try {
        // Call the backend client to get the status
        // We expect gcpClient.getSystemStatus() to return something like { isOnline: true } or { isOnline: false }
        log.debug('Calling gcpClient.getSystemStatus...');
        const statusResult = await gcpClient(
            handlerConfig.targetAudience,
            handlerConfig.idToken,
            {dataType: 'status'}, // Use the payload expected by your GCP function
            log
        )
        log.debug({statusResult}, 'Received response from gcpClient.getSystemStatus.');

        if (statusResult && typeof statusResult.isOnline === 'boolean') {
            if (statusResult.isOnline) {
                speechText = 'The solar energy system is currently online and reporting data.';
            } else {
                speechText = 'The solar energy system is currently reporting as offline.';
            }
        } else {
            // Handle unexpected response format from the backend
            log.warn({statusResult}, 'Received unexpected format from getSystemStatus.');
            speechText = "Sorry, I received an unexpected status format from the system. I can't determine if it's online right now.";
        }

    } catch (error) {
        log.error({err: error}, `Error fetching system status from backend for ${INTENT_NAME}.`);
        speechText = "Sorry, I couldn't retrieve the system status right now. There might be a connection issue. Please try again later.";
    }

    // Use buildTellResponse as this interaction usually concludes the turn.
    return buildTellResponse(speechText);
};


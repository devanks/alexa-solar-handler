// src/intentHandlers/getSummaryIntentHandler.mjs
import { buildTellResponse } from '../utils/responseBuilder.mjs';
import { formatPower, formatEnergy } from '../utils/formatters.mjs';

const INTENT_NAME = 'GetSummaryIntent';

/**
 * Processes the successful API summary result to build speech parts and detect processing errors.
 * @param {object} summaryResult - The result object from gcpClient.getSystemSummary.
 * @param {object} log - The logger instance.
 * @returns {{summaryParts: string[], errorsEncountered: boolean}} - The parts for the speech and if errors occurred.
 */
function processSummaryResult(summaryResult, log) {
    const summaryParts = [];
    let errorsEncountered = false;

    // --- Process Current Power ---
    if (typeof summaryResult.currentPowerW === 'number') {
        summaryParts.push(`Currently generating ${formatPower(summaryResult.currentPowerW)}.`);
    } else {
        log.warn({ summaryResult }, 'currentPowerW missing or not a number in summary response.');
        summaryParts.push("Couldn't determine the current power generation.");
        errorsEncountered = true;
    }

    // --- Process Daily Production ---
    if (typeof summaryResult.dailyProductionKWh === 'number') {
        const energykWh = summaryResult.dailyProductionKWh;
        if (energykWh > 0) {
            summaryParts.push(`Today's production is ${formatEnergy(energykWh)} so far.`);
        } else {
            summaryParts.push("There has been no production recorded yet today.");
        }
    } else {
        log.warn({ summaryResult }, 'dailyProductionKWh missing or not a number in summary response.');
        summaryParts.push("Couldn't determine today's production data.");
        errorsEncountered = true;
    }

    // --- Process System Status ---
    if (typeof summaryResult.isOnline === 'boolean') {
        summaryParts.push(summaryResult.isOnline ? "The system is online." : "The system is reporting as offline.");
    } else {
        log.warn({ summaryResult }, 'isOnline missing or not a boolean in summary response.');
        summaryParts.push("Couldn't determine the system's online status.");
        errorsEncountered = true;
    }

    return { summaryParts, errorsEncountered };
}

/**
 * Determines the appropriate speech text based on a caught error.
 * @param {Error} error - The error object caught.
 * @returns {string} - The user-facing error speech string.
 */
function determineErrorSpeech(error) {
    const isTimeout = error.code === 'ETIMEDOUT' || error.message?.toLowerCase().includes('timeout');

    if (isTimeout) {
        return "Sorry, the request to your solar system timed out. Please try again later.";
    } else if (error.statusCode && error.statusCode >= 500) {
        return "Sorry, there seems to be an issue with the solar system's reporting service. Please try again later.";
    } else {
        // Generic connection error
        return "Sorry, I couldn't retrieve the system summary right now due to a connection issue. Please try again later.";
    }
}

/**
 * Handles GetSummaryIntent - provides a summary of current power, daily production, and system status.
 * (Refactored for lower cognitive complexity)
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @param {object} gcpClient - The client for interacting with the backend service.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleGetSummaryIntent = async (event, log, gcpClient) => {
    log.info(`Handling ${INTENT_NAME}.`);

    let speechText;
    let overallErrorsEncountered = false; // Track errors from API call OR processing

    try {
        log.debug('Calling gcpClient.getSystemSummary...');
        const summaryResult = await gcpClient.getSystemSummary();
        log.debug({ summaryResult }, 'Received response from gcpClient.getSystemSummary.');

        if (!summaryResult) {
            log.warn('Received null or undefined response from getSystemSummary.');
            speechText = "Sorry, I received an empty response from the system. I can't provide a summary right now.";
            overallErrorsEncountered = true;
        } else {
            // Process the valid (though potentially incomplete) result
            const { summaryParts, errorsEncountered: processingErrors } = processSummaryResult(summaryResult, log);
            overallErrorsEncountered = processingErrors; // Set flag based on processing outcome

            speechText = summaryParts.join(' ');

            // Add prefix only if processing errors occurred but we still have some parts
            if (overallErrorsEncountered && summaryParts.length > 0) {
                speechText = "Here's a partial summary: " + speechText;
            } else if (overallErrorsEncountered && summaryParts.length === 0) {
                // Should be rare if API returned an object, but possible if all fields were bad
                speechText = "Sorry, I couldn't parse any summary information from the system's response.";
            }
            // If no processing errors, speechText is already correctly joined.
        }

    } catch (error) {
        log.error({ err: error }, `Error fetching system summary from backend for ${INTENT_NAME}.`);
        overallErrorsEncountered = true; // API call failed
        speechText = determineErrorSpeech(error);
    }

    // Final log and return
    log.info({ speechText, errorsEncountered: overallErrorsEncountered }, `Final summary speech constructed.`);
    return buildTellResponse(speechText);
};

// Note: We might export processSummaryResult and determineErrorSpeech if we wanted to test them directly.
// For now, they are internal helpers to handleGetSummaryIntent.

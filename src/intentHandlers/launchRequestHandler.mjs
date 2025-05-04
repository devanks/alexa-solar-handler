// src/intentHandlers/launchRequestHandler.mjs
import {buildAskResponse} from '../utils/responseBuilder.mjs';

// We might need gcpClient later if the launch requires initial data, but not for a simple welcome.
// import { callGcpFunction } from '../utils/gcpClient.mjs';

/**
 * Handles the LaunchRequest intent (skill opened without specific command).
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleLaunchRequest = async (event, log) => {
    log.info('Handling LaunchRequest.');

    // --- Simple Welcome Message ---
    // For now, let's just provide a static welcome message.
    const speechText = "Welcome to Solar Monitor! You can ask about your current solar production or daily total. What would you like to know?";
    const repromptText = "Try asking: what's my current production?";

    // Use buildAskResponse to welcome the user and prompt them for input, keeping the session open.
    return buildAskResponse(speechText, repromptText);
};


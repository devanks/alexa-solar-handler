// src/intentHandlers/fallbackIntentHandler.mjs
import { buildAskResponse } from '../utils/responseBuilder.mjs';

/**
 * Handles AMAZON.FallbackIntent - triggered when the user's request doesn't match any other intent.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleFallbackIntent = async (event, log) => {
    log.info('Handling AMAZON.FallbackIntent.');

    // Provide a helpful message and reprompt.
    const speechText = "Sorry, I didn't understand that request. You can ask about current power, daily production, or system status. You can also say 'help' for more options. What would you like to know?";
    const repromptText = "What solar data are you interested in? Try asking 'what's my current power?' or say 'help'.";

    // Use buildAskResponse to provide guidance and keep the session open for another try.
    return buildAskResponse(speechText, repromptText);
};


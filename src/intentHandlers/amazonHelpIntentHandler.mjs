// src/intentHandlers/amazonHelpIntentHandler.mjs
import { buildAskResponse } from '../utils/responseBuilder.mjs';

/**
 * Handles the AMAZON.HelpIntent - provides guidance to the user.
 *
 * @param {object} event - The Alexa request event object.
 * @param {object} log - The logger instance.
 * @returns {Promise<object>} - A promise resolving to the Alexa response object.
 */
export const handleHelpIntent = async (event, log) => {
    log.info('Handling AMAZON.HelpIntent.');

    // Define the help message and a reprompt in case the user doesn't respond.
    const speechText = `You can ask me about your solar energy system. For example, try saying:
        'What's my current power production?',
        'How much energy did I produce today?',
        Or, 'Is the system online?'.
        What would you like to know?`; // End with a question to guide the user.

    const repromptText = "You can ask about current power, daily production, or the system status. What data are you interested in?";

    // Use buildAskResponse to provide help and keep the session open.
    return buildAskResponse(speechText, repromptText);
};


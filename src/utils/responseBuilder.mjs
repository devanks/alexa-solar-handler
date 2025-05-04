// src/utils/responseBuilder.mjs

/**
 * Builds a simple Alexa response with speech and optional reprompt.
 *
 * @param {string} speechText - The text Alexa should speak.
 * @param {boolean} shouldEndSession - If true, the session ends after the response.
 * @param {string} [repromptText=null] - Optional text for the reprompt if the session stays open.
 * @param {object} [sessionAttributes={}] - Optional session attributes to persist.
 * @returns {object} The Alexa response object.
 */
export function buildSimpleResponse(speechText, shouldEndSession, repromptText = null, sessionAttributes = {}) {
    const response = {
        outputSpeech: {
            type: 'PlainText',
            text: speechText,
        },
        shouldEndSession: shouldEndSession,
    };

    // Add reprompt only if the session should not end and reprompt text is provided
    if (!shouldEndSession && repromptText) {
        response.reprompt = {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        };
    }

    // Return the full structure expected by Lambda
    return {
        version: '1.0',
        sessionAttributes: sessionAttributes,
        response: response,
    };
}

/**
 * Builds a response asking the user for clarification or help, keeping the session open.
 *
 * @param {string} speechText - The help or clarification question.
 * @param {string} repromptText - The text to use if the user doesn't respond.
 * @param {object} [sessionAttributes={}] - Optional session attributes.
 * @returns {object} The Alexa response object.
 */
export function buildAskResponse(speechText, repromptText, sessionAttributes = {}) {
    return buildSimpleResponse(speechText, false, repromptText, sessionAttributes);
}

/**
 * Builds a response that simply speaks text and closes the session.
 *
 * @param {string} speechText - The text Alexa should speak.
 * @param {object} [sessionAttributes={}] - Optional session attributes (usually empty when ending).
 * @returns {object} The Alexa response object.
 */
export function buildTellResponse(speechText, sessionAttributes = {}) {
    // When telling, we usually end the session and don't need a reprompt.
    return buildSimpleResponse(speechText, true, null, sessionAttributes);
}

// You can add more complex builders later if needed (e.g., for cards, directives)


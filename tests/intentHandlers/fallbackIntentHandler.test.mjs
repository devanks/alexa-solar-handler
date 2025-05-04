// tests/intentHandlers/fallbackIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleFallbackIntent } from '../../src/intentHandlers/fallbackIntentHandler.mjs';
import { buildAskResponse } from '../../src/utils/responseBuilder.mjs'; // To construct expected result

describe('AMAZON.FallbackIntent Handler', () => {

    // --- Mocks ---
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => mockLogger),
    };

    // --- Mock Event ---
    const mockFallbackEvent = {
        version: '1.0',
        session: {
            new: false,
            sessionId: 'amzn1.echo-api.session.test-fallback-session',
            application: { applicationId: 'amzn1.ask.skill.test-skill-id' },
            attributes: {},
            user: { userId: 'test-user-fallback' }
        },
        context: { /* ... context details ... */ },
        request: {
            type: 'IntentRequest',
            requestId: 'amzn1.echo-api.request.test-fallback-request',
            timestamp: '2023-01-01T17:00:00Z',
            locale: 'en-US',
            intent: {
                name: 'AMAZON.FallbackIntent', // Correct intent name
                confirmationStatus: 'NONE',
                slots: {}, // No specific slots for Fallback
            },
        },
    };

    // --- Reset Mocks ---
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Test Case ---

    it('should return a helpful message and reprompt, keeping the session open', async () => {
        // Arrange
        const expectedSpeech = "Sorry, I didn't understand that request. You can ask about current power, daily production, or system status. You can also say 'help' for more options. What would you like to know?";
        const expectedReprompt = "What solar data are you interested in? Try asking 'what's my current power?' or say 'help'.";

        const expectedResponse = buildAskResponse(expectedSpeech, expectedReprompt);

        // Act
        // Note: Fallback handler doesn't need gcpClient or config
        const result = await handleFallbackIntent(mockFallbackEvent, mockLogger);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Handling AMAZON.FallbackIntent.');
        expect(result).toEqual(expectedResponse); // Check the entire response structure
        expect(result.response.shouldEndSession).toBe(false); // Verify session stays open
    });

});

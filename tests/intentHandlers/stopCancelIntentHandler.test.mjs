// tests/intentHandlers/stopCancelIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// --- FIX: Import the CORRECT exported name ---
import { handleStopCancelIntent } from '../../src/intentHandlers/stopCancelIntentHandler.mjs';
// ---------------------------------------------
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs'; // To construct expected result

describe('Stop/Cancel Intent Handler', () => {

    // --- Mocks ---
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => mockLogger),
    };

    // --- Mock Events ---
    // Helper to create base event structure
    const createBaseEvent = (intentName) => ({
        version: '1.0',
        session: {
            new: false,
            sessionId: `amzn1.echo-api.session.test-${intentName.toLowerCase()}-session`,
            application: { applicationId: 'amzn1.ask.skill.test-skill-id' },
            attributes: {},
            user: { userId: `test-user-${intentName.toLowerCase()}` }
        },
        context: { /* ... context details ... */ },
        request: {
            type: 'IntentRequest',
            requestId: `amzn1.echo-api.request.test-${intentName.toLowerCase()}-request`,
            timestamp: '2023-01-01T16:00:00Z',
            locale: 'en-US',
            intent: {
                name: intentName, // Set dynamically
                confirmationStatus: 'NONE',
                slots: {},
            },
        },
    });

    const mockStopEvent = createBaseEvent('AMAZON.StopIntent');
    const mockCancelEvent = createBaseEvent('AMAZON.CancelIntent');

    // --- Reset Mocks ---
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Test Cases ---

    it('should return a simple goodbye message and end session for AMAZON.StopIntent', async () => {
        // Arrange
        const expectedSpeech = 'Goodbye!';
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        // Note: Handler doesn't need gcpClient or config
        // --- FIX: Call the CORRECT imported function ---
        const result = await handleStopCancelIntent(mockStopEvent, mockLogger);
        // -------------------------------------------

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Handling AMAZON.StopIntent.'); // Check log message
        expect(result).toEqual(expectedResponse); // Check the entire response structure
        expect(result.response.shouldEndSession).toBe(true); // Verify session ends
    });

    it('should return a simple goodbye message and end session for AMAZON.CancelIntent', async () => {
        // Arrange
        const expectedSpeech = 'Goodbye!';
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        // --- FIX: Call the CORRECT imported function ---
        const result = await handleStopCancelIntent(mockCancelEvent, mockLogger);
        // -------------------------------------------

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Handling AMAZON.CancelIntent.'); // Check log message
        expect(result).toEqual(expectedResponse); // Check the entire response structure
        expect(result.response.shouldEndSession).toBe(true); // Verify session ends
    });

});

// tests/intentHandlers/sessionEndedRequestHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleSessionEndedRequest } from '../../src/intentHandlers/sessionEndedRequestHandler.mjs';

describe('SessionEndedRequest Handler', () => {

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
    const createSessionEndedEvent = (reason, error = undefined) => ({
        version: '1.0',
        session: {
            // Session details might be less relevant here but included
            new: false,
            sessionId: `amzn1.echo-api.session.test-session-ended-${reason.toLowerCase()}`,
            application: { applicationId: 'amzn1.ask.skill.test-skill-id' },
            attributes: {},
            user: { userId: `test-user-session-ended` }
        },
        context: { /* ... context details ... */ },
        request: {
            type: 'SessionEndedRequest', // Correct request type
            requestId: `amzn1.echo-api.request.test-session-ended-${reason.toLowerCase()}-request`,
            timestamp: '2023-01-01T18:00:00Z',
            locale: 'en-US',
            reason: reason, // Set dynamically
            ...(error && { error: error }), // Conditionally add error object
        },
    });

    const mockUserInitiatedEvent = createSessionEndedEvent('USER_INITIATED');
    const mockErrorEvent = createSessionEndedEvent('ERROR', {
        type: 'INVALID_RESPONSE',
        message: 'Skill response invalid.'
    });
    const mockExceededPromptsEvent = createSessionEndedEvent('EXCEEDED_MAX_REPROMPTS');

    // --- Reset Mocks ---
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Test Cases ---

    it('should log the reason when session ends due to USER_INITIATED', async () => {
        // Arrange
        const expectedLogPayload = { reason: 'USER_INITIATED', error: undefined };

        // Act
        // Note: Handler doesn't need gcpClient or config
        const result = await handleSessionEndedRequest(mockUserInitiatedEvent, mockLogger);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            expectedLogPayload,
            'Handling SessionEndedRequest.'
        );
        expect(result).toBeUndefined(); // Handler returns resolved promise, await result is undefined
    });

    it('should log the reason and error details when session ends due to ERROR', async () => {
        // Arrange
        const expectedLogPayload = {
            reason: 'ERROR',
            error: {
                type: 'INVALID_RESPONSE',
                message: 'Skill response invalid.'
            }
        };

        // Act
        const result = await handleSessionEndedRequest(mockErrorEvent, mockLogger);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            expectedLogPayload,
            'Handling SessionEndedRequest.'
        );
        expect(result).toBeUndefined();
    });

    it('should log the reason when session ends due to EXCEEDED_MAX_REPROMPTS', async () => {
        // Arrange
        const expectedLogPayload = { reason: 'EXCEEDED_MAX_REPROMPTS', error: undefined };

        // Act
        const result = await handleSessionEndedRequest(mockExceededPromptsEvent, mockLogger);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            expectedLogPayload,
            'Handling SessionEndedRequest.'
        );
        expect(result).toBeUndefined();
    });

});

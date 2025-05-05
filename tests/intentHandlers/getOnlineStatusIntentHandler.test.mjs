// tests/intentHandlers/getOnlineStatusIntentHandler.test.mjs
import { describe, it, test, expect, jest, beforeEach } from '@jest/globals';
import { handleGetOnlineStatusIntent } from '../../src/intentHandlers/getOnlineStatusIntentHandler.mjs';
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs';

describe('GetOnlineStatusIntent Handler', () => {

    // --- Mocks ---
    let mockLogger;
    let mockGcpClient;
    let mockEvent;
    let mockConfig;

    beforeEach(() => {
        // Reset mocks before each test
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            child: jest.fn(() => mockLogger),
        };

        mockGcpClient = jest.fn();

        mockEvent = {
            // Basic structure, specific intent name
            request: {
                type: 'IntentRequest',
                intent: {
                    name: 'GetOnlineStatusIntent',
                },
            },
            // Add other event parts if necessary for future tests
        };

        mockConfig = {
            targetAudience: 'test-audience',
            idToken: 'test-token',
        };
    });

    // --- Parameterized Tests for Successful Responses ---
    test.each([
        [
            { isOnline: true }, // Mock response from gcpClient
            'The solar energy system is currently online and reporting data.', // Expected speech
            'Online' // Test description suffix
        ],
        [
            { isOnline: false },
            'The solar energy system is currently reporting as offline.',
            'Offline'
        ],
    ])('should return correct status when system is %s', async (mockStatusResult, expectedSpeech, _description) => {
        // Arrange
        mockGcpClient.mockResolvedValue(mockStatusResult);
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetOnlineStatusIntent(mockEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Handling GetOnlineStatusIntent.');
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Called before and after gcpClient call
        expect(mockLogger.debug).toHaveBeenCalledWith('Calling gcpClient.getSystemStatus...');
        expect(mockLogger.debug).toHaveBeenCalledWith({ statusResult: mockStatusResult }, 'Received response from gcpClient.getSystemStatus.');
        expect(result).toEqual(expectedResponse);
        expect(result.response.shouldEndSession).toBe(true);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Test for Backend Error ---
    it('should return an error message if the backend call fails', async () => {
        // Arrange
        const backendError = new Error("Backend unavailable");
        mockGcpClient.mockRejectedValue(backendError);
        const expectedSpeech = "Sorry, I couldn't retrieve the system status right now. There might be a connection issue. Please try again later.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetOnlineStatusIntent(mockEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Handling GetOnlineStatusIntent.');
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only called before the call
        expect(mockLogger.debug).toHaveBeenCalledWith('Calling gcpClient.getSystemStatus...');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: backendError },
            'Error fetching system status from backend for GetOnlineStatusIntent.'
        );
        expect(result).toEqual(expectedResponse);
        expect(result.response.shouldEndSession).toBe(true);
        expect(mockLogger.warn).not.toHaveBeenCalled();

    });

    // --- Parameterized Tests for Unexpected Backend Responses ---
    const unexpectedResponses = [
        [null, 'null response'],
        [undefined, 'undefined response'],
        [{}, 'empty object response'],
        [{ isOnline: 'yes' }, 'non-boolean isOnline'],
        [{ online: true }, 'incorrect property name'],
        ['just a string', 'string response'],
        [[true], 'array response'],
    ];

    describe('Handling Unexpected Backend Responses', () => {
        test.each(unexpectedResponses)('should return an error message for %s', async (mockStatusResult, _description) => {
            // Arrange
            mockGcpClient.mockResolvedValue(mockStatusResult);
            const expectedSpeech = "Sorry, I received an unexpected status format from the system. I can't determine if it's online right now.";
            const expectedResponse = buildTellResponse(expectedSpeech);

            // Act
            const result = await handleGetOnlineStatusIntent(mockEvent, mockLogger, mockGcpClient, mockConfig);

            // Assert
            expect(mockLogger.info).toHaveBeenCalledWith('Handling GetOnlineStatusIntent.');
            expect(mockGcpClient).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Called before and after gcpClient call
            expect(mockLogger.debug).toHaveBeenCalledWith({ statusResult: mockStatusResult }, 'Received response from gcpClient.getSystemStatus.');
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                { statusResult: mockStatusResult },
                'Received unexpected format from getSystemStatus.'
            );
            expect(result).toEqual(expectedResponse);
            expect(result.response.shouldEndSession).toBe(true);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

});

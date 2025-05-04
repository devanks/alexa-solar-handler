// tests/intentHandlers/getCurrentPowerIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleGetCurrentPowerIntent } from '../../src/intentHandlers/getCurrentPowerIntentHandler.mjs';
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs'; // To construct expected results

describe('GetCurrentPowerIntent Handler', () => {

    // --- Mocks ---
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => mockLogger),
    };
    const mockGcpClient = jest.fn(); // Mock for the passed-in callGcpFunction
    const mockConfig = {
        targetAudience: 'test-audience',
        idToken: 'test-token',
    };

    // --- Mock Event ---
    const mockGetCurrentPowerEvent = {
        version: '1.0',
        session: {
            // ... session details ...
            attributes: {}, // Start with empty attributes
            user: { userId: 'test-user-id' }
        },
        context: { /* ... context details ... */ },
        request: {
            type: 'IntentRequest',
            requestId: 'amzn1.echo-api.request.test-power',
            timestamp: '2023-01-01T13:00:00Z',
            locale: 'en-US',
            intent: {
                name: 'GetCurrentPowerIntent',
                confirmationStatus: 'NONE',
                slots: {}, // No slots expected for this intent
            },
        },
    };

    // --- Expected Payload ---
    const expectedGcpPayload = {
        action: 'GET_SOLAR_DATA', // Or 'GET_CURRENT_POWER' if you changed it
        dataType: 'current',
        // userId: 'test-user-id' // Uncomment if you add userId to payload
    };

    // --- Reset Mocks ---
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Test Cases ---

    it('should call GCP function and return formatted power data on success', async () => {
        // Arrange
        const mockGcpSuccessResponse = { value: 1500, unit: 'W' };
        mockGcpClient.mockResolvedValue(mockGcpSuccessResponse);

        const expectedSpeech = 'Your current solar production is 1500 watts.';
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(
            mockGetCurrentPowerEvent,
            mockLogger,
            mockGcpClient,
            mockConfig
        );

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Handling GetCurrentPowerIntent.');
        expect(mockLogger.info).toHaveBeenCalledWith({ payload: expectedGcpPayload }, 'Calling GCP function to get current power data.');
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockGcpClient).toHaveBeenCalledWith(
            mockConfig.targetAudience,
            mockConfig.idToken,
            expectedGcpPayload,
            mockLogger // Ensure logger is passed through
        );
        expect(mockLogger.info).toHaveBeenCalledWith({ gcpResponse: mockGcpSuccessResponse }, 'Received response from GCP function.');
        expect(result).toEqual(expectedResponse);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle different units correctly (e.g., kW)', async () => {
        // Arrange
        const mockGcpSuccessResponse = { value: 1.5, unit: 'kW' };
        mockGcpClient.mockResolvedValue(mockGcpSuccessResponse);

        const expectedSpeech = 'Your current solar production is 1.5 kW.'; // Doesn't convert kW to watts
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expectedResponse);
    });


    it('should return error message if GCP response is successful but malformed (missing value)', async () => {
        // Arrange
        const mockGcpMalformedResponse = { unit: 'W' }; // Missing 'value'
        mockGcpClient.mockResolvedValue(mockGcpMalformedResponse);

        const expectedSpeech = "Sorry, I received an unexpected response from the solar monitor. Please try again later.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { gcpResponse: mockGcpMalformedResponse },
            'GCP function response was successful but malformed or missing expected data (value, unit) for current power.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return error message if GCP response is successful but malformed (missing unit)', async () => {
        // Arrange
        const mockGcpMalformedResponse = { value: 1200 }; // Missing 'unit'
        mockGcpClient.mockResolvedValue(mockGcpMalformedResponse);

        const expectedSpeech = "Sorry, I received an unexpected response from the solar monitor. Please try again later.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { gcpResponse: mockGcpMalformedResponse },
            'GCP function response was successful but malformed or missing expected data (value, unit) for current power.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return generic error message if GCP client throws generic error', async () => {
        // Arrange
        const genericError = new Error("Network connection failed");
        mockGcpClient.mockRejectedValue(genericError);

        const expectedSpeech = "Sorry, I couldn't connect to the solar monitor right now.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: genericError },
            'Error calling GCP function for GetCurrentPowerIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws error with statusCode 500', async () => {
        // Arrange
        const serverError = new Error("Internal Server Error");
        serverError.statusCode = 500; // Add statusCode property
        mockGcpClient.mockRejectedValue(serverError);

        const expectedSpeech = "There was a problem retrieving the current power data from the backend.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: serverError },
            'Error calling GCP function for GetCurrentPowerIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws error with statusCode 503', async () => {
        // Arrange
        const unavailableError = new Error("Service Unavailable");
        unavailableError.statusCode = 503;
        mockGcpClient.mockRejectedValue(unavailableError);

        const expectedSpeech = "The solar monitor service seems to be temporarily unavailable. Please try again soon.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: unavailableError },
            'Error calling GCP function for GetCurrentPowerIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws timeout error', async () => {
        // Arrange
        const timeoutError = new Error("Request timed out after 10000ms"); // Example timeout message
        mockGcpClient.mockRejectedValue(timeoutError);

        const expectedSpeech = "The request to the solar monitor timed out. Please try again.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetCurrentPowerIntent(mockGetCurrentPowerEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: timeoutError },
            'Error calling GCP function for GetCurrentPowerIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

});

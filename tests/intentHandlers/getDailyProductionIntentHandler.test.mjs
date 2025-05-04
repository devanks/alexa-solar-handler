// tests/intentHandlers/getDailyProductionIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleGetDailyProductionIntent } from '../../src/intentHandlers/getDailyProductionIntentHandler.mjs';
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs'; // To construct expected results

describe('GetDailyProductionIntent Handler', () => {

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
        targetAudience: 'test-audience-daily',
        idToken: 'test-token-daily',
    };

    // --- Mock Event ---
    const mockGetDailyProductionEvent = {
        version: '1.0',
        session: {
            // ... session details ...
            attributes: {},
            user: { userId: 'test-user-daily' }
        },
        context: { /* ... context details ... */ },
        request: {
            type: 'IntentRequest',
            requestId: 'amzn1.echo-api.request.test-daily',
            timestamp: '2023-01-01T14:00:00Z',
            locale: 'en-US',
            intent: {
                name: 'GetDailyProductionIntent', // Correct intent name
                confirmationStatus: 'NONE',
                slots: {}, // No slots expected
            },
        },
    };

    // --- Expected Payload ---
    const expectedGcpPayload = {
        action: 'GET_SOLAR_DATA', // Or 'GET_DAILY_PRODUCTION' if you changed it
        dataType: 'daily', // Expecting 'daily'
        // userId: 'test-user-daily' // Uncomment if you add userId to payload
    };

    // --- Reset Mocks ---
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Test Cases ---

    it('should call GCP function and return formatted daily production data on success (kWh)', async () => {
        // Arrange
        const mockGcpSuccessResponse = { value: 12.5, unit: 'kWh' }; // Typical unit for daily
        mockGcpClient.mockResolvedValue(mockGcpSuccessResponse);

        const expectedSpeech = 'Your total solar production for the day is 12.5 kilowatt hours.';
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(
            mockGetDailyProductionEvent,
            mockLogger,
            mockGcpClient,
            mockConfig
        );

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('Handling GetDailyProductionIntent.');
        expect(mockLogger.info).toHaveBeenCalledWith({ payload: expectedGcpPayload }, 'Calling GCP function to get daily production data.');
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockGcpClient).toHaveBeenCalledWith(
            mockConfig.targetAudience,
            mockConfig.idToken,
            expectedGcpPayload,
            mockLogger
        );
        expect(mockLogger.info).toHaveBeenCalledWith({ gcpResponse: mockGcpSuccessResponse }, 'Received response from GCP function.');
        expect(result).toEqual(expectedResponse);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle other units correctly (e.g., Wh)', async () => {
        // Arrange
        const mockGcpSuccessResponse = { value: 12500, unit: 'Wh' }; // Watt-hours
        mockGcpClient.mockResolvedValue(mockGcpSuccessResponse);

        const expectedSpeech = 'Your total solar production for the day is 12500 Wh.'; // Doesn't convert Wh
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expectedResponse);
    });


    it('should return error message if GCP response is successful but malformed (missing value)', async () => {
        // Arrange
        const mockGcpMalformedResponse = { unit: 'kWh' }; // Missing 'value'
        mockGcpClient.mockResolvedValue(mockGcpMalformedResponse);

        const expectedSpeech = "Sorry, I received an unexpected response from the solar monitor. Please try again later.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { gcpResponse: mockGcpMalformedResponse },
            'GCP function response was successful but malformed or missing expected data (value, unit) for daily production.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return error message if GCP response is successful but malformed (missing unit)', async () => {
        // Arrange
        const mockGcpMalformedResponse = { value: 10.1 }; // Missing 'unit'
        mockGcpClient.mockResolvedValue(mockGcpMalformedResponse);

        const expectedSpeech = "Sorry, I received an unexpected response from the solar monitor. Please try again later.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { gcpResponse: mockGcpMalformedResponse },
            'GCP function response was successful but malformed or missing expected data (value, unit) for daily production.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return generic error message if GCP client throws generic error', async () => {
        // Arrange
        const genericError = new Error("DNS lookup failed");
        mockGcpClient.mockRejectedValue(genericError);

        const expectedSpeech = "Sorry, I couldn't connect to the solar monitor right now.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: genericError },
            'Error calling GCP function for GetDailyProductionIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws error with statusCode 500', async () => {
        // Arrange
        const serverError = new Error("Backend Database Error");
        serverError.statusCode = 500;
        mockGcpClient.mockRejectedValue(serverError);

        const expectedSpeech = "There was a problem retrieving the daily production data from the backend.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: serverError },
            'Error calling GCP function for GetDailyProductionIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws error with statusCode 503', async () => {
        // Arrange
        const unavailableError = new Error("Service Unavailable - Maintenance");
        unavailableError.statusCode = 503;
        mockGcpClient.mockRejectedValue(unavailableError);

        const expectedSpeech = "The solar monitor service seems to be temporarily unavailable. Please try again soon.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: unavailableError },
            'Error calling GCP function for GetDailyProductionIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

    it('should return specific error message if GCP client throws timeout error', async () => {
        // Arrange
        const timeoutError = new Error("Connection timed out"); // Different phrasing
        mockGcpClient.mockRejectedValue(timeoutError);

        const expectedSpeech = "The request to the solar monitor timed out. Please try again.";
        const expectedResponse = buildTellResponse(expectedSpeech);

        // Act
        const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: timeoutError },
            'Error calling GCP function for GetDailyProductionIntent.'
        );
        expect(result).toEqual(expectedResponse);
    });

});

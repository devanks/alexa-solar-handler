// tests/intentHandlers/getDailyProductionIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleGetDailyProductionIntent } from '../../src/intentHandlers/getDailyProductionIntentHandler.mjs';
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs';

describe('GetDailyProductionIntent Handler', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockLogger), // Ensure child returns the mock too
  };

  const mockGcpClient = jest.fn();
  // --- Mock Config (Ensure it's defined) ---
  const mockConfig = {
    targetAudience: 'test-audience-daily',
    idToken: 'test-token-daily',
  };
  // --- Mock Event (Ensure it's defined) ---
  const mockGetDailyProductionEvent = {
    version: '1.0',
    session: {
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
        name: 'GetDailyProductionIntent',
        confirmationStatus: 'NONE',
        slots: {},
      },
    },
  };

  // --- Define the fixed GCP Response Structure (Globally for reuse) ---
  const mockFullGcpResponse = {
    dailyProductionKWh: 27.46, // Test value for daily production
    currentPowerW: 0,
    isOnline: true,
    timestamp: 1746393603,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call GCP function, extract dailyProductionKWh, and return formatted data on success', async () => {
    // Arrange
    // ---> DEFINE expectedGcpPayload INSIDE the test case <---
    const expectedGcpPayload = {
      action: 'GET_SOLAR_DATA',
      dataType: 'daily', // Correct type for daily
    };
    // Use the globally defined mock response
    mockGcpClient.mockResolvedValue(mockFullGcpResponse);
    const expectedSpeech =
        'Your total solar production for the day is 27.5 kilowatt hours.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetDailyProductionIntent(
        mockGetDailyProductionEvent,
        mockLogger,
        mockGcpClient,
        mockConfig
    );

    // Assert
    // ---> The assertion now uses the locally defined expectedGcpPayload <---
    expect(mockGcpClient).toHaveBeenCalledWith(
        mockConfig.targetAudience,
        mockConfig.idToken,
        expectedGcpPayload, // Uses the one defined above
        mockLogger
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
        { gcpResponse: mockFullGcpResponse },
        'Received response from GCP function.'
    );
    expect(result).toEqual(expectedResponse);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should handle zero production correctly', async () => {
    // Arrange
    const mockZeroProductionResponse = {
      ...mockFullGcpResponse,
      dailyProductionKWh: 0,
    };
    mockGcpClient.mockResolvedValue(mockZeroProductionResponse);

    const expectedSpeech =
        'Your total solar production for the day is 0.0 kilowatt hours.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetDailyProductionIntent(
        mockGetDailyProductionEvent,
        mockLogger,
        mockGcpClient,
        mockConfig
    );

    // Assert
    expect(result).toEqual(expectedResponse);
  });

  it('should return error message if GCP response is successful but dailyProductionKWh field is missing', async () => {
    // Arrange
    const { dailyProductionKWh, ...malformedResponse } = mockFullGcpResponse;
    mockGcpClient.mockResolvedValue(malformedResponse);

    const expectedSpeech =
        'Sorry, I received an incomplete response from the solar monitor. Please try again later.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetDailyProductionIntent(
        mockGetDailyProductionEvent,
        mockLogger,
        mockGcpClient,
        mockConfig
    );

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
        { gcpResponse: malformedResponse },
        'GCP function response was successful but missing expected field (dailyProductionKWh).'
    );
    expect(result).toEqual(expectedResponse);
  });

  it('should return error message if GCP response field dailyProductionKWh is not a number', async () => {
    // Arrange
    const malformedResponse = {
      ...mockFullGcpResponse,
      dailyProductionKWh: null, // Value is wrong type
    };
    mockGcpClient.mockResolvedValue(malformedResponse);

    const expectedSpeech =
        'Sorry, I received unexpected data format from the solar monitor. Please try again later.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetDailyProductionIntent(
        mockGetDailyProductionEvent,
        mockLogger,
        mockGcpClient,
        mockConfig
    );

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
        { gcpResponse: malformedResponse },
        'GCP response field dailyProductionKWh was not a number.'
    );
    expect(result).toEqual(expectedResponse);
  });

  // --- Error handling tests (GCP client throwing errors) ---
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
    expect(mockLogger.error).toHaveBeenCalledWith({ err: genericError }, 'Error calling GCP function for GetDailyProductionIntent.');
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
    expect(mockLogger.error).toHaveBeenCalledWith({ err: serverError }, 'Error calling GCP function for GetDailyProductionIntent.');
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
    expect(mockLogger.error).toHaveBeenCalledWith({ err: unavailableError }, 'Error calling GCP function for GetDailyProductionIntent.');
    expect(result).toEqual(expectedResponse);
  });

  it('should return specific error message if GCP client throws timeout error', async () => {
    // Arrange
    const timeoutError = new Error("Connection timed out");
    mockGcpClient.mockRejectedValue(timeoutError);
    const expectedSpeech = "The request to the solar monitor timed out. Please try again.";
    const expectedResponse = buildTellResponse(expectedSpeech);
    // Act
    const result = await handleGetDailyProductionIntent(mockGetDailyProductionEvent, mockLogger, mockGcpClient, mockConfig);
    // Assert
    expect(mockGcpClient).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith({ err: timeoutError }, 'Error calling GCP function for GetDailyProductionIntent.');
    expect(result).toEqual(expectedResponse);
  });

// --- Final closing brace and parenthesis ---
});

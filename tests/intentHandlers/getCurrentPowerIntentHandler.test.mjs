// tests/intentHandlers/getCurrentPowerIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleGetCurrentPowerIntent } from '../../src/intentHandlers/getCurrentPowerIntentHandler.mjs';
import { buildTellResponse } from '../../src/utils/responseBuilder.mjs';

describe('GetCurrentPowerIntent Handler', () => {
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
    targetAudience: 'test-audience',
    idToken: 'test-token',
  };
  // --- Mock Event (Ensure it's defined) ---
  const mockGetCurrentPowerEvent = {
    version: '1.0',
    session: {
      attributes: {},
      user: { userId: 'test-user-id' },
    },
    context: {
      /* ... context details ... */
    },
    request: {
      type: 'IntentRequest',
      requestId: 'amzn1.echo-api.request.test-power',
      timestamp: '2023-01-01T13:00:00Z',
      locale: 'en-US',
      intent: {
        name: 'GetCurrentPowerIntent',
        confirmationStatus: 'NONE',
        slots: {},
      },
    },
  };

  // --- Define the fixed GCP Response Structure (Globally for reuse in multiple tests) ---
  const mockFullGcpResponse = {
    dailyProductionKWh: 27.46,
    currentPowerW: 1500, // Test value for current power
    isOnline: true,
    timestamp: 1746393603,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call GCP function, extract currentPowerW, and return formatted power data on success', async () => {
    // Arrange
    // ---> DEFINE expectedGcpPayload INSIDE the test case <---
    const expectedGcpPayload = {
      action: 'GET_SOLAR_DATA',
      dataType: 'current',
    };
    // Use the globally defined mock response
    mockGcpClient.mockResolvedValue(mockFullGcpResponse);
    const expectedSpeech = 'Your current solar production is 1.5 kilowatts.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
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

  it('should handle zero watts correctly', async () => {
    // Arrange
    const mockZeroPowerResponse = { ...mockFullGcpResponse, currentPowerW: 0 };
    mockGcpClient.mockResolvedValue(mockZeroPowerResponse);

    const expectedSpeech = 'Your current solar production is 0 watts.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );

    // Assert
    expect(result).toEqual(expectedResponse);
  });

  it('should return error message if GCP response is successful but currentPowerW field is missing', async () => {
    // Arrange
    // Create a response *missing* the specific field
    const { currentPowerW, ...malformedResponse } = mockFullGcpResponse;
    mockGcpClient.mockResolvedValue(malformedResponse);

    const expectedSpeech =
      'Sorry, I received an incomplete response from the solar monitor. Please try again later.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
      { gcpResponse: malformedResponse }, // Log the actual malformed response
      'GCP function response was successful but missing expected field (currentPowerW).'
    );
    expect(result).toEqual(expectedResponse);
  });

  it('should return error message if GCP response field currentPowerW is not a number', async () => {
    // Arrange
    const malformedResponse = {
      ...mockFullGcpResponse,
      currentPowerW: 'invalid', // Value is wrong type
    };
    mockGcpClient.mockResolvedValue(malformedResponse);

    const expectedSpeech =
      'Sorry, I received unexpected data format from the solar monitor. Please try again later.';
    const expectedResponse = buildTellResponse(expectedSpeech);

    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
      { gcpResponse: malformedResponse },
      'GCP response field currentPowerW was not a number.'
    );
    expect(result).toEqual(expectedResponse);
  });

  // --- Error handling tests (GCP client throwing errors) ---
  it('should return generic error message if GCP client throws generic error', async () => {
    // Arrange
    const genericError = new Error('Network connection failed');
    mockGcpClient.mockRejectedValue(genericError);
    const expectedSpeech =
      "Sorry, I couldn't connect to the solar monitor right now.";
    const expectedResponse = buildTellResponse(expectedSpeech);
    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );
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
    const serverError = new Error('Internal Server Error');
    serverError.statusCode = 500;
    mockGcpClient.mockRejectedValue(serverError);
    const expectedSpeech =
      'There was a problem retrieving the current power data from the backend.';
    const expectedResponse = buildTellResponse(expectedSpeech);
    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );
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
    const unavailableError = new Error('Service Unavailable');
    unavailableError.statusCode = 503;
    mockGcpClient.mockRejectedValue(unavailableError);
    const expectedSpeech =
      'The solar monitor service seems to be temporarily unavailable. Please try again soon.';
    const expectedResponse = buildTellResponse(expectedSpeech);
    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );
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
    const timeoutError = new Error('Request timed out after 10000ms');
    mockGcpClient.mockRejectedValue(timeoutError);
    const expectedSpeech =
      'The request to the solar monitor timed out. Please try again.';
    const expectedResponse = buildTellResponse(expectedSpeech);
    // Act
    const result = await handleGetCurrentPowerIntent(
      mockGetCurrentPowerEvent,
      mockLogger,
      mockGcpClient,
      mockConfig
    );
    // Assert
    expect(mockGcpClient).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: timeoutError },
      'Error calling GCP function for GetCurrentPowerIntent.'
    );
    expect(result).toEqual(expectedResponse);
  });

  // --- THIS WAS MISSING ---
});

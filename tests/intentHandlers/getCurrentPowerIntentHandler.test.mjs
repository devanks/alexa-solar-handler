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
  const mockConfig = {
    /* ... same as before ... */
  };
  const mockGetCurrentPowerEvent = {
    /* ... same as before ... */
  };
  const expectedGcpPayload = {
    /* ... same as before ... */
  };

  // --- NEW: Define the fixed GCP Response Structure ---
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
    const mockFullGcpResponse = {
      // Make sure mockFullGcpResponse is defined/accessible here too
      dailyProductionKWh: 27.46,
      currentPowerW: 1500,
      isOnline: true,
      timestamp: 1746393603,
    };

    mockGcpClient.mockResolvedValue(mockFullGcpResponse);
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
      currentPowerW: 'invalid',
    }; // Value is wrong type
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

  // --- Error handling tests (GCP client throwing errors) remain the same ---
  it('should return generic error message if GCP client throws generic error', async () => {
    /* ... no changes needed ... */
  });
  it('should return specific error message if GCP client throws error with statusCode 500', async () => {
    /* ... no changes needed ... */
  });
  it('should return specific error message if GCP client throws error with statusCode 503', async () => {
    /* ... no changes needed ... */
  });
  it('should return specific error message if GCP client throws timeout error', async () => {
    /* ... no changes needed ... */
  });
});

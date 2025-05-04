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
  const mockConfig = {
    /* ... same as before ... */
  };
  const mockGetDailyProductionEvent = {
    /* ... same as before ... */
  };
  const expectedGcpPayload = {
    /* ... same as before ... */
  };

  // --- NEW: Define the fixed GCP Response Structure ---
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
    const mockFullGcpResponse = {
      // Make sure mockFullGcpResponse is defined/accessible here too
      dailyProductionKWh: 27.46,
      currentPowerW: 0,
      isOnline: true,
      timestamp: 1746393603,
    };

    mockGcpClient.mockResolvedValue(mockFullGcpResponse);
    const expectedSpeech =
      'Your total solar production for the day is 27.46 kilowatt hours.';
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
      'Your total solar production for the day is 0 kilowatt hours.';
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
      dailyProductionKWh: null,
    }; // Value is wrong type
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

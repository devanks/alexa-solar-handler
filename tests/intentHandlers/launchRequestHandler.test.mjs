// tests/intentHandlers/launchRequestHandler.test.mjs
import { describe, it, expect, jest } from '@jest/globals';
import { handleLaunchRequest } from '../../src/intentHandlers/launchRequestHandler.mjs';
import { buildAskResponse } from '../../src/utils/responseBuilder.mjs'; // We know the handler uses this

// Mock the responseBuilder module if we wanted to check calls *to* it,
// but for handlers, it's often better to test the final output structure.
// jest.mock('../../src/utils/responseBuilder.mjs');

describe('LaunchRequest Handler', () => {
  // Create a mock logger for testing
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockLogger), // Allow chaining if needed
  };

  // Mock event object for LaunchRequest
  const mockLaunchEvent = {
    version: '1.0',
    session: {
      /* ... session details ... */
    },
    context: {
      /* ... context details ... */
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'amzn1.echo-api.request.xxxx',
      timestamp: '2023-01-01T12:00:00Z',
      locale: 'en-US',
    },
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a welcome message using buildAskResponse', async () => {
    // Arrange
    const expectedSpeech =
      'Welcome to Solar Monitor! You can ask about your current solar production or daily total. What would you like to know?';
    const expectedReprompt = "Try asking: what's my current production?";

    // This is the structure buildAskResponse is expected to create
    const expectedResponse = buildAskResponse(expectedSpeech, expectedReprompt);

    // Act
    const result = await handleLaunchRequest(mockLaunchEvent, mockLogger);

    // Assert
    // 1. Check the overall response structure matches what buildAskResponse creates
    expect(result).toEqual(expectedResponse);

    // 2. Verify the specific content (optional sanity check, already covered by above)
    expect(result.response.outputSpeech.text).toBe(expectedSpeech);
    expect(result.response.reprompt.outputSpeech.text).toBe(expectedReprompt);
    expect(result.response.shouldEndSession).toBe(false);

    // 3. Verify logging happened
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Handling LaunchRequest.');
    expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors were logged
  });

  // --- Add tests for backend interaction later if uncommented ---
  /*
    it('should call backend and use data if successful', async () => {
        // Arrange
        const mockGcpClient = jest.fn().mockResolvedValue({ status: 'OK' });
        const mockConfig = { targetAudience: 'aud', idToken: 'token' };
        // ... setup expected response using mock data ...

        // Act
        const result = await handleLaunchRequest(mockLaunchEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('Fetching initial state from backend for LaunchRequest.');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ initialState: { status: 'OK' } }), 'Received initial state from backend.');
        // ... assert response uses the data ...
    });

    it('should return error response if backend call fails', async () => {
        // Arrange
        const mockGcpClient = jest.fn().mockRejectedValue(new Error('Network Error'));
        const mockConfig = { targetAudience: 'aud', idToken: 'token' };
        // ... setup expected error response (likely using buildTellResponse) ...

        // Act
        const result = await handleLaunchRequest(mockLaunchEvent, mockLogger, mockGcpClient, mockConfig);

        // Assert
        expect(mockGcpClient).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Failed to fetch initial state during LaunchRequest.');
        // ... assert response is the specific error response ...
    });
    */
});

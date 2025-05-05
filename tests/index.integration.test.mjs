// tests/index.integration.test.mjs
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { getSecret } from '../src/utils/secrets.mjs';
import { generateIdToken } from '../src/utils/gcpAuth.mjs';
import { callGcpFunction } from '../src/utils/gcpClient.mjs';

// --- Mock External Boundaries ONLY ---
const mockGetSecret = jest.fn(getSecret);
const mockGenerateIdToken = jest.fn(generateIdToken);
const mockCallGcpFunction = jest.fn(callGcpFunction);

// Apply mocks using jest.unstable_mockModule
jest.unstable_mockModule('../src/utils/secrets.mjs', () => ({
  getSecret: mockGetSecret,
}));
jest.unstable_mockModule('../src/utils/gcpAuth.mjs', () => ({
  generateIdToken: mockGenerateIdToken,
}));
jest.unstable_mockModule('../src/utils/gcpClient.mjs', () => ({
  callGcpFunction: mockCallGcpFunction,
}));
// --- Logger is NOT mocked ---

// --- FIX: Use top-level await for dynamic import ---
const indexModule = await import('../src/index.mjs');
const handler = indexModule.handler; // Assign handler directly

// --- Dynamically import the SUT (System Under Test) ---
let originalEnv;
beforeAll(async () => {
  originalEnv = { ...process.env };
  // Import index.mjs AFTER mocks are defined
});

// --- Test Setup ---
const MOCK_CONTEXT = { awsRequestId: 'int-test-req-id' };
const MOCK_GCP_CREDENTIALS = { project_id: 'int-test-proj' };
const MOCK_ID_TOKEN = 'mock-int-jwt-token';
const FAKE_SECRET_ID = 'int-fake-secret-id';
const FAKE_AUDIENCE = 'int-fake-audience-url';

// Helper to create mock Alexa events
const createMockEvent = (requestType, intentName = null, slots = {}) => ({
  version: '1.0',
  session: {
    new: true,
    sessionId: `int-test-session-${Math.random()}`,
    application: { applicationId: 'amzn1.ask.skill.fake-skill-id' },
    user: { userId: 'amzn1.ask.account.fake-user-id' },
    attributes: {},
  },
  context: {
    System: {
      apiEndpoint: 'https://api.amazonalexa.com',
      apiAccessToken: 'fakeToken',
      application: { applicationId: 'amzn1.ask.skill.fake-skill-id' },
      user: { userId: 'amzn1.ask.account.fake-user-id' },
      device: { deviceId: 'fakeDeviceId', supportedInterfaces: {} },
    },
  },
  request: {
    type: requestType,
    requestId: `int-test-req-${Math.random()}`,
    timestamp: new Date().toISOString(),
    locale: 'en-US',
    ...(requestType === 'IntentRequest' && {
      intent: { name: intentName, confirmationStatus: 'NONE', slots },
    }),
    ...(requestType === 'LaunchRequest' && {}),
    ...(requestType === 'SessionEndedRequest' && { reason: 'USER_INITIATED' }),
  },
});

describe('Lambda Handler Integration Tests', () => {
  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.GCP_SECRET_ID = FAKE_SECRET_ID;
    process.env.TARGET_AUDIENCE = FAKE_AUDIENCE;

    mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
    mockGenerateIdToken.mockResolvedValue(MOCK_ID_TOKEN);
    mockCallGcpFunction.mockResolvedValue({ status: 'ok' });
  });

  // === Test Cases Expecting Correct Routing ===

  describe('LaunchRequest Handling', () => {
    it('should return the welcome message', async () => {
      // Expect correct routing
      const event = createMockEvent('LaunchRequest');
      const result = await handler(event, MOCK_CONTEXT);

      // Check auth flow - use expect.anything() for the logger argument
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      expect(mockCallGcpFunction).not.toHaveBeenCalled();

      // Expect intended behavior
      expect(result.response.outputSpeech.text).toContain(
        'Welcome to Solar Monitor'
      );
      expect(result.response.shouldEndSession).toBe(false);
    });
  });

  describe('SessionEndedRequest Handling', () => {
    it('should handle SessionEndedRequest gracefully', async () => {
      // Arrange
      // Create a SessionEndedRequest event (reason can vary)
      const event = createMockEvent('SessionEndedRequest');
      event.request.reason = 'USER_INITIATED'; // Example reason

      // Act
      // The handler might return null/undefined or an empty response
      // for SessionEndedRequest, as no speech is sent back.
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth flow - often SessionEndedRequest might bypass full auth
      // depending on implementation, but let's assume it might still run.
      // Adjust these if your index.mjs skips auth for SessionEndedRequest.
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );

      // Ensure GCP function was NOT called
      expect(mockCallGcpFunction).not.toHaveBeenCalled();

      // SessionEnded handlers typically return nothing or an empty response object.
      // Check for null/undefined OR an empty response object.
      // If your handler explicitly returns {}, use that. If it returns nothing, check for undefined.
      // If it returns null, check for null. Let's check for undefined as a common case.
      // Adjust this based on your handleSessionEndedRequest implementation.
      // A safe check might be that there's no 'response' property or it's empty.
      expect(result?.response).toBeUndefined(); // Or expect(result).toBeNull(); or expect(result).toEqual({});

      // We can't easily assert specific logs without mocking the logger,
      // but we know the handler completed without throwing an error.
    });

    it('should handle SessionEndedRequest with ERROR reason', async () => {
      // Arrange
      const event = createMockEvent('SessionEndedRequest');
      event.request.reason = 'ERROR';
      event.request.error = {
        type: 'INVALID_RESPONSE',
        message: 'Skill response invalid.',
      };

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Basic checks are the same - no crash, no GCP call, no response body
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      expect(mockCallGcpFunction).not.toHaveBeenCalled();
      expect(result?.response).toBeUndefined(); // Adjust as needed

      // In a real scenario, you'd expect specific logging for the error case,
      // but we can't assert that here without logger mocks.
    });
  });

  describe('GetCurrentPowerIntent Handling', () => {
    it('should call GCP and return power', async () => {
      // Expect correct routing
      const event = createMockEvent('IntentRequest', 'GetCurrentPowerIntent');
      mockCallGcpFunction.mockResolvedValue({ currentPowerW: 1570 });
      const result = await handler(event, MOCK_CONTEXT);

      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      expect(mockCallGcpFunction).toHaveBeenCalledWith(
        FAKE_AUDIENCE,
        MOCK_ID_TOKEN,
        expect.objectContaining({ dataType: 'current' }),
        expect.anything() // Use expect.anything() for logger
      );
      // *** ------------------------ ***

      // Expect intended behavior
      expect(result.response.outputSpeech.text).toBe(
        'Your current solar production is 1.6 kilowatts.'
      );
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should return an error message if callGcpFunction fails', async () => {
      // Expect correct routing
      const event = createMockEvent('IntentRequest', 'GetCurrentPowerIntent');
      const gcpError = new Error('GCP Network Error');
      gcpError.code = 'ETIMEDOUT';
      mockCallGcpFunction.mockRejectedValue(gcpError);
      const result = await handler(event, MOCK_CONTEXT);
      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // *** ------------------------ ***
      expect(result.response.outputSpeech.text).toContain(
        "couldn't connect to the solar monitor"
      );
      // Cannot easily assert console logs without mocking, so removed logger assertion
    });

    it('should return an error message if GCP response is missing data', async () => {
      // Expect correct routing
      const event = createMockEvent('IntentRequest', 'GetCurrentPowerIntent');
      mockCallGcpFunction.mockResolvedValue({ message: 'Data not ready' });
      const result = await handler(event, MOCK_CONTEXT);
      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // *** ------------------------ ***
      expect(result.response.outputSpeech.text).toContain(
        'received an incomplete response'
      );
      // Cannot easily assert console logs without mocking
    });
  });

  describe('GetSummaryIntent Handling', () => {
    // Expect correct routing now

    it('should call GCP and return summary', async () => {
      const event = createMockEvent('IntentRequest', 'GetSummaryIntent');
      mockCallGcpFunction.mockResolvedValue({
        currentPowerW: 2100,
        dailyProductionKWh: 8.3,
        isOnline: true,
      });
      const result = await handler(event, MOCK_CONTEXT);
      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      expect(mockCallGcpFunction).toHaveBeenCalledWith(
        FAKE_AUDIENCE,
        MOCK_ID_TOKEN,
        expect.objectContaining({ dataType: 'summary' }),
        expect.anything()
      );
      // *** ------------------------ ***
      expect(result.response.outputSpeech.text).toContain('system is online');
      expect(result.response.outputSpeech.text).toContain(
        'generating 2.1 kilowatts'
      );
    });

    it('should return partial summary', async () => {
      const event = createMockEvent('IntentRequest', 'GetSummaryIntent');
      mockCallGcpFunction.mockResolvedValue({
        dailyProductionKWh: 9.1,
        isOnline: true,
      });
      const result = await handler(event, MOCK_CONTEXT);
      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // *** ------------------------ ***
      expect(result.response.outputSpeech.text).toContain('system is online');
      expect(result.response.outputSpeech.text).toContain('9.1 kilowatt hours');
    });

    it('should return error if call would fail', async () => {
      const event = createMockEvent('IntentRequest', 'GetSummaryIntent');
      mockCallGcpFunction.mockRejectedValue({ statusCode: 503 });
      const result = await handler(event, MOCK_CONTEXT);
      // *** Expect 1 call again ***
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // *** ------------------------ ***
      expect(result.response.outputSpeech.text).toContain(
        "solar system's reporting service"
      );
    });
  });

  describe('GetDailyProductionIntent Handling', () => {
    it('should call GCP and return daily production', async () => {
      // Arrange
      const event = createMockEvent(
        'IntentRequest',
        'GetDailyProductionIntent'
      );
      const mockGcpResponse = { dailyProductionKWh: 7.8 };
      mockCallGcpFunction.mockResolvedValue(mockGcpResponse);

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth and routing
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Verify payload includes dataType: 'daily' (or whatever your handler expects)
      expect(mockCallGcpFunction).toHaveBeenCalledWith(
        FAKE_AUDIENCE,
        MOCK_ID_TOKEN,
        expect.objectContaining({ dataType: 'daily' }), // Assuming 'daily' is the expected type
        expect.anything() // Logger
      );

      // Check response content (uses real formatter)
      expect(result.response.outputSpeech.text).toBe(
        'Your total solar production for the day is 7.8 kilowatt hours.'
      );
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should return an error message if callGcpFunction fails', async () => {
      // Arrange
      const event = createMockEvent(
        'IntentRequest',
        'GetDailyProductionIntent'
      );
      const gcpError = new Error('GCP Network Error - Daily');
      gcpError.code = 'ECONNREFUSED'; // Example error code
      mockCallGcpFunction.mockRejectedValue(gcpError);

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Check for a generic connection error message from the daily handler
      expect(result.response.outputSpeech.text).toContain(
        "couldn't connect to the solar monitor"
      ); // Adjust if your daily handler has a different error message
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should return an error message if GCP response is missing data', async () => {
      // Arrange
      const event = createMockEvent(
        'IntentRequest',
        'GetDailyProductionIntent'
      );
      // Return a response that's missing the dailyProductionKWh field
      mockCallGcpFunction.mockResolvedValue({ currentPowerW: 1000 });

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Check for an incomplete data error message from the daily handler
      expect(result.response.outputSpeech.text).toContain(
        'received an incomplete response'
      ); // Adjust if your daily handler has a different error message
      expect(result.response.shouldEndSession).toBe(true);
    });
  });

  describe('GetOnlineStatusIntent Handling', () => {
    it('should call GCP and return online status when true', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'GetOnlineStatusIntent');
      const mockGcpResponse = { isOnline: true };
      mockCallGcpFunction.mockResolvedValue(mockGcpResponse);

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth and routing
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Verify payload includes dataType: 'status' (or whatever your handler expects)
      expect(mockCallGcpFunction).toHaveBeenCalledWith(
        FAKE_AUDIENCE,
        MOCK_ID_TOKEN,
        expect.objectContaining({ dataType: 'status' }), // Assuming 'status' is the expected type
        expect.anything() // Logger
      );

      // Check response content
      expect(result.response.outputSpeech.text).toBe(
        'The solar energy system is currently online and reporting data.'
      );
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should call GCP and return offline status when false', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'GetOnlineStatusIntent');
      const mockGcpResponse = { isOnline: false };
      mockCallGcpFunction.mockResolvedValue(mockGcpResponse);

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      expect(mockCallGcpFunction).toHaveBeenCalledWith(
        FAKE_AUDIENCE,
        MOCK_ID_TOKEN,
        expect.objectContaining({ dataType: 'status' }),
        expect.anything()
      );

      // Check response content
      expect(result.response.outputSpeech.text).toBe(
        'The solar energy system is currently reporting as offline.'
      );
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should return an error message if callGcpFunction fails', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'GetOnlineStatusIntent');
      const gcpError = new Error('GCP Network Error - Status');
      mockCallGcpFunction.mockRejectedValue(gcpError);

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Check for a generic connection error message from the status handler
      expect(result.response.outputSpeech.text).toContain(
        "couldn't retrieve the system status"
      ); // Adjust if your status handler has a different error message
      expect(result.response.shouldEndSession).toBe(true);
    });

    it('should return an error message if GCP response is missing data', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'GetOnlineStatusIntent');
      // Return a response that's missing the isOnline field
      mockCallGcpFunction.mockResolvedValue({ message: 'Status pending' });

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
      // Check for an incomplete data error message from the status handler
      expect(result.response.outputSpeech.text).toContain(
        'unexpected status format'
      );
      expect(result.response.shouldEndSession).toBe(true);
    });
  });

  describe('Stop/Cancel/Help/Fallback Handling', () => {
    // This test checks the index.mjs fallback when router returns null for unknown intent
    it('should handle unknown intent (routed to fallback) correctly', async () => {
      const event = createMockEvent('IntentRequest', 'MyMadeUpIntentName');
      const result = await handler(event, MOCK_CONTEXT);
      expect(mockCallGcpFunction).not.toHaveBeenCalled(); // Correct
      // Expect the actual fallback message from index.mjs
      expect(result.response.outputSpeech.text).toBe(
        "Sorry, I didn't understand that request. You can ask about current power, daily production, or system status. You can also say 'help' for more options. What would you like to know?"
      );
      expect(result.response.shouldEndSession).toBe(false); // Fallback from index.mjs ends session
    });

    it('should handle AMAZON.HelpIntent correctly', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'AMAZON.HelpIntent');

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth flow (should still happen)
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      // Ensure GCP function was NOT called for Help
      expect(mockCallGcpFunction).not.toHaveBeenCalled();

      // Check response content (matches the predefined help message)
      expect(result.response.outputSpeech.text).toContain(
        'You can ask me about your solar energy system. For example, try saying:\n' +
          "        'What's my current power production?',\n" +
          "        'How much energy did I produce today?',\n" +
          "        Or, 'Is the system online?'.\n" +
          '        What would you like to know?'
      ); // Check main part of help text
      expect(result.response.reprompt.outputSpeech.text).toContain(
        'You can ask about current power, daily production, or the system status. What data are you interested in?'
      ); // Check reprompt
      expect(result.response.shouldEndSession).toBe(false); // Help keeps session open
    });
    it('should handle AMAZON.StopIntent correctly', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'AMAZON.StopIntent');
      const expectedSpeech = 'Goodbye!'; // Adjust if your handler says something different

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth flow
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      // Ensure GCP function was NOT called
      expect(mockCallGcpFunction).not.toHaveBeenCalled();

      // Check response content
      expect(result.response.outputSpeech.text).toBe(expectedSpeech);
      expect(result.response.shouldEndSession).toBe(true); // Stop ends session
      expect(result.response.reprompt).toBeUndefined(); // No reprompt on stop
    });

    it('should handle AMAZON.CancelIntent correctly', async () => {
      // Arrange
      const event = createMockEvent('IntentRequest', 'AMAZON.CancelIntent');
      const expectedSpeech = 'Goodbye!'; // Adjust if your handler says something different

      // Act
      const result = await handler(event, MOCK_CONTEXT);

      // Assert
      // Check auth flow
      expect(mockGetSecret).toHaveBeenCalledWith(
        FAKE_SECRET_ID,
        expect.anything()
      );
      expect(mockGenerateIdToken).toHaveBeenCalledWith(
        MOCK_GCP_CREDENTIALS,
        FAKE_AUDIENCE,
        expect.anything()
      );
      // Ensure GCP function was NOT called
      expect(mockCallGcpFunction).not.toHaveBeenCalled();

      // Check response content
      expect(result.response.outputSpeech.text).toBe(expectedSpeech);
      expect(result.response.shouldEndSession).toBe(true); // Cancel ends session
      expect(result.response.reprompt).toBeUndefined(); // No reprompt on cancel
    });
  });

  describe('Auth/Config Error Handling (by index.mjs)', () => {
    // These should pass as they happen before routing
    it('should return config error if GCP_SECRET_ID is missing', async () => {
      delete process.env.GCP_SECRET_ID;
      const event = createMockEvent('LaunchRequest');
      const result = await handler(event, MOCK_CONTEXT);
      expect(result.response.outputSpeech.text).toContain(
        'not configured correctly'
      );
      expect(mockGetSecret).not.toHaveBeenCalled();
    });
    it('should return generic error if getSecret fails', async () => {
      mockGetSecret.mockResolvedValue(null);
      const event = createMockEvent('LaunchRequest');
      const result = await handler(event, MOCK_CONTEXT);
      expect(result.response.outputSpeech.text).toContain(
        "couldn't retrieve the necessary credentials"
      );
      expect(mockGetSecret).toHaveBeenCalledTimes(1);
      expect(mockGenerateIdToken).not.toHaveBeenCalled();
    });
    it('should return generic error if generateIdToken fails', async () => {
      mockGenerateIdToken.mockResolvedValue(null);
      const event = createMockEvent('LaunchRequest');
      const result = await handler(event, MOCK_CONTEXT);
      expect(result.response.outputSpeech.text).toContain(
        'encountered an issue authenticating'
      );
      expect(mockGenerateIdToken).toHaveBeenCalledTimes(1);
      expect(mockCallGcpFunction).not.toHaveBeenCalled();
    });
  });
});

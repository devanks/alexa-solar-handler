// tests/index.test.mjs
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  beforeAll,
  afterAll,
} from '@jest/globals';

// --- Mock dependencies ---
const mockGetSecret = jest.fn();
const mockGenerateIdToken = jest.fn();
const mockCallGcpFunction = jest.fn();
const mockRouteRequest = jest.fn(); // Mock the router function
const mockSelectedHandler = jest.fn(); // Mock a generic handler function returned by router
const mockBuildTellResponse = jest.fn(); // Mock the response builder for error cases

// Use jest.unstable_mockModule for ESM mocking
// *** CORRECTED PATHS ***
jest.unstable_mockModule('../src/utils/secrets.mjs', () => ({
  getSecret: mockGetSecret,
}));
jest.unstable_mockModule('../src/utils/gcpAuth.mjs', () => ({
  generateIdToken: mockGenerateIdToken,
}));
jest.unstable_mockModule('../src/utils/gcpClient.mjs', () => ({
  callGcpFunction: mockCallGcpFunction,
}));
jest.unstable_mockModule('../src/router.mjs', () => ({
  routeRequest: mockRouteRequest,
})); // Mock the router module

// Mock response builder - Mock buildTellResponse, keep others potentially real or mock as needed
// *** CORRECTED PATH ***
jest.unstable_mockModule('../src/utils/responseBuilder.mjs', () => ({
  buildTellResponse: mockBuildTellResponse,
  // Example of keeping one real (if needed by a real handler being tested indirectly)
  // buildAskResponse: jest.requireActual('../src/utils/responseBuilder.mjs').buildAskResponse
  buildAskResponse: jest.fn((speech, reprompt) => ({
    /* simple mock */ speech,
    reprompt,
    end: false,
  })),
}));

// Mock Logger
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
};
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance); // Ensure child returns self
// *** CORRECTED PATH ***
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({
  default: mockLoggerInstance, // Mock the default export
}));

// --- Dynamically import the handler AFTER mocks ---
let handler;
let originalEnv; // Store original env for cleanup
beforeAll(async () => {
  originalEnv = { ...process.env }; // Store original env
  // *** CORRECTED PATH ***
  const indexModule = await import('../src/index.mjs');
  handler = indexModule.handler;
});

// --- Test Setup ---
const MOCK_EVENT_BASE = { version: '1.0', session: {}, context: {} };
const MOCK_CONTEXT = { awsRequestId: 'test-req-id-123' };
const MOCK_GCP_CREDENTIALS = { project_id: 'test-proj' /* other fields */ };
const MOCK_ID_TOKEN = 'mock-jwt-token';
const FAKE_SECRET_ID = 'fake-secret-id';
const FAKE_AUDIENCE = 'fake-audience-url';

// Helper to create full Alexa response structure for Tell responses
const createExpectedTellResponse = (speechText) => ({
  version: '1.0',
  sessionAttributes: {},
  response: {
    outputSpeech: {
      type: 'PlainText',
      text: speechText,
    },
    shouldEndSession: true,
  },
});

describe('Lambda Handler (with Router)', () => {
  // Restore environment variables and clear mocks after all tests
  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks(); // Use restoreAllMocks if needed, or clearAllMocks in beforeEach
  });

  // Reset mocks and environment before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mock return values that might be cleared
    mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);

    // Set default valid environment for most tests
    process.env.GCP_SECRET_ID = FAKE_SECRET_ID;
    process.env.TARGET_AUDIENCE = FAKE_AUDIENCE;

    // Default mock implementations for success path
    mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
    mockGenerateIdToken.mockResolvedValue(MOCK_ID_TOKEN);
    mockRouteRequest.mockReturnValue(mockSelectedHandler); // Router finds a handler
    mockSelectedHandler.mockResolvedValue({ response: 'Handler Success' }); // Mock handler returns successfully

    // Configure mockBuildTellResponse to return the full structure using the helper
    mockBuildTellResponse.mockImplementation((text) =>
      createExpectedTellResponse(text)
    );
  });

  // --- Success Path Test ---
  it('should authenticate, route, call handler, and return handler response on full success', async () => {
    // Arrange
    const mockLaunchEvent = {
      ...MOCK_EVENT_BASE,
      request: { type: 'LaunchRequest' },
    };
    const expectedHandlerConfig = {
      targetAudience: FAKE_AUDIENCE,
      idToken: MOCK_ID_TOKEN,
    };
    const expectedHandlerResponse = { response: 'Handler Success' }; // Handler response can be anything
    mockSelectedHandler.mockResolvedValue(expectedHandlerResponse);

    // Act
    const result = await handler(mockLaunchEvent, MOCK_CONTEXT);

    // Assert
    // Auth
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID); // Should be called now
    expect(mockGenerateIdToken).toHaveBeenCalledWith(
      MOCK_GCP_CREDENTIALS,
      FAKE_AUDIENCE
    );
    // Routing
    expect(mockRouteRequest).toHaveBeenCalledWith(mockLaunchEvent, mockLoggerInstance);
    // Handler Execution
    expect(mockSelectedHandler).toHaveBeenCalledTimes(1);
    expect(mockSelectedHandler).toHaveBeenCalledWith(
      mockLaunchEvent,
      mockLoggerInstance,
      mockCallGcpFunction,
      expectedHandlerConfig
    );
    // Final Response
    expect(result).toEqual(expectedHandlerResponse);
    // Logging
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: mockLaunchEvent }),
      'Received event'
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Successfully generated Google ID token.'
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      { handlerName: mockSelectedHandler.name },
      'Executing selected handler.'
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      { response: expectedHandlerResponse },
      'Handler execution successful.'
    );
    expect(mockLoggerInstance.error).not.toHaveBeenCalled();
  });

  // --- Auth Failure Tests (Use helper for expected response) ---
  it('should return config error response if GCP_SECRET_ID is not set', async () => {
    delete process.env.GCP_SECRET_ID;
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      'Sorry, the skill is not configured correctly. Missing secret ID.'
    );
    // Configure mock specifically for this call if needed, otherwise beforeEach handles it
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Configuration error: GCP_SECRET_ID missing.'
    );
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('should return config error response if TARGET_AUDIENCE is not set', async () => {
    delete process.env.TARGET_AUDIENCE;
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      'Sorry, the skill is not configured correctly. Missing target audience.'
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Configuration error: TARGET_AUDIENCE missing.'
    );
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('should return credential error response if getSecret fails', async () => {
    mockGetSecret.mockResolvedValue(null);
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      "Sorry, I couldn't retrieve the necessary credentials right now. Please try again later."
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).'
    );
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID); // Verify getSecret was called
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  it('should return auth error response if generateIdToken fails', async () => {
    mockGenerateIdToken.mockResolvedValue(null);
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      'Sorry, I encountered an issue authenticating. Please try again later.'
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).'
    );
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID); // Verify prerequisites
    expect(mockGenerateIdToken).toHaveBeenCalledWith(
      MOCK_GCP_CREDENTIALS,
      FAKE_AUDIENCE
    ); // Verify call
    expect(mockRouteRequest).not.toHaveBeenCalled();
  });

  // --- Routing Failure / No Handler Test ---
  it('should return fallback response if router returns null (and not SessionEnded)', async () => {
    mockRouteRequest.mockReturnValue(null); // Simulate router not finding a handler
    const event = {
      ...MOCK_EVENT_BASE,
      request: { type: 'IntentRequest', intent: { name: 'UnknownIntent' } },
    };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      "Sorry, I didn't understand that request or I can't handle it right now."
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockRouteRequest).toHaveBeenCalledWith(event, mockLoggerInstance);
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'IntentRequest',
        intentName: 'UnknownIntent',
      }),
      'No handler found for this request. Sending fallback response.'
    );
  });

  it('should return empty object for SessionEndedRequest when router returns null', async () => {
    mockRouteRequest.mockReturnValue(null); // Router returns null for SessionEnded
    const event = {
      ...MOCK_EVENT_BASE,
      request: { type: 'SessionEndedRequest', reason: 'USER_INITIATED' },
    };

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual({}); // Still expect empty object
    expect(mockRouteRequest).toHaveBeenCalledWith(event, mockLoggerInstance);
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'SessionEndedRequest received. No response needed.'
    );
    expect(mockBuildTellResponse).not.toHaveBeenCalled(); // Ensure no error response was built
  });

  // --- Unexpected Error Handling Test ---
  it('should return generic error response if the selected handler throws an unexpected error', async () => {
    const handlerError = new Error('Handler crashed!');
    mockSelectedHandler.mockRejectedValue(handlerError); // Make the handler throw
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      'Sorry, something went wrong. Please try again later.'
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockSelectedHandler).toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errName: 'Error',
        errMessage: 'Handler crashed!',
      }),
      'Unhandled error during Lambda execution.'
    );
  });

  it('should return generic error response if routing itself throws an error', async () => {
    const routingError = new Error('Router exploded!');
    mockRouteRequest.mockImplementation(() => {
      throw routingError;
    }); // Make router throw
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    // *** USE HELPER ***
    const expectedResponse = createExpectedTellResponse(
      'Sorry, something went wrong. Please try again later.'
    );
    // mockBuildTellResponse.mockReturnValue(expectedResponse);

    const response = await handler(event, MOCK_CONTEXT);

    expect(response).toEqual(expectedResponse); // Should match full structure now
    expect(mockRouteRequest).toHaveBeenCalled();
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errName: 'Error',
        errMessage: 'Router exploded!',
      }),
      'Unhandled error during Lambda execution.'
    );
  });
});

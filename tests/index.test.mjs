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

// --- Mocks ---
// --- Re-enable Mocks ---
const mockGetSecret = jest.fn();
const mockGenerateIdToken = jest.fn();
const mockCallGcpFunction = jest.fn();
const mockRouteRequest = jest.fn();
const mockSelectedHandler = jest.fn(); // Mock the handler selected by the router
const mockBuildTellResponse = jest.fn();
const mockBuildAskResponse = jest.fn((speech, reprompt) => ({ speech, reprompt, end: false }));
const mockLoggerInstance = {
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), child: jest.fn(),
};
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance); // Initialize child mock
// ------------------------

// --- Mock Modules (Re-enable BEFORE beforeAll) ---
jest.unstable_mockModule('../src/utils/secrets.mjs', () => ({ getSecret: mockGetSecret }));
jest.unstable_mockModule('../src/utils/gcpAuth.mjs', () => ({ generateIdToken: mockGenerateIdToken }));
jest.unstable_mockModule('../src/utils/gcpClient.mjs', () => ({ callGcpFunction: mockCallGcpFunction }));
jest.unstable_mockModule('../src/router.mjs', () => ({ routeRequest: mockRouteRequest }));
jest.unstable_mockModule('../src/utils/responseBuilder.mjs', () => ({
  buildTellResponse: mockBuildTellResponse,
  buildAskResponse: mockBuildAskResponse,
}));
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({ default: mockLoggerInstance }));
// ------------------------------------------------

// --- Test Setup ---
let handler; // Declare handler variable at the top scope
let originalEnv;

// --- Use async beforeAll to import the SUT AFTER mocks are defined ---
beforeAll(async () => {
  originalEnv = { ...process.env };
  // Dynamically import the module *inside* beforeAll
  const indexModule = await import('../src/index.mjs');
  handler = indexModule.handler; // Assign the imported handler

  // Check remains useful
  if (typeof handler !== 'function') {
    throw new Error('Failed to import handler function in beforeAll. Check module structure and mocks.');
  }
});

const MOCK_EVENT_BASE = { version: '1.0', session: {}, context: {} };
const MOCK_CONTEXT = { awsRequestId: 'test-req-id-123' };
// --- Re-enable mock constants ---
const MOCK_GCP_CREDENTIALS = { project_id: 'test-proj' };
const MOCK_ID_TOKEN = 'mock-jwt-token';
// -------------------------------
const FAKE_SECRET_ID = 'fake-secret-id';
const FAKE_AUDIENCE = 'fake-audience-url';

// Helper for expected Tell response structure (keep)
const createExpectedTellOutput = (speechText) => ({
  response: {
    outputSpeech: { type: 'PlainText', text: speechText },
    shouldEndSession: true
  }
});

describe('Lambda Handler (with Router)', () => {
  afterAll(() => {
    process.env = originalEnv;
    // --- Re-enable mock restore ---
    jest.restoreAllMocks();
    // -----------------------------
  });

  beforeEach(() => {
    // --- Re-enable mock clears ---
    jest.clearAllMocks();
    mockLoggerInstance.child.mockReturnValue(mockLoggerInstance); // Ensure child reset
    // ----------------------------

    // Setup env vars
    process.env.GCP_SECRET_ID = FAKE_SECRET_ID;
    process.env.TARGET_AUDIENCE = FAKE_AUDIENCE;

    // --- Re-enable mock resets ---
    mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
    mockGenerateIdToken.mockResolvedValue(MOCK_ID_TOKEN);
    mockRouteRequest.mockReturnValue(mockSelectedHandler); // Default router behavior
    mockSelectedHandler.mockResolvedValue({ response: 'Handler Success' }); // Default selected handler behavior
    mockBuildTellResponse.mockImplementation(createExpectedTellOutput); // Use helper
    // ----------------------------
  });

  // --- Restore original tests ---

  // --- Success Path Test ---
  it('should authenticate, route, call handler, and return handler response on full success', async () => {
    // Arrange
    const mockLaunchEvent = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest', requestId: 'req-launch' } };
    const expectedHandlerConfig = {
      targetAudience: FAKE_AUDIENCE,
      idToken: MOCK_ID_TOKEN,
    };
    const expectedHandlerResponse = { response: 'Handler Success' };
    mockSelectedHandler.mockResolvedValue(expectedHandlerResponse);

    // Act
    const result = await handler(mockLaunchEvent, MOCK_CONTEXT);

    // Assert
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID, mockLoggerInstance);
    expect(mockGenerateIdToken).toHaveBeenCalledWith(MOCK_GCP_CREDENTIALS, FAKE_AUDIENCE, mockLoggerInstance);
    expect(mockRouteRequest).toHaveBeenCalledWith(mockLaunchEvent, mockLoggerInstance);
    expect(mockSelectedHandler).toHaveBeenCalledWith(
        mockLaunchEvent, mockLoggerInstance, mockCallGcpFunction, expectedHandlerConfig
    );
    expect(result).toEqual(expectedHandlerResponse);
    expect(mockLoggerInstance.error).not.toHaveBeenCalled();
  });

  // --- Auth Failure Tests ---
  it('should return credential error response if getSecret fails', async () => {
    // Arrange
    mockGetSecret.mockResolvedValue(null);
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    const expectedSpeech = "Sorry, I couldn't retrieve the necessary credentials right now. Please try again later.";
    const expectedResponse = createExpectedTellOutput(expectedSpeech);

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual(expectedResponse);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).'
    );
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID, mockLoggerInstance);
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
  });

  it('should return auth error response if generateIdToken fails', async () => {
    // Arrange
    mockGenerateIdToken.mockResolvedValue(null);
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest' } };
    const expectedSpeech = 'Sorry, I encountered an issue authenticating. Please try again later.';
    const expectedResponse = createExpectedTellOutput(expectedSpeech);

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual(expectedResponse);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).'
    );
    expect(mockGetSecret).toHaveBeenCalledWith(FAKE_SECRET_ID, mockLoggerInstance);
    expect(mockGenerateIdToken).toHaveBeenCalledWith(MOCK_GCP_CREDENTIALS, FAKE_AUDIENCE, mockLoggerInstance);
  });

  // --- Routing Failure / No Handler Test ---
  it('should return fallback response if router returns null (and not SessionEnded)', async () => {
    // Arrange
    mockRouteRequest.mockReturnValue(null); // Override default for this test
    const event = { ...MOCK_EVENT_BASE, request: { type: 'IntentRequest', intent: { name: 'UnknownIntent' }, requestId: 'req-unknown' } };
    const expectedSpeech = "Sorry, I didn't understand that request or I can't handle it right now.";
    const expectedResponse = createExpectedTellOutput(expectedSpeech);

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual(expectedResponse);
    expect(mockRouteRequest).toHaveBeenCalledWith(event, mockLoggerInstance);
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        expect.objectContaining({ intentName: 'UnknownIntent' }),
        'No handler found for this request. Sending fallback response.'
    );
  });

  it('should return empty object for SessionEndedRequest when router returns null', async () => {
    // Arrange
    mockRouteRequest.mockReturnValue(null); // Override default for this test
    const event = { ...MOCK_EVENT_BASE, request: { type: 'SessionEndedRequest', reason: 'USER_INITIATED', requestId: 'req-ended' } };

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual({}); // Still expect empty object
    expect(mockRouteRequest).toHaveBeenCalledWith(event, mockLoggerInstance);
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.info).toHaveBeenCalledWith('SessionEndedRequest received. No response needed.');
  });

  // --- Unexpected Error Handling Test ---
  it('should return generic error response if the selected handler throws an unexpected error', async () => {
    // Arrange
    const handlerError = new Error('Handler crashed!');
    mockSelectedHandler.mockRejectedValue(handlerError);
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest', requestId: 'req-handler-err' } };
    const expectedSpeech = 'Sorry, something went wrong. Please try again later.';
    const expectedResponse = createExpectedTellOutput(expectedSpeech);

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual(expectedResponse);
    expect(mockGenerateIdToken).toHaveBeenCalledWith(MOCK_GCP_CREDENTIALS, FAKE_AUDIENCE, mockLoggerInstance);
    expect(mockSelectedHandler).toHaveBeenCalled(); // Ensure handler was called
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ errMessage: 'Handler crashed!' }),
        'Unhandled error during Lambda execution.'
    );
  });

  it('should return generic error response if routing itself throws an error', async () => {
    // Arrange
    const routingError = new Error('Router exploded!');
    mockRouteRequest.mockImplementation(() => { throw routingError; }); // Throw error from router
    const event = { ...MOCK_EVENT_BASE, request: { type: 'LaunchRequest', requestId: 'req-router-err' } };
    const expectedSpeech = 'Sorry, something went wrong. Please try again later.';
    const expectedResponse = createExpectedTellOutput(expectedSpeech);

    // Act
    const response = await handler(event, MOCK_CONTEXT);

    // Assert
    expect(response).toEqual(expectedResponse);
    expect(mockGenerateIdToken).toHaveBeenCalledWith(MOCK_GCP_CREDENTIALS, FAKE_AUDIENCE, mockLoggerInstance);
    expect(mockRouteRequest).toHaveBeenCalledWith(event, mockLoggerInstance);
    expect(mockSelectedHandler).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ errMessage: 'Router exploded!' }),
        'Unhandled error during Lambda execution.'
    );
  });
  // --- End of restored tests ---

});

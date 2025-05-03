// tests/index.test.mjs
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// --- Mock Setup ---
// Keep existing mocks
const mockGetSecret = jest.fn();
const mockGenerateIdToken = jest.fn();
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

// Add mock for the new client function
const mockCallGcpFunction = jest.fn();

// --- Mock Modules ---
// Mock logger module
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({
  default: mockLoggerInstance,
  __esModule: true,
}));
// Mock secrets module
jest.unstable_mockModule('../src/utils/secrets.mjs', () => ({
  getSecret: mockGetSecret,
  __esModule: true,
}));
// Mock gcpAuth module
jest.unstable_mockModule('../src/utils/gcpAuth.mjs', () => ({
  generateIdToken: mockGenerateIdToken,
  __esModule: true,
}));
// Mock the new gcpClient module
jest.unstable_mockModule('../src/utils/gcpClient.mjs', () => ({
  callGcpFunction: mockCallGcpFunction, // Mock the named export
  __esModule: true,
}));

// --- Dynamic Import ---
// Import the handler *after* all mocks are defined
const { handler } = await import('../src/index.mjs');

// --- Mock Data ---
const MOCK_GCP_CREDENTIALS = {
  project_id: 'mock-project',
  client_email: 'test@example.com',
  private_key: '...',
};
const MOCK_AUDIENCE = 'https://mock-target.service.com';
const MOCK_ID_TOKEN = 'mock.id.token';
const MOCK_GCP_RESPONSE = { success: true, data: 'from-gcp-function' };
const MOCK_EVENT = { request: { type: 'LaunchRequest' } };
const MOCK_CONTEXT = { awsRequestId: 'test-request-id-123' };

// --- Test Lifecycle Hooks ---
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks(); // Use jest.clearAllMocks() for simplicity

  // Default success behavior for all mocks
  mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
  mockGenerateIdToken.mockResolvedValue(MOCK_ID_TOKEN);
  mockCallGcpFunction.mockResolvedValue(MOCK_GCP_RESPONSE); // Default to successful API call
  mockLoggerInstance.child.mockReturnThis();

  // Set environment variables
  process.env.GCP_SECRET_ID = 'fake-secret-id';
  process.env.TARGET_AUDIENCE = MOCK_AUDIENCE;
});

afterEach(() => {
  // Clean up environment variables
  delete process.env.GCP_SECRET_ID;
  delete process.env.TARGET_AUDIENCE;
});

// --- Test Suite ---
describe('Lambda Handler', () => {
  // --- Success Path ---
  it('should return 200 and GCP response body on full success', async () => {
    // Arrange (Defaults in beforeEach are sufficient)

    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);

    // Assert
    // 1. Check Lambda response
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(response.body)).toEqual(MOCK_GCP_RESPONSE); // Should forward GCP response

    // 2. Check mocks were called correctly
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockGenerateIdToken).toHaveBeenCalledWith(
      MOCK_GCP_CREDENTIALS,
      MOCK_AUDIENCE
    );
    expect(mockCallGcpFunction).toHaveBeenCalledWith(
      MOCK_AUDIENCE,
      MOCK_ID_TOKEN,
      MOCK_EVENT, // Ensure event is passed as payload
      expect.objectContaining({
        // Check logger instance was passed
        info: expect.any(Function),
        error: expect.any(Function),
      })
    );

    // 3. Check key log messages
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Successfully generated Google ID token.'
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Successfully received response via GCP client.'
    );
    expect(mockLoggerInstance.error).not.toHaveBeenCalled(); // No errors logged
  });

  // --- Failure Paths (Existing) ---
  it('should return 500 if GCP_SECRET_ID is not set', async () => {
    // Arrange
    delete process.env.GCP_SECRET_ID;
    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('GCP_SECRET_ID missing'); // Adjusted message check
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockCallGcpFunction).not.toHaveBeenCalled(); // Should not be called
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'GCP_SECRET_ID environment variable not set.'
    );
  });

  it('should return 500 if TARGET_AUDIENCE is not set', async () => {
    // Arrange
    delete process.env.TARGET_AUDIENCE;
    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('TARGET_AUDIENCE missing'); // Adjusted message check
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockCallGcpFunction).not.toHaveBeenCalled(); // Should not be called
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'TARGET_AUDIENCE environment variable not set.'
    );
  });

  it('should return 500 if getSecret fails', async () => {
    // Arrange
    mockGetSecret.mockResolvedValue(null);
    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Failed to retrieve GCP credentials.'); // Adjusted message
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockCallGcpFunction).not.toHaveBeenCalled(); // Should not be called
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).'
    );
  });

  it('should return 500 if generateIdToken fails', async () => {
    // Arrange
    mockGenerateIdToken.mockResolvedValue(null);
    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    // Check the specific message returned when token generation fails
    expect(body.message).toBe(
      'Successfully retrieved credentials, but failed to generate Google ID token. Check logs.'
    );
    expect(body.retrievedProjectId).toBe(MOCK_GCP_CREDENTIALS.project_id);
    expect(body.tokenGenerated).toBe(false);
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockGenerateIdToken).toHaveBeenCalledWith(
      MOCK_GCP_CREDENTIALS,
      MOCK_AUDIENCE
    );
    expect(mockCallGcpFunction).not.toHaveBeenCalled(); // Should not be called
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).'
    );
  });

  // --- NEW Failure Paths (API Client) ---

  it('should return 502 if callGcpFunction rejects with a non-OK status error', async () => {
    // Arrange
    const upstreamError = new Error(
      'Cloud Function call failed with status 403'
    );
    upstreamError.statusCode = 403;
    upstreamError.responseBody = 'Forbidden access';
    upstreamError.isApiClientError = true;
    mockCallGcpFunction.mockRejectedValue(upstreamError);

    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);

    // Assert
    expect(response.statusCode).toBe(502); // Default Bad Gateway for upstream errors
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Upstream Cloud Function returned status 403.');
    expect(body.errorDetails).toBe(upstreamError.message);
    expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errStatusCode: 403,
        errResponseBodyPreview: 'Forbidden access',
      }),
      'Error occurred during GCP Cloud Function call.'
    );
  });

  it('should return 502 if callGcpFunction rejects with a JSON parse error', async () => {
    // Arrange
    const parseError = new Error(
      'Failed to parse Cloud Function JSON response'
    );
    parseError.statusCode = 200; // Status might still be OK
    parseError.responseBody = '<!DOCTYPE html>...'; // Non-JSON response
    parseError.isParseError = true;
    parseError.isApiClientError = true;
    mockCallGcpFunction.mockRejectedValue(parseError);

    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);

    // Assert
    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(
      'Failed to parse upstream Cloud Function response.'
    );
    expect(body.errorDetails).toBe(parseError.message);
    expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errIsParse: true,
        errResponseBodyPreview: expect.stringContaining('<!DOCTYPE html>'),
      }),
      'Error occurred during GCP Cloud Function call.'
    );
  });

  it('should return 504 if callGcpFunction rejects with a network error', async () => {
    // Arrange
    const networkError = new Error(
      'Network error calling Cloud Function: connect ETIMEDOUT'
    );
    networkError.isNetworkError = true;
    networkError.isApiClientError = true;
    mockCallGcpFunction.mockRejectedValue(networkError);

    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);

    // Assert
    expect(response.statusCode).toBe(504); // Gateway Timeout for network issues
    const body = JSON.parse(response.body);
    expect(body.message).toBe(
      'Network error reaching upstream Cloud Function.'
    );
    expect(body.errorDetails).toBe(networkError.message);
    expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ errIsNetwork: true }),
      'Error occurred during GCP Cloud Function call.'
    );
  });

  it('should return 502 for generic errors from callGcpFunction', async () => {
    // Arrange
    const genericError = new Error('Something unexpected happened');
    // Note: We don't set custom flags like isNetworkError etc.
    mockCallGcpFunction.mockRejectedValue(genericError);

    // Act
    const response = await handler(MOCK_EVENT, MOCK_CONTEXT);

    // Assert
    expect(response.statusCode).toBe(502); // Default Bad Gateway
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Error calling upstream Cloud Function.'); // Default message
    expect(body.errorDetails).toBe(genericError.message);
    expect(mockCallGcpFunction).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errName: 'Error',
        errMessage: 'Something unexpected happened',
      }),
      'Error occurred during GCP Cloud Function call.'
    );
  });
});

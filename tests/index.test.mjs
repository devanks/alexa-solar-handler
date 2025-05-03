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
const mockGetSecret = jest.fn();
const mockGenerateIdToken = jest.fn();
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

// Mock logger module
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({
  default: mockLoggerInstance, // Mock the default export
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

// --- Dynamic Import (Back to Top Level) ---
// Import the handler *after* all mocks are defined above
const { handler } = await import('../src/index.mjs');

// --- Mock Data ---
const MOCK_GCP_CREDENTIALS = {
  project_id: 'mock-project',
  client_email: 'test@example.com',
  private_key: '...',
}; // Ensure mock creds pass validation
const MOCK_AUDIENCE = 'https://mock-target.service.com';
const MOCK_ID_TOKEN = 'mock.id.token';

// --- Test Lifecycle Hooks ---
// beforeAll is no longer needed for the import

beforeEach(() => {
  // Reset all mocks
  mockGetSecret.mockClear();
  mockGenerateIdToken.mockClear();
  mockLoggerInstance.info.mockClear();
  mockLoggerInstance.warn.mockClear();
  mockLoggerInstance.error.mockClear();
  mockLoggerInstance.debug.mockClear();
  mockLoggerInstance.child.mockClear();

  // Default success behavior
  mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
  mockGenerateIdToken.mockResolvedValue(MOCK_ID_TOKEN);
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

// afterAll not strictly needed unless restoring spies (which we aren't using here)

// --- Test Suite ---
describe('Lambda Handler', () => {
  // --- Success Path ---
  it('should return 200 and success message when secret and token are generated', async () => {
    // Arrange
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-123' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(
      'Successfully retrieved credentials and generated Google ID token.'
    );
    expect(body.retrievedProjectId).toBe(MOCK_GCP_CREDENTIALS.project_id);
    expect(body.tokenGenerated).toBe(true);
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockGenerateIdToken).toHaveBeenCalledWith(
      MOCK_GCP_CREDENTIALS,
      MOCK_AUDIENCE
    );
    // Check specific log messages if needed
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Successfully retrieved credentials and generated Google ID token.'
    );
  });

  // --- Failure Paths ---
  it('should return 500 if GCP_SECRET_ID is not set', async () => {
    // Arrange
    delete process.env.GCP_SECRET_ID;
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-456' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('GCP_SECRET_ID environment variable is not set.');
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'GCP_SECRET_ID environment variable is not set.'
    );
  });

  it('should return 500 if TARGET_AUDIENCE is not set', async () => {
    // Arrange
    delete process.env.TARGET_AUDIENCE;
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-457' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(
      'TARGET_AUDIENCE environment variable is not set.'
    );
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'TARGET_AUDIENCE environment variable is not set.'
    );
  });

  it('should return 500 if getSecret fails', async () => {
    // Arrange
    mockGetSecret.mockResolvedValue(null);
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-789' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(
      'Failed to retrieve GCP credentials. Check logs.'
    );
    expect(body.tokenGenerated).toBe(false);
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockGenerateIdToken).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to retrieve GCP credentials. Check logs.'
    );
  });

  it('should return 500 if generateIdToken fails', async () => {
    // Arrange
    mockGenerateIdToken.mockResolvedValue(null);
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-101' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
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
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Successfully retrieved credentials, but failed to generate Google ID token. Check logs.'
    );
  });
});

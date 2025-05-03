// tests/index.test.mjs

// Import Jest functions explicitly
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// --- Mock Setup ---

// Mock function for getSecret
const mockGetSecret = jest.fn();

// Mock object for the logger
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

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

// --- Dynamic Import (Deferred) ---
let handler; // Define handler variable in the outer scope

// --- Mock Data ---
const MOCK_GCP_CREDENTIALS = {
  project_id: 'mock-project',
};

// --- Test Lifecycle Hooks ---

beforeAll(async () => {
  // Dynamically import the handler *inside beforeAll*, AFTER mocks are defined
  // Use the correct relative path
  const handlerModule = await import('../src/index.mjs');
  handler = handlerModule.handler; // Assign the imported handler to the outer scope variable
});

beforeEach(() => {
  // Reset mocks
  mockGetSecret.mockClear();
  mockLoggerInstance.info.mockClear();
  mockLoggerInstance.warn.mockClear();
  mockLoggerInstance.error.mockClear();
  mockLoggerInstance.debug.mockClear();
  mockLoggerInstance.child.mockClear();

  // Configure default mock behavior
  mockGetSecret.mockResolvedValue(MOCK_GCP_CREDENTIALS);
  mockLoggerInstance.child.mockReturnThis();

  // Set environment variable
  process.env.GCP_SECRET_ID = 'fake-secret-id';
});

afterEach(() => {
  // Clean up environment variable
  delete process.env.GCP_SECRET_ID;
});

// --- Test Suite ---
describe('Lambda Handler', () => {
  // Tests remain the same, but they will use the 'handler' variable
  // that was assigned during the beforeAll hook.

  it('should return a 200 status code and success message when secret is retrieved', async () => {
    // Arrange
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-123' };
    // Act
    const response = await handler(mockEvent, mockContext); // Uses the handler assigned in beforeAll
    // Assert
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Successfully retrieved GCP credentials.');
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id');
    expect(mockLoggerInstance.child).toHaveBeenCalledWith({
      awsRequestId: mockContext.awsRequestId,
    });
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      { projectId: MOCK_GCP_CREDENTIALS.project_id },
      'Successfully retrieved and parsed GCP credentials.'
    );
  });

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
    expect(body.message).toContain('Failed to retrieve GCP credentials');
    expect(mockGetSecret).not.toHaveBeenCalled();
    expect(mockLoggerInstance.child).toHaveBeenCalledWith({
      awsRequestId: mockContext.awsRequestId,
    });
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'GCP_SECRET_ID environment variable is not set.'
    );
  });

  it('should return 500 if getSecret fails (returns null)', async () => {
    // Arrange
    mockGetSecret.mockResolvedValue(null);
    const mockEvent = {};
    const mockContext = { awsRequestId: 'test-request-id-789' };
    // Act
    const response = await handler(mockEvent, mockContext);
    // Assert
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Failed to retrieve GCP credentials');
    expect(mockGetSecret).toHaveBeenCalledWith('fake-secret-id'); // Should be called
    expect(mockLoggerInstance.child).toHaveBeenCalledWith({
      awsRequestId: mockContext.awsRequestId,
    });
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Failed to retrieve GCP credentials.'
    );
  });
});

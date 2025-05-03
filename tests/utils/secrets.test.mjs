// tests/utils/secrets.test.mjs

// Import Jest functions explicitly
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  jest, // Import the 'jest' object itself for jest.spyOn, jest.fn
} from '@jest/globals';

// Import modules under test/dependencies
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as secretsUtil from '../../src/utils/secrets.mjs';
import * as loggerUtil from '../../src/utils/logger.mjs';

// Store spies globally in the test file scope
let secretsManagerSendSpy;
let loggerInfoSpy,
  loggerWarnSpy,
  loggerErrorSpy,
  loggerDebugSpy,
  loggerChildSpy;

// Define a reusable mock logger object USING the imported jest object
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

beforeAll(() => {
  // Use the imported jest object for spying
  loggerInfoSpy = jest
    .spyOn(loggerUtil.default, 'info')
    .mockImplementation(mockLoggerInstance.info);
  loggerWarnSpy = jest
    .spyOn(loggerUtil.default, 'warn')
    .mockImplementation(mockLoggerInstance.warn);
  loggerErrorSpy = jest
    .spyOn(loggerUtil.default, 'error')
    .mockImplementation(mockLoggerInstance.error);
  loggerDebugSpy = jest
    .spyOn(loggerUtil.default, 'debug')
    .mockImplementation(mockLoggerInstance.debug);
  loggerChildSpy = jest
    .spyOn(loggerUtil.default, 'child')
    .mockImplementation(mockLoggerInstance.child);
  secretsManagerSendSpy = jest.spyOn(SecretsManagerClient.prototype, 'send');
});

beforeEach(() => {
  mockLoggerInstance.info.mockClear();
  mockLoggerInstance.warn.mockClear();
  mockLoggerInstance.error.mockClear();
  mockLoggerInstance.debug.mockClear();
  mockLoggerInstance.child.mockClear();
  secretsManagerSendSpy.mockClear();
  secretsManagerSendSpy.mockResolvedValue({}); // Default behavior
});

afterAll(() => {
  secretsManagerSendSpy.mockRestore();
  loggerInfoSpy.mockRestore();
  loggerWarnSpy.mockRestore();
  loggerErrorSpy.mockRestore();
  loggerDebugSpy.mockRestore();
  loggerChildSpy.mockRestore();
});

const MOCK_SECRET_ID = 'my-gcp-secret';
const MOCK_SECRET_JSON = {
  /* ... same as before ... */
};
const MOCK_SECRET_STRING = JSON.stringify(MOCK_SECRET_JSON);

describe('getSecret Utility', () => {
  // --- ALL YOUR 'it(...)' TEST CASES REMAIN THE SAME ---
  // They now use the explicitly imported 'expect', 'it', etc.
  // and the spies set up using the imported 'jest' object.

  it('should return parsed secret object when SecretString is present', async () => {
    // Arrange
    secretsManagerSendSpy.mockResolvedValueOnce({
      SecretString: MOCK_SECRET_STRING,
    });
    // Act
    const secret = await secretsUtil.getSecret(MOCK_SECRET_ID);
    // Assert
    expect(secret).toEqual(MOCK_SECRET_JSON);
    expect(secretsManagerSendSpy).toHaveBeenCalledTimes(1);
    expect(secretsManagerSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ input: { SecretId: MOCK_SECRET_ID } })
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Attempting to fetch secret'
    );
    // ... other assertions
  });

  // ... (other test cases remain the same) ...

  it('should return parsed secret object when SecretBinary is present', async () => {
    // Arrange
    const secretBinary = Buffer.from(MOCK_SECRET_STRING, 'utf-8');
    secretsManagerSendSpy.mockResolvedValueOnce({ SecretBinary: secretBinary });
    // Act
    const secret = await secretsUtil.getSecret(MOCK_SECRET_ID);
    // Assert
    expect(secret).toEqual(MOCK_SECRET_JSON);
    expect(secretsManagerSendSpy).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'SecretBinary retrieved and decoded successfully.'
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Secret parsed successfully as JSON.'
    );
  });

  it('should return null if Secret ID is not provided', async () => {
    // Act
    const secret = await secretsUtil.getSecret('');
    // Assert
    expect(secret).toBeNull();
    expect(secretsManagerSendSpy).not.toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Secret ID was not provided.'
    );
  });

  it('should return null and log error if AWS SDK throws an error', async () => {
    // Arrange
    const awsError = new Error('AWS SDK Error');
    awsError.name = 'ResourceNotFoundException';
    secretsManagerSendSpy.mockRejectedValueOnce(awsError);
    // Act
    const secret = await secretsUtil.getSecret(MOCK_SECRET_ID);
    // Assert
    expect(secret).toBeNull();
    expect(secretsManagerSendSpy).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      { err: awsError },
      'Failed to retrieve secret from Secrets Manager'
    );
  });

  it('should return null and log error if secret string is not valid JSON', async () => {
    // Arrange
    secretsManagerSendSpy.mockResolvedValueOnce({
      SecretString: 'this is not json',
    });
    // Act
    const secret = await secretsUtil.getSecret(MOCK_SECRET_ID);
    // Assert
    expect(secret).toBeNull();
    expect(secretsManagerSendSpy).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'SecretString retrieved successfully.'
    );
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(SyntaxError) }),
      'Failed to parse secret string as JSON.'
    );
  });

  it('should return null if neither SecretString nor SecretBinary is present', async () => {
    // Arrange (using default mock behavior set in beforeEach)
    // secretsManagerSendSpy.mockResolvedValueOnce({});
    // Act
    const secret = await secretsUtil.getSecret(MOCK_SECRET_ID);
    // Assert
    expect(secret).toBeNull();
    expect(secretsManagerSendSpy).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      'Secret value not found in response.'
    );
  });
});

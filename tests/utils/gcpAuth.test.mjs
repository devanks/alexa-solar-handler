// tests/utils/gcpAuth.test.mjs
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  beforeAll,
} from '@jest/globals';
// Remove the direct import of GoogleAuth as we are mocking the whole module
// import { GoogleAuth } from 'google-auth-library';

// --- Mock dependencies ---
const mockFetchIdToken = jest.fn();
const mockGetIdTokenClient = jest.fn();

// --- FIX: Define the mock constructor function separately ---
const mockGoogleAuthInstance = {
  // Represents the object returned by `new GoogleAuth()`
  getIdTokenClient: mockGetIdTokenClient,
};
const mockGoogleAuthConstructor = jest.fn(() => mockGoogleAuthInstance); // This is the mock for `GoogleAuth` itself
// ---------------------------------------------------------

// Mock the GoogleAuth library module
jest.unstable_mockModule('google-auth-library', () => ({
  // --- FIX: Use the external mock constructor here ---
  GoogleAuth: mockGoogleAuthConstructor,
  // -------------------------------------------------
}));

// --- Mock Logger ---
const mockPinoInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockPinoInstance),
};

// --- Dynamically import the function under test ---
let generateIdToken;
beforeAll(async () => {
  // Import the actual function AFTER mocks are set up
  const gcpAuthModule = await import('../../src/utils/gcpAuth.mjs');
  generateIdToken = gcpAuthModule.generateIdToken;
});

// --- Test Setup ---
const MOCK_CREDS = {
  /* ... */
};
const MOCK_AUDIENCE = 'https://your-target-service.run.app';
const MOCK_TOKEN = 'mock.jwt.token.via.provider';

describe('generateIdToken Utility (using idTokenProvider)', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clears call history for ALL mocks, including mockGoogleAuthConstructor

    // Reset mock implementations
    mockGetIdTokenClient.mockResolvedValue({
      idTokenProvider: { fetchIdToken: mockFetchIdToken },
    });
    mockFetchIdToken.mockResolvedValue(MOCK_TOKEN);
    // Reset the constructor mock's implementation if it was changed in a test
    mockGoogleAuthConstructor.mockImplementation(() => mockGoogleAuthInstance);
  });

  it('should return an ID token on success', async () => {
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBe(MOCK_TOKEN);
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockPinoInstance.error).not.toHaveBeenCalled();
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
      expect.objectContaining({ tokenLength: MOCK_TOKEN.length }),
      'Successfully generated ID token via idTokenProvider.'
    );
  });

  it('should return null if credentials are null', async () => {
    const token = await generateIdToken(null, MOCK_AUDIENCE, mockPinoInstance);
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      'Missing credentials or targetAudience for generateIdToken'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).not.toHaveBeenCalled();
    // -----------------------------------------
  });

  it('should return null if credentials object is missing required fields', async () => {
    const invalidCreds = { client_email: 'only_one' };
    const authError = new Error('Invalid Credentials Structure');
    // --- FIX: Call mockImplementationOnce on the mock constructor ---
    mockGoogleAuthConstructor.mockImplementationOnce(() => {
      throw authError;
    });
    // -----------------------------------------------------------

    const token = await generateIdToken(
      invalidCreds,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: invalidCreds,
    });
    // -----------------------------------------
    expect(mockGetIdTokenClient).not.toHaveBeenCalled();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ errMessage: 'Invalid Credentials Structure' }),
      'Error during ID token generation process.'
    );
  });

  it('should return null if target audience is missing or invalid', async () => {
    const token1 = await generateIdToken(MOCK_CREDS, null, mockPinoInstance);
    const token2 = await generateIdToken(MOCK_CREDS, '', mockPinoInstance);
    expect(token1).toBeNull();
    expect(token2).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      'Missing credentials or targetAudience for generateIdToken'
    );
    expect(mockPinoInstance.error).toHaveBeenCalledTimes(2);
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).not.toHaveBeenCalled();
    // -----------------------------------------
  });

  it('should return null and log error if GoogleAuth constructor throws', async () => {
    const authError = new Error('Auth constructor failed');
    // --- FIX: Call mockImplementationOnce on the mock constructor ---
    mockGoogleAuthConstructor.mockImplementationOnce(() => {
      throw authError;
    });
    // -----------------------------------------------------------
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ errMessage: 'Auth constructor failed' }),
      'Error during ID token generation process.'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
  });

  // Tests for getIdTokenClient rejects, client invalid, fetch rejects, fetch returns null
  // remain the same as they interact with mockGetIdTokenClient and mockFetchIdToken,
  // which were already correctly defined Jest mocks. We just need to ensure
  // mockGoogleAuthConstructor is asserted correctly where appropriate.

  it('should return null and log error if getIdTokenClient rejects', async () => {
    const clientError = new Error('Failed to get client');
    mockGetIdTokenClient.mockRejectedValueOnce(clientError);
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ errMessage: 'Failed to get client' }),
      'Error during ID token generation process.'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(MOCK_AUDIENCE);
  });

  it('should return null and log error if client object is invalid (missing provider)', async () => {
    mockGetIdTokenClient.mockResolvedValueOnce({}); // No provider
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      'Failed to get a valid ID token client or provider method.'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(MOCK_AUDIENCE);
  });

  it('should return null and log error if fetchIdToken rejects', async () => {
    const fetchError = new Error('Network error during fetch');
    mockFetchIdToken.mockRejectedValueOnce(fetchError);
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      expect.objectContaining({ errMessage: 'Network error during fetch' }),
      'Error during ID token generation process.'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
  });

  it('should return null and log error if fetchIdToken returns null/undefined', async () => {
    mockFetchIdToken.mockResolvedValueOnce(null);
    const token = await generateIdToken(
      MOCK_CREDS,
      MOCK_AUDIENCE,
      mockPinoInstance
    );
    expect(token).toBeNull();
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
      'fetchIdToken returned null, undefined, or empty string.'
    );
    // --- FIX: Assert on the mock constructor ---
    expect(mockGoogleAuthConstructor).toHaveBeenCalledWith({
      credentials: MOCK_CREDS,
    });
    // -----------------------------------------
  });
});

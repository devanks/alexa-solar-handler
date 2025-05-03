// tests/utils/gcpAuth.test.mjs
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
jest.mock('pino');         // ← now it will load __mocks__/pino.js

/* ---------- 1.  Create a logger stub we can assert on ---------- */
export const mockPinoInstance = {
  info : jest.fn(),
  warn : jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),   // make chaining work
};

/* ---------- 2.  Tell Jest to replace "pino" with our stub
                   (must happen BEFORE we import the SUT) -------- */
jest.unstable_mockModule('pino', () => {
  const factory = jest.fn(() => mockPinoInstance);   // default export is a fn
  factory.stdTimeFunctions = {                       // extra property pino has
    isoTime: jest.fn(() => '2024-01-01T00:00:00.000Z')
  };
  return {
    __esModule: true,
    default    : factory,
    mockPinoInstance,          // named export so tests can import it
  };
});

/* ---------- 3.  Mock google-auth-library the same way --------- */
const mockFetchIdToken     = jest.fn();
const mockGetIdTokenClient = jest.fn();

jest.unstable_mockModule('google-auth-library', () => ({
  __esModule: true,
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: mockGetIdTokenClient,
  })),
}));

/* ---------- 4.  Now we can load the modules that use pino ------ */
const { generateIdToken } = await import('../../src/utils/gcpAuth.mjs');
const { GoogleAuth }      = await import('google-auth-library');
const { mockPinoInstance: logger } = await import('pino');

// --- Test Data ---
const MOCK_CREDS = { client_email: 'test@service.account', private_key: 'fake-key-content' };
const MOCK_AUDIENCE = 'https://your-target-service.run.app';
const MOCK_TOKEN = 'mock.jwt.token.via.provider';

// --- Test Hooks ---
beforeEach(() => {
  // Clear all mocks defined with jest.fn() or jest.spyOn()
  jest.clearAllMocks();

  // Reset google-auth-library mock implementations
  mockGetIdTokenClient.mockResolvedValue({
    idTokenProvider: { fetchIdToken: mockFetchIdToken }
  });
  mockFetchIdToken.mockResolvedValue(MOCK_TOKEN);

  // Reset pino mock instance behavior (specifically chaining)
  // **mockPinoInstance should now be defined here**
  if (mockPinoInstance && mockPinoInstance.child) { // Add a safety check just in case
    mockPinoInstance.child.mockReturnThis();
  } else {
    console.warn('Warning: mockPinoInstance or child method not found in beforeEach!');
  }
});


// --- Test Suite ---
describe('generateIdToken Utility (using idTokenProvider)', () => {
  it('should return an ID token on success', async () => {
    // Act
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);

    // Assert Response
    expect(token).toBe(MOCK_TOKEN);

    // Assert Mocks Called Correctly
    expect(GoogleAuth).toHaveBeenCalledWith({ credentials: MOCK_CREDS });
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);

    // Assert Logging (using the imported mockPinoInstance)
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { targetAudience: MOCK_AUDIENCE },
        'Attempting to generate ID token via idTokenProvider.'
    );
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { clientType: 'object' },
        'auth.getIdTokenClient() resolved.'
    );
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
        'Calling client.idTokenProvider.fetchIdToken()...'
    );
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
        'client.idTokenProvider.fetchIdToken() resolved.'
    );
    expect(mockPinoInstance.info).toHaveBeenCalledWith(
        expect.objectContaining({ targetAudience: MOCK_AUDIENCE, tokenLength: MOCK_TOKEN.length }),
        'Successfully generated ID token via idTokenProvider.'
    );
    expect(mockPinoInstance.error).not.toHaveBeenCalled();
  });

  it('should return null if credentials are null', async () => {
    const token = await generateIdToken(null, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing service account credentials provided.');
    expect(GoogleAuth).not.toHaveBeenCalled();
  });

  it('should return null if credentials object is missing required fields', async () => {
    await generateIdToken({ client_email: 'only_one' }, MOCK_AUDIENCE); // Missing private_key
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing service account credentials provided.');
    mockPinoInstance.error.mockClear(); // Clear for next assertion
    await generateIdToken({ private_key: 'only_one' }, MOCK_AUDIENCE); // Missing client_email
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing service account credentials provided.');
    expect(GoogleAuth).not.toHaveBeenCalled();
  });


  it('should return null if target audience is missing or invalid', async () => {
    await generateIdToken(MOCK_CREDS, null);
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing target audience provided.');
    mockPinoInstance.error.mockClear();
    await generateIdToken(MOCK_CREDS, '');
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing target audience provided.');
    mockPinoInstance.error.mockClear();
    await generateIdToken(MOCK_CREDS, 123);
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Invalid or missing target audience provided.');
    expect(GoogleAuth).not.toHaveBeenCalled();
  });

  it('should return null and log error if GoogleAuth constructor throws', async () => {
    const authError = new Error('Auth constructor failed');
    GoogleAuth.mockImplementationOnce(() => { throw authError; });
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: 'Error', errMessage: 'Auth constructor failed' }),
        'Error generating Google ID token.'
    );
  });

  it('should return null and log error if getIdTokenClient rejects', async () => {
    const clientError = new Error('Failed to get client');
    mockGetIdTokenClient.mockRejectedValueOnce(clientError);
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: 'Error', errMessage: 'Failed to get client' }),
        'Error generating Google ID token.'
    );
    expect(mockFetchIdToken).not.toHaveBeenCalled();
  });

  it('should return null and log error if client object is invalid (missing provider)', async () => {
    mockGetIdTokenClient.mockResolvedValueOnce({ someOtherProperty: 'value' });
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ clientExists: true, clientType: 'object', providerExists: false }),
        'Client or idTokenProvider or fetchIdToken function is missing/invalid.'
    );
    expect(mockPinoInstance.debug).toHaveBeenCalledWith( // Check debug log added in defensive check
        { clientKeys: ['someOtherProperty'] },
        'Available keys on the received client object.'
    );
    expect(mockFetchIdToken).not.toHaveBeenCalled();
  });

  it('should return null and log error if fetchIdToken rejects', async () => {
    const tokenError = new Error('Failed to fetch token from provider');
    mockFetchIdToken.mockRejectedValueOnce(tokenError);
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockGetIdTokenClient).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockPinoInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: 'Error', errMessage: 'Failed to fetch token from provider' }),
        'Error generating Google ID token.'
    );
  });

  it('should return null and log error if fetchIdToken returns null/undefined', async () => {
    mockFetchIdToken.mockResolvedValueOnce(null);
    const token = await generateIdToken(MOCK_CREDS, MOCK_AUDIENCE);
    expect(token).toBeNull();
    expect(mockFetchIdToken).toHaveBeenCalledWith(MOCK_AUDIENCE);
    expect(mockPinoInstance.error).toHaveBeenCalledWith('Failed to retrieve ID token (fetchIdToken returned null/undefined).');
    expect(mockPinoInstance.info).not.toHaveBeenCalledWith(
        expect.stringMatching('Successfully generated ID token via idTokenProvider.')
    );
  });
});


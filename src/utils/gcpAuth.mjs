// src/utils/gcpAuth.mjs
import { GoogleAuth } from 'google-auth-library';

export const generateIdToken = async (credentials, targetAudience, log) => {
  // Ensure log is valid at the start
  if (typeof log?.info !== 'function') {
    console.error("CRITICAL: Invalid logger passed to generateIdToken");
    // Attempt to use console as a fallback for this critical error
    console.error({ credentials: !!credentials, targetAudience, log }, "generateIdToken initial check");
    return null; // Cannot proceed without logger
  }

  // ... initial checks for credentials, targetAudience ...
  if (!credentials || !targetAudience) {
    log.error('Missing credentials or targetAudience for generateIdToken');
    return null;
  }

  try {
    const auth = new GoogleAuth({ credentials });
    log.info('Calling auth.getIdTokenClient()...');
    const client = await auth.getIdTokenClient(targetAudience);
    log.info({ clientType: typeof client }, 'auth.getIdTokenClient() resolved.');

    if (!client?.idTokenProvider?.fetchIdToken) {
      log.error('Failed to get a valid ID token client or provider method.');
      return null;
    }
    log.info('Calling client.idTokenProvider.fetchIdToken()...');
    const token = await client.idTokenProvider.fetchIdToken(targetAudience);
    log.info('client.idTokenProvider.fetchIdToken() resolved.'); // <-- Last log seen

    // --- START ADDED DEBUG LOGGING ---
    log.debug({ tokenValue: token, tokenType: typeof token }, 'Token value received from fetchIdToken.'); // What is the token?

    if (!token) {
      log.error('fetchIdToken returned null, undefined, or empty string.'); // More specific error
      return null;
    }

    // If we get here, token is truthy
    log.debug({ tokenLength: token?.length }, 'Token is truthy, attempting final log.');
    // --- END ADDED DEBUG LOGGING ---

    // This is the log that was missing
    log.info({ targetAudience, tokenLength: token?.length }, 'Successfully generated ID token via idTokenProvider.');
    return token;

  } catch (error) {
    log.error({
      errName: error?.name,
      errMessage: error?.message,
      errStack: error?.stack,
      targetAudience
    }, 'Error during ID token generation process.');
    return null;
  }
};

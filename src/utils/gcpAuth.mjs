// src/utils/gcpAuth.mjs
import { GoogleAuth } from 'google-auth-library';
import logger from './logger.mjs';

export const generateIdToken = async (serviceAccountCredentials, targetAudience) => {
  const log = logger.child({ utility: 'gcpAuth' });

  /* ---------- validation of inputs (unchanged) ---------- */
  if (
      !serviceAccountCredentials ||
      typeof serviceAccountCredentials !== 'object' ||
      !serviceAccountCredentials.client_email ||
      !serviceAccountCredentials.private_key
  ) {
    log.error('Invalid or missing service account credentials provided.');
    return null;
  }
  if (!targetAudience || typeof targetAudience !== 'string') {
    log.error('Invalid or missing target audience provided.');
    return null;
  }

  try {
    log.info({ targetAudience }, 'Attempting to generate ID token via idTokenProvider.');

    /* ---------------- obtain IdTokenClient ---------------- */
    const auth = new GoogleAuth({ credentials: serviceAccountCredentials });

    log.info('Calling auth.getIdTokenClient()...');
    const client = await auth.getIdTokenClient(targetAudience);

    /* <─── 1.  SUCCESS LOG THAT THE TEST EXPECTS ───> */
    log.info({ clientType: typeof client }, 'auth.getIdTokenClient() resolved.');

    /* ------------- 2.  DEFENSIVE VALIDATION --------------- */
    if (
        !client ||
        typeof client !== 'object' ||
        !client.idTokenProvider ||
        typeof client.idTokenProvider.fetchIdToken !== 'function'
    ) {
      log.debug(
          { clientKeys: Object.keys(client || {}) },
          'Available keys on the received client object.'
      );

      log.error(
          {
            clientExists: !!client,
            clientType: typeof client,
            providerExists:
                !!client?.idTokenProvider &&
                typeof client?.idTokenProvider.fetchIdToken === 'function',
          },
          'Client or idTokenProvider or fetchIdToken function is missing/invalid.'
      );
      return null;
    }

    /* ---------------- obtain the ID-token ------------------ */
    log.info('Calling client.idTokenProvider.fetchIdToken()...');
    const idToken = await client.idTokenProvider.fetchIdToken(targetAudience);
    log.info('client.idTokenProvider.fetchIdToken() resolved.');

    if (!idToken) {
      log.error('Failed to retrieve ID token (fetchIdToken returned null/undefined).');
      return null;
    }

    log.info(
        { targetAudience, tokenLength: idToken.length },
        'Successfully generated ID token via idTokenProvider.'
    );
    return idToken;
  } catch (error) {
    log.error(
        {
          errName: error.name,
          errMessage: error.message,
          errStack: error.stack?.split('\n')[1]?.trim(),
          targetAudience,
        },
        'Error generating Google ID token.'
    );
    return null;
  }
};

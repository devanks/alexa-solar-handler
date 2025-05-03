// src/index.mjs
import logger from './utils/logger.mjs';
import { getSecret } from './utils/secrets.mjs';
import { generateIdToken } from './utils/gcpAuth.mjs'; // Import the new function

export const handler = async (event, context) => {
  // Read required environment variables inside the handler
  const GCP_SECRET_ID = process.env.GCP_SECRET_ID;
  const TARGET_AUDIENCE = process.env.TARGET_AUDIENCE; // New environment variable

  const log = logger.child({ awsRequestId: context.awsRequestId });
  log.info({ event }, 'Received event');

  // --- Variable Initialization ---
  let statusCode = 500; // Default to error
  let message = 'An unexpected error occurred.';
  let gcpCredentials = null;
  let idToken = null;
  let retrievedProjectId = null;
  let tokenGenerated = false;

  // --- Input Validation ---
  if (!GCP_SECRET_ID) {
    message = 'GCP_SECRET_ID environment variable is not set.';
    log.error(message);
  } else if (!TARGET_AUDIENCE) {
    message = 'TARGET_AUDIENCE environment variable is not set.';
    log.error(message);
  } else {
    // --- Fetch Credentials ---
    log.info('Attempting to fetch GCP credentials.');
    gcpCredentials = await getSecret(GCP_SECRET_ID);

    if (!gcpCredentials) {
      message = 'Failed to retrieve GCP credentials. Check logs.';
      log.error(message);
      // Keep statusCode 500
    } else {
      retrievedProjectId = gcpCredentials.project_id || null;
      log.info(
        { projectId: retrievedProjectId },
        'Successfully retrieved and parsed GCP credentials.'
      );

      // --- Generate ID Token ---
      log.info('Attempting to generate Google ID token.');
      idToken = await generateIdToken(gcpCredentials, TARGET_AUDIENCE);

      if (!idToken) {
        message =
          'Successfully retrieved credentials, but failed to generate Google ID token. Check logs.';
        log.error(message);
        // Keep statusCode 500 as token generation failed
      } else {
        // --- Success ---
        tokenGenerated = true;
        statusCode = 200; // Success!
        message =
          'Successfully retrieved credentials and generated Google ID token.';
        log.info(message);
        // TODO: Next step - Use the idToken to call the target service
      }
    }
  }

  // --- Construct Response ---
  // SECURITY: Do not include the full idToken in the response body!
  // Include only non-sensitive confirmation.
  const responseBody = {
    message: message,
    retrievedProjectId: retrievedProjectId,
    tokenGenerated: tokenGenerated, // Indicate if token step was successful
    // Example of masked token for DEBUGGING ONLY - REMOVE FOR PRODUCTION
    // debug_token_preview: idToken ? `${idToken.substring(0, 5)}...${idToken.substring(idToken.length - 5)}` : null,
    awsRequestId: context.awsRequestId,
  };

  const response = {
    statusCode: statusCode,
    body: JSON.stringify(responseBody),
    headers: {
      'Content-Type': 'application/json',
    },
  };

  log.info(
    {
      response: { statusCode: response.statusCode, headers: response.headers },
    },
    'Sending response'
  );
  return response;
};

// src/index.mjs
import { getSecret } from './utils/secrets.mjs';
import { generateIdToken } from './utils/gcpAuth.mjs';
import { callGcpFunction } from './utils/gcpClient.mjs';
import logger from './utils/logger.mjs';

export const handler = async (event, context) => {
  // Ensure context exists and has awsRequestId for robust logging
  const awsRequestId = context?.awsRequestId || 'no-request-id';
  const log = logger.child({ awsRequestId });

  log.info({ event: event || 'No event object provided' }, 'Received event');

  // --- Environment Variable Check ---
  const { GCP_SECRET_ID, TARGET_AUDIENCE } = process.env;

  if (!GCP_SECRET_ID) {
    log.error('GCP_SECRET_ID environment variable not set.');
    // **Ensure this return statement is present**
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Configuration error: GCP_SECRET_ID missing.',
        awsRequestId,
      }),
    };
  }
  if (!TARGET_AUDIENCE) {
    log.error('TARGET_AUDIENCE environment variable not set.');
    // **Ensure this return statement is present**
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Configuration error: TARGET_AUDIENCE missing.',
        awsRequestId,
      }),
    };
  }

  // --- Get GCP Credentials ---
  log.info({ secretId: GCP_SECRET_ID }, 'Attempting to fetch GCP credentials.'); // Log which secret is being fetched
  let credentials;
  try {
    credentials = await getSecret(GCP_SECRET_ID);
  } catch (error) {
    // Catch potential errors *during* secret fetching itself
    log.error({ err: error }, 'Error occurred while calling getSecret.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error retrieving GCP credentials.',
        error: error.message,
        awsRequestId,
      }),
    };
  }

  if (!credentials) {
    log.error(
      'Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).'
    );
    // **Ensure this return statement is present**
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Failed to retrieve GCP credentials.',
        awsRequestId,
      }),
    };
  }
  // Log success only after validation
  log.info(
    { projectId: credentials.project_id },
    'Successfully retrieved and parsed GCP credentials.'
  );

  // --- Generate Google ID Token ---
  log.info('Attempting to generate Google ID token.');
  let idToken;
  try {
    idToken = await generateIdToken(credentials, TARGET_AUDIENCE);
  } catch (error) {
    // Catch potential errors *during* token generation itself
    log.error({ err: error }, 'Error occurred while calling generateIdToken.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Error generating Google ID token.',
        error: error.message,
        awsRequestId,
      }),
    };
  }

  if (!idToken) {
    log.error(
      'Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).'
    );
    // **Ensure this return statement is present**
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:
          'Successfully retrieved credentials, but failed to generate Google ID token. Check logs.',
        retrievedProjectId: credentials.project_id, // Include context if available
        tokenGenerated: false,
        awsRequestId,
      }),
    };
  }
  // Log success only after validation
  log.info('Successfully generated Google ID token.');

  // --- Call Target Cloud Function using the Client ---
  try {
    const gcpResponse = await callGcpFunction(
      TARGET_AUDIENCE,
      idToken,
      event,
      log
    );
    log.info('Successfully received response via GCP client.');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gcpResponse),
    };
  } catch (error) {
    // Catch errors specifically from the callGcpFunction client
    log.error(
      {
        errName: error.name,
        errMessage: error.message,
        errStatusCode: error.statusCode,
        errIsNetwork: error.isNetworkError,
        errIsParse: error.isParseError,
        ...(error.responseBody && {
          errResponseBodyPreview: error.responseBody.substring(0, 200),
        }),
      },
      'Error occurred during GCP Cloud Function call.'
    );

    let statusCode = 502; // Default: Bad Gateway
    let message = 'Error calling upstream Cloud Function.'; // Default message

    if (error.isNetworkError) {
      statusCode = 504; // Gateway Timeout
      message = 'Network error reaching upstream Cloud Function.';
    } else if (error.isParseError) {
      // statusCode remains 502
      message = 'Failed to parse upstream Cloud Function response.';
    } else if (error.statusCode) {
      // statusCode remains 502 (or could be customized)
      message = `Upstream Cloud Function returned status ${error.statusCode}.`;
    }

    return {
      statusCode: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        errorDetails: error.message,
        awsRequestId,
      }),
    };
  }
};

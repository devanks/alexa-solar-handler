// src/index.mjs
import logger from './utils/logger.mjs';
import { getSecret } from './utils/secrets.mjs'; // Import the new function

// Read the Secret ID from environment variables
export const handler = async (event, context) => {
  const GCP_SECRET_ID = process.env.GCP_SECRET_ID;
  const log = logger.child({ awsRequestId: context.awsRequestId });
  log.info({ event }, 'Received event');

  let gcpCredentials = null;
  if (!GCP_SECRET_ID) {
    log.error('GCP_SECRET_ID environment variable is not set.');
  } else {
    // Attempt to fetch the GCP credentials from Secrets Manager
    gcpCredentials = await getSecret(GCP_SECRET_ID);
  }

  let message;
  if (gcpCredentials) {
    // IMPORTANT: DO NOT log the actual credentials in production!
    // Log only non-sensitive parts for confirmation during testing.
    log.info(
      { projectId: gcpCredentials.project_id }, // Example: Log only project_id
      'Successfully retrieved and parsed GCP credentials.'
    );
    message = 'Successfully retrieved GCP credentials.';
  } else {
    log.error('Failed to retrieve GCP credentials.');
    message = 'Failed to retrieve GCP credentials. Check logs.';
  }

  // TODO: Next step - Use gcpCredentials to generate an ID token

  // Modify the response to reflect the outcome
  const response = {
    statusCode: gcpCredentials ? 200 : 500, // Return 500 if fetching failed
    body: JSON.stringify({
      message: message,
      retrievedProjectId: gcpCredentials?.project_id || null, // Example detail in response
      awsRequestId: context.awsRequestId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };

  log.info(
    {
      response: { statusCode: response.statusCode, headers: response.headers },
    },
    'Sending response'
  ); // Avoid logging sensitive body
  return response;
};

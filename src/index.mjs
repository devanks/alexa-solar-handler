// src/index.mjs
import { getSecret } from './utils/secrets.mjs';
import { generateIdToken } from './utils/gcpAuth.mjs';
import { callGcpFunction } from './utils/gcpClient.mjs'; // Assuming this is the intended GCP client function
import baseLogger from './utils/logger.mjs'; // Changed import name for clarity
import { routeRequest } from './router.mjs';
import { buildTellResponse } from './utils/responseBuilder.mjs';

export const handler = async (event, context) => {
  const awsRequestId = context?.awsRequestId || 'no-request-id';
  // Initialize request-specific logger *once*
  const log = baseLogger.child({ awsRequestId }); // Use baseLogger

  log.info({ event: event || 'No event object provided' }, 'Received event');

  let idToken; // Will hold the token if auth succeeds
  let credentials; // Will hold credentials

  try {
    // --- Environment Variable Check ---
    const { GCP_SECRET_ID, TARGET_AUDIENCE } = process.env;
    if (!GCP_SECRET_ID) {
      log.error('Configuration error: GCP_SECRET_ID missing.');
      return buildTellResponse('Sorry, the skill is not configured correctly. Missing secret ID.');
    }
    if (!TARGET_AUDIENCE) {
      log.error('Configuration error: TARGET_AUDIENCE missing.');
      return buildTellResponse('Sorry, the skill is not configured correctly. Missing target audience.');
    }

    // --- Get GCP Credentials ---
    log.info({ secretId: GCP_SECRET_ID }, 'Attempting to fetch GCP credentials.');
    // *** FIX: Pass 'log' as the second argument ***
    credentials = await getSecret(GCP_SECRET_ID, log);
    // *********************************************
    if (!credentials) {
      log.error('Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).');
      return buildTellResponse("Sorry, I couldn't retrieve the necessary credentials right now. Please try again later.");
    }
    log.info({ projectId: credentials.project_id }, 'Successfully retrieved and parsed GCP credentials.');

    // --- Generate Google ID Token ---
    log.info('Attempting to generate Google ID token.');
    // *** FIX: Pass 'log' as the third argument ***
    idToken = await generateIdToken(credentials, TARGET_AUDIENCE, log);
    // ********************************************
    if (!idToken) {
      // This log might now be redundant if generateIdToken logs the specific internal error
      log.error('Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).');
      return buildTellResponse('Sorry, I encountered an issue authenticating. Please try again later.');
    }
    log.info('Successfully generated Google ID token.'); // This log should now appear

    // --- Routing ---
    const selectedHandler = routeRequest(event, log);

    // --- Execute Handler ---
    if (selectedHandler) {
      log.info({ handlerName: selectedHandler.name || 'anonymous' }, 'Executing selected handler.');
      const handlerConfig = {
        targetAudience: TARGET_AUDIENCE,
        idToken: idToken,
      };
      // Assuming handlers expect event, log, callGcpFunction, handlerConfig
      const response = await selectedHandler(event, log, callGcpFunction, handlerConfig);
      log.info({ response }, 'Handler execution successful.');
      return response;
    } else if (event?.request?.type === 'SessionEndedRequest') {
      log.info('SessionEndedRequest received. No response needed.');
      return {};
    } else {
      log.warn({ requestType: event?.request?.type, intentName: event?.request?.intent?.name }, 'No handler found for this request. Sending fallback response.');
      return buildTellResponse("Sorry, I didn't understand that request or I can't handle it right now.");
    }
  } catch (error) {
    // --- Generic Error Handling ---
    log.error({ errName: error?.name, errMessage: error?.message, errStack: error?.stack, eventId: event?.request?.requestId }, 'Unhandled error during Lambda execution.');
    return buildTellResponse('Sorry, something went wrong. Please try again later.');
  }
};

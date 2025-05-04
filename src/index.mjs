// src/index.mjs
import { getSecret } from './utils/secrets.mjs';
import { generateIdToken } from './utils/gcpAuth.mjs';
import { callGcpFunction } from './utils/gcpClient.mjs'; // Still needed for handlers potentially
import logger from './utils/logger.mjs';
import { routeRequest } from './router.mjs'; // Import the router
import { buildTellResponse } from './utils/responseBuilder.mjs'; // For fallback responses

export const handler = async (event, context) => {
  const awsRequestId = context?.awsRequestId || 'no-request-id';
  // Initialize request-specific logger *once*
  const log = logger.child({ awsRequestId });

  log.info({ event: event || 'No event object provided' }, 'Received event');

  let idToken; // Will hold the token if auth succeeds
  let credentials; // Will hold credentials

  try {
    // --- Environment Variable Check ---
    const { GCP_SECRET_ID, TARGET_AUDIENCE } = process.env;
    if (!GCP_SECRET_ID) {
      log.error('Configuration error: GCP_SECRET_ID missing.');
      return buildTellResponse(
        'Sorry, the skill is not configured correctly. Missing secret ID.'
      );
    }
    if (!TARGET_AUDIENCE) {
      log.error('Configuration error: TARGET_AUDIENCE missing.');
      return buildTellResponse(
        'Sorry, the skill is not configured correctly. Missing target audience.'
      );
    }

    // --- Get GCP Credentials ---
    log.info(
      { secretId: GCP_SECRET_ID },
      'Attempting to fetch GCP credentials.'
    );
    credentials = await getSecret(GCP_SECRET_ID);
    if (!credentials) {
      log.error(
        'Failed to retrieve GCP credentials from Secrets Manager (getSecret returned null/undefined).'
      );
      // Return user-friendly Alexa response
      return buildTellResponse(
        "Sorry, I couldn't retrieve the necessary credentials right now. Please try again later."
      );
    }
    log.info(
      { projectId: credentials.project_id },
      'Successfully retrieved and parsed GCP credentials.'
    );

    // --- Generate Google ID Token ---
    log.info('Attempting to generate Google ID token.');
    idToken = await generateIdToken(credentials, TARGET_AUDIENCE);
    if (!idToken) {
      log.error(
        'Failed to generate Google ID token after retrieving credentials (generateIdToken returned null/undefined).'
      );
      // Return user-friendly Alexa response
      return buildTellResponse(
        'Sorry, I encountered an issue authenticating. Please try again later.'
      );
    }
    log.info('Successfully generated Google ID token.');

    // --- Routing ---
    const selectedHandler = routeRequest(event);

    // --- Execute Handler ---
    if (selectedHandler) {
      log.info(
        { handlerName: selectedHandler.name },
        'Executing selected handler.'
      );
      // Prepare dependencies/config for the handler
      const handlerConfig = {
        targetAudience: TARGET_AUDIENCE,
        idToken: idToken,
        // Add other config/dependencies handlers might need
      };
      // Call the selected handler, passing event, log, the GCP client function, and config
      // The handler itself should manage errors related to the GCP call
      const response = await selectedHandler(
        event,
        log,
        callGcpFunction,
        handlerConfig
      );
      log.info({ response }, 'Handler execution successful.');
      return response;
    } else if (event?.request?.type === 'SessionEndedRequest') {
      // Gracefully handle SessionEndedRequest which doesn't need a response body
      log.info('SessionEndedRequest received. No response needed.');
      return {}; // Return empty object or appropriate structure if needed by platform
    } else {
      // No handler found for other request types or unknown intents
      log.warn(
        {
          requestType: event?.request?.type,
          intentName: event?.request?.intent?.name,
        },
        'No handler found for this request. Sending fallback response.'
      );
      return buildTellResponse(
        "Sorry, I didn't understand that request or I can't handle it right now."
      );
    }
  } catch (error) {
    // --- Generic Error Handling ---
    // This catches unexpected errors during setup, routing, or handler execution
    log.error(
      {
        errName: error?.name,
        errMessage: error?.message,
        errStack: error?.stack,
        eventId: event?.request?.requestId, // Include event ID for tracing
      },
      'Unhandled error during Lambda execution.'
    );

    // Return a generic error response to the user
    return buildTellResponse(
      'Sorry, something went wrong. Please try again later.'
    );
  }
};

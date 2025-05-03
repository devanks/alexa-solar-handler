// src/utils/gcpClient.mjs
import fetch from 'node-fetch';
// Optional: Define a custom error class for upstream errors
// export class GcpClientError extends Error { ... }

/**
 * Calls the target Google Cloud Function with an ID token.
 *
 * @param {string} targetUrl - The URL of the Google Cloud Function.
 * @param {string} idToken - The bearer token for authentication.
 * @param {object} payload - The JSON payload to send in the request body.
 * @param {object} log - The logger instance.
 * @returns {Promise<object>} - The parsed JSON response body from the Cloud Function.
 * @throws {Error} - Throws an error if the fetch fails, the status is not OK, or JSON parsing fails.
 */
export const callGcpFunction = async (targetUrl, idToken, payload, log) => {
  log.info(
    { target: targetUrl },
    'Attempting to call target Google Cloud Function via client.'
  );

  let response; // Declare response outside try block to access status in catch
  try {
    response = await fetch(targetUrl, {
      method: 'POST', // Assuming POST
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        // Add any other required headers here
      },
      body: JSON.stringify(payload),
    });

    log.info(
      { status: response.status, statusText: response.statusText },
      'Received response from Cloud Function.'
    );

    const responseBodyText = await response.text(); // Get text first

    if (!response.ok) {
      log.error(
        {
          target: targetUrl,
          statusCode: response.status,
          responseBody: responseBodyText,
        },
        'Cloud Function call failed with non-OK status.'
      );

      // Create a more informative error
      const error = new Error(
        `Cloud Function call failed with status ${response.status}`
      );
      error.statusCode = response.status; // Attach status code
      error.responseBody = responseBodyText; // Attach body text
      error.isApiClientError = true; // Flag for handler
      throw error;
    }

    // Attempt to parse JSON only if response was OK
    try {
      const jsonResponse = JSON.parse(responseBodyText);
      log.info('Successfully parsed JSON response from Cloud Function.');
      return jsonResponse; // Success! Return the parsed body
    } catch (parseError) {
      log.error(
        { responseBody: responseBodyText, err: parseError },
        'Failed to parse JSON response from Cloud Function.'
      );
      const error = new Error('Failed to parse Cloud Function JSON response');
      error.statusCode = response.status; // Keep original status
      error.responseBody = responseBodyText;
      error.isParseError = true; // Flag for handler
      error.isApiClientError = true;
      throw error;
    }
  } catch (fetchError) {
    // Handle network errors or errors thrown above
    if (fetchError.isApiClientError) {
      // If it's an error we already processed (non-OK status, parse error), re-throw it
      throw fetchError;
    } else {
      // Otherwise, it's likely a network/fetch-level error
      log.error(
        {
          errName: fetchError.name,
          errMessage: fetchError.message,
          target: targetUrl,
        },
        'Network or other error calling Cloud Function.'
      );
      const error = new Error(
        `Network error calling Cloud Function: ${fetchError.message}`
      );
      error.isNetworkError = true; // Flag for handler
      error.isApiClientError = true;
      throw error;
    }
  }
};

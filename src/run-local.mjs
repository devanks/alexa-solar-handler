// run-local.mjs
import { handler } from './index.mjs'; // Import your handler

// --- Configuration ---
// Set environment variables like they would be in Lambda
// IMPORTANT: Replace with your actual values!
process.env.GCP_SECRET_ID =
  'arn:aws:secretsmanager:us-east-1:416823110122:secret:GCP_Solarman_Alexa_Invoker_Key-FtpVoD'; // Or just the secret name if using default region
process.env.TARGET_AUDIENCE =
  'https://us-central1-solarman-smartthings.cloudfunctions.net/AlexaHandler';
// Optional: Explicitly set AWS region if not using default or AWS_PROFILE
// process.env.AWS_REGION = 'us-east-1';
// Note: google-auth-library usually doesn't need GOOGLE_APPLICATION_CREDENTIALS
// when credentials are provided directly as an object, as we do here.

// --- Mock Lambda Input ---
const mockEvent = {
  // Add any properties your handler might expect from the event object
  // For now, an empty object might be sufficient
};

const mockContext = {
  awsRequestId: `local-${Date.now()}-${Math.random().toString(16).substring(2)}`, // Generate a unique-ish ID
  functionName: 'alexa-gcp-proxy-local',
  // Add other context properties if your handler uses them
  // getRemainingTimeInMillis: () => 30000, // Example: 30 seconds
};

// --- Execute Handler ---
console.log('--- Running Handler Locally ---');
console.log('Event:', JSON.stringify(mockEvent));
console.log('Context Request ID:', mockContext.awsRequestId);
console.log('Environment Vars:', {
  GCP_SECRET_ID: process.env.GCP_SECRET_ID,
  TARGET_AUDIENCE: process.env.TARGET_AUDIENCE,
  AWS_REGION: process.env.AWS_REGION || '(using default/profile)',
});
console.log('---------------------------------');

(async () => {
  try {
    const response = await handler(mockEvent, mockContext);

    console.log('\n--- Handler Response ---');
    console.log('Status Code:', response.statusCode);
    console.log('Headers:', JSON.stringify(response.headers));
    console.log('Body:', response.body); // Body is already stringified
    console.log('------------------------');

    if (response.statusCode !== 200) {
      console.error('\nHandler returned non-200 status.');
      process.exitCode = 1; // Indicate failure
    }
  } catch (error) {
    console.error('\n--- Handler Error ---');
    console.error(error);
    console.error('---------------------');
    process.exitCode = 1; // Indicate failure
  }
})();

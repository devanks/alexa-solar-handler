// src/utils/secrets.mjs
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import logger from './logger.mjs';

// Instantiate the Secrets Manager client
// By default, it will use the credentials from the Lambda execution environment (IAM Role)
// Specify the region; it's good practice, though often inferred from the environment.
const region = process.env.AWS_REGION || 'us-east-1'; // Or your specific region
const client = new SecretsManagerClient({ region });

/**
 * Fetches a secret from AWS Secrets Manager.
 * @param {string} secretId - The name or ARN of the secret.
 * @returns {Promise<object|null>} - A promise that resolves to the parsed secret object (assuming JSON), or null if an error occurs.
 */
export const getSecret = async (secretId) => {
  const log = logger.child({ service: 'SecretsManager', secretId });
  log.info('Attempting to fetch secret');

  if (!secretId) {
    log.error('Secret ID was not provided.');
    return null;
  }

  const command = new GetSecretValueCommand({ SecretId: secretId });

  try {
    const data = await client.send(command);
    let secretValue;

    if ('SecretString' in data && data.SecretString) {
      secretValue = data.SecretString;
      log.info('SecretString retrieved successfully.');
    } else if ('SecretBinary' in data && data.SecretBinary) {
      // If the secret is binary, decode it (assuming base64)
      const buff = Buffer.from(data.SecretBinary, 'base64');
      secretValue = buff.toString('utf-8');
      log.info('SecretBinary retrieved and decoded successfully.');
    } else {
      log.warn('Secret value not found in response.');
      return null;
    }

    // Assuming the secret string is JSON
    try {
      const parsedSecret = JSON.parse(secretValue);
      log.info('Secret parsed successfully as JSON.');
      // IMPORTANT: Avoid logging the actual parsedSecret content here in production!
      // For debugging ONLY, you might log Object.keys(parsedSecret)
      log.debug(
        { secretKeys: Object.keys(parsedSecret) },
        'Parsed secret keys'
      );
      return parsedSecret;
    } catch (parseError) {
      log.error({ err: parseError }, 'Failed to parse secret string as JSON.');
      // Optionally return the raw string if parsing fails and that's acceptable
      // return secretValue;
      return null;
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to retrieve secret from Secrets Manager');
    // Consider different error handling based on error.name
    // e.g., 'ResourceNotFoundException', 'AccessDeniedException'
    return null;
  }
};

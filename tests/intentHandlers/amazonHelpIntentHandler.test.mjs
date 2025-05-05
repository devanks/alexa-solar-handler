// tests/intentHandlers/amazonHelpIntentHandler.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleHelpIntent } from '../../src/intentHandlers/amazonHelpIntentHandler.mjs';
import { buildAskResponse } from '../../src/utils/responseBuilder.mjs'; // To construct expected result

describe('AMAZON.HelpIntent Handler', () => {
  // --- Mocks ---
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockLogger),
  };

  // --- Mock Event ---
  const mockHelpEvent = {
    version: '1.0',
    session: {
      // Session details are less critical here, but include for completeness
      new: false,
      sessionId: 'amzn1.echo-api.session.test-help-session',
      application: {
        applicationId: 'amzn1.ask.skill.test-skill-id',
      },
      attributes: {}, // No specific attributes expected for Help
      user: { userId: 'test-user-help' },
    },
    context: {
      /* ... context details ... */
    },
    request: {
      type: 'IntentRequest',
      requestId: 'amzn1.echo-api.request.test-help-request',
      timestamp: '2023-01-01T15:00:00Z',
      locale: 'en-US',
      intent: {
        name: 'AMAZON.HelpIntent', // Correct intent name
        confirmationStatus: 'NONE',
        slots: {}, // No slots expected for Help
      },
    },
  };

  // --- Reset Mocks ---
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Test Case ---

  it('should return the correct help message and reprompt using buildAskResponse', async () => {
    // Arrange
    const expectedSpeech = `You can ask me about your solar energy system. For example, try saying:
        'What's my current power production?',
        'How much energy did I produce today?',
        Or, 'Is the system online?'.
        What would you like to know?`;
    const expectedReprompt =
      'You can ask about current power, daily production, or the system status. What data are you interested in?';

    const expectedResponse = buildAskResponse(expectedSpeech, expectedReprompt);

    // Act
    // Note: Help handler doesn't need gcpClient or config
    const result = await handleHelpIntent(mockHelpEvent, mockLogger);

    // Assert
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Handling AMAZON.HelpIntent.');
    expect(result).toEqual(expectedResponse); // Check the entire response structure
    expect(result.response.shouldEndSession).toBe(false); // Verify session stays open
  });
});

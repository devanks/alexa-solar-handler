// tests/utils/responseBuilder.test.mjs
import { describe, it, expect } from '@jest/globals';
import {
    buildSimpleResponse,
    buildAskResponse,
    buildTellResponse
} from '../../src/utils/responseBuilder.mjs';

describe('Response Builder Utilities', () => {

    // --- Parameterized Tests for buildSimpleResponse ---
    describe('buildSimpleResponse', () => {
        // Define test cases as an array of arrays or array of objects
        // Format: [description, speech, shouldEndSession, repromptText, sessionAttributes, expectedResponse]
        const simpleResponseTestCases = [
            [
                'minimal response ending session',
                'Goodbye!', true, null, {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: { outputSpeech: { type: 'PlainText', text: 'Goodbye!' }, shouldEndSession: true }
                }
            ],
            [
                'minimal response keeping session open (no reprompt)',
                'What next?', false, null, {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: { outputSpeech: { type: 'PlainText', text: 'What next?' }, shouldEndSession: false }
                    // No reprompt object expected
                }
            ],
            [
                'response with reprompt when session stays open',
                'Ask me something.', false, 'I didn\'t hear that, what can I do?', {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: {
                        outputSpeech: { type: 'PlainText', text: 'Ask me something.' },
                        shouldEndSession: false,
                        reprompt: { outputSpeech: { type: 'PlainText', text: 'I didn\'t hear that, what can I do?' } }
                    }
                }
            ],
            [
                'response NOT including reprompt if session ends',
                'Okay, done.', true, 'This should not appear.', {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: { outputSpeech: { type: 'PlainText', text: 'Okay, done.' }, shouldEndSession: true }
                    // No reprompt object expected
                }
            ],
            [
                'response including session attributes',
                'Attributes set.', true, null, { key1: 'value1', count: 5 },
                {
                    version: '1.0', sessionAttributes: { key1: 'value1', count: 5 },
                    response: { outputSpeech: { type: 'PlainText', text: 'Attributes set.' }, shouldEndSession: true }
                }
            ],
            [
                'response keeping session open with attributes and reprompt',
                'Tell me more.', false, 'What else?', { state: 'asking' },
                {
                    version: '1.0', sessionAttributes: { state: 'asking' },
                    response: {
                        outputSpeech: { type: 'PlainText', text: 'Tell me more.' },
                        shouldEndSession: false,
                        reprompt: { outputSpeech: { type: 'PlainText', text: 'What else?' } }
                    }
                }
            ]
        ];

        // Use it.each to run the tests
        it.each(simpleResponseTestCases)(
            'should build a %s', // Uses the first element of each case array as description part
            (description, speech, shouldEndSession, repromptText, sessionAttributes, expected) => {
                expect(buildSimpleResponse(speech, shouldEndSession, repromptText, sessionAttributes)).toEqual(expected);
            }
        );
    });

    // --- Parameterized Tests for buildAskResponse ---
    describe('buildAskResponse', () => {
        // Format: [description, speech, reprompt, attributes, expected]
        const askResponseTestCases = [
            [
                'basic ask response',
                'What is your favorite color?', 'Please tell me your favorite color.', {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: {
                        outputSpeech: { type: 'PlainText', text: 'What is your favorite color?' },
                        shouldEndSession: false,
                        reprompt: { outputSpeech: { type: 'PlainText', text: 'Please tell me your favorite color.' } }
                    }
                }
            ],
            [
                'ask response with session attributes',
                'What else?', 'Tell me more.', { lastIntent: 'SomeIntent' },
                {
                    version: '1.0', sessionAttributes: { lastIntent: 'SomeIntent' },
                    response: {
                        outputSpeech: { type: 'PlainText', text: 'What else?' },
                        shouldEndSession: false,
                        reprompt: { outputSpeech: { type: 'PlainText', text: 'Tell me more.' } }
                    }
                }
            ]
        ];

        it.each(askResponseTestCases)(
            'should build a %s',
            (description, speech, reprompt, attributes, expected) => {
                expect(buildAskResponse(speech, reprompt, attributes)).toEqual(expected);
            }
        );
    });

    // --- Parameterized Tests for buildTellResponse ---
    describe('buildTellResponse', () => {
        // Format: [description, speech, attributes, expected]
        const tellResponseTestCases = [
            [
                'basic tell response',
                'Okay, closing the skill now.', {},
                {
                    version: '1.0', sessionAttributes: {},
                    response: { outputSpeech: { type: 'PlainText', text: 'Okay, closing the skill now.' }, shouldEndSession: true }
                }
            ],
            [
                'tell response with session attributes',
                'Final message.', { finalState: 'complete' },
                {
                    version: '1.0', sessionAttributes: { finalState: 'complete' },
                    response: { outputSpeech: { type: 'PlainText', text: 'Final message.' }, shouldEndSession: true }
                }
            ]
        ];

        it.each(tellResponseTestCases)(
            'should build a %s',
            (description, speech, attributes, expected) => {
                expect(buildTellResponse(speech, attributes)).toEqual(expected);
            }
        );
    });
});

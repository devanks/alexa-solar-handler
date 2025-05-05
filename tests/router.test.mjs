// tests/router.test.mjs
import { describe, it, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// --- Mock the handlers ---
const mockLaunchHandler = jest.fn();
const mockCurrentPowerHandler = jest.fn();
const mockDailyProductionHandler = jest.fn();
const mockHelpHandler = jest.fn();
const mockStopCancelHandler = jest.fn();
const mockFallbackHandler = jest.fn();
const mockSessionEndedHandler = jest.fn();
const mockGetOnlineStatusHandler = jest.fn();
const mockGetSummaryHandler = jest.fn();

// --- Mock the modules ---
jest.unstable_mockModule('../src/intentHandlers/launchRequestHandler.mjs', () => ({ handleLaunchRequest: mockLaunchHandler }));
jest.unstable_mockModule('../src/intentHandlers/getCurrentPowerIntentHandler.mjs', () => ({ handleGetCurrentPowerIntent: mockCurrentPowerHandler }));
jest.unstable_mockModule('../src/intentHandlers/getDailyProductionIntentHandler.mjs', () => ({ handleGetDailyProductionIntent: mockDailyProductionHandler }));
jest.unstable_mockModule('../src/intentHandlers/getOnlineStatusIntentHandler.mjs', () => ({ handleGetOnlineStatusIntent: mockGetOnlineStatusHandler }));
jest.unstable_mockModule('../src/intentHandlers/getSummaryIntentHandler.mjs', () => ({ handleGetSummaryIntent: mockGetSummaryHandler }));
jest.unstable_mockModule('../src/intentHandlers/amazonHelpIntentHandler.mjs', () => ({ handleHelpIntent: mockHelpHandler }));
jest.unstable_mockModule('../src/intentHandlers/stopCancelIntentHandler.mjs', () => ({ handleStopCancelIntent: mockStopCancelHandler }));
jest.unstable_mockModule('../src/intentHandlers/fallbackIntentHandler.mjs', () => ({ handleFallbackIntent: mockFallbackHandler }));
jest.unstable_mockModule('../src/intentHandlers/sessionEndedRequestHandler.mjs', () => ({ handleSessionEndedRequest: mockSessionEndedHandler }));

// --- Mock the logger ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Keep debug if you want to assert specific debug logs later
    child: jest.fn(),
};

// --- Dynamically import the router ---
let routeRequest;
beforeAll(async () => {
    const routerModule = await import('../src/router.mjs');
    routeRequest = routerModule.routeRequest;
});

describe('Request Router', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger.child.mockReturnValue(mockLogger); // Reset child mock return value
    });

    // Helper function
    const createMockEvent = (requestType, intentName = null) => ({
        version: '1.0', session: {}, context: {},
        request: {
            type: requestType, requestId: 'req-id-' + Math.random(),
            timestamp: new Date().toISOString(), locale: 'en-US',
            ...(intentName && { intent: { name: intentName, slots: {} } }),
            ...(requestType === 'SessionEndedRequest' && { reason: 'USER_INITIATED' })
        },
    });

    // --- Test for LaunchRequest ---
    it('should return the LaunchRequest handler for LaunchRequest type', () => {
        const event = createMockEvent('LaunchRequest');
        const handler = routeRequest(event, mockLogger);
        expect(handler).toBe(mockLaunchHandler);
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'LaunchRequest' }, 'Determined request type.');
        expect(mockLogger.info).toHaveBeenCalledWith('Matched LaunchRequest'); // Changed from debug
        // *** ------------------ ***
    });

    // --- Parameterized Tests for IntentRequest Routing ---
    const intentRoutingTestCases = [
        { intentName: 'GetCurrentPowerIntent', expectedHandler: mockCurrentPowerHandler },
        { intentName: 'GetDailyProductionIntent', expectedHandler: mockDailyProductionHandler },
        { intentName: 'GetOnlineStatusIntent', expectedHandler: mockGetOnlineStatusHandler },
        { intentName: 'GetSummaryIntent', expectedHandler: mockGetSummaryHandler },
        { intentName: 'AMAZON.HelpIntent', expectedHandler: mockHelpHandler },
        { intentName: 'AMAZON.StopIntent', expectedHandler: mockStopCancelHandler },
        { intentName: 'AMAZON.CancelIntent', expectedHandler: mockStopCancelHandler },
        { intentName: 'AMAZON.FallbackIntent', expectedHandler: mockFallbackHandler },
        { intentName: 'UnknownIntent', expectedHandler: mockFallbackHandler },
    ];

    test.each(intentRoutingTestCases)(
        'should route IntentRequest for $intentName to the correct handler',
        ({ intentName, expectedHandler }) => {
            // Arrange
            const event = createMockEvent('IntentRequest', intentName);

            // Act
            const handler = routeRequest(event, mockLogger);

            // Assert Handler
            expect(handler).toBe(expectedHandler);

            // *** UPDATED Assertions ***
            expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
            expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'IntentRequest' }, 'Determined request type.');
            expect(mockLogger.info).toHaveBeenCalledWith({ intentName: intentName }, 'Determined intent name.');

            // Assert Specific Log (info or warn)
            if (intentName === 'UnknownIntent') {
                expect(mockLogger.warn).toHaveBeenCalledWith({ intentName }, 'Unknown intent name encountered.');
            } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
                // Match the combined log message from the code
                expect(mockLogger.info).toHaveBeenCalledWith('Matched AMAZON.Stop/CancelIntent');
            } else {
                expect(mockLogger.info).toHaveBeenCalledWith(`Matched ${intentName}`);
            }
            // *** ------------------ ***
        }
    );

    // --- Test for SessionEndedRequest ---
    it('should return the SessionEndedRequest handler for SessionEndedRequest type', () => {
        const event = createMockEvent('SessionEndedRequest');
        const handler = routeRequest(event, mockLogger);

        expect(handler).toBe(mockSessionEndedHandler);
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'SessionEndedRequest' }, 'Determined request type.');
        expect(mockLogger.info).toHaveBeenCalledWith('Matched SessionEndedRequest'); // Changed from debug
        // *** ------------------ ***
    });

    // --- Tests for Unknown Request Type and Invalid Event ---
    it('should return null for an unknown request type', () => {
        const event = createMockEvent('UnknownRequestType');
        const handler = routeRequest(event, mockLogger);

        expect(handler).toBeNull();
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'UnknownRequestType' }, 'Determined request type.');
        expect(mockLogger.warn).toHaveBeenCalledWith({ requestType: 'UnknownRequestType' }, 'No matching route found, returning null.'); // Changed message
        // *** ------------------ ***
    });

    it('should return null if event or request structure is invalid/missing', () => {
        expect(routeRequest(null, mockLogger)).toBeNull();
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---'); // Called even with null event
        expect(mockLogger.error).toHaveBeenCalledWith('Router Error: Event missing request type.');
        // *** ------------------ ***
        mockLogger.error.mockClear();
        mockLogger.info.mockClear(); // Clear info too

        expect(routeRequest({}, mockLogger)).toBeNull();
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.error).toHaveBeenCalledWith('Router Error: Event missing request type.');
        // *** ------------------ ***
        mockLogger.error.mockClear();
        mockLogger.info.mockClear();

        expect(routeRequest({ request: {} }, mockLogger)).toBeNull();
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.error).toHaveBeenCalledWith('Router Error: Event missing request type.');
        // *** ------------------ ***
    });

    it('should route to fallback if IntentRequest is missing intent name', () => {
        const event = { request: { type: 'IntentRequest', requestId: 'req-missing-intent' } }; // Missing intent obj/name
        const handler = routeRequest(event, mockLogger);
        expect(handler).toBe(mockFallbackHandler);
        // *** UPDATED Assertions ***
        expect(mockLogger.info).toHaveBeenCalledWith('--- Router received event ---');
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'IntentRequest' }, 'Determined request type.');
        expect(mockLogger.info).toHaveBeenCalledWith({ intentName: undefined }, 'Determined intent name.');
        expect(mockLogger.error).toHaveBeenCalledWith('Router Error: IntentRequest missing intent name.');
        // *** ------------------ ***
    });

});

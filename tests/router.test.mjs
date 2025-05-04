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
const mockGetSummaryHandler = jest.fn(); // Mock for the GetSummaryIntent handler


// --- Mock the modules ---
jest.unstable_mockModule('../src/intentHandlers/launchRequestHandler.mjs', () => ({ handleLaunchRequest: mockLaunchHandler }));
jest.unstable_mockModule('../src/intentHandlers/getCurrentPowerIntentHandler.mjs', () => ({ handleGetCurrentPowerIntent: mockCurrentPowerHandler }));
jest.unstable_mockModule('../src/intentHandlers/getDailyProductionIntentHandler.mjs', () => ({ handleGetDailyProductionIntent: mockDailyProductionHandler }));
jest.unstable_mockModule('../src/intentHandlers/getOnlineStatusIntentHandler.mjs', () => ({ handleGetOnlineStatusIntent: mockGetOnlineStatusHandler }));
// --- Ensure GetSummaryIntent handler is mocked ---
jest.unstable_mockModule('../src/intentHandlers/getSummaryIntentHandler.mjs', () => ({ handleGetSummaryIntent: mockGetSummaryHandler }));
// -------------------------------------------------
jest.unstable_mockModule('../src/intentHandlers/amazonHelpIntentHandler.mjs', () => ({ handleHelpIntent: mockHelpHandler }));
jest.unstable_mockModule('../src/intentHandlers/stopCancelIntentHandler.mjs', () => ({ handleStopCancelIntent: mockStopCancelHandler })); // Correct mock name
jest.unstable_mockModule('../src/intentHandlers/fallbackIntentHandler.mjs', () => ({ handleFallbackIntent: mockFallbackHandler }));
jest.unstable_mockModule('../src/intentHandlers/sessionEndedRequestHandler.mjs', () => ({ handleSessionEndedRequest: mockSessionEndedHandler }));


// --- Mock the logger ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'LaunchRequest' }, 'Routing request type.');
        expect(mockLogger.debug).toHaveBeenCalledWith('Matched LaunchRequest.');
    });

    // --- Parameterized Tests for IntentRequest Routing ---
    const intentRoutingTestCases = [
        { intentName: 'GetCurrentPowerIntent', expectedHandler: mockCurrentPowerHandler },
        { intentName: 'GetDailyProductionIntent', expectedHandler: mockDailyProductionHandler },
        { intentName: 'GetOnlineStatusIntent', expectedHandler: mockGetOnlineStatusHandler },
        // --- Added test case for GetSummaryIntent ---
        { intentName: 'GetSummaryIntent', expectedHandler: mockGetSummaryHandler },
        // -------------------------------------------
        { intentName: 'AMAZON.HelpIntent', expectedHandler: mockHelpHandler },
        { intentName: 'AMAZON.StopIntent', expectedHandler: mockStopCancelHandler },
        { intentName: 'AMAZON.CancelIntent', expectedHandler: mockStopCancelHandler },
        { intentName: 'AMAZON.FallbackIntent', expectedHandler: mockFallbackHandler },
        { intentName: 'UnknownIntent', expectedHandler: mockFallbackHandler }, // Routes to fallback
    ];

    test.each(intentRoutingTestCases)(
        'should route IntentRequest for $intentName to the correct handler',
        ({ intentName, expectedHandler }) => {
            // Arrange
            const event = createMockEvent('IntentRequest', intentName);

            // Act
            const handler = routeRequest(event, mockLogger); // Pass logger

            // Assert Handler
            expect(handler).toBe(expectedHandler);

            // Assert General Intent Routing Logs
            expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'IntentRequest' }, 'Routing request type.');
            expect(mockLogger.info).toHaveBeenCalledWith({ intentName: intentName }, 'Routing intent name.');

            // Assert Specific Debug Log (or warn for UnknownIntent)
            if (intentName === 'UnknownIntent') {
                expect(mockLogger.warn).toHaveBeenCalledWith(`Unknown intent name encountered: ${intentName}`);
                expect(mockLogger.debug).toHaveBeenCalledWith('Routing unknown intent to FallbackIntent.');
            } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
                expect(mockLogger.debug).toHaveBeenCalledWith(`Matched ${intentName}.`);
            } else {
                // This covers GetCurrentPower, GetDailyProduction, GetOnlineStatus, GetSummary, Help, Fallback
                expect(mockLogger.debug).toHaveBeenCalledWith(`Matched ${intentName}.`);
            }
        }
    );

    // --- Test for SessionEndedRequest ---
    it('should return the SessionEndedRequest handler for SessionEndedRequest type', () => {
        const event = createMockEvent('SessionEndedRequest');
        const handler = routeRequest(event, mockLogger); // Pass logger

        expect(handler).toBe(mockSessionEndedHandler);
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'SessionEndedRequest' }, 'Routing request type.');
        expect(mockLogger.debug).toHaveBeenCalledWith('Matched SessionEndedRequest.');
    });

    // --- Tests for Unknown Request Type and Invalid Event ---
    it('should return null for an unknown request type', () => {
        const event = createMockEvent('UnknownRequestType');
        const handler = routeRequest(event, mockLogger); // Pass logger

        expect(handler).toBeNull();
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'UnknownRequestType' }, 'Routing request type.');
        expect(mockLogger.warn).toHaveBeenCalledWith(`Unknown request type encountered: UnknownRequestType`);
    });

    it('should return null if event or request structure is invalid/missing', () => {
        expect(routeRequest(null, mockLogger)).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('Request object or request type is missing.');
        mockLogger.error.mockClear(); // Clear for next check

        expect(routeRequest({}, mockLogger)).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('Request object or request type is missing.');
        mockLogger.error.mockClear();

        expect(routeRequest({ request: {} }, mockLogger)).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith('Request object or request type is missing.');
    });

    it('should route to fallback if IntentRequest is missing intent name', () => {
        const event = { request: { type: 'IntentRequest' } }; // Missing intent obj/name
        const handler = routeRequest(event, mockLogger);
        expect(handler).toBe(mockFallbackHandler);
        expect(mockLogger.info).toHaveBeenCalledWith({ requestType: 'IntentRequest' }, 'Routing request type.');
        expect(mockLogger.info).toHaveBeenCalledWith({ intentName: undefined }, 'Routing intent name.');
        expect(mockLogger.error).toHaveBeenCalledWith('IntentRequest is missing intent name.');
    });

});

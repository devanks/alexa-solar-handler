// tests/router.test.mjs
import { describe, it, test, expect, jest, beforeEach, beforeAll } from '@jest/globals'; // Added 'test'

// --- Mock the handlers (remains the same) ---
const mockLaunchHandler = jest.fn();
const mockCurrentPowerHandler = jest.fn();
const mockDailyProductionHandler = jest.fn();
const mockHelpHandler = jest.fn();
const mockStopCancelHandler = jest.fn();
const mockFallbackHandler = jest.fn();
const mockSessionEndedHandler = jest.fn();
const mockGetOnlineStatusHandler = jest.fn();
// const mockGetSummaryHandler = jest.fn();


// --- Mock the modules (remains the same) ---
jest.unstable_mockModule('../src/intentHandlers/launchRequestHandler.mjs', () => ({ handleLaunchRequest: mockLaunchHandler }));
jest.unstable_mockModule('../src/intentHandlers/getCurrentPowerIntentHandler.mjs', () => ({ handleGetCurrentPowerIntent: mockCurrentPowerHandler }));
jest.unstable_mockModule('../src/intentHandlers/getDailyProductionIntentHandler.mjs', () => ({ handleGetDailyProductionIntent: mockDailyProductionHandler }));
jest.unstable_mockModule('../src/intentHandlers/getOnlineStatusIntentHandler.mjs', () => ({ handleGetOnlineStatusIntent: mockGetOnlineStatusHandler }));
jest.unstable_mockModule('../src/intentHandlers/amazonHelpIntentHandler.mjs', () => ({ handleHelpIntent: mockHelpHandler }));
jest.unstable_mockModule('../src/intentHandlers/stopCancelIntentHandler.mjs', () => ({ handleStopOrCancelIntent: mockStopCancelHandler }));
jest.unstable_mockModule('../src/intentHandlers/fallbackIntentHandler.mjs', () => ({ handleFallbackIntent: mockFallbackHandler }));
jest.unstable_mockModule('../src/intentHandlers/sessionEndedRequestHandler.mjs', () => ({ handleSessionEndedRequest: mockSessionEndedHandler }));
// Mock other handlers here


// --- Mock the logger (remains the same) ---
const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
};
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({ default: mockLoggerInstance }));


// --- Dynamically import the router (remains the same) ---
let routeRequest;
beforeAll(async () => {
    const routerModule = await import('../src/router.mjs');
    routeRequest = routerModule.routeRequest;
});


describe('Request Router', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);
    });

    // Helper function (remains the same)
    const createMockEvent = (requestType, intentName = null) => ({
        version: '1.0', session: {}, context: {},
        request: {
            type: requestType, requestId: 'req-id-' + Math.random(),
            timestamp: new Date().toISOString(), locale: 'en-US',
            ...(intentName && { intent: { name: intentName, slots: {} } }),
            ...(requestType === 'SessionEndedRequest' && { reason: 'USER_INITIATED' })
        },
    });

    // --- Test for LaunchRequest (remains separate) ---
    it('should return the LaunchRequest handler for LaunchRequest type', () => {
        const event = createMockEvent('LaunchRequest');
        const handler = routeRequest(event);
        expect(handler).toBe(mockLaunchHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledTimes(2);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'LaunchRequest' }), 'Routing request');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to LaunchRequest handler.');
    });

    // --- Parameterized Tests for IntentRequest Routing ---
    const intentRoutingTestCases = [
        { intentName: 'GetCurrentPowerIntent', expectedHandler: mockCurrentPowerHandler, specificLog: 'Routing to GetCurrentPowerIntent handler.', isWarning: false },
        { intentName: 'GetDailyProductionIntent', expectedHandler: mockDailyProductionHandler, specificLog: 'Routing to GetDailyProductionIntent handler.', isWarning: false },
        { intentName: 'GetOnlineStatusIntent', expectedHandler: mockGetOnlineStatusHandler, specificLog: 'Routing to GetOnlineStatusIntent handler.', isWarning: false },
        { intentName: 'AMAZON.HelpIntent', expectedHandler: mockHelpHandler, specificLog: 'Routing to AMAZON.HelpIntent handler.', isWarning: false },
        { intentName: 'AMAZON.StopIntent', expectedHandler: mockStopCancelHandler, specificLog: 'Routing AMAZON.StopIntent to Stop/Cancel handler.', isWarning: false },
        { intentName: 'AMAZON.CancelIntent', expectedHandler: mockStopCancelHandler, specificLog: 'Routing AMAZON.CancelIntent to Stop/Cancel handler.', isWarning: false },
        { intentName: 'AMAZON.FallbackIntent', expectedHandler: mockFallbackHandler, specificLog: 'Routing to AMAZON.FallbackIntent handler.', isWarning: false },
        { intentName: 'UnknownIntent', expectedHandler: mockFallbackHandler, specificLog: 'No specific handler found for this intent name. Routing to FallbackIntent handler.', isWarning: true }, // The warning case
    ];

    // Use 'test.each' which works well with arrays of objects
    test.each(intentRoutingTestCases)(
        'should route IntentRequest for $intentName to the correct handler',
        ({ intentName, expectedHandler, specificLog, isWarning }) => {
            // Arrange
            const event = createMockEvent('IntentRequest', intentName);

            // Act
            const handler = routeRequest(event);

            // Assert Handler
            expect(handler).toBe(expectedHandler);

            // Assert General Intent Routing Log
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(
                expect.objectContaining({ intentName: intentName }),
                'Routing IntentRequest.'
            );


            // Assert Specific Log (Info or Warn)
            if (isWarning) {
                expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
                    { intentName: intentName }, // Check the context object
                    specificLog                 // Check the message string
                );
                // --- FIX: Expect 2 info calls for the warning case ---
                expect(mockLoggerInstance.info).toHaveBeenCalledTimes(2); // Initial log + "Routing IntentRequest" log
                expect(mockLoggerInstance.warn).toHaveBeenCalledTimes(1);
            } else {
                expect(mockLoggerInstance.info).toHaveBeenCalledWith(specificLog); // The third info log
                expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
                // --- FIX: Expect 3 info calls for non-warning cases ---
                expect(mockLoggerInstance.info).toHaveBeenCalledTimes(3); // Initial + "Routing IntentRequest" + Specific Intent
            }
        }
    );

    // --- Test for SessionEndedRequest (remains separate) ---
    it('should return the SessionEndedRequest handler for SessionEndedRequest type', () => {
        const event = createMockEvent('SessionEndedRequest');
        const handler = routeRequest(event);

        expect(handler).toBe(mockSessionEndedHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledTimes(2);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'SessionEndedRequest' }), 'Routing request');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to SessionEndedRequest handler.');
    });

    // --- Tests for Unknown Request Type and Invalid Event (remain separate) ---
    it('should return null for an unknown request type', () => {
        const event = createMockEvent('UnknownRequestType');
        const handler = routeRequest(event);

        expect(handler).toBeNull();
        expect(mockLoggerInstance.warn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.info).toHaveBeenCalledTimes(1); // Only the initial routing log
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith({ requestType: 'UnknownRequestType' }, 'Received unknown request type. No handler available.');
    });

    it('should return null if event or request structure is invalid/missing', () => {
        expect(mockLoggerInstance.info).not.toHaveBeenCalled();
        expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
        expect(routeRequest(null)).toBeNull();
        expect(routeRequest({})).toBeNull();
        expect(routeRequest({ request: {} })).toBeNull();
        // Check logger wasn't called excessively or with errors for invalid input
    });

});

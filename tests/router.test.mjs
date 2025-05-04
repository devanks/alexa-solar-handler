// tests/router.test.mjs
import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// --- Mock the handlers BEFORE importing the router ---
const mockLaunchHandler = jest.fn();
const mockCurrentPowerHandler = jest.fn();
const mockDailyProductionHandler = jest.fn();
// --- Define mock for Help handler ---
const mockHelpHandler = jest.fn();
// Define mocks for future handlers here if needed
// const mockFallbackHandler = jest.fn();

// Use jest.unstable_mockModule for ESM mocking consistency
jest.unstable_mockModule('../src/intentHandlers/launchRequestHandler.mjs', () => ({
    handleLaunchRequest: mockLaunchHandler,
}));
jest.unstable_mockModule('../src/intentHandlers/getCurrentPowerIntentHandler.mjs', () => ({
    handleGetCurrentPowerIntent: mockCurrentPowerHandler,
}));
jest.unstable_mockModule('../src/intentHandlers/getDailyProductionIntentHandler.mjs', () => ({
    handleGetDailyProductionIntent: mockDailyProductionHandler,
}));
// --- Mock the Help handler module ---
jest.unstable_mockModule('../src/intentHandlers/amazonHelpIntentHandler.mjs', () => ({
    handleHelpIntent: mockHelpHandler,
}));
// Mock other handlers here when they exist


// --- Mock the logger ---
const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
};
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);

jest.unstable_mockModule('../src/utils/logger.mjs', () => ({
    default: mockLoggerInstance,
}));


// --- Now dynamically import the router AFTER mocks are set up ---
let routeRequest;
beforeAll(async () => {
    const routerModule = await import('../src/router.mjs');
    routeRequest = routerModule.routeRequest;
});

// --- Tests for the router ---
describe('Request Router', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);
    });

    // Helper to create mock event objects (remains the same)
    const createMockEvent = (requestType, intentName = null) => ({
        version: '1.0',
        session: { /* ... */ },
        context: { /* ... */ },
        request: {
            type: requestType,
            requestId: 'req-id-' + Math.random(),
            timestamp: new Date().toISOString(),
            locale: 'en-US',
            ...(intentName && { intent: { name: intentName, slots: {} } }),
        },
    });

    // --- Existing Tests ---

    it('should return the LaunchRequest handler for LaunchRequest type', () => {
        const event = createMockEvent('LaunchRequest');
        const handler = routeRequest(event);
        expect(handler).toBe(mockLaunchHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'LaunchRequest' }), 'Routing request');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to LaunchRequest handler.');
    });

    it('should return the GetCurrentPowerIntent handler for IntentRequest with that name', () => {
        const event = createMockEvent('IntentRequest', 'GetCurrentPowerIntent');
        const handler = routeRequest(event);
        expect(handler).toBe(mockCurrentPowerHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'GetCurrentPowerIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to GetCurrentPowerIntent handler.');
    });

    it('should return the GetDailyProductionIntent handler for IntentRequest with that name', () => {
        const event = createMockEvent('IntentRequest', 'GetDailyProductionIntent');
        const handler = routeRequest(event);
        expect(handler).toBe(mockDailyProductionHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'GetDailyProductionIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to GetDailyProductionIntent handler.');
    });

    // --- Add Test for Help Intent ---
    it('should return the HelpIntent handler for IntentRequest with AMAZON.HelpIntent name', () => {
        const event = createMockEvent('IntentRequest', 'AMAZON.HelpIntent'); // Use the Help intent name
        const handler = routeRequest(event);
        expect(handler).toBe(mockHelpHandler); // Check against the Help mock
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'AMAZON.HelpIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to AMAZON.HelpIntent handler.');
    });


    // --- Other Existing Tests ---

    it('should return null for IntentRequest with an unknown intent name', () => {
        const event = createMockEvent('IntentRequest', 'UnknownIntent');
        const handler = routeRequest(event);
        // If Fallback handler exists and is mocked: expect(handler).toBe(mockFallbackHandler);
        expect(handler).toBeNull(); // Currently returns null
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'UnknownIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith({ intentName: 'UnknownIntent' }, 'No specific handler found for this intent name. Routing to fallback/null.');
    });

    it('should return null for SessionEndedRequest type', () => {
        const event = createMockEvent('SessionEndedRequest');
        const handler = routeRequest(event);
        expect(handler).toBeNull();
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'SessionEndedRequest' }), 'Routing request');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to SessionEndedRequest handler.');
    });

    it('should return null for an unknown request type', () => {
        const event = createMockEvent('AudioPlayer.PlaybackStarted');
        const handler = routeRequest(event);
        expect(handler).toBeNull();
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'AudioPlayer.PlaybackStarted' }), 'Routing request');
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith({ requestType: 'AudioPlayer.PlaybackStarted' }, 'Received unknown request type. No handler available.');
    });

    it('should return null if event or request structure is invalid/missing', () => {
        expect(routeRequest(null)).toBeNull();
        expect(routeRequest({})).toBeNull();
        expect(routeRequest({ request: null })).toBeNull();
        expect(routeRequest({ request: {} })).toBeNull();
        expect(mockLoggerInstance.warn).toHaveBeenLastCalledWith({ requestType: undefined }, 'Received unknown request type. No handler available.');
    });

});

// tests/router.test.mjs
import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// --- Mock the handlers BEFORE importing the router ---
const mockLaunchHandler = jest.fn();
const mockCurrentPowerHandler = jest.fn();
const mockDailyProductionHandler = jest.fn();
const mockHelpHandler = jest.fn();
const mockStopCancelHandler = jest.fn();
// --- Define mock for Fallback handler ---
const mockFallbackHandler = jest.fn();
// Define mocks for future handlers here if needed


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
jest.unstable_mockModule('../src/intentHandlers/amazonHelpIntentHandler.mjs', () => ({
    handleHelpIntent: mockHelpHandler,
}));
jest.unstable_mockModule('../src/intentHandlers/stopCancelIntentHandler.mjs', () => ({
    handleStopOrCancelIntent: mockStopCancelHandler,
}));
// --- Mock the Fallback handler module ---
jest.unstable_mockModule('../src/intentHandlers/fallbackIntentHandler.mjs', () => ({
    handleFallbackIntent: mockFallbackHandler,
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

    it('should return the LaunchRequest handler for LaunchRequest type', () => { /* ... */ });
    it('should return the GetCurrentPowerIntent handler for IntentRequest with that name', () => { /* ... */ });
    it('should return the GetDailyProductionIntent handler for IntentRequest with that name', () => { /* ... */ });
    it('should return the HelpIntent handler for IntentRequest with AMAZON.HelpIntent name', () => { /* ... */ });
    it('should return the Stop/Cancel handler for IntentRequest with AMAZON.StopIntent name', () => { /* ... */ });
    it('should return the Stop/Cancel handler for IntentRequest with AMAZON.CancelIntent name', () => { /* ... */ });


    // --- Add Test for explicit Fallback Intent routing ---
    it('should return the Fallback handler for IntentRequest with AMAZON.FallbackIntent name', () => {
        const event = createMockEvent('IntentRequest', 'AMAZON.FallbackIntent');
        const handler = routeRequest(event);
        expect(handler).toBe(mockFallbackHandler); // Check against the Fallback mock
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'AMAZON.FallbackIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to AMAZON.FallbackIntent handler.');
    });

    // --- Update Test for unknown intent names ---
    it('should return the Fallback handler for IntentRequest with an unknown intent name', () => {
        const event = createMockEvent('IntentRequest', 'UnknownIntent');
        const handler = routeRequest(event);
        expect(handler).toBe(mockFallbackHandler); // Should now return Fallback handler
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ intentName: 'UnknownIntent' }), 'Routing IntentRequest.');
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith({ intentName: 'UnknownIntent' }, 'No specific handler found for this intent name. Routing to FallbackIntent handler.'); // Check warning log
    });


    // --- Other Existing Tests ---

    it('should return null for SessionEndedRequest type', () => { /* ... */ });
    it('should return null for an unknown request type', () => { /* ... */ });
    it('should return null if event or request structure is invalid/missing', () => { /* ... */ });

});

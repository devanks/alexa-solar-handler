// tests/router.test.mjs
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// --- Mock the handlers BEFORE importing the router ---
const mockLaunchHandler = jest.fn();
// Define mocks for future handlers here if needed
// const mockSolarDataHandler = jest.fn();

// Use jest.unstable_mockModule for ESM mocking consistency
jest.unstable_mockModule('../src/intentHandlers/launchRequestHandler.mjs', () => ({
    handleLaunchRequest: mockLaunchHandler,
}));
// Mock other handlers here when they exist using jest.unstable_mockModule


// --- Mock the logger ---
// Create the mock instance methods FIRST
const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(), // We'll make child return itself below
};
// Ensure calling child() returns the same mock instance
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);

// Use jest.unstable_mockModule to mock the default export
jest.unstable_mockModule('../src/utils/logger.mjs', () => ({
    default: mockLoggerInstance, // Mock the default export which is the logger
}));


// --- Now dynamically import the router AFTER mocks are set up ---
// Use dynamic import() because mocks need to be established first with ESM
let routeRequest;
beforeAll(async () => {
    const routerModule = await import('../src/router.mjs');
    routeRequest = routerModule.routeRequest;
});


describe('Request Router', () => {

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        // Re-assign mock return value for child in case it was cleared? (Good practice)
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

    // --- Tests remain largely the same, but use mockLoggerInstance ---

    it('should return the LaunchRequest handler for LaunchRequest type', () => {
        const event = createMockEvent('LaunchRequest');
        const handler = routeRequest(event);
        expect(handler).toBe(mockLaunchHandler); // Should now correctly be the mock
        // Use the correctly mocked logger instance for assertions
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'LaunchRequest' }), 'Routing request');
        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Routing to LaunchRequest handler.');
    });

    /* Tests for IntentRequests (when handlers exist) - update to use mockLoggerInstance
    it('should return the GetSolarDataIntent handler...', () => {
        // ...
        expect(handler).toBe(mockSolarDataHandler);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(...);
        expect(mockLoggerInstance.info).toHaveBeenCalledWith(...);
    });
    // ... other intent tests ...
    */

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
        // Check the LAST call to warn, as previous calls might log undefined requestType too
        expect(mockLoggerInstance.warn).toHaveBeenLastCalledWith({ requestType: undefined }, 'Received unknown request type. No handler available.');
    });

});

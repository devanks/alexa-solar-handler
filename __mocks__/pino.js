// __mocks__/pino.js
import { jest } from '@jest/globals';

// This is the actual mock logger instance that tests will assert against.
// We export it so the test file can import it.
export const mockPinoInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    // Crucially, ensure child() returns the instance for chaining
    child: jest.fn().mockReturnThis(),
};

// This is the factory function that logger.mjs imports as `pino`
// and calls like `pino({...})`. It should return our mock instance.
const pinoMockFactory = jest.fn(() => mockPinoInstance);

// Attach the necessary properties *directly* onto the factory function object,
// mimicking the structure of the real pino library.
pinoMockFactory.stdTimeFunctions = {
    isoTime: jest.fn(() => '2024-01-01T10:00:00.000Z'), // Return a fixed ISO string for predictability
};

// Export the factory function as the default export for `import pino from 'pino'`
export default pinoMockFactory;

// Note: We don't need __esModule: true here as it's an actual .mjs file

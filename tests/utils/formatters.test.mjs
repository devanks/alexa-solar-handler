// tests/utils/formatters.test.mjs
import { describe, test, expect } from '@jest/globals';
import { formatPower, formatEnergy } from '../../src/utils/formatters.mjs';

describe('Utility Formatters', () => {
  describe('formatPower', () => {
    const testCases = [
      { input: 0, expected: '0 watts' }, // Explicitly test 0
      { input: 0.4, expected: 'almost zero watts' }, // Near zero
      { input: 1, expected: '1 watt' }, // Rounding check
      { input: 999, expected: '999 watts' },
      { input: 999.5, expected: '1000 watts' }, // Check rounding up boundary
      { input: 1000, expected: '1.0 kilowatts' },
      { input: 1049, expected: '1.0 kilowatts' }, // Check toFixed(1) rounding
      { input: 1050, expected: '1.1 kilowatts' }, // Check toFixed(1) rounding
      { input: 2567, expected: '2.6 kilowatts' },
      { input: -500, expected: '-500 watts' }, // Negative values
      { input: -1500, expected: '-1.5 kilowatts' }, // Negative kW
      { input: null, expected: 'an unknown amount of power' },
      { input: undefined, expected: 'an unknown amount of power' },
      { input: NaN, expected: 'an unknown amount of power' },
      { input: Infinity, expected: 'an unknown amount of power' },
      { input: 'abc', expected: 'an unknown amount of power' }, // Non-numeric string
    ];

    test.each(testCases)(
      'should format $input W as "$expected"',
      ({ input, expected }) => {
        expect(formatPower(input)).toBe(expected);
      }
    );
  });

  describe('formatEnergy', () => {
    const testCases = [
      { input: 0, expected: '0.0 kilowatt hours' },
      { input: 0.1, expected: '0.1 kilowatt hours' },
      { input: 1, expected: '1.0 kilowatt hours' },
      { input: 1.05, expected: '1.1 kilowatt hours' }, // Check rounding
      { input: 1.04, expected: '1.0 kilowatt hours' }, // Check rounding
      { input: 25.67, expected: '25.7 kilowatt hours' },
      { input: -5.5, expected: '-5.5 kilowatt hours' }, // Negative values
      { input: null, expected: 'an unknown amount of energy' },
      { input: undefined, expected: 'an unknown amount of energy' },
      { input: NaN, expected: 'an unknown amount of energy' },
      { input: Infinity, expected: 'an unknown amount of energy' },
      { input: 'xyz', expected: 'an unknown amount of energy' }, // Non-numeric string
    ];

    test.each(testCases)(
      'should format $input kWh as "$expected"',
      ({ input, expected }) => {
        expect(formatEnergy(input)).toBe(expected);
      }
    );
  });
});

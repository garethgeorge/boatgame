import { describe, it, expect } from 'vitest';
import { AnimalLogicStep } from './AnimalLogic';
import { AnimalLogicConfig } from './AnimalLogicConfigs';

describe('AnimalLogicStep', () => {
    const configA: any = { name: 'A' };
    const configB: any = { name: 'B' };
    const configC: any = { name: 'C' };

    describe('sequence', () => {
        it('should return configs in order', () => {
            const seq = AnimalLogicStep.sequence([configA, configB, configC]);
            expect(seq(0, '')).toBe(configA);
            expect(seq(1, '')).toBe(configB);
            expect(seq(2, '')).toBe(configC);
            expect(seq(3, '')).toBe(null);
        });

        it('should return null for empty sequence', () => {
            const seq = AnimalLogicStep.sequence([]);
            expect(seq(0, '')).toBe(null);
        });
    });

    describe('until', () => {
        it('should return the script until the result matches', () => {
            const until = AnimalLogicStep.until('MATCH', Infinity, configA);
            expect(until(0, '')).toBe(configA);
            expect(until(1, 'BLAH')).toBe(configA);
            expect(until(2, 'MATCH')).toBe(null);
        });
    });

    describe('random', () => {
        it('should return a random choice at step 0', () => {
            const choices = [configA, configB];
            const rand = AnimalLogicStep.random(choices);

            const results = new Set();
            for (let i = 0; i < 20; i++) {
                results.add(rand(0, ''));
            }

            expect(results.has(configA) || results.has(configB)).toBe(true);
            expect(rand(1, '')).toBe(null);
        });

        it('should return null for empty choices', () => {
            const rand = AnimalLogicStep.random([]);
            expect(rand(0, '')).toBe(null);
        });
    });

    describe('nested logic', () => {
        it('should handle until wrapping a sequence', () => {
            const seq = AnimalLogicStep.sequence([configA, configB]);
            const until = AnimalLogicStep.until('DONE', Infinity, seq);

            // until doesn't care about step, it just returns the script it wraps
            expect(until(0, '')).toBe(seq);
            expect(until(5, 'NOT_DONE')).toBe(seq);
            expect(until(0, 'DONE')).toBe(null);
        });
    });
});

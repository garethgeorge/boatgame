import { ObjectPool } from './ObjectPool';
import { describe, it, expect, vi } from 'vitest';

describe('ObjectPool', () => {
    it('should create new objects when the pool is empty', () => {
        const factory = vi.fn(() => ({ id: Math.random() }));
        const pool = new ObjectPool(factory);

        const obj1 = pool.get();
        expect(factory).toHaveBeenCalledTimes(1);
        expect(obj1).toBeDefined();
    });

    it('should reuse objects from the pool', () => {
        const factory = vi.fn(() => ({ id: Math.random() }));
        const pool = new ObjectPool(factory);

        const obj1 = pool.get();
        pool.release(obj1);

        const obj2 = pool.get();
        expect(factory).toHaveBeenCalledTimes(1);
        expect(obj2).toBe(obj1);
    });

    it('should respect maxSize', () => {
        const factory = vi.fn(() => ({ id: Math.random() }));
        const pool = new ObjectPool(factory, 2);

        const obj1 = pool.get();
        const obj2 = pool.get();
        const obj3 = pool.get();

        pool.release(obj1);
        pool.release(obj2);
        pool.release(obj3); // Should not be added to the pool

        expect(pool.size).toBe(2);
    });

    it('should clear the pool', () => {
        const factory = vi.fn(() => ({ id: Math.random() }));
        const pool = new ObjectPool(factory);

        const obj1 = pool.get();
        pool.release(obj1);
        expect(pool.size).toBe(1);

        pool.clear();
        expect(pool.size).toBe(0);
    });
});

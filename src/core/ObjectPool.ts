/**
 * A simple, generic object pool for reusable objects.
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private maxSize: number;

    constructor(factory: () => T, maxSize: number = 100) {
        this.factory = factory;
        this.maxSize = maxSize;
    }

    /**
     * Retrieves an object from the pool or creates a new one if the pool is empty.
     */
    get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    /**
     * Returns an object to the pool, provided the pool has not reached its maximum size.
     */
    release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }

    /**
     * Clears the pool.
     */
    clear(): void {
        this.pool = [];
    }

    /**
     * Returns the current number of objects in the pool.
     */
    get size(): number {
        return this.pool.length;
    }
}


export class MathUtils {
    public static clamp(min: number, max: number, x: number): number {
        return Math.max(min, Math.min(x, max));
    }

    public static linearstep(edge0: number, edge1: number, x: number): number {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t;
    }

    public static smoothstep(edge0: number, edge1: number, x: number): number {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    // A simple, fast 32-bit generator (Mulberry32)
    public static createUniformRNG(seed: number): () => number {
        return () => {
            // Keep seed within 32 bits to prevent precision loss over time
            seed = (seed + 0x6D2B79F5) | 0;
            let t = seed;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    // Gaussian distributed random numbers with mean 0 and variance 1
    // using the supplied uniform RNG
    public static createGaussianRNG(random: () => number): () => number {
        return () => {
            // Box-Muller requires u1 to be in (0, 1] to avoid log(0) and NaN
            // random() returns [0, 1), so we use 1.0 - random()
            // We clamp to a tiny epsilon to ensure it's never exactly 0.
            const u1 = Math.max(1e-10, 1.0 - random());
            const u2 = random();

            const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            return z0;
        }
    }
}
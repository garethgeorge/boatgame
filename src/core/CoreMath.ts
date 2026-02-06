
export class CoreMath {
    public static clamp(min: number, max: number, x: number): number {
        return Math.max(min, Math.min(x, max));
    }

    public static lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
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

    /**
     * Finds the closest point on a curve f(y) to a target point (px, py).
     * @param f Function that returns x for a given y
     * @param px Target point x
     * @param py Target point y
     * @param epsilon Precision threshold for optimization
     */
    public static findClosestPoint(f: (y: number) => number, px: number, py: number, epsilon: number = 0.1): { x: number, y: number, distSq: number } {
        // 1. Automatic Interval Selection
        const r = Math.max(10, Math.abs(f(py) - px));
        const a = py - r; // yMin
        const b = py + r; // yMax

        // 2. Optimization (Brent's Method)
        // We want to minimize: D(y) = (f(y) - px)^2 + (y - py)^2
        const bestY = this.runBrentsMethod(a, b, (y) => {
            const dx = f(y) - px;
            const dy = y - py;
            return dx * dx + dy * dy;
        }, epsilon);

        const finalX = f(bestY);
        const dx = finalX - px;
        const dy = bestY - py;
        return { x: finalX, y: bestY, distSq: dx * dx + dy * dy };
    }

    /**
     * Brent's Algorithm for Function Minimization
     * @param minBound: Lower bound
     * @param maxBound: Upper bound
     * @param costFunc: A function that returns the cost to be minimized
     * @param epsilon: Precision threshold
     */
    public static runBrentsMethod(minBound: number, maxBound: number, costFunc: (u: number) => number, epsilon: number = 0.1): number {
        const GOLDEN_RATIO = 0.3819660; // (3 - sqrt(5)) / 2
        const EPSILON = epsilon;        // Precision threshold
        const MAX_ITERATIONS = 60;      // Increased iterations for higher precision if needed

        // a and b are the current search interval
        let a = minBound;
        let b = maxBound;

        // x is the point with the lowest cost found so far
        let x = a + GOLDEN_RATIO * (b - a);
        let w = x; // second best point
        let v = x; // previous best point

        let fx = costFunc(x);
        let fw = fx;
        let fv = fx;

        let delta = 0;      // Distance moved in the current step
        let lastDelta = 0;  // Distance moved in the previous step

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            let midpoint = (a + b) / 2;

            // Check if the range is small enough to stop
            if (Math.abs(x - midpoint) <= (EPSILON * 2 - (b - a) / 2)) {
                return x;
            }

            let step = 0;

            // Try Parabolic Interpolation if we've moved enough
            if (Math.abs(lastDelta) > EPSILON) {
                // Compute the parabolic fit
                let r = (x - w) * (fx - fv);
                let q = (x - v) * (fx - fw);
                let p = (x - v) * q - (x - w) * r;
                q = 2 * (q - r);

                if (q > 0) p = -p;
                q = Math.abs(q);

                // Is the parabolic step "safe"?
                if (Math.abs(p) < Math.abs(0.5 * q * lastDelta) &&
                    p > q * (a - x) &&
                    p < q * (b - x)) {
                    step = p / q;
                    delta = step;
                } else {
                    // Parabolic failed; use Golden Section
                    lastDelta = (x >= midpoint) ? a - x : b - x;
                    step = GOLDEN_RATIO * lastDelta;
                }
            } else {
                // Not enough movement; use Golden Section
                lastDelta = (x >= midpoint) ? a - x : b - x;
                step = GOLDEN_RATIO * lastDelta;
            }

            // Update lastDelta and find new point u
            let u = x + step;
            let fu = costFunc(u);

            // Update the bounds and the best points
            if (fu <= fx) {
                if (u >= x) a = x; else b = x;
                v = w; fv = fw;
                w = x; fw = fx;
                x = u; fx = fu;
            } else {
                if (u < x) a = u; else b = u;
                if (fu <= fw || w === x) {
                    v = w; fv = fw;
                    w = u; fw = fu;
                } else if (fu <= fv || v === x || v === w) {
                    v = u; fv = fu;
                }
            }
            lastDelta = delta;
        }

        return x;
    }
}
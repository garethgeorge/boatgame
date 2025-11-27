// terrain.worker.ts

// --- SimplexNoise Implementation (Duplicated for Worker) ---
class SimplexNoise {
  perm: Uint8Array;
  grad3: number[][];

  constructor(seed: number = Math.random()) {
    this.perm = new Uint8Array(512);
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Shuffle
    for (let i = 255; i > 0; i--) {
      const r = Math.floor((seed * (i + 1)) % 256);
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      [p[i], p[r]] = [p[r], p[i]];
    }

    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    let n0, n1, n2;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }
}

// --- RiverSystem Logic (Duplicated for Worker) ---
class RiverSystem {
  private noise: SimplexNoise;
  private readonly PATH_SCALE = 0.002;
  private readonly PATH_AMPLITUDE = 100;
  private readonly WIDTH_SCALE = 0.002;
  private readonly MIN_WIDTH = 15;
  private readonly MAX_WIDTH = 75;

  constructor() {
    this.noise = new SimplexNoise(100);
  }

  getRiverCenter(z: number): number {
    return this.noise.noise2D(0, z * this.PATH_SCALE) * this.PATH_AMPLITUDE;
  }

  getRiverWidth(z: number): number {
    const biomeNoise = (this.noise.noise2D(100, z * this.WIDTH_SCALE) + 1) / 2;
    let baseWidth = this.lerp(this.MIN_WIDTH, this.MAX_WIDTH, biomeNoise);
    return Math.max(15, baseWidth);
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}

// --- Worker Logic ---

const riverSystem = new RiverSystem();
const noise = new SimplexNoise(200);

// Helper functions
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function calculateHeight(x: number, z: number): number {
  const riverWidth = riverSystem.getRiverWidth(z);
  const riverEdge = riverWidth / 2;
  const distFromCenter = Math.abs(x);
  const distFromBank = distFromCenter - riverEdge;

  // 1. Land Generation
  let mountainMask = noise.noise2D(x * 0.001, z * 0.001);
  mountainMask = (mountainMask + 1) / 2;
  mountainMask = Math.pow(mountainMask, 2);

  const hillNoise =
    noise.noise2D(x * 0.01, z * 0.01) * 5 +
    noise.noise2D(x * 0.03, z * 0.03) * 2;

  const ridge1 = 1 - Math.abs(noise.noise2D(x * 0.005, z * 0.005));
  const ridge2 = 1 - Math.abs(noise.noise2D(x * 0.01, z * 0.01));
  const mountainNoise = (Math.pow(ridge1, 2) * 40 + Math.pow(ridge2, 2) * 10);

  let rawLandHeight = (hillNoise * (1 - mountainMask)) + (mountainNoise * mountainMask);
  rawLandHeight += noise.noise2D(x * 0.1, z * 0.1) * 1.0;
  rawLandHeight = Math.max(2.0, rawLandHeight + 2.0);

  const bankTaper = smoothstep(0, 15, distFromBank);
  const landHeight = rawLandHeight * bankTaper;

  // 2. River Bed
  const depth = 8;
  const normalizedX = Math.min(1.0, distFromCenter / riverEdge);
  const riverBedHeight = -depth * (1 - normalizedX * normalizedX);

  // 3. Blend
  const transitionWidth = 8.0;
  const mixFactor = smoothstep(riverEdge - transitionWidth / 2, riverEdge + transitionWidth / 2, distFromCenter);

  return (1 - mixFactor) * riverBedHeight + mixFactor * landHeight;
}

function getDistributedX(u: number, width: number): number {
  const C = width / 4;
  return C * u * (1 + (u * u));
}

self.onmessage = (e: MessageEvent) => {
  const { zOffset, chunkSize, chunkWidth, resX, resZ } = e.data;

  const numVertices = (resX + 1) * (resZ + 1);
  const numIndices = resX * resZ * 6;

  const positions = new Float32Array(numVertices * 3);
  const colors = new Float32Array(numVertices * 3);
  const uvs = new Float32Array(numVertices * 2);
  const indices = new Uint32Array(numIndices); // Uint32 for indices

  const colorDry = { r: 0xE6 / 255, g: 0xC2 / 255, b: 0x88 / 255 };
  const colorWet = { r: 0x5C / 255, g: 0xB8 / 255, b: 0x5C / 255 };

  // Generate Vertices
  for (let z = 0; z <= resZ; z++) {
    const v = z / resZ;
    const localZ = v * chunkSize;

    for (let x = 0; x <= resX; x++) {
      const u = (x / resX) * 2 - 1;
      const localX = getDistributedX(u, chunkWidth);

      const index = z * (resX + 1) + x;

      const worldZ = zOffset + localZ;
      const riverCenter = riverSystem.getRiverCenter(worldZ);
      const worldX = localX + riverCenter;
      const height = calculateHeight(localX, worldZ);

      positions[index * 3] = worldX;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = localZ;

      // Colors
      let wetness = noise.noise2D(worldX * 0.002, worldZ * 0.002);
      wetness = (wetness + 1) / 2;

      // Lerp color
      colors[index * 3] = colorDry.r * (1 - wetness) + colorWet.r * wetness;
      colors[index * 3 + 1] = colorDry.g * (1 - wetness) + colorWet.g * wetness;
      colors[index * 3 + 2] = colorDry.b * (1 - wetness) + colorWet.b * wetness;

      // UVs
      uvs[index * 2] = (localX / chunkWidth) + 0.5;
      uvs[index * 2 + 1] = v;
    }
  }

  // Generate Indices
  let i = 0;
  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      const a = z * (resX + 1) + x;
      const b = z * (resX + 1) + (x + 1);
      const c = (z + 1) * (resX + 1) + x;
      const d = (z + 1) * (resX + 1) + (x + 1);

      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }

  // Post message back
  (self as any).postMessage({
    positions,
    colors,
    uvs,
    indices
  }, [positions.buffer, colors.buffer, uvs.buffer, indices.buffer]);
};

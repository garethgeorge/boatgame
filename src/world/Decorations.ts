import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

export class Decorations {
  public static readonly treeMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513 }); // Brown trunk
  public static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0x228B22 }); // Forest Green
  public static readonly dryBushMaterial = new THREE.MeshToonMaterial({ color: 0x8B5A2B }); // Brownish
  public static readonly greenBushMaterial = new THREE.MeshToonMaterial({ color: 0x32CD32 }); // Lime Green
  public static readonly cactusMaterial = new THREE.MeshToonMaterial({ color: 0x6B8E23 }); // Olive Drab
  public static readonly rockMaterialDesert = new THREE.MeshToonMaterial({ color: 0xE6C288 }); // Yellow Sandstone
  public static readonly rockMaterialForest = new THREE.MeshToonMaterial({ color: 0x888888 }); // Grey
  public static readonly snowyLeafMaterial = new THREE.MeshToonMaterial({ color: 0xFFFFFF }); // White
  public static readonly iceRockMaterial = new THREE.MeshToonMaterial({ color: 0xE0F6FF }); // Ice Blue

  static {
    // Cast to any to avoid TS error if property is missing in definition but present in runtime
    (this.rockMaterialDesert as any).flatShading = true;
    (this.rockMaterialDesert as any).needsUpdate = true;
    (this.rockMaterialForest as any).flatShading = true;
    (this.rockMaterialForest as any).needsUpdate = true;
    (this.iceRockMaterial as any).flatShading = true;
    (this.iceRockMaterial as any).needsUpdate = true;
  }

  private static rockNoise3D = createNoise3D();

  private static cache: {
    trees: { mesh: THREE.Group, wetness: number, isSnowy: boolean, isLeafless: boolean }[],
    bushes: { mesh: THREE.Group, wetness: number }[],
    cactuses: THREE.Group[],
    rocks: { mesh: THREE.Group, size: number, isIcy: boolean }[]
  } = { trees: [], bushes: [], cactuses: [], rocks: [] };

  private static loadPromise: Promise<void> | null = null;

  private static generateCache() {
    console.log("Generating Decoration Cache...");
    // Generate Trees
    for (let i = 0; i < 50; i++) {
      const wetness = Math.random();
      this.cache.trees.push({ mesh: this.createTree(wetness, false, false), wetness, isSnowy: false, isLeafless: false });
    }
    // Generate Snowy Trees
    for (let i = 0; i < 30; i++) {
      const wetness = Math.random();
      this.cache.trees.push({ mesh: this.createTree(wetness, true, false), wetness, isSnowy: true, isLeafless: false });
    }
    // Generate Leafless Trees (for Ice Biome)
    for (let i = 0; i < 20; i++) {
      const wetness = Math.random();
      this.cache.trees.push({ mesh: this.createTree(wetness, false, true), wetness, isSnowy: false, isLeafless: true });
    }
    // Generate Bushes
    for (let i = 0; i < 50; i++) {
      const wetness = Math.random();
      this.cache.bushes.push({ mesh: this.createBush(wetness), wetness });
    }
    // Generate Cactuses
    for (let i = 0; i < 20; i++) {
      this.cache.cactuses.push(this.createCactus());
    }
    // Generate Rocks
    for (let i = 0; i < 30; i++) {
      const size = Math.random();
      this.cache.rocks.push({ mesh: this.createRock(size, false), size, isIcy: false });
    }
    // Generate Icy Rocks
    for (let i = 0; i < 20; i++) {
      const size = Math.random();
      this.cache.rocks.push({ mesh: this.createRock(size, true), size, isIcy: true });
    }
    console.log("Decoration Cache Generated.");
  }

  static async preload(): Promise<void> {
    if (this.cache.trees.length > 0) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      // Use setTimeout to allow this to be async and not block immediately if called
      setTimeout(() => {
        this.generateCache();
        resolve();
      }, 0);
    });

    return this.loadPromise;
  }

  static getTree(wetness: number, isSnowy: boolean = false, isLeafless: boolean = false): THREE.Group {
    if (this.cache.trees.length === 0) this.generateCache();

    const candidates = this.cache.trees.filter(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless && Math.abs(t.wetness - wetness) < 0.3);
    const source = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.cache.trees.find(t => t.isSnowy === isSnowy && t.isLeafless === isLeafless) || this.cache.trees[0];

    if (!source) return this.createTree(wetness, isSnowy, isLeafless); // Fallback
    return source.mesh.clone();
  }

  static getBush(wetness: number): THREE.Group {
    if (this.cache.bushes.length === 0) this.generateCache();

    const candidates = this.cache.bushes.filter(b => Math.abs(b.wetness - wetness) < 0.3);
    const source = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.cache.bushes[Math.floor(Math.random() * this.cache.bushes.length)];

    if (!source) return this.createBush(wetness); // Fallback
    return source.mesh.clone();
  }

  static getCactus(): THREE.Group {
    if (this.cache.cactuses.length === 0) this.generateCache();

    if (this.cache.cactuses.length === 0) return this.createCactus(); // Fallback if init failed?
    return this.cache.cactuses[Math.floor(Math.random() * this.cache.cactuses.length)].clone();
  }

  static getRock(biome: 'desert' | 'forest' | 'ice', size: number): THREE.Group {
    if (this.cache.rocks.length === 0) this.generateCache();

    const isIcy = biome === 'ice';
    const candidates = this.cache.rocks.filter(r => r.isIcy === isIcy && Math.abs(r.size - size) < 0.3);
    const source = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.cache.rocks.find(r => r.isIcy === isIcy) || this.cache.rocks[0];

    const rock = source ? source.mesh.clone() : this.createRock(size, isIcy);

    // Apply biome material if not icy (icy rocks are pre-generated with ice material)
    // Actually, createRock uses the material passed or default?
    // Let's look at createRock. It uses rockMaterialForest by default.
    // We should ensure createRock uses correct material.

    // If it's not icy, we might need to swap between Desert and Forest
    if (!isIcy) {
      const material = biome === 'desert' ? this.rockMaterialDesert : this.rockMaterialForest;
      rock.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
        }
      });
    }

    return rock;
  }

  static createTree(wetness: number, isSnowy: boolean, isLeafless: boolean): THREE.Group {
    const group = new THREE.Group();

    // Tree parameters based on wetness
    // Taller trees: 4-8m
    const height = 4 + wetness * 4 + Math.random() * 2;
    const trunkThickness = 0.4 + wetness * 0.3;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkThickness * 0.6, trunkThickness, height, 6);
    const trunk = new THREE.Mesh(trunkGeo, this.treeMaterial);
    trunk.position.y = height / 2;
    group.add(trunk);

    // Branches & Leaves
    // DRAMATICALLY INCREASED BRANCH LENGTH
    const branchCount = 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < branchCount; i++) {
      const y = height * (0.4 + Math.random() * 0.5); // Start higher up

      // Branch length: 1.5m to 3.0m (Reduced by 50%)
      const branchLen = 1.5 + Math.random() * 1.5;
      const branchThick = trunkThickness * 0.5;

      const branchGeo = new THREE.CylinderGeometry(branchThick * 0.5, branchThick, branchLen, 4);
      const branch = new THREE.Mesh(branchGeo, this.treeMaterial);

      // Position on trunk
      branch.position.set(0, y, 0);

      // Rotation
      const angleY = Math.random() * Math.PI * 2;
      const angleX = Math.PI / 3 + (Math.random() - 0.5) * 0.5; // Angled up/out

      branch.rotation.y = angleY;
      branch.rotation.z = angleX;

      // Shift branch so it starts at trunk surface
      branch.translateY(branchLen / 2);

      group.add(branch);

      // Sub-branches (visible branching)
      const subBranchCount = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < subBranchCount; j++) {
        const subLen = branchLen * (0.6 + Math.random() * 0.4); // Long sub-branches too
        const subThick = branchThick * 0.7;

        const subGeo = new THREE.CylinderGeometry(subThick * 0.5, subThick, subLen, 4);
        const subBranch = new THREE.Mesh(subGeo, this.treeMaterial);

        // Position along parent branch
        const posAlong = (0.6 + Math.random() * 0.4) * branchLen;
        subBranch.position.set(0, posAlong - branchLen / 2, 0);

        // Rotate out
        subBranch.rotation.z = Math.PI / 4 * (Math.random() > 0.5 ? 1 : -1);
        subBranch.rotation.x = (Math.random() - 0.5) * 1.5;

        subBranch.translateY(subLen / 2);

        branch.add(subBranch);

        // Leaf Cluster at end of sub-branch - SMALLER CANOPY
        if (!isLeafless) {
          const leafSize = 1.0 + wetness * 0.5; // Reduced from 1.5+
          const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
          const leafMesh = new THREE.Mesh(leafGeo, isSnowy ? this.snowyLeafMaterial : this.leafMaterial);
          leafMesh.position.set(0, subLen / 2, 0);
          subBranch.add(leafMesh);
        }
      }

      // Leaf Cluster at end of main branch - SMALLER CANOPY
      if (!isLeafless) {
        const leafSize = 1.2 + wetness * 0.6; // Reduced from 2.0+
        const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
        const leafMesh = new THREE.Mesh(leafGeo, isSnowy ? this.snowyLeafMaterial : this.leafMaterial);

        leafMesh.position.set(0, branchLen / 2, 0);
        branch.add(leafMesh);
      }
    }

    // Top Leaf Cluster - SMALLER
    if (!isLeafless) {
      const topLeafSize = 1.5 + wetness * 0.8; // Reduced from 2.5+
      const topLeafGeo = new THREE.IcosahedronGeometry(topLeafSize, 0);
      const topLeaf = new THREE.Mesh(topLeafGeo, isSnowy ? this.snowyLeafMaterial : this.leafMaterial);
      topLeaf.position.y = height;
      group.add(topLeaf);
    }

    return group;
  }

  static createBush(wetness: number): THREE.Group {
    const group = new THREE.Group();

    if (wetness > 0.5) {
      // FERN (Wet) - Larger
      const frondCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < frondCount; i++) {
        const length = (1.5 + Math.random() * 1.5) * 3.0; // 3x larger
        const width = (0.5 + Math.random() * 0.3) * 3.0; // 3x larger

        const segments = 5;
        const segmentLen = length / segments;

        const curveGroup = new THREE.Group();
        const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.5);
        const angleX = Math.PI / 4 + Math.random() * 0.3;

        curveGroup.rotation.y = angleY;

        let currentPos = new THREE.Vector3(0, 0, 0);
        let currentAngle = angleX;

        for (let k = 0; k < segments; k++) {
          const segWidth = width * (1 - k / segments);
          const segGeo = new THREE.PlaneGeometry(segWidth, segmentLen);
          segGeo.translate(0, segmentLen / 2, 0);

          const seg = new THREE.Mesh(segGeo, this.greenBushMaterial);
          seg.position.copy(currentPos);
          seg.rotation.x = currentAngle;
          (seg.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;

          curveGroup.add(seg);

          currentPos.add(new THREE.Vector3(0, segmentLen, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), currentAngle));
          currentAngle += 0.25; // Less curve for longer fronds
        }
        group.add(curveGroup);
      }

    } else {
      // DEAD BUSH (Dry) - Refined based on feedback
      // "Start at ground level with between 2-3 stems at randomly placed angles"
      // "Small number of short jagged branches off of those"
      const material = this.dryBushMaterial;

      const generateJaggedBranch = (start: THREE.Vector3, len: number, thick: number, depth: number, ang: THREE.Euler) => {
        if (depth === 0) return;

        const end = start.clone().add(new THREE.Vector3(0, len, 0).applyEuler(ang));
        const mid = start.clone().add(end).multiplyScalar(0.5);

        const geo = new THREE.CylinderGeometry(thick * 0.7, thick, len, 4);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.copy(mid);
        mesh.lookAt(end);
        mesh.rotateX(Math.PI / 2);
        group.add(mesh);

        // 1 or 2 sub-branches, jagged angles
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const newLen = len * 0.6;
          const newThick = thick * 0.7;

          // Jagged angle: abrupt change
          const newAng = new THREE.Euler(
            ang.x + (Math.random() - 0.5) * 2.0,
            ang.y + (Math.random() - 0.5) * 2.0,
            ang.z + (Math.random() - 0.5) * 2.0
          );
          generateJaggedBranch(end, newLen, newThick, depth - 1, newAng);
        }
      };

      // 2-3 Stems from ground
      const stemCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < stemCount; i++) {
        // Random angle out from center
        const angleY = Math.random() * Math.PI * 2;
        const angleX = 0.3 + Math.random() * 0.5; // Angle up from ground

        const startAngle = new THREE.Euler(
          (Math.random() - 0.5) * 1.5, // Widen spread
          angleY,
          (Math.random() - 0.5) * 1.5 // Widen spread
        );

        // Increase base size by 3x
        generateJaggedBranch(new THREE.Vector3(0, 0, 0), 0.5 * 3.0, 0.1 * 3.0, 3, startAngle);
      }
    }

    return group;
  }

  static createCactus(): THREE.Group {
    const group = new THREE.Group();

    // Saguaro Parameters (2x Scale)
    const height = 3.0 + Math.random() * 3.0; // 3m to 6m
    const trunkRadius = 0.25 + Math.random() * 0.15; // Thicker trunk

    // Trunk
    const trunkGeo = new THREE.CapsuleGeometry(trunkRadius, height - trunkRadius * 2, 8, 16);
    const trunk = new THREE.Mesh(trunkGeo, this.cactusMaterial);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Arms
    // Saguaros usually have 0-5 arms
    const armCount = Math.floor(Math.random() * 4); // 0 to 3 arms

    for (let i = 0; i < armCount; i++) {
      // Arm parameters
      const armRadius = trunkRadius * (0.6 + Math.random() * 0.2); // Slightly thinner than trunk
      const startHeight = height * (0.3 + Math.random() * 0.4); // Start 30-70% up
      const armLengthVertical = (height - startHeight) * (0.5 + Math.random() * 0.5); // Go up a bit
      const armOutwardDist = 0.5 + Math.random() * 0.5; // How far out before going up

      const angle = Math.random() * Math.PI * 2;

      // Create Curve
      // Start at trunk surface
      const startPoint = new THREE.Vector3(Math.cos(angle) * trunkRadius * 0.8, startHeight, Math.sin(angle) * trunkRadius * 0.8);

      // Control point: Outwards and slightly up
      const controlPoint = new THREE.Vector3(
        Math.cos(angle) * (trunkRadius + armOutwardDist),
        startHeight,
        Math.sin(angle) * (trunkRadius + armOutwardDist)
      );

      // End point: Upwards
      const endPoint = new THREE.Vector3(
        Math.cos(angle) * (trunkRadius + armOutwardDist),
        startHeight + armLengthVertical,
        Math.sin(angle) * (trunkRadius + armOutwardDist)
      );

      const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);

      // Tube Geometry
      const tubeGeo = new THREE.TubeGeometry(curve, 8, armRadius, 8, false);
      const arm = new THREE.Mesh(tubeGeo, this.cactusMaterial);
      arm.castShadow = true;
      arm.receiveShadow = true;
      group.add(arm);

      // Cap the top of the arm
      const capGeo = new THREE.SphereGeometry(armRadius, 8, 8);
      const cap = new THREE.Mesh(capGeo, this.cactusMaterial);
      cap.position.copy(endPoint);
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);
    }

    return group;
  }

  static createRock(size: number, isIcy: boolean): THREE.Group {
    const group = new THREE.Group();

    // Size: 0 (Small rock) to 1 (Large boulder)
    // Scale factor: 0.5 to 2.5
    const baseScale = 0.5 + size * 2.0;

    // Use Icosahedron for base shape (triangular)
    // Detail 0 = 20 faces (Low poly)
    // Detail 1 = 80 faces (Mid poly) - Let's use 0 for very low poly, or 1 for slightly better shape?
    // User said "nice looking rocks out of triangular geometry... keep vertex count relatively low".
    // Detail 0 is very blocky (D20 die). Detail 1 is better for displacement.
    // Let's try Detail 1 for larger rocks, Detail 0 for small ones?
    // Or just Detail 0 and rely on displacement to make it interesting?
    // Let's use Detail 1 but keep it low poly style.
    const detail = size > 0.5 ? 1 : 0;
    const geo = new THREE.IcosahedronGeometry(baseScale, detail);

    // Convert to non-indexed to allow flat shading (sharp edges)
    // BufferGeometryUtils.mergeVertices might be needed if we wanted smooth, but we want sharp.
    // toNonIndexed() splits vertices so each face has its own normals.
    // Actually IcosahedronGeometry is already indexed.
    // We want to displace vertices *before* splitting them, so the mesh stays watertight?
    // If we split first, faces will separate when displaced.
    // So: Displace -> Compute Normals -> (Optional) ToNonIndexed for hard edges?
    // MeshToonMaterial with flatShading: true calculates face normals in shader or uses flat normals.
    // If we want true flat look, we usually want non-indexed geometry or use flatShading: true.
    // Let's stick to indexed for displacement, then rely on material flatShading.

    const posAttribute = geo.attributes.position;
    const vertex = new THREE.Vector3();

    // Noise parameters
    const noiseScale = 0.5; // How frequent the noise is
    const noiseStrength = baseScale * 0.4; // How much to displace

    // Seed offset for variety
    const seedOffset = Math.random() * 100;

    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);

      // 3D Noise
      const n = this.rockNoise3D(
        vertex.x * noiseScale + seedOffset,
        vertex.y * noiseScale + seedOffset,
        vertex.z * noiseScale + seedOffset
      );

      // Displace along normal (for sphere, normal is just normalized position)
      // Or just add to position?
      // Radial displacement preserves convexity mostly.
      const displacement = n * noiseStrength;

      // Apply displacement
      // vertex.normalize().multiplyScalar(baseScale + displacement); 
      // But we already have the shape. Let's just add along radial vector.
      const dir = vertex.clone().normalize();
      vertex.add(dir.multiplyScalar(displacement));

      posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geo.computeVertexNormals();

    // Non-uniform scaling for variety (flattened, stretched)
    geo.scale(
      1.0 + (Math.random() - 0.5) * 0.4,
      0.6 + (Math.random() - 0.5) * 0.4, // Generally flatter
      1.0 + (Math.random() - 0.5) * 0.4
    );

    // Default material (will be swapped)
    // Important: flatShading: true in material
    const mesh = new THREE.Mesh(geo, isIcy ? this.iceRockMaterial : this.rockMaterialForest);

    // Random rotation
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // Sink slightly into ground
    // Calculate bounding box to know how deep?
    // Or just heuristic.
    mesh.position.y = baseScale * 0.2;

    group.add(mesh);

    // Add a second smaller rock sometimes (Cluster)
    if (size > 0.4 && Math.random() > 0.6) {
      const size2 = size * 0.5;
      const scale2 = baseScale * 0.5;
      const geo2 = new THREE.IcosahedronGeometry(scale2, 0);

      const posAttribute2 = geo2.attributes.position;
      const vertex2 = new THREE.Vector3();
      const seedOffset2 = Math.random() * 100;

      for (let i = 0; i < posAttribute2.count; i++) {
        vertex2.fromBufferAttribute(posAttribute2, i);
        const n = this.rockNoise3D(
          vertex2.x * noiseScale + seedOffset2,
          vertex2.y * noiseScale + seedOffset2,
          vertex2.z * noiseScale + seedOffset2
        );
        const dir = vertex2.clone().normalize();
        vertex2.add(dir.multiplyScalar(n * scale2 * 0.4));
        posAttribute2.setXYZ(i, vertex2.x, vertex2.y, vertex2.z);
      }
      geo2.computeVertexNormals();
      geo2.scale(1, 0.7, 1);

      const mesh2 = new THREE.Mesh(geo2, isIcy ? this.iceRockMaterial : this.rockMaterialForest);

      const offsetDir = Math.random() * Math.PI * 2;
      const offsetDist = baseScale * 0.9;

      mesh2.position.set(Math.cos(offsetDir) * offsetDist, scale2 * 0.2, Math.sin(offsetDir) * offsetDist);
      mesh2.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      group.add(mesh2);
    }

    return group;
  }
}

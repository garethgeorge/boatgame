import * as THREE from 'three';

export class Decorations {
  private static treeMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513 }); // Brown trunk
  private static leafMaterial = new THREE.MeshToonMaterial({ color: 0x228B22 }); // Forest Green
  private static dryBushMaterial = new THREE.MeshToonMaterial({ color: 0x8B5A2B }); // Brownish
  private static greenBushMaterial = new THREE.MeshToonMaterial({ color: 0x32CD32 }); // Lime Green
  private static cactusMaterial = new THREE.MeshToonMaterial({ color: 0x6B8E23 }); // Olive Drab

  private static cache: {
    trees: { mesh: THREE.Group, wetness: number }[],
    bushes: { mesh: THREE.Group, wetness: number }[],
    cactuses: THREE.Group[]
  } = { trees: [], bushes: [], cactuses: [] };

  static initCache() {
    console.log("Initializing Decoration Cache...");
    // Generate Trees
    for (let i = 0; i < 50; i++) {
      const wetness = Math.random();
      this.cache.trees.push({ mesh: this.createTree(wetness), wetness });
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
    console.log("Decoration Cache Initialized.");
  }

  static getTree(wetness: number): THREE.Group {
    if (this.cache.trees.length === 0) this.initCache();

    const candidates = this.cache.trees.filter(t => Math.abs(t.wetness - wetness) < 0.3);
    const source = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.cache.trees[Math.floor(Math.random() * this.cache.trees.length)];

    if (!source) return this.createTree(wetness); // Fallback
    return source.mesh.clone();
  }

  static getBush(wetness: number): THREE.Group {
    if (this.cache.bushes.length === 0) this.initCache();

    const candidates = this.cache.bushes.filter(b => Math.abs(b.wetness - wetness) < 0.3);
    const source = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.cache.bushes[Math.floor(Math.random() * this.cache.bushes.length)];

    if (!source) return this.createBush(wetness); // Fallback
    return source.mesh.clone();
  }

  static getCactus(): THREE.Group {
    if (this.cache.cactuses.length === 0) this.initCache();

    if (this.cache.cactuses.length === 0) return this.createCactus(); // Fallback if init failed?
    return this.cache.cactuses[Math.floor(Math.random() * this.cache.cactuses.length)].clone();
  }

  static createTree(wetness: number): THREE.Group {
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
        const leafSize = 1.0 + wetness * 0.5; // Reduced from 1.5+
        const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
        const leafMesh = new THREE.Mesh(leafGeo, this.leafMaterial);
        leafMesh.position.set(0, subLen / 2, 0);
        subBranch.add(leafMesh);
      }

      // Leaf Cluster at end of main branch - SMALLER CANOPY
      const leafSize = 1.2 + wetness * 0.6; // Reduced from 2.0+
      const leafGeo = new THREE.IcosahedronGeometry(leafSize, 0);
      const leafMesh = new THREE.Mesh(leafGeo, this.leafMaterial);

      leafMesh.position.set(0, branchLen / 2, 0);
      branch.add(leafMesh);
    }

    // Top Leaf Cluster - SMALLER
    const topLeafSize = 1.5 + wetness * 0.8; // Reduced from 2.5+
    const topLeafGeo = new THREE.IcosahedronGeometry(topLeafSize, 0);
    const topLeaf = new THREE.Mesh(topLeafGeo, this.leafMaterial);
    topLeaf.position.y = height;
    group.add(topLeaf);

    return group;
  }

  static createBush(wetness: number): THREE.Group {
    const group = new THREE.Group();

    if (wetness > 0.5) {
      // FERN (Wet) - Larger
      const frondCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < frondCount; i++) {
        const length = 1.5 + Math.random() * 1.5; // 2-3x larger
        const width = 0.5 + Math.random() * 0.3;

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
          (Math.random() - 0.5) * 0.5, // Slight random tilt
          angleY,
          angleX // Lean out
        );

        // Convert Euler to vector direction to get correct start angle?
        // Actually, my recursive function takes an Euler for direction.
        // But Euler(0, angleY, angleX) might not be exactly "lean out".
        // Let's construct a direction vector and lookAt it?
        // Simpler: Just use random Euler angles that tend outwards.

        const stemAngle = new THREE.Euler(
          (Math.random() - 0.5) * 1.0,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 1.0
        );

        // Ensure it points somewhat up
        // Actually, let's just use the recursive function with a "up-ish" angle

        generateJaggedBranch(new THREE.Vector3(0, 0, 0), 0.5, 0.1, 3, stemAngle);
      }
    }

    return group;
  }

  static createCactus(): THREE.Group {
    const group = new THREE.Group();

    // Main stem
    const height = 1.5 + Math.random() * 1.5;
    const width = 0.2 + Math.random() * 0.1;
    const stemGeo = new THREE.CapsuleGeometry(width, height, 4, 8);
    const stem = new THREE.Mesh(stemGeo, this.cactusMaterial);
    stem.position.y = height / 2;
    group.add(stem);

    // Arms
    if (Math.random() > 0.3) {
      const armHeight = height * 0.4;
      const armGeo = new THREE.CapsuleGeometry(width * 0.8, armHeight, 4, 8);
      const arm = new THREE.Mesh(armGeo, this.cactusMaterial);

      // Position arm
      const side = Math.random() > 0.5 ? 1 : -1;
      const y = height * 0.4 + Math.random() * 0.3;

      // Arm structure: Horizontal out, then vertical up?
      // Simple approach: Just a rotated capsule sticking out
      arm.position.set(side * width * 0.8, y, 0);
      arm.rotation.z = side * -Math.PI / 4;
      group.add(arm);

      // Second arm?
      if (Math.random() > 0.5) {
        const arm2 = new THREE.Mesh(armGeo, this.cactusMaterial);
        const y2 = height * 0.3 + Math.random() * 0.3;
        arm2.position.set(-side * width * 0.8, y2, 0);
        arm2.rotation.z = -side * -Math.PI / 4;
        group.add(arm2);
      }
    }

    return group;
  }
}

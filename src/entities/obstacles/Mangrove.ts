import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations'; // Re-using materials if possible, or define new ones

export class Mangrove extends Entity {
  private static cache: THREE.Group[] = [];
  private static readonly CACHE_SIZE = 100;

  // Materials
  private static trunkMaterial = new THREE.MeshToonMaterial({ color: 0x5D5346 }); // Darker swamp wood
  private static leafMaterial = new THREE.MeshToonMaterial({
    color: 0xffffff, // White base for vertex colors
    vertexColors: true
  });

  constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
    super();

    const radius = 4.5; // Increased collision radius for 3x size

    // Physics Body
    const body = physicsEngine.world.createBody({
      type: 'static', // Mangroves don't move
      position: planck.Vec2(x, y)
    });

    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.5,
      restitution: 0.1
    });

    body.setUserData({ type: 'obstacle', entity: this });
    this.physicsBodies.push(body);

    // Visuals
    const mesh = Mangrove.getMangroveMesh();
    this.meshes.push(mesh);

    // Sync initial position
    this.sync();

    // Random rotation
    mesh.rotation.y = Math.random() * Math.PI * 2;
  }

  update(dt: number): void {
    // Static, no update needed
  }

  private static getMangroveMesh(): THREE.Group {
    if (this.cache.length === 0) {
      this.generateCache();
    }
    const template = this.cache[Math.floor(Math.random() * this.cache.length)];
    return template.clone();
  }

  private static generateCache() {
    console.log("Generating Mangrove Cache...");
    for (let i = 0; i < this.CACHE_SIZE; i++) {
      this.cache.push(this.createMangrove());
    }
  }

  private static createMangrove(): THREE.Group {
    const group = new THREE.Group();

    // Parameters (Scaled 3x)
    const height = (4.0 + Math.random() * 2.0) * 3.0;
    const rootHeight = (1.5 + Math.random() * 0.5) * 3.0; // Height where roots merge
    const spread = (2.0 + Math.random() * 1.0) * 3.0; // Width of root base

    // 1. Roots
    // Use CatmullRomCurve3 for organic, gnarled roots
    const rootCount = 12 + Math.floor(Math.random() * 8); // More roots

    for (let i = 0; i < rootCount; i++) {
      const angle = (i / rootCount) * Math.PI * 2 + (Math.random() * 0.5);
      const dist = spread * (0.6 + Math.random() * 0.8); // Varied distance

      // Points for the root curve
      // Start at bottom (underwater/ground)
      const p0 = new THREE.Vector3(Math.cos(angle) * dist, -2.0, Math.sin(angle) * dist);

      // Attachment point at the trunk base
      // Slant into the trunk: End point (p3) is high and inside, p2 is lower and outside

      const attachAngle = angle + (Math.random() - 0.5) * 0.5; // Slight twist

      // p3: End point, deep inside the trunk and higher up
      const p3 = new THREE.Vector3(
        Math.cos(attachAngle) * 0.2, // Close to center
        rootHeight + 1.0, // Higher up inside trunk
        Math.sin(attachAngle) * 0.2
      );

      // p2: Entry point at trunk surface
      // Trunk radius is ~1.2
      const entryRadius = 1.0 + Math.random() * 0.3;
      const p2 = new THREE.Vector3(
        Math.cos(attachAngle) * entryRadius,
        rootHeight - 0.2, // Just below the "merge" height
        Math.sin(attachAngle) * entryRadius
      );

      // Jitter p2 slightly
      p2.y += (Math.random() - 0.5) * 0.3;

      // Mid point: Arching out
      const p1 = p0.clone().lerp(p2, 0.5);
      p1.y += 1.0; // Arch up
      p1.x *= 1.2; // Bulge out
      p1.z *= 1.2;

      // Add random jitter to mid points for "gnarled" look
      p1.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(0.5));

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);

      // Thicker roots
      const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.3 + Math.random() * 0.2, 5, false);
      const root = new THREE.Mesh(tubeGeo, this.trunkMaterial);
      root.castShadow = true;
      root.receiveShadow = true;
      group.add(root);
    }

    // 2. Trunk (Gnarly)
    const trunkHeight = height - rootHeight;

    // Create a gnarly path for the trunk
    const trunkPoints = [];
    const trunkSegments = 5;
    for (let i = 0; i <= trunkSegments; i++) {
      const t = i / trunkSegments;
      const y = rootHeight + t * trunkHeight;

      // Jitter x/z, less at bottom, more in middle/top
      const jitter = (t > 0 && t < 1) ? 0.4 : 0.0;
      const x = (Math.random() - 0.5) * jitter;
      const z = (Math.random() - 0.5) * jitter;

      trunkPoints.push(new THREE.Vector3(x, y, z));
    }

    const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints);

    // Tapering radius: Thick at bottom (1.5), thinner at top (0.8)
    // TubeGeometry doesn't support tapering natively without custom generator or modifying geometry.
    // But we can just use a constant radius that's "gnarly" enough, or use a custom geometry.
    // For simplicity and style, let's use a slightly thinner constant radius but the curve gives it character.
    // OR, we can just use multiple overlapping tubes? No, too expensive.
    // Let's just use a constant radius for now, maybe 1.0.
    // Actually, we can modify the radius in the vertex shader or just accept it.
    // Let's stick to constant radius 1.2 (average of previous 0.9 and 1.5).

    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 1.2, 7, false);
    const trunk = new THREE.Mesh(trunkGeo, this.trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 3. Canopy
    // Wide spreading branches
    const branchCount = 6 + Math.floor(Math.random() * 4);
    const branchStartY = rootHeight + trunkHeight * 0.5;

    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2 + Math.random();
      // Increased spread: Longer branches (was * 3.0, now * 4.5)
      const len = (2.0 + Math.random() * 1.5) * 4.5;

      const branchGeo = new THREE.CylinderGeometry(0.3, 0.6, len, 5);
      const branch = new THREE.Mesh(branchGeo, this.trunkMaterial);

      // Branch position/rotation in Group space
      const bY = branchStartY + (Math.random() * trunkHeight * 0.4);
      branch.position.set(0, bY, 0);
      branch.rotation.y = angle;
      const zRot = Math.PI / 2 - 0.2 - Math.random() * 0.4; // Angle down/out
      branch.rotation.z = zRot;
      branch.translateY(len / 2); // Move visual mesh so pivot is at start

      trunk.add(branch);

      // Foliage Generation (New Approach)
      // We want horizontal disks forming a canopy.
      // To ensure horizontal orientation, we add them to the main 'group', not the rotated 'branch'.
      // We need to calculate the world (group) position of points along the branch.

      // Branch start point (relative to trunk center) is (0, bY, 0)
      // Branch vector:
      // The branch is rotated by 'angle' around Y, then 'zRot' around Z.
      // Vector pointing along the branch:
      // Start with (0, 1, 0) (Y-up, default cylinder)
      // Rotate Z by zRot -> points somewhat sideways/up
      // Rotate Y by angle -> points in correct direction

      const dir = new THREE.Vector3(0, 1, 0);
      dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), zRot);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      dir.normalize();

      const startPos = new THREE.Vector3(0, bY, 0);
      // Adjust startPos for trunk offset if needed (trunk is at 0,0,0 local to group)

      // Spawn leaf disks along the branch
      const diskCount = 5 + Math.floor(Math.random() * 3);
      for (let j = 0; j < diskCount; j++) {
        const t = 0.3 + Math.random() * 0.7; // Dist along branch
        const pos = startPos.clone().add(dir.clone().multiplyScalar(len * t));

        // Spread out from the branch line
        pos.x += (Math.random() - 0.5) * 3.0;
        pos.z += (Math.random() - 0.5) * 3.0;
        pos.y += (Math.random() - 0.5) * 0.5; // Slight vertical jitter

        const leaf = this.createLeafDisk();
        leaf.position.copy(pos);

        // Add to main group to maintain horizontal orientation
        group.add(leaf);
      }
    }

    // Top canopy - Cluster of disks at the top
    const topDiskCount = 15;
    for (let i = 0; i < topDiskCount; i++) {
      const leaf = this.createLeafDisk();

      // Cluster at top
      leaf.position.y = height + (Math.random() - 0.5) * 1.5;
      leaf.position.x = (Math.random() - 0.5) * 9.0;
      leaf.position.z = (Math.random() - 0.5) * 9.0;

      group.add(leaf);
    }

    return group;
  }

  private static createLeafDisk(): THREE.Mesh {
    // Irregular disk
    const radius = 2.0 + Math.random() * 1.5;
    const segments = 7; // Low poly, odd number for irregularity
    const geo = new THREE.CylinderGeometry(radius, radius, 0.1, segments);

    // Modulate vertices to make it irregular
    const posAttribute = geo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);

      // If it's an outer vertex (radius > 0.1)
      const r = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
      if (r > 0.5) {
        // Push in/out
        const scale = 0.7 + Math.random() * 0.6;
        vertex.x *= scale;
        vertex.z *= scale;
        // Slight y wobble
        vertex.y += (Math.random() - 0.5) * 0.2;
      }

      posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    // Vertex Colors
    const color = new THREE.Color(0x4A5D23);
    color.offsetHSL(0, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.1);

    const colors = new Float32Array(posAttribute.count * 3);
    for (let i = 0; i < posAttribute.count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Compute normals after modification
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.leafMaterial);

    // Strictly horizontal rotation with random yaw
    mesh.rotation.y = Math.random() * Math.PI * 2;
    // Very slight tilt
    mesh.rotation.x = (Math.random() - 0.5) * 0.1;
    mesh.rotation.z = (Math.random() - 0.5) * 0.1;

    return mesh;
  }
}


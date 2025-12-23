import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export abstract class BaseMangrove extends Entity {
  private static cache: THREE.Group[] = [];
  private static readonly CACHE_SIZE = 100;

  // Materials
  protected static trunkMaterial = new THREE.MeshToonMaterial({ color: 0x5D5346, name: 'Mangrove - Trunk Material' }); // Darker swamp wood
  protected static leafMaterial = new THREE.MeshToonMaterial({
    name: 'Mangrove - Leaf Material',
    color: 0xffffff, // White base for vertex colors
    vertexColors: true
  });

  public static preload() {
    GraphicsUtils.registerObject(this.trunkMaterial);
    GraphicsUtils.registerObject(this.leafMaterial);
  }

  constructor(x: number, y: number, scale: number, physicsEngine: PhysicsEngine) {
    super();

    // Visuals
    const mesh = BaseMangrove.getMangroveMesh();
    mesh.scale.setScalar(scale); // Apply scale to visuals
    this.meshes.push(mesh);

    // Physics Body
    const body = physicsEngine.world.createBody({
      type: 'static', // Mangroves don't move
      position: planck.Vec2(x, y)
    });

    this.createFixtures(body, mesh, scale);

    body.setUserData({ type: 'obstacle', entity: this });
    this.physicsBodies.push(body);

    // Sync initial position
    this.sync();

    // Random rotation
    const angle = Math.random() * Math.PI * 2;
    mesh.rotation.y = angle;
    body.setAngle(angle);
  }

  // Abstract method for subclasses to implement specific collider logic
  protected abstract createFixtures(body: planck.Body, mesh: THREE.Group, scale: number): void;

  update(dt: number): void {
    // Static, no update needed
  }

  // Helper Methods

  protected static getMangroveMesh(): THREE.Group {
    if (this.cache.length === 0) {
      this.generateCache();
    }
    const template = this.cache[Math.floor(Math.random() * this.cache.length)];
    return GraphicsUtils.cloneObject(template);
  }

  private static generateCache() {
    console.log("Generating Mangrove Cache...");
    this.preload();

    for (let i = 0; i < this.CACHE_SIZE; i++) {
      const mangrove = this.createMangrove();
      GraphicsUtils.markAsCache(mangrove);
      this.cache.push(mangrove);
    }
  }

  // Monotone Chain Convex Hull Algorithm
  protected static getConvexHull(points: planck.Vec2[]): planck.Vec2[] {
    if (points.length <= 3) return points;

    // Sort points lexographically (by x, then y)
    // Clone to avoid modifying original array
    const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    const lower: planck.Vec2[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: planck.Vec2[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    // Concatenate lower and upper to form full hull
    // Last point of lower is same as first of upper, so pop it
    lower.pop();
    const hull = lower.concat(upper);

    return hull;
  }

  // Cross product of vectors (b - a) and (c - a)
  private static crossProduct(a: planck.Vec2, b: planck.Vec2, c: planck.Vec2): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  private static createMangrove(): THREE.Group {
    const group = new THREE.Group();
    const rootOffsets: { x: number, z: number, r: number }[] = [];

    // Parameters (Scaled 3x)
    const height = (4.0 + Math.random() * 2.0) * 3.0;
    const rootHeight = (1.5 + Math.random() * 0.5) * 3.0; // Height where roots merge
    const spread = (2.0 + Math.random() * 1.0) * 3.0; // Width of root base

    // 1. Roots
    // Use CatmullRomCurve3 for organic, gnarled roots
    const rootCount = 5 + Math.floor(Math.random() * 8); // 5 to 12 roots

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

      // Calculate intersection with Water (y=0) for physics
      // Simple linear scan approximation
      const divisions = 20;
      for (let j = 0; j <= divisions; j++) {
        const t = j / divisions;
        const pt = curve.getPoint(t);
        if (pt.y >= 0) {
          // Found transition point (approx)
          // Store this point for collision
          const rootRadius = 0.3 + Math.random() * 0.2; // Match visual radius approx
          rootOffsets.push({ x: pt.x, z: pt.z, r: rootRadius });
          break;
        }
      }

      // Thicker roots
      const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.3 + Math.random() * 0.2, 5, false);
      tubeGeo.name = 'Mangrove - Root Geometry';
      const root = GraphicsUtils.createMesh(tubeGeo, this.trunkMaterial, 'MangroveRoot');
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
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 1.2, 7, false);
    trunkGeo.name = 'Mangrove - Trunk Geometry';
    const trunk = GraphicsUtils.createMesh(trunkGeo, this.trunkMaterial, 'MangroveTrunk');
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
      branchGeo.name = 'Mangrove - Branch Geometry';
      const branch = GraphicsUtils.createMesh(branchGeo, this.trunkMaterial, 'MangroveBranch');

      // Branch position/rotation in Group space
      const bY = branchStartY + (Math.random() * trunkHeight * 0.4);
      branch.position.set(0, bY, 0);
      branch.rotation.y = angle;
      const zRot = Math.PI / 2 - 0.2 - Math.random() * 0.4; // Angle down/out
      branch.rotation.z = zRot;
      branch.translateY(len / 2); // Move visual mesh so pivot is at start

      trunk.add(branch);

      // Foliage Generation (New Approach)
      const dir = new THREE.Vector3(0, 1, 0);
      dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), zRot);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      dir.normalize();

      const startPos = new THREE.Vector3(0, bY, 0);

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

    // Merge geometries
    // 1. Wood Geometry (Roots, Trunk, Branches)
    const woodGeometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material === this.trunkMaterial) {
        child.updateMatrixWorld();
        const geo = child.geometry.clone();
        GraphicsUtils.registerObject(geo);
        geo.applyMatrix4(child.matrixWorld);
        woodGeometries.push(geo);
      }
    });

    // 2. Leaf Geometry
    const leafGeometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material === this.leafMaterial) {
        child.updateMatrixWorld();
        const geo = child.geometry.clone();
        GraphicsUtils.registerObject(geo);
        geo.applyMatrix4(child.matrixWorld);
        leafGeometries.push(geo);
      }
    });

    // Create a new compact group
    const finalGroup = new THREE.Group();

    if (woodGeometries.length > 0) {
      const mergedWood = BufferGeometryUtils.mergeGeometries(woodGeometries);
      const woodMesh = GraphicsUtils.createMesh(mergedWood, this.trunkMaterial, 'MangroveWood');
      woodMesh.castShadow = true;
      woodMesh.receiveShadow = true;
      finalGroup.add(woodMesh);
      woodGeometries.forEach(g => GraphicsUtils.disposeObject(g));
    }

    if (leafGeometries.length > 0) {
      const mergedLeaves = BufferGeometryUtils.mergeGeometries(leafGeometries);
      const leafMesh = GraphicsUtils.createMesh(mergedLeaves, this.leafMaterial, 'MangroveLeaves');
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      finalGroup.add(leafMesh);
      leafGeometries.forEach(g => GraphicsUtils.disposeObject(g));
    }

    // Dispose of the original loose group and its children's geometries
    GraphicsUtils.disposeObject(group);

    // Attach Root Collider Offsets to userData
    finalGroup.userData.rootOffsets = rootOffsets;

    return finalGroup;
  }

  private static createLeafDisk(): THREE.Mesh {
    // Irregular disk
    const radius = 2.0 + Math.random() * 1.5;
    const segments = 7; // Low poly, odd number for irregularity
    const geo = new THREE.CylinderGeometry(radius, radius, 0.1, segments);
    geo.name = 'Mangrove - Leaf Disk Geometry';

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
    geo.computeVertexNormals();

    const mesh = GraphicsUtils.createMesh(geo, this.leafMaterial, 'MangroveLeafSingle');
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.x = (Math.random() - 0.5) * 0.1;
    mesh.rotation.z = (Math.random() - 0.5) * 0.1;

    return mesh;
  }
}

export class SmallMangrove extends BaseMangrove {
  // Small mangroves have convex hull physics
  protected createFixtures(body: planck.Body, mesh: THREE.Group, scale: number): void {
    const rootOffsets = mesh.userData.rootOffsets as { x: number, z: number, r: number }[];

    if (rootOffsets) {
      // Small Mangrove: Convex Hull of roots + radius
      const points = rootOffsets.map(o => planck.Vec2(o.x * scale, o.z * scale));

      // 1. Get Hull
      let hull = BaseMangrove.getConvexHull(points);

      // 2. Expand Hull to account for root radius (approximate)
      const centroid = planck.Vec2(0, 0);
      for (const p of hull) centroid.add(p);
      centroid.mul(1.0 / hull.length);

      // Expand
      const expandedHull = hull.map(p => {
        const dir = planck.Vec2.sub(p, centroid);
        dir.normalize();
        // Add avg root radius (scaled) + small padding
        const expansion = 0.4 * scale;
        return planck.Vec2.add(p, planck.Vec2(dir.x * expansion, dir.y * expansion));
      });

      body.createFixture({
        shape: planck.Polygon(expandedHull),
        density: 1.0,
        friction: 0.5,
        restitution: 0.1
      });
    } else {
      // Fallback
      body.createFixture({
        shape: planck.Circle(4.5 * scale),
        density: 1.0,
        friction: 0.5,
        restitution: 0.1
      });
    }
  }
}

export class LargeMangrove extends BaseMangrove {
  // Medium/Large mangroves have complex physics (circles per root)
  protected createFixtures(body: planck.Body, mesh: THREE.Group, scale: number): void {
    const rootOffsets = mesh.userData.rootOffsets as { x: number, z: number, r: number }[];

    if (rootOffsets) {
      for (const offset of rootOffsets) {
        body.createFixture({
          shape: planck.Circle(
            planck.Vec2(offset.x * scale, offset.z * scale),
            offset.r * scale * 2.0
          ),
          density: 1.0,
          friction: 0.5,
          restitution: 0.1
        });
      }
    } else {
      // Fallback
      body.createFixture({
        shape: planck.Circle(4.5 * scale),
        density: 1.0,
        friction: 0.5,
        restitution: 0.1
      });
    }
  }
}

import * as THREE from 'three';
import * as planck from 'planck';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/decorations/Decorations';
import { MangroveFactory } from '../../world/factories/MangroveFactory';

export abstract class BaseMangrove extends Entity {
  constructor(x: number, y: number, scale: number, physicsEngine: PhysicsEngine) {
    super();

    // Visuals obtained through Decorations interface
    const mesh = Decorations.getMangrove(scale);
    this.meshes.push(mesh);

    // Physics Body
    const body = physicsEngine.world.createBody({
      type: 'static', // Mangroves don't move
      position: planck.Vec2(x, y)
    });

    this.createFixtures(body, mesh, scale);

    body.setUserData({ type: 'obstacle', subtype: 'mangrove', entity: this });
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
}

export class SmallMangrove extends BaseMangrove {
  // Small mangroves have convex hull physics
  protected createFixtures(body: planck.Body, mesh: THREE.Group, scale: number): void {
    const rootOffsets = mesh.userData.rootOffsets as { x: number, z: number, r: number }[];

    if (rootOffsets) {
      // Small Mangrove: Convex Hull of roots + radius
      const points = rootOffsets.map(o => planck.Vec2(o.x * scale, o.z * scale));

      // 1. Get Hull
      let hull = MangroveFactory.getConvexHull(points);

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

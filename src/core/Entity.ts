import * as planck from 'planck';
import {
  TransformNode,
  Vector3,
  Quaternion,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  Engine
} from '@babylonjs/core';

// Stub for backward compatibility
class DummyDisposer {
  add(obj: any) { }
}

export abstract class Entity {
  public disposer = new DummyDisposer();
  public physicsBodies: planck.Body[] = [];
  public meshes: TransformNode[] = [];
  public debugMeshes: TransformNode[] = [];

  // Set to true to have the entity deleted
  public shouldRemove: boolean = false;

  // True for entities that can cause penalties
  public canCausePenalty: boolean = false;

  // Set to true when this entity has caused a penalty to avoid repetition
  public hasCausedPenalty: boolean = false;

  // Optional normal vector for terrain alignment
  // If set, mesh will be tilted so its Y-axis aligns with this normal
  // while still following physics rotation around Y
  protected normalVector: Vector3 | null = null;

  constructor() { }

  abstract update(dt: number): void;

  // Do stuff when hit by the player
  wasHitByPlayer(boat: any): void {

  }

  // Helper function to destroy all physics bodies for the entity
  destroyPhysicsBodies() {
    for (const body of this.physicsBodies) {
      const world = body.getWorld();
      world.destroyBody(body);
    }
    this.physicsBodies = [];
  }

  dispose() {
    // Babylon.js handles resources recursively when disposing a node.
    this.meshes.forEach(m => m.dispose());
    this.meshes = [];

    this.debugMeshes.forEach(m => m.dispose());
    this.debugMeshes = [];

    this.physicsBodies = [];
  }

  // Interpolation state
  private prevPos: Map<planck.Body, planck.Vec2> = new Map();
  private prevAngle: Map<planck.Body, number> = new Map();

  savePreviousState() {
    for (const body of this.physicsBodies) {
      this.prevPos.set(body, body.getPosition().clone());
      this.prevAngle.set(body, body.getAngle());
    }
  }

  // Sync graphics position/rotation with physics body
  // By default, syncs the first mesh with the first body
  // Subclasses can override or call this manually for specific pairs
  sync(alpha: number = 1.0) {
    if (this.physicsBodies.length > 0 && this.meshes.length > 0) {
      const body = this.physicsBodies[0];
      const mesh = this.meshes[0];
      this.syncBodyMesh(body, mesh, alpha);
    }

    // Sync debug meshes
    for (let i = 0; i < Math.min(this.physicsBodies.length, this.debugMeshes.length); i++) {
      this.syncBodyMesh(this.physicsBodies[i], this.debugMeshes[i], alpha);
    }
  }

  protected syncBodyMesh(body: planck.Body, mesh: TransformNode, alpha: number) {
    const currPos = body.getPosition();
    const currAngle = body.getAngle();

    let pos = currPos;
    let angle = currAngle;

    // Interpolate if we have previous state
    if (this.prevPos.has(body) && this.prevAngle.has(body)) {
      const prevPos = this.prevPos.get(body)!;
      const prevAngle = this.prevAngle.get(body)!;

      const x = prevPos.x * (1 - alpha) + currPos.x * alpha;
      const y = prevPos.y * (1 - alpha) + currPos.y * alpha;
      pos = planck.Vec2(x, y);

      // Interpolate angle
      angle = prevAngle * (1 - alpha) + currAngle * alpha;
    }

    mesh.position.x = pos.x;
    mesh.position.z = pos.y; // Map 2D Physics Y to 3D Graphics Z

    // Apply rotation with optional normal alignment
    if (this.normalVector) {
      const up = Vector3.Up();
      const axis = Vector3.Cross(up, this.normalVector);
      const dot = Vector3.Dot(up, this.normalVector);

      let normalQuaternion = Quaternion.Identity();
      if (dot < -0.999999) {
        normalQuaternion = Quaternion.FromEulerAngles(Math.PI, 0, 0);
      } else if (dot > 0.999999) {
        normalQuaternion = Quaternion.Identity();
      } else {
        const angleRel = Math.acos(dot);
        normalQuaternion = Quaternion.RotationAxis(axis.normalize(), angleRel);
      }

      // Rotate around the normal vector (physics angle)
      const rotationQuaternion = Quaternion.RotationAxis(this.normalVector, -angle);

      // Order in Babylon: q1.multiply(q2) results in q1 * q2.
      // Standard: first apply q2, then q1.
      // We want to apply tilt (normalQuaternion) then spin (rotationQuaternion).
      if (!mesh.rotationQuaternion) mesh.rotationQuaternion = Quaternion.Identity();
      rotationQuaternion.multiplyToRef(normalQuaternion, mesh.rotationQuaternion);

    } else {
      // Standard rotation around Y
      mesh.rotationQuaternion = null; // Ensure euler is used or reset quat
      mesh.rotation.x = 0;
      mesh.rotation.z = 0;
      mesh.rotation.y = -angle;
    }
  }

  ensureDebugMeshes(): TransformNode[] {
    if (this.debugMeshes.length > 0) return this.debugMeshes;
    if (this.physicsBodies.length === 0) return [];

    const scene = Engine.LastCreatedScene;
    if (!scene) return [];

    const mat = new StandardMaterial("debugMat", scene);
    mat.diffuseColor = new Color3(1, 0, 0);
    mat.wireframe = true;
    mat.disableLighting = true; // Make it look like a debug line

    for (const body of this.physicsBodies) {
      const group = new TransformNode("debugGroup", scene);

      for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
        const shape = fixture.getShape();
        const type = shape.getType();

        let debugMesh: Mesh | null = null;

        if (type === 'circle') {
          const circle = shape as planck.Circle;
          const radius = circle.getRadius();
          const center = circle.getCenter();

          debugMesh = MeshBuilder.CreateCylinder("circle", { diameter: radius * 2, height: 1 }, scene);
          debugMesh.material = mat;
          debugMesh.position.set(center.x, 0, center.y);

        } else if (type === 'polygon') {
          const poly = shape as planck.Polygon;
          const vertices = (poly as any).m_vertices;

          const points: Vector3[] = [];
          for (const v of vertices) {
            points.push(new Vector3(v.x, 0, v.y));
          }
          if (points.length > 0) {
            points.push(points[0].clone());
          }

          const lines = MeshBuilder.CreateLines("poly", { points: points }, scene);
          lines.color = new Color3(1, 0, 0);
          // lines.parent = group; // Handled below
          debugMesh = lines as any;
        }

        if (debugMesh) {
          debugMesh.parent = group;
        }
      }

      // Initial sync
      this.syncBodyMesh(body, group, 1.0);
      this.debugMeshes.push(group);
    }

    return this.debugMeshes;
  }
}

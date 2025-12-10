import * as planck from 'planck';
import * as THREE from 'three';

export abstract class Entity {
  public physicsBodies: planck.Body[] = [];
  public meshes: THREE.Object3D[] = [];
  public materials: THREE.Material[] = [];
  public debugMeshes: THREE.Object3D[] = [];

  public shouldRemove: boolean = false;

  // True for entities that can cause penalties
  public canCausePenalty: boolean = false;

  // Set to true when this entity has caused a penalty to avoid repetition
  public hasCausedPenalty: boolean = false;

  // Optional normal vector for terrain alignment
  // If set, mesh will be tilted so its Y-axis aligns with this normal
  // while still following physics rotation around Y
  protected normalVector: THREE.Vector3 | null = null;

  constructor() { }

  abstract update(dt: number): void;

  // Do stuff when hit by another game object
  onHit(): void { }

  dispose() {
    // Dispose of all meshes
    for (const mesh of this.meshes) {
      this.disposeObject3D(mesh);
    }
    this.meshes = [];

    // Dispose of all debug meshes
    for (const mesh of this.debugMeshes) {
      this.disposeObject3D(mesh);
    }
    this.debugMeshes = [];

    // Dispose of tracked materials
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials = [];
  }

  private disposeObject3D(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: THREE.Material) => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      }
    });
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

    // Sync debug meshes - assuming 1:1 mapping if they exist, or just rebuild them?
    // Actually, ensureDebugMeshes creates a group for each body usually?
    // Let's iterate if counts match
    for (let i = 0; i < Math.min(this.physicsBodies.length, this.debugMeshes.length); i++) {
      this.syncBodyMesh(this.physicsBodies[i], this.debugMeshes[i], alpha);
    }
  }

  protected syncBodyMesh(body: planck.Body, mesh: THREE.Object3D, alpha: number) {
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

      // Interpolate angle (handle wrap-around if necessary, but Planck angles are continuous)
      angle = prevAngle * (1 - alpha) + currAngle * alpha;
    }

    mesh.position.x = pos.x;
    mesh.position.z = pos.y; // Map 2D Physics Y to 3D Graphics Z

    // Apply rotation with optional normal alignment
    if (this.normalVector) {
      //mesh.setRotationFromAxisAngle(this.normalVector.clone(), -angle);
      const up = new THREE.Vector3(0, 1, 0); // Default Y-axis
      const normalQuaternion = new THREE.Quaternion().setFromUnitVectors(up, this.normalVector);

      // The axis for this rotation is the targetNormal itself
      const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(this.normalVector, -angle);

      // Multiply the orientation by the rotation to get the final transformation
      // Order matters: first align, then rotate around the aligned axis.
      mesh.quaternion.multiplyQuaternions(rotationQuaternion, normalQuaternion);
    } else {
      // Standard rotation around Y. Intentionally preserves any other rotations.
      mesh.rotation.y = -angle;
    }
  }

  ensureDebugMeshes(): THREE.Object3D[] {
    if (this.debugMeshes.length > 0) return this.debugMeshes;
    if (this.physicsBodies.length === 0) return [];

    for (const body of this.physicsBodies) {
      const group = new THREE.Group();

      for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
        const shape = fixture.getShape();
        const type = shape.getType();

        let mesh: THREE.Mesh | null = null;
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        this.materials.push(material); // Track for disposal

        if (type === 'circle') {
          const circle = shape as planck.Circle;
          const radius = circle.getRadius();
          const center = circle.getCenter();

          const geometry = new THREE.CylinderGeometry(radius, radius, 1, 16);
          mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(center.x, 0, center.y); // Local offset

        } else if (type === 'polygon') {
          const poly = shape as planck.Polygon;
          const vertices = (poly as any).m_vertices;

          const points: THREE.Vector3[] = [];
          for (const v of vertices) {
            points.push(new THREE.Vector3(v.x, 0, v.y));
          }
          if (points.length > 0) {
            points.push(points[0].clone());
          }

          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
          // Lines don't have geometry in the same way for disposal, but BufferGeometry is disposable.
          // We should probably track this geometry too?
          // For now, let's just add the line.
          group.add(line);
          continue;
        }

        if (mesh) {
          group.add(mesh);
        }
      }

      // Initial sync
      this.syncBodyMesh(body, group, 1.0);
      this.debugMeshes.push(group);
    }

    return this.debugMeshes;
  }
}


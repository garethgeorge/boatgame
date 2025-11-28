import * as planck from 'planck';
import * as THREE from 'three';

export abstract class Entity {
  physicsBody: planck.Body | null = null;
  mesh: THREE.Object3D | null = null;
  debugMesh: THREE.Mesh | THREE.Group | null = null;

  constructor() { }

  shouldRemove: boolean = false;
  hasCausedPenalty: boolean = false;

  abstract update(dt: number): void;

  onHit(): void { }

  // Sync graphics position/rotation with physics body
  sync() {
    if (this.physicsBody) {
      const pos = this.physicsBody.getPosition();
      const angle = this.physicsBody.getAngle();

      if (this.mesh) {
        this.mesh.position.x = pos.x;
        this.mesh.position.z = pos.y; // Map 2D Physics Y to 3D Graphics Z
        this.mesh.rotation.y = -angle;
      }

      if (this.debugMesh) {
        this.debugMesh.position.x = pos.x;
        this.debugMesh.position.z = pos.y;
        this.debugMesh.rotation.y = -angle;
      }
    }
  }

  ensureDebugMesh(): THREE.Object3D | null {
    if (this.debugMesh) return this.debugMesh;
    if (!this.physicsBody) return null;

    const group = new THREE.Group();

    for (let fixture = this.physicsBody.getFixtureList(); fixture; fixture = fixture.getNext()) {
      const shape = fixture.getShape();
      const type = shape.getType();

      let mesh: THREE.Mesh | null = null;
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });

      if (type === 'circle') {
        const circle = shape as planck.Circle;
        const radius = circle.getRadius();
        const center = circle.getCenter();

        const geometry = new THREE.CylinderGeometry(radius, radius, 1, 16);
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(center.x, 0, center.y); // Local offset

      } else if (type === 'polygon') {
        // Handle Box (which is a polygon)
        // We need to construct geometry from vertices
        // But for simple boxes, we can try to detect if it's a box or just draw lines
        // Let's just draw lines for the polygon
        const poly = shape as planck.Polygon;
        const vertices = (poly as any).m_vertices;

        const points: THREE.Vector3[] = [];
        for (const v of vertices) {
          points.push(new THREE.Vector3(v.x, 0, v.y)); // Map 2D -> 3D (Y -> Z)
        }
        // Close the loop
        if (points.length > 0) {
          points.push(points[0].clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
        group.add(line);
        continue; // Skip adding mesh, we added line
      }

      if (mesh) {
        group.add(mesh);
      }
    }

    this.debugMesh = group;
    // Initial sync
    const pos = this.physicsBody.getPosition();
    const angle = this.physicsBody.getAngle();
    this.debugMesh.position.set(pos.x, 0, pos.y);
    this.debugMesh.rotation.y = -angle;

    return this.debugMesh;
  }
}


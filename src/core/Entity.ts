import * as planck from 'planck';
import * as THREE from 'three';

export abstract class Entity {
  physicsBody: planck.Body | null = null;
  mesh: THREE.Object3D | null = null;

  constructor() { }

  shouldRemove: boolean = false;

  abstract update(dt: number): void;

  onHit(): void { }

  // Sync graphics position/rotation with physics body
  sync() {
    if (this.physicsBody && this.mesh) {
      const pos = this.physicsBody.getPosition();
      const angle = this.physicsBody.getAngle();

      this.mesh.position.x = pos.x;
      this.mesh.position.z = pos.y; // Map 2D Physics Y to 3D Graphics Z
      this.mesh.rotation.y = -angle;
    }
  }
}


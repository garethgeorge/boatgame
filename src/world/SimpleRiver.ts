import Matter from 'matter-js';
import * as THREE from 'three';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';

export class SimpleRiver {
  constructor(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
    this.createShores(physicsEngine, graphicsEngine);
  }

  createShores(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
    const riverWidth = 40;
    const riverLength = 1000;
    const wallThickness = 10;

    // Left Shore (Physics)
    const leftWallBody = Matter.Bodies.rectangle(
      -riverWidth / 2 - wallThickness / 2, // x center
      0, // y center (z in 3D)
      wallThickness,
      riverLength,
      { isStatic: true, label: 'Shore' }
    );

    // Right Shore (Physics)
    const rightWallBody = Matter.Bodies.rectangle(
      riverWidth / 2 + wallThickness / 2, // x center
      0, // y center (z in 3D)
      wallThickness,
      riverLength,
      { isStatic: true, label: 'Shore' }
    );

    physicsEngine.addBody(leftWallBody);
    physicsEngine.addBody(rightWallBody);

    // Graphics
    const wallGeometry = new THREE.BoxGeometry(wallThickness, 5, riverLength);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green

    const leftWallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWallMesh.position.set(-riverWidth / 2 - wallThickness / 2, 2.5, 0);
    graphicsEngine.add(leftWallMesh);

    const rightWallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWallMesh.position.set(riverWidth / 2 + wallThickness / 2, 2.5, 0);
    graphicsEngine.add(rightWallMesh);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(riverWidth, riverLength);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    graphicsEngine.add(waterMesh);
  }
}

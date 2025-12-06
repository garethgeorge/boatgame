import * as planck from 'planck';
import * as THREE from 'three';

export interface AttackAnimal {
    getPhysicsBody(): planck.Body | null;
    setLandPosition(height: number, normal: THREE.Vector3): void;
    setWaterPosition(height: number): void;
    didStartEnteringWater?(): void;
}

import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { BaseMangrove } from '../../entities/obstacles/Mangrove';

export class MangroveFactory implements DecorationFactory {
  async load(): Promise<void> {
    await BaseMangrove.preload();
  }

  create(options: { scale?: number } = {}): THREE.Group {
    const mesh = BaseMangrove.getMangroveMesh();
    if (options && options.scale) {
      mesh.scale.setScalar(options.scale);
    }
    return mesh;
  }
}

import * as THREE from 'three';
import { DecorationRegistry } from './DecorationRegistry';
import { TreeFactory } from './factories/TreeFactory';
import { BushFactory } from './factories/BushFactory';
import { CactusFactory } from './factories/CactusFactory';
import { RockFactory } from './factories/RockFactory';
import { BottleFactory } from './factories/BottleFactory';
import { GLTFModelFactory } from './factories/GLTFModelFactory';

// Register factories
DecorationRegistry.register('tree', new TreeFactory());
DecorationRegistry.register('bush', new BushFactory());
DecorationRegistry.register('cactus', new CactusFactory());
DecorationRegistry.register('rock', new RockFactory());
DecorationRegistry.register('bottle', new BottleFactory());

DecorationRegistry.register('polarBear', new GLTFModelFactory('assets/polar-bear-model-1.glb'));
DecorationRegistry.register('hippo', new GLTFModelFactory('assets/hippo-model-1.glb'));
DecorationRegistry.register('alligator', new GLTFModelFactory('assets/alligator-model-1.glb'));
DecorationRegistry.register('penguinKayak', new GLTFModelFactory('assets/penguin-kayak-model-1.glb'));
DecorationRegistry.register('brownBear', new GLTFModelFactory('assets/brown-bear-model-1.glb'));
DecorationRegistry.register('monkey', new GLTFModelFactory('assets/monkey-model-1.glb'));
DecorationRegistry.register('moose', new GLTFModelFactory('assets/moose-model-1.glb'));
DecorationRegistry.register('duckling', new GLTFModelFactory('assets/duckling-model-1.glb'));


export class Decorations {

  static async preload(): Promise<void> {
    await DecorationRegistry.loadAll();
  }

  static getTree(wetness: number, isSnowy: boolean = false, isLeafless: boolean = false): THREE.Group {
    return DecorationRegistry.getFactory('tree').create({ wetness, isSnowy, isLeafless }).model;
  }

  static getBush(wetness: number): THREE.Group {
    return DecorationRegistry.getFactory('bush').create(wetness).model;
  }

  static getCactus(): THREE.Group {
    return DecorationRegistry.getFactory('cactus').create().model;
  }

  static getRock(biome: 'desert' | 'forest' | 'ice' | 'swamp', size: number): THREE.Group {
    return DecorationRegistry.getFactory('rock').create({ size, biome }).model;
  }

  static getBottle(color: number): THREE.Group {
    return DecorationRegistry.getFactory('bottle').create(color).model;
  }

  static getBottleFadeAnimation(): THREE.AnimationClip {
    return DecorationRegistry.getFactory('bottle').create().animations[0];
  }

  // Animal getters
  private static getAnimal(name: string): { model: THREE.Group, animations: THREE.AnimationClip[] } | null {
    try {
      return DecorationRegistry.getFactory(name).create();
    } catch (e) {
      console.warn(`${name} model not loaded yet`);
      return null;
    }
  }

  static getPolarBear() { return this.getAnimal('polarBear'); }
  static getHippo() { return this.getAnimal('hippo'); }
  static getAlligator() { return this.getAnimal('alligator'); }
  static getPenguinKayak() { return this.getAnimal('penguinKayak'); }
  static getBrownBear() { return this.getAnimal('brownBear'); }
  static getMoose() { return this.getAnimal('moose'); }
  static getMonkey() { return this.getAnimal('monkey'); }
  static getDuckling() { return this.getAnimal('duckling'); }
}

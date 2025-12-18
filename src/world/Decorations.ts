import * as THREE from 'three';
import { DecorationRegistry } from './DecorationRegistry';
import { TreeFactory } from './factories/TreeFactory';
import { BushFactory } from './factories/BushFactory';
import { CactusFactory } from './factories/CactusFactory';
import { RockFactory } from './factories/RockFactory';
import { BottleFactory } from './factories/BottleFactory';
import { GLTFModelFactory } from './factories/GLTFModelFactory';
import { CycadFactory } from './factories/CycadFactory';
import { TreeFernFactory } from './factories/TreeFernFactory';

// Register factories
DecorationRegistry.register('tree', new TreeFactory());
DecorationRegistry.register('bush', new BushFactory());
DecorationRegistry.register('cactus', new CactusFactory());
DecorationRegistry.register('rock', new RockFactory());
DecorationRegistry.register('bottle', new BottleFactory());
DecorationRegistry.register('cycad', new CycadFactory());
DecorationRegistry.register('treeFern', new TreeFernFactory());
DecorationRegistry.register('boat', new GLTFModelFactory('assets/boat-model-1.glb'));
DecorationRegistry.register('polarBear', new GLTFModelFactory('assets/polar-bear-model-1.glb'));
DecorationRegistry.register('hippo', new GLTFModelFactory('assets/hippo-model-1.glb'));
DecorationRegistry.register('alligator', new GLTFModelFactory('assets/alligator-model-1.glb'));
DecorationRegistry.register('penguinKayak', new GLTFModelFactory('assets/penguin-kayak-model-1.glb'));
DecorationRegistry.register('brownBear', new GLTFModelFactory('assets/brown-bear-model-1.glb'));
DecorationRegistry.register('monkey', new GLTFModelFactory('assets/monkey-model-1.glb'));
DecorationRegistry.register('moose', new GLTFModelFactory('assets/moose-model-1.glb'));
DecorationRegistry.register('duckling', new GLTFModelFactory('assets/duckling-model-1.glb'));
DecorationRegistry.register('depot', new GLTFModelFactory('assets/depot-model-1.glb'));
DecorationRegistry.register('trex', new GLTFModelFactory('assets/t-rex-model-1.glb'));
DecorationRegistry.register('triceratops', new GLTFModelFactory('assets/triceratops-model-1.glb'));


export class Decorations {

  static async preload(): Promise<void> {
    await DecorationRegistry.loadAll();
  }

  static getBoat() {
    return DecorationRegistry.getFactory('boat').create();
  }

  static getTree(wetness: number, isSnowy: boolean = false, isLeafless: boolean = false): THREE.Group {
    return DecorationRegistry.getFactory('tree').create({ wetness, isSnowy, isLeafless });
  }

  static getBush(wetness: number): THREE.Group {
    return DecorationRegistry.getFactory('bush').create(wetness);
  }

  static getCactus(): THREE.Group {
    return DecorationRegistry.getFactory('cactus').create();
  }

  static getCycad(): THREE.Group {
    return DecorationRegistry.getFactory('cycad').create();
  }

  static getTreeFern(): THREE.Group {
    return DecorationRegistry.getFactory('treeFern').create();
  }

  static getRock(biome: 'desert' | 'forest' | 'ice' | 'swamp', size: number): THREE.Group {
    return DecorationRegistry.getFactory('rock').create({ size, biome });
  }

  static getBottle(color: number): THREE.Group {
    return DecorationRegistry.getFactory('bottle').create(color);
  }

  static getBottleFadeAnimation(): THREE.AnimationClip {
    return DecorationRegistry.getFactory('bottle').createAnimation('fade');
  }

  static getBottleDropAnimation(): THREE.AnimationClip {
    return DecorationRegistry.getFactory('bottle').createAnimation('drop');
  }

  static getBottleLeftArcAnimation(): THREE.AnimationClip {
    return DecorationRegistry.getFactory('bottle').createAnimation('arc-left');
  }

  static getBottleRightArcAnimation(): THREE.AnimationClip {
    return DecorationRegistry.getFactory('bottle').createAnimation('arc-right');
  }

  static getDepot(): THREE.Group {
    return DecorationRegistry.getFactory('depot').create();
  }

  // Animal getters
  private static getModelAndAnimations(name: string): { model: THREE.Group, animations: THREE.AnimationClip[] } | null {
    try {
      const factory = DecorationRegistry.getFactory(name);
      const model = factory.create();
      const animations = factory.getAllAnimations();
      return { model, animations };
    } catch (e) {
      console.warn(`${name} model not loaded yet`);
      return null;
    }
  }

  static getPolarBear() { return this.getModelAndAnimations('polarBear'); }
  static getHippo() { return this.getModelAndAnimations('hippo'); }
  static getAlligator() { return this.getModelAndAnimations('alligator'); }
  static getPenguinKayak() { return this.getModelAndAnimations('penguinKayak'); }
  static getBrownBear() { return this.getModelAndAnimations('brownBear'); }
  static getMoose() { return this.getModelAndAnimations('moose'); }
  static getMonkey() { return this.getModelAndAnimations('monkey'); }
  static getDuckling() { return this.getModelAndAnimations('duckling'); }
  static getTRex() { return this.getModelAndAnimations('trex'); }
  static getTriceratops() { return this.getModelAndAnimations('triceratops'); }
}

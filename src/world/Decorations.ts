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
import { RiverRockFactory } from './factories/RiverRockFactory';
import { FlowerFactory } from './factories/FlowerFactory';
import { DecorationInstance } from './factories/DecorationFactory';
import { MangroveFactory } from './factories/MangroveFactory';

export type { DecorationInstance };

// Register factories
DecorationRegistry.register('tree', new TreeFactory());
DecorationRegistry.register('bush', new BushFactory());
DecorationRegistry.register('cactus', new CactusFactory());
DecorationRegistry.register('rock', new RockFactory());
DecorationRegistry.register('bottle', new BottleFactory());
DecorationRegistry.register('cycad', new CycadFactory());
DecorationRegistry.register('treeFern', new TreeFernFactory());
DecorationRegistry.register('riverRock', new RiverRockFactory());
DecorationRegistry.register('flower', new FlowerFactory());
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
DecorationRegistry.register('brontosaurus', new GLTFModelFactory('assets/brontosaurus-model-1.glb'));
DecorationRegistry.register('pterodactyl', new GLTFModelFactory('assets/pterodactyl-model-1.glb'));
DecorationRegistry.register('dolphin', new GLTFModelFactory('assets/dolphin-model-1.glb'));
DecorationRegistry.register('mangrove', new MangroveFactory());



export class Decorations {

  static async preload(): Promise<void> {
    await DecorationRegistry.loadAll();
  }

  static getBoat() {
    return DecorationRegistry.getFactory('boat').create();
  }

  static getTreeInstance(wetness: number, isSnowy: boolean = false, isLeafless: boolean = false): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('tree') as TreeFactory;
    return factory.createInstance({ wetness, isSnowy, isLeafless });
  }

  static getBush(wetness: number): THREE.Group {
    return DecorationRegistry.getFactory('bush').create(wetness);
  }

  static getCactusInstance(): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('cactus') as CactusFactory;
    return factory.createInstance();
  }

  static getCycadInstance(): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('cycad') as CycadFactory;
    return factory.createInstance();
  }

  static getTreeFernInstance(): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('treeFern') as TreeFernFactory;
    return factory.createInstance();
  }

  static getRockInstance(biome: string, size: number): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('rock') as RockFactory;
    return factory.createInstance({ biome, size });
  }

  static getRiverRock(radius: number, hasPillars: boolean, biome: string): THREE.Group {
    return DecorationRegistry.getFactory('riverRock').create({ radius, hasPillars, biome });
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
  static getBrontosaurus() { return this.getModelAndAnimations('brontosaurus'); }
  static getPterodactyl() { return this.getModelAndAnimations('pterodactyl'); }
  static getDolphin() { return this.getModelAndAnimations('dolphin'); }

  // Flower Accessors
  static getFlowerInstance(): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('flower') as FlowerFactory;
    return factory.createInstance();
  }

  // Animal getters

  static getMangrove(scale: number = 1.0): THREE.Group {
    return DecorationRegistry.getFactory('mangrove').create({ scale });
  }
}

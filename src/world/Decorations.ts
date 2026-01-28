import * as THREE from 'three';
import { DecorationRegistry } from './DecorationRegistry';
import { BushFactory } from './factories/BushFactory';
import { CactusFactory } from './factories/CactusFactory';
import { RockFactory } from './factories/RockFactory';
import { BottleFactory } from './factories/BottleFactory';
import { GLTFModelFactory } from './factories/GLTFModelFactory';
import { CycadFactory } from './factories/CycadFactory';
import { TreeFernFactory } from './factories/TreeFernFactory';
import { RiverRockFactory } from './factories/RiverRockFactory';
import { DecorationInstance } from './factories/DecorationFactory';
import { MangroveFactory } from './factories/MangroveFactory';
import { LSystemTreeFactory, LSystemTreeInstanceOptions } from './factories/LSystemTreeFactory';
import { LSystemTreeKind } from './factories/LSystemTreeArchetypes';
import { LSystemFlowerFactory, LSystemFlowerInstanceOptions } from './factories/LSystemFlowerFactory';
import { LSystemFlowerKind } from './factories/LSystemFlowerArchetypes';

export type { DecorationInstance, LSystemTreeKind, LSystemTreeInstanceOptions, LSystemFlowerKind, LSystemFlowerInstanceOptions };

const DECORATION_FACTORIES = {
  'bush': new BushFactory(),
  'cactus': new CactusFactory(),
  'rock': new RockFactory(),
  'bottle': new BottleFactory(),
  'cycad': new CycadFactory(),
  'treeFern': new TreeFernFactory(),
  'riverRock': new RiverRockFactory(),
  'boat': new GLTFModelFactory('assets/boat-model-1.glb'),
  'polarBear': new GLTFModelFactory('assets/polar-bear-model-1.glb'),
  'hippo': new GLTFModelFactory('assets/hippo-model-1.glb'),
  'alligator': new GLTFModelFactory('assets/alligator-model-1.glb'),
  'penguinKayak': new GLTFModelFactory('assets/penguin-kayak-model-1.glb'),
  'brownBear': new GLTFModelFactory('assets/brown-bear-model-1.glb'),
  'monkey': new GLTFModelFactory('assets/monkey-model-1.glb'),
  'moose': new GLTFModelFactory('assets/moose-model-1.glb'),
  'duckling': new GLTFModelFactory('assets/duckling-model-1.glb'),
  'depot': new GLTFModelFactory('assets/depot-model-1.glb'),
  'trex': new GLTFModelFactory('assets/t-rex-model-1.glb'),
  'triceratops': new GLTFModelFactory('assets/triceratops-model-1.glb'),
  'brontosaurus': new GLTFModelFactory('assets/brontosaurus-model-1.glb'),
  'pterodactyl': new GLTFModelFactory('assets/pterodactyl-model-1.glb'),
  'butterfly': new GLTFModelFactory('assets/butterfly-model-1.glb'),
  'dolphin': new GLTFModelFactory('assets/dolphin-model-1.glb'),
  'bluebird': new GLTFModelFactory('assets/bluebird-model-1.glb'),
  'egret': new GLTFModelFactory('assets/egret-model-1.glb'),
  'swan': new GLTFModelFactory('assets/swan-model-1.glb'),
  'dragonfly': new GLTFModelFactory('assets/dragonfly-model-1.glb'),
  'snake': new GLTFModelFactory('assets/snake-model-1.glb'),
  'turtle': new GLTFModelFactory('assets/turtle-model-1.glb'),
  'unicorn': new GLTFModelFactory('assets/unicorn-model-1.glb'),
  'mangrove': new MangroveFactory(),
  'lsystem-tree': new LSystemTreeFactory(),
  'lsystem-flower': new LSystemFlowerFactory(),
} as const;

export type DecorationId = keyof typeof DECORATION_FACTORIES;

// Register factories
Object.entries(DECORATION_FACTORIES).forEach(([name, factory]) => {
  DecorationRegistry.register(name as DecorationId, factory as any);
});

export class Decorations {

  static isDecorationId(id: string): id is DecorationId {
    return id in DECORATION_FACTORIES;
  }

  static async preload(names?: DecorationId[]): Promise<void> {
    await DecorationRegistry.loadFiltered((name, factory) => {
      // Always load non-GLTF models as they may have internal caches that need initialization
      const isGLTF = factory instanceof GLTFModelFactory;
      const explicit = names && names.includes(name as DecorationId);
      return !isGLTF || explicit;
    });
  }

  /**
   * Triggers a load in the background without awaiting it.
   */
  static loadBackground(name: DecorationId): void {
    DecorationRegistry.load(name).catch(err => {
      console.error(`Failed to background load ${name}:`, err);
    });
  }

  /**
   * Ensures all assets in array are loaded.
   */
  static *ensureAllLoaded(names: DecorationId[]): Generator<void | Promise<void>, void, unknown> {
    for (const name of names) {
      const promise = DecorationRegistry.load(name);
      if (promise) yield promise;
    }
  }

  /**
   * The boat!
   */
  static getBoat() {
    return DecorationRegistry.getFactory('boat').create();
  }

  /**
   * Functions returning data to be used for instancing
   */
  static getLSystemTreeInstance(options: LSystemTreeInstanceOptions): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('lsystem-tree') as LSystemTreeFactory;
    return factory.createInstance(options);
  }

  static getLSystemFlowerInstance(options: LSystemFlowerInstanceOptions): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('lsystem-flower') as LSystemFlowerFactory;
    return factory.createInstance(options);
  }

  static getBushInstance(wetness: number): DecorationInstance[] {
    const factory = DecorationRegistry.getFactory('bush') as BushFactory;
    return factory.createInstance(wetness);
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

  /**
   * Functions that return models etc generally these are used as entities
   */
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

  static getMangrove(scale: number = 1.0): THREE.Group {
    return DecorationRegistry.getFactory('mangrove').create({ scale });
  }

  /** 
   * Functions that return a model and animations
   */
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
  static getButterfly() { return this.getModelAndAnimations('butterfly'); }
  static getDolphin() { return this.getModelAndAnimations('dolphin'); }
  static getBluebird() { return this.getModelAndAnimations('bluebird'); }
  static getEgret() { return this.getModelAndAnimations('egret'); }
  static getSwan() { return this.getModelAndAnimations('swan'); }
  static getDragonfly() { return this.getModelAndAnimations('dragonfly'); }
  static getSnake() { return this.getModelAndAnimations('snake'); }
  static getTurtle() { return this.getModelAndAnimations('turtle'); }
  static getUnicorn() { return this.getModelAndAnimations('unicorn'); }

  private static getModelAndAnimations(name: DecorationId): { model: THREE.Group, animations: THREE.AnimationClip[] } | null {
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
}

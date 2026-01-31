import { Decorations } from '../world/Decorations';
import { Alligator } from './obstacles/Alligator';
import { PolarBear } from './obstacles/PolarBear';
import { Hippo } from './obstacles/Hippo';
import { TRex } from './obstacles/TRex';
import { Brontosaurus } from './obstacles/Brontosaurus';
import { BrownBear } from './obstacles/BrownBear';
import { Monkey } from './obstacles/Monkey';
import { Moose } from './obstacles/Moose';
import { Triceratops } from './obstacles/Triceratops';
import { Dolphin } from './obstacles/Dolphin';
import { Duckling } from './obstacles/Duckling';
import { Butterfly } from './obstacles/Butterfly';
import { Pterodactyl } from './obstacles/Pterodactyl';
import { Bluebird } from './obstacles/Bluebird';
import { Egret } from './obstacles/Egret';
import { Dragonfly } from './obstacles/Dragonfly';
import { Snake } from './obstacles/Snake';
import { Turtle } from './obstacles/Turtle';
import { PenguinKayak } from './obstacles/PenguinKayak';
import { Swan } from './obstacles/Swan';
import { Unicorn } from './obstacles/Unicorn';
import * as THREE from 'three';

export interface EntityManifestEntry {
    name: string;
    model: () => { model: THREE.Object3D, animations: THREE.AnimationClip[] };
    scale: number;
}

export const ENTITY_MANIFEST: EntityManifestEntry[] = [
    { name: 'alligator', model: () => Decorations.getAlligator()!, scale: Alligator.MODEL_SCALE },
    { name: 'polarBear', model: () => Decorations.getPolarBear()!, scale: PolarBear.MODEL_SCALE },
    { name: 'hippo', model: () => Decorations.getHippo()!, scale: Hippo.MODEL_SCALE },
    { name: 'trex', model: () => Decorations.getTRex()!, scale: TRex.MODEL_SCALE },
    { name: 'brontosaurus', model: () => Decorations.getBrontosaurus()!, scale: Brontosaurus.MODEL_SCALE },
    { name: 'brownBear', model: () => Decorations.getBrownBear()!, scale: BrownBear.MODEL_SCALE },
    { name: 'monkey', model: () => Decorations.getMonkey()!, scale: Monkey.MODEL_SCALE },
    { name: 'moose', model: () => Decorations.getMoose()!, scale: Moose.MODEL_SCALE },
    { name: 'triceratops', model: () => Decorations.getTriceratops()!, scale: Triceratops.MODEL_SCALE },
    { name: 'dolphin', model: () => Decorations.getDolphin()!, scale: Dolphin.MODEL_SCALE },
    { name: 'duckling', model: () => Decorations.getDuckling()!, scale: Duckling.MODEL_SCALE },
    { name: 'butterfly', model: () => Decorations.getButterfly()!, scale: Butterfly.MODEL_SCALE },
    { name: 'pterodactyl', model: () => Decorations.getPterodactyl()!, scale: Pterodactyl.MODEL_SCALE },
    { name: 'bluebird', model: () => Decorations.getBluebird()!, scale: Bluebird.MODEL_SCALE },
    { name: 'egret', model: () => Decorations.getEgret()!, scale: Egret.MODEL_SCALE },
    { name: 'dragonfly', model: () => Decorations.getDragonfly()!, scale: Dragonfly.MODEL_SCALE },
    { name: 'snake', model: () => Decorations.getSnake()!, scale: Snake.MODEL_SCALE },
    { name: 'turtle', model: () => Decorations.getTurtle()!, scale: Turtle.MODEL_SCALE },
    { name: 'penguinKayak', model: () => Decorations.getPenguinKayak()!, scale: PenguinKayak.MODEL_SCALE },
    { name: 'swan', model: () => Decorations.getSwan()!, scale: Swan.MODEL_SCALE },
    { name: 'unicorn', model: () => Decorations.getUnicorn()!, scale: Unicorn.MODEL_SCALE }
];

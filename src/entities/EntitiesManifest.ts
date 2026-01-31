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
    model: () => THREE.Object3D;
    scale: number;
}

export const ENTITY_MANIFEST: EntityManifestEntry[] = [
    { name: 'alligator', model: () => Decorations.getAlligator()!.model, scale: Alligator.MODEL_SCALE },
    { name: 'polarBear', model: () => Decorations.getPolarBear()!.model, scale: PolarBear.MODEL_SCALE },
    { name: 'hippo', model: () => Decorations.getHippo()!.model, scale: Hippo.MODEL_SCALE },
    { name: 'trex', model: () => Decorations.getTRex()!.model, scale: TRex.MODEL_SCALE },
    { name: 'brontosaurus', model: () => Decorations.getBrontosaurus()!.model, scale: Brontosaurus.MODEL_SCALE },
    { name: 'brownBear', model: () => Decorations.getBrownBear()!.model, scale: BrownBear.MODEL_SCALE },
    { name: 'monkey', model: () => Decorations.getMonkey()!.model, scale: Monkey.MODEL_SCALE },
    { name: 'moose', model: () => Decorations.getMoose()!.model, scale: Moose.MODEL_SCALE },
    { name: 'triceratops', model: () => Decorations.getTriceratops()!.model, scale: Triceratops.MODEL_SCALE },
    { name: 'dolphin', model: () => Decorations.getDolphin()!.model, scale: Dolphin.MODEL_SCALE },
    { name: 'duckling', model: () => Decorations.getDuckling()!.model, scale: Duckling.MODEL_SCALE },
    { name: 'butterfly', model: () => Decorations.getButterfly()!.model, scale: Butterfly.MODEL_SCALE },
    { name: 'pterodactyl', model: () => Decorations.getPterodactyl()!.model, scale: Pterodactyl.MODEL_SCALE },
    { name: 'bluebird', model: () => Decorations.getBluebird()!.model, scale: Bluebird.MODEL_SCALE },
    { name: 'egret', model: () => Decorations.getEgret()!.model, scale: Egret.MODEL_SCALE },
    { name: 'dragonfly', model: () => Decorations.getDragonfly()!.model, scale: Dragonfly.MODEL_SCALE },
    { name: 'snake', model: () => Decorations.getSnake()!.model, scale: Snake.MODEL_SCALE },
    { name: 'turtle', model: () => Decorations.getTurtle()!.model, scale: Turtle.MODEL_SCALE },
    { name: 'penguinKayak', model: () => Decorations.getPenguinKayak()!.model, scale: PenguinKayak.MODEL_SCALE },
    { name: 'swan', model: () => Decorations.getSwan()!.model, scale: Swan.MODEL_SCALE },
    { name: 'unicorn', model: () => Decorations.getUnicorn()!.model, scale: Unicorn.MODEL_SCALE }
];

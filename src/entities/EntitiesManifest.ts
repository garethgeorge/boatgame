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
    { name: 'alligator', model: () => Decorations.getAlligator()!.model, scale: 3.0 },
    { name: 'polarBear', model: () => Decorations.getPolarBear()!.model, scale: 3.0 },
    { name: 'hippo', model: () => Decorations.getHippo()!.model, scale: 3.0 },
    { name: 'trex', model: () => Decorations.getTRex()!.model, scale: 6.0 },
    { name: 'brontosaurus', model: () => Decorations.getBrontosaurus()!.model, scale: 8.0 },
    { name: 'brownBear', model: () => Decorations.getBrownBear()!.model, scale: 3.0 },
    { name: 'monkey', model: () => Decorations.getMonkey()!.model, scale: 0.025 },
    { name: 'moose', model: () => Decorations.getMoose()!.model, scale: 0.1 },
    { name: 'triceratops', model: () => Decorations.getTriceratops()!.model, scale: 3.0 },
    { name: 'dolphin', model: () => Decorations.getDolphin()!.model, scale: 4.0 },
    { name: 'duckling', model: () => Decorations.getDuckling()!.model, scale: 1.0 },
    { name: 'butterfly', model: () => Decorations.getButterfly()!.model, scale: 1.0 },
    { name: 'pterodactyl', model: () => Decorations.getPterodactyl()!.model, scale: 3.0 },
    { name: 'bluebird', model: () => Decorations.getBluebird()!.model, scale: 2.0 },
    { name: 'egret', model: () => Decorations.getEgret()!.model, scale: 3.0 },
    { name: 'dragonfly', model: () => Decorations.getDragonfly()!.model, scale: 2.25 },
    { name: 'snake', model: () => Decorations.getSnake()!.model, scale: 3.0 },
    { name: 'turtle', model: () => Decorations.getTurtle()!.model, scale: 2.0 },
    { name: 'penguinKayak', model: () => Decorations.getPenguinKayak()!.model, scale: 2.0 },
    { name: 'swan', model: () => Decorations.getSwan()!.model, scale: 3.0 },
    { name: 'unicorn', model: () => Decorations.getUnicorn()!.model, scale: 6.0 }
];

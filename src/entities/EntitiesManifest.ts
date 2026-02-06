import { Decorations } from '../world/decorations/Decorations';
import { Boat } from './Boat';
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
import { GingerMan } from './obstacles/GingerMan';
import * as THREE from 'three';
import { BaseMangrove } from './obstacles/Mangrove';
import { MessageInABottle } from './obstacles/MessageInABottle';

export interface EntityManifestEntry {
    name: string;
    model: () => { model: THREE.Object3D, animations: THREE.AnimationClip[] } | null;
    params: { scale: number, angle?: number };
    frontZoneEndY?: number;
}

export const BOAT_MANIFEST: EntityManifestEntry = {
    name: 'boat',
    model: () => Decorations.getBoat(),
    params: Boat.MODEL_PARAMS,
    frontZoneEndY: Boat.FRONT_ZONE_END_Y
};

export const ENTITY_MANIFEST: EntityManifestEntry[] = [
    { name: 'alligator', model: () => Decorations.getAlligator()!, params: Alligator.MODEL_PARAMS },
    { name: 'polarBear', model: () => Decorations.getPolarBear()!, params: PolarBear.MODEL_PARAMS },
    { name: 'hippo', model: () => Decorations.getHippo()!, params: Hippo.MODEL_PARAMS },
    { name: 'trex', model: () => Decorations.getTRex()!, params: TRex.MODEL_PARAMS },
    { name: 'brontosaurus', model: () => Decorations.getBrontosaurus()!, params: Brontosaurus.MODEL_PARAMS },
    { name: 'brownBear', model: () => Decorations.getBrownBear()!, params: BrownBear.MODEL_PARAMS },
    { name: 'monkey', model: () => Decorations.getMonkey()!, params: Monkey.MODEL_PARAMS },
    { name: 'moose', model: () => Decorations.getMoose()!, params: Moose.MODEL_PARAMS },
    { name: 'triceratops', model: () => Decorations.getTriceratops()!, params: Triceratops.MODEL_PARAMS },
    { name: 'dolphin', model: () => Decorations.getDolphin()!, params: Dolphin.MODEL_PARAMS },
    { name: 'duckling', model: () => Decorations.getDuckling()!, params: Duckling.MODEL_PARAMS },
    { name: 'butterfly', model: () => Decorations.getButterfly()!, params: Butterfly.MODEL_PARAMS },
    { name: 'pterodactyl', model: () => Decorations.getPterodactyl()!, params: Pterodactyl.MODEL_PARAMS },
    { name: 'bluebird', model: () => Decorations.getBluebird()!, params: Bluebird.MODEL_PARAMS },
    { name: 'egret', model: () => Decorations.getEgret()!, params: Egret.MODEL_PARAMS },
    { name: 'dragonfly', model: () => Decorations.getDragonfly()!, params: Dragonfly.MODEL_PARAMS },
    { name: 'snake', model: () => Decorations.getSnake()!, params: Snake.MODEL_PARAMS },
    { name: 'turtle', model: () => Decorations.getTurtle()!, params: Turtle.MODEL_PARAMS },
    { name: 'penguinKayak', model: () => Decorations.getPenguinKayak()!, params: PenguinKayak.MODEL_PARAMS },
    { name: 'swan', model: () => Decorations.getSwan()!, params: Swan.MODEL_PARAMS },
    { name: 'unicorn', model: () => Decorations.getUnicorn()!, params: Unicorn.MODEL_PARAMS },
    { name: 'gingerman', model: () => Decorations.getGingerMan()!, params: GingerMan.MODEL_PARAMS },
    { name: 'messageInABottle', model: () => ({ model: Decorations.getBottle(0x88FF88), animations: [] }), params: { scale: 1 } },
    { name: 'mangrove', model: () => ({ model: Decorations.getMangrove(1), animations: [] }), params: { scale: 1 } },
];

import { Sprite } from "../simpleComponents/content.ts";
import { SpriteRenderer } from "../spriteRenderer.ts";
import {GameObject, getSprite} from "./player.ts";
import {vec2} from "gl-matrix";
import {CircleCollider} from "./circleCollider.ts";

const METEOR_KEYS = [
    "meteorBrown_big1",
    "meteorBrown_big2",
    "meteorBrown_big3",
    "meteorBrown_big4",
    "meteorBrown_med1",
    "meteorBrown_med3",
    "meteorGrey_big1",
    "meteorGrey_big2",
    "meteorGrey_big3",
    "meteorGrey_big4",
    "meteorGrey_med1",
    "meteorGrey_med2",
]

const METEOR_MIN_SPEED = .8;
const METEOR_MAX_SPEED = 2.5;

export class Obstacle implements GameObject {
    sprite: Sprite;
    active:boolean = true;
    speed:number = METEOR_MIN_SPEED + Math.random() * (METEOR_MAX_SPEED - METEOR_MIN_SPEED);
    rotation = Math.random() * Math.PI;
    rotationOrigin= vec2.fromValues(0.5, 0.5);
    rotationSpeed = (Math.random() - 0.5) * 0.035;
    public readonly collider: CircleCollider;

    constructor() {
        //use getSprite to get sprite from content object using enemy "colors from sheet.xml; and number from 1-5
        const key = METEOR_KEYS[Math.floor(Math.random() * METEOR_KEYS.length)];
        this.sprite = getSprite(key);
        this.collider = CircleCollider.fromRect(this.sprite.drawRect);
    }

    update(dt: number): void {
        this.sprite.drawRect.y += this.speed * dt;
        this.rotation += this.rotationSpeed * dt;
        this.collider.update(this.sprite.drawRect);
    }
    draw(renderer: SpriteRenderer) {
        renderer.drawSpriteSource(
            this.sprite.texture!,
            this.sprite.drawRect,
            this.sprite.sourceRect,
            undefined,
            this.rotation,
            this.rotationOrigin
        );
    }

    cleanup(): void {
        this.sprite.texture = undefined;
    }
}
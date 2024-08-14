// gameObject.ts
import { Content, Sprite } from "../simpleComponents/content.ts";
import {SpriteRenderer} from "../spriteRenderer.ts";
import {vec2} from "gl-matrix";
import {InputManager} from "../simpleComponents/inputManager.ts";
import {CircleCollider} from "./circleCollider.ts";
import { EffectManager } from "./effectManager.ts";


export interface GameObject {
    sprite: Sprite;
    update(dt:number): void;
    components?: { [key in ComponentType]?: IAction[] };
    draw(spriteRenderer: SpriteRenderer): void;
}

export enum ComponentType {
    Physics,
    PostRender
}


export interface IAction {
    type: ComponentType;
    performAction(dt:number,gameObject: GameObject): void;
}


//returns sprite that is not a part of the content object meaning it is tied to instance of the player
export const getSprite = (spriteName: string): Sprite => ({
    texture: Content.sprites[spriteName].texture,
    //how much of the texture to draw in drawRect
    sourceRect: Content.sprites[spriteName].sourceRect.copy(),
    //where to draw the sprite and how big it is
    drawRect: Content.sprites[spriteName].drawRect.copy(),
});



export class Player implements GameObject{
    sprite: Sprite;
    private moveDirection = vec2.create();
    private readonly velocity: number;
    public readonly collider: CircleCollider;
    public readonly effectManager: EffectManager;
    public readonly components?: { [key in ComponentType]?: IAction[] };


    //get reference to input manager to check for key presses
    constructor(spriteName: string, private inputManager: InputManager, readonly device: GPUDevice, private gameWidth: number, private gameHeight: number) {
        // this.sprite = new Sprite(Content.playerTexture, new Rect(0, 0, 99, 75), new Rect(0, 0, 99, 75));
        this.sprite = getSprite(spriteName);
        this.sprite.drawRect.x = 130;
        this.sprite.drawRect.y = 100;
        this.velocity = 5;
        //components:
        this.collider = CircleCollider.fromRect(this.sprite.drawRect);
        this.effectManager = new EffectManager(device, this.sprite);
        this.components = {
            [ComponentType.Physics]: [this.collider],
            [ComponentType.PostRender]: [this.effectManager]
        };
    }

    public clampToScreen() {
        this.sprite.drawRect.x = Math.max(0, Math.min(this.sprite.drawRect.x, this.gameWidth - this.sprite.drawRect.width));
        this.sprite.drawRect.y = Math.max(0, Math.min(this.sprite.drawRect.y, this.gameHeight - this.sprite.drawRect.height));
    }

    update(dt: number) {
        vec2.zero(this.moveDirection);

        if(this.inputManager.isKeyDown('w')) {
            this.moveDirection[1] = -1;
        }
        if(this.inputManager.isKeyDown('s')) {
            this.moveDirection[1] = 1;
        }
        if(this.inputManager.isKeyDown('a')) {
            this.moveDirection[0] = -1;
        }
        if(this.inputManager.isKeyDown('d')) {
            this.moveDirection[0] = 1;
        }

        // Normalize the move direction
        vec2.normalize(this.moveDirection, this.moveDirection);
        // Move the player
        this.sprite.drawRect.x += this.moveDirection[0] * this.velocity * dt;
        this.sprite.drawRect.y += this.moveDirection[1] * this.velocity * dt;
        this.clampToScreen();

        //perform components on the player
        const physicsComponents = this.components![ComponentType.Physics];
        if (physicsComponents) {
            for (const action of physicsComponents) {
                action.performAction(dt, this);
            }
        }
    }

    draw(renderer: SpriteRenderer) {
        renderer.drawSpriteSource(
            this.sprite.texture!,
            this.sprite.drawRect,
            this.sprite.sourceRect
        );
    }

}

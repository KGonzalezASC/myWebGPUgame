import {GameObject} from "./player.ts";
import { SpriteRenderer } from "../spriteRenderer.ts";
import {Content, Sprite} from "../simpleComponents/content.ts";
import {Rect} from "../simpleComponents/rect.ts";

export class Background implements GameObject {
    sprite: Sprite;
    sprite2: Sprite;
    backgroundSpeed = 5;

    constructor(gameWidth: number, private gameHeight: number) {
        //new sprite with content.bgTexture
        this.sprite = new Sprite(Content.bgTexture, new Rect(0, 0, gameWidth, gameHeight), new Rect(0, 0, gameWidth, gameHeight));
        this.sprite.drawRect.width = gameWidth;
        this.sprite.drawRect.height = gameHeight;

        //make second sprite with same texture for scrolling
        this.sprite2 = new Sprite(Content.bgTexture, new Rect(0, -gameHeight, gameWidth, gameHeight), new Rect(0, 0, gameWidth, gameHeight));
        this.sprite2.drawRect.width = gameWidth;
        this.sprite2.drawRect.height = gameHeight;
    }

    update(dt: number): void {
        this.sprite.drawRect.y += this.backgroundSpeed * dt;
        this.sprite2.drawRect.y = this.sprite.drawRect.y - this.sprite.drawRect.height;
        if (this.sprite.drawRect.y >= this.gameHeight) {
           const temp = this.sprite.drawRect;
              this.sprite.drawRect = this.sprite2.drawRect;
              this.sprite2.drawRect = temp;
        }
    }


    draw(renderer: SpriteRenderer) {
        renderer.drawSpriteSource(
            this.sprite.texture!,
            this.sprite.drawRect,
            this.sprite.sourceRect
        );
        renderer.drawSpriteSource(
            this.sprite2.texture!,
            this.sprite2.drawRect,
            this.sprite2.sourceRect
        );
    }

}
import {Rect} from "../simpleComponents/rect.ts";
import {SpriteRenderer} from "../spriteRenderer.ts";
import {Content} from "../simpleComponents/content.ts";

//set frame time dividded by frame rate of browser
const FRAME_TIME_MS = 400 / 120;

export class Explosion {
    public playing = false;
    private timeToNextFrame = 0;

    private sourceRect: Rect;
    private drawRect: Rect;

    private currentCol = 0;
    private currentRow = 0;

    private readonly cols = 4;
    private readonly rows = 4;

    constructor() {
        this.sourceRect = new Rect(0, 0, 400, 400);
        this.drawRect = new Rect(0, 0, 300, 300);
    }

    public play(drawRect: Rect) {
        this.playing = true;
        this.timeToNextFrame = 0;
        this.currentCol = 0;
        this.currentRow = 0;
        this.drawRect = drawRect.copy();
    }

    public update(dt: number) {
        if (!this.playing) return;

        this.timeToNextFrame += dt;

        if (this.timeToNextFrame >= FRAME_TIME_MS) {
            this.timeToNextFrame -= FRAME_TIME_MS;
            this.currentCol++;
            if (this.currentCol >= this.cols) {
                this.currentCol = 0;
                this.currentRow++;
                if (this.currentRow >= this.rows) {
                    this.currentRow = 0;
                    this.playing = false;
                }
            }
        }
    }

    public draw(spriteRenderer: SpriteRenderer) {
        const colOffset = this.currentCol * this.sourceRect.width;
        const rowOffset = this.currentRow * this.sourceRect.height;
        this.sourceRect.x = colOffset;
        this.sourceRect.y = rowOffset;

        spriteRenderer.drawSpriteSource(Content.explosionTexture,
            this.drawRect,
            this.sourceRect);
    }
}
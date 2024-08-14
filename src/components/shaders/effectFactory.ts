import {GreyFX} from "./greyFX.ts";
import {TextureFX} from "./textureFX.ts";
import {Texture} from "../simpleComponents/texture.ts";
import {Content} from "../simpleComponents/content.ts";
import {BlurFX} from "./blurFX.ts";
import {BloomFX} from "./bloomFX.ts";
import {BarberShopFX} from "./barberShopFX.ts";
import {WobbleFX} from "./wobbleFX.ts";

export interface PostProcessingEffect {
    init(): Promise<void>;
    draw(destinationTextureView: GPUTextureView, isSpriteFX?: boolean): void;
    screenTexture: Texture;
    updateScreenTexture?(texture: Texture): void;
}


export class EffectFactory {
    public readonly effects: PostProcessingEffect[] = [];
    public bloomFX: BloomFX | null = null;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    public async createEffect(type: string): Promise<PostProcessingEffect> {
        let effect: PostProcessingEffect;

        switch (type) {
            case 'greyFX':
                effect = new GreyFX(this.device, this.width, this.height);
                break;
            case 'textureFX':
                effect = new TextureFX(this.device, this.width, this.height);
                break;
            case 'blurFX':
                effect = new BlurFX(this.device, this.width, this.height);
                break;
            case 'barberShopFX':
                effect = new BarberShopFX(this.device, this.width, this.height);
                break;
            case 'bloomFX':
                effect = new BloomFX(this.device, this.width, this.height);
                this.bloomFX = effect as BloomFX;
                break;
            case 'wobbleFX':
                effect = new WobbleFX(this.device, this.width, this.height);
                break;
            default:
                throw new Error(`Unknown effect type: ${type}`);
        }

        await effect.init();
        this.effects.push(effect);
        //if textureFX is created, set the combine texture
        if(type === 'textureFX') {
            (effect as TextureFX).setCombineTexture(Content.iceTexture);
        }
        //console.log('EffectFactory: created effect', effect);
        return effect;
    }

    public getEffect(index: number): PostProcessingEffect {
        if (index < 0 || index >= this.effects.length) {
            throw new Error(`Invalid effect index: ${index}`);
        }
        return this.effects[index];
    }

}

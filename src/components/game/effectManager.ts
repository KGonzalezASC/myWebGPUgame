import {ComponentType, GameObject, IAction} from "./player.ts";
import { EffectFactory } from "../shaders/effectFactory.ts";
import {Texture} from "../simpleComponents/texture.ts";
import {Sprite} from "../simpleComponents/content.ts";

export class EffectManager implements IAction {
    type = ComponentType.PostRender;
    private effectFactory: EffectFactory;
    private effectTexture: Texture|null = null;
    private shaderSpriteTexture: Texture|null = null;


    constructor(private readonly device: GPUDevice, protected sprite: Sprite) {
        this.effectFactory = new EffectFactory(this.device, 1024, 1024);
    }

    public async initEffects(effectNames: string[]): Promise<void> {
        for (const effectName of effectNames) {
            try {
                await this.effectFactory.createEffect(effectName);

            } catch (error) {
                console.error(`Failed to initialize effect "${effectName}":`, error);
            }
        }
        this.sprite.texture = await Texture.createTextureCopy(this.device, this.sprite.texture!.texture); //copy the texture to avoid writing to the whole spriteSheet
        this.shaderSpriteTexture = await Texture.createTextureCopy(this.device, this.sprite.texture!.texture);
        this.effectTexture = await Texture.createEmptyTexture(this.device, 1024, 1024);
    }



    performAction(_:number, target: GameObject): void {
        this.drawSpriteFX(target.sprite);
    }

    drawSpriteFX(target: Sprite){
        const effects = this.effectFactory.effects;
        if (effects.length === 0) {
            return;
        }

        let currentTexture = this.shaderSpriteTexture!;
        for (const effect of effects) {
            effect.updateScreenTexture!(currentTexture);
            // use a temporary texture for the effect output
            const tempTextureView = this.effectTexture!.texture.createView();
            // Apply the effect
            effect.draw(tempTextureView, true);
            // Update currentTexture to be the output of the current effect
            currentTexture = this.effectTexture!;
        }

        // Apply the last effect output to the sprite texture
        const finalEffect = effects[effects.length - 1];
        finalEffect.updateScreenTexture!(currentTexture);
        finalEffect.draw(target.texture!.texture.createView(), true);
    }
}

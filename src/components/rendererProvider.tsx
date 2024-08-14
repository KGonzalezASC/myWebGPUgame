import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {Content} from "./simpleComponents/content.ts";
import {SpriteRenderer} from "./spriteRenderer.ts";
import {ComponentType, GameObject} from "./game/player.ts";
import {InputManager} from "./simpleComponents/inputManager.ts";
import {EffectFactory} from "./shaders/effectFactory.ts";
import {Texture} from "./simpleComponents/texture.ts";


interface WebGPURenderContextType {
    canvas: HTMLCanvasElement | null;
    context?: GPUCanvasContext;
    device?: GPUDevice;
    drawItems?: (items: GameObject[]) => void;  // Callback to draw items from app.tsx
    inputManager?: InputManager;
}


const WebGPURenderContext = createContext<WebGPURenderContextType>({ canvas: null });

export const useWebGPURenderContext = (): WebGPURenderContextType => {
    const context = useContext(WebGPURenderContext);
    if (!context) {
        throw new Error('useWebGPURenderContext must be used within a WebGPURenderContextProvider');
    }
    return context;
};

/**
 * This provider initializes the WebGPU context and device, and provides the context and device to its children.
 * @param canvasRef
 * @param children
 * @constructor
 */
export const RenderProvider: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement>; children: React.ReactNode }> = ({ canvasRef, children }) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const [context, setContext] = useState<GPUCanvasContext | undefined>();
    const [device, setDevice] = useState<GPUDevice | undefined>();
    // Store instance of SpriteRenderer, which handles the sprite pipeline, creating buffers,
    // and using those buffers in the bind group. Each texture has a unique pipeline,
    // and the renderer manages bind groups for each texture to handle their specific
    // textures and samplers.
    const spriteRendererRef = useRef<SpriteRenderer | null>(null);
    const effectFactoryRef = useRef<EffectFactory | null>(null);
    const inputManagerRef = useRef<InputManager>(new InputManager());
    const lastTimeRef = useRef<number>(performance.now());
    const postProcessTextureBloom = useRef<GPUTexture | null>(null);

    //useEffects run after the first render and after every update of the component
    useEffect(() => {
        const canvasElement = canvasRef.current;
        if (canvasElement && !canvas) {
            setCanvas(canvasElement);
            const gpuContext = canvasElement.getContext('webgpu');
            if (gpuContext) {
                setContext(gpuContext);
            } else {
                console.error('WebGPU not supported on your browser');
            }
        }
        //canvasref is stable so it wont change between renders unless the canvas is removed
    }, [canvasRef, canvas]);

    useEffect(() => {
        const initializeWebGPU = async () => {
            if (!canvas || !context || device) {
                return;
            }
            try {
                const [adapter] = await Promise.all([navigator.gpu.requestAdapter()]);
                if (!adapter) {
                    console.error('No adapter found');
                    return;
                }

                const device = await adapter.requestDevice();
                if (!device) {
                    console.error('Failed to request device');
                    return;
                }

                context.configure({
                    device: device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                });

                setDevice(device);await Content.loadAssets(device);
                // Buffer data is now handled in the SpriteRenderer
                //we create pipelines for each texture because each texture has its own pipeline since
                //each texture has its own bind group because each texture has its own texture and sampler
                spriteRendererRef.current = new SpriteRenderer(device, canvas.width, canvas.height);
                //in here we set up the index buffer and the projection view matrix buffer
                //the index buffer is used to draw the triangles for the sprites
                //the projection view matrix buffer is updated every frame to update the sprites position in the camera
                //the index buffer is created once and reused for all sprites
                //the vertex buffer is created for each batch draw call and reused for all sprites in that batch draw call depending on the number of sprites
                //and the number of batch draw calls we might need to create a new vertex buffer
                //the vertex buffer is created in the sprite renderer
                spriteRendererRef.current.initialize();
                effectFactoryRef.current = new EffectFactory(device, canvas.width, canvas.height);
                //always give empty texture to the color attachment to render to the screen
                postProcessTextureBloom.current = (await Texture.createEmptyTexture(device, canvas.width, canvas.height)).texture;
                //assign ScreenFXs here
                //await effectFactoryRef.current.createEffect('textureFX');
                //await effectFactoryRef.current.createEffect('bloomFX');
                await effectFactoryRef.current.createEffect('wobbleFX');
                //snowFX look into
                //await effectFactoryRef.current.createEffect('barberShopFX');
                //await effectFactoryRef.current.createEffect('greyFX');
                //await effectFactoryRef.current.createEffect('blurFX');

                if(effectFactoryRef.current!.bloomFX !== null){
                    //this can be also set in draw function to update the texture every frame
                    postProcessTextureBloom.current = effectFactoryRef.current!.bloomFX!.brightnessTexture.texture;
                }
                // u can assign sprites here
                // playerSpriteRef.current = Content.sprites["playerShip1_blue"];
            } catch (error) {
                console.error('Error initializing WebGPU:', error);
            }
        };
        initializeWebGPU();
    }, [canvas, context, device]);

    const gameUpdateLoop = (dt: number, items: GameObject[]) => {
        items.forEach((item) => {
            item.update(dt);
        });
    };

    //the draw function is called every frame after button click from the DrawingComponent in App.tsx
    const draw = useCallback(async (items: GameObject[]) => {
        if (!canvas || !context || !device || !spriteRendererRef.current) {
            console.error('Missing canvas, context, device, or Sprite Renderer');
            return;
        }

        const now = performance.now();
        let dt = (now - lastTimeRef.current) / 1000;
        dt = Math.min(dt, 1); // Cap dt to prevent large jumps due to switching tabs

        gameUpdateLoop(dt, items);
        //command encoder is needed every frame to encode the commands to the GPU
        const commandEncoder = device.createCommandEncoder();
        // Default texture view is just directly writing to the canvas
        let defaultTextureView: GPUTextureView | undefined;
        if (effectFactoryRef.current!.effects.length === 0) {
            defaultTextureView = context.getCurrentTexture().createView();
        }
        // Determine the initial texture view to render to
        const effectFactoryChainFirstTextureView = effectFactoryRef.current!.effects.length > 0
            ? effectFactoryRef.current!.effects[0].screenTexture.texture.createView()
            : defaultTextureView;

        //we are still writing to two textures in the render pass meaning that we can pass the brightness texture to the bloomFX in memory
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    //write to the first effects screen texture
                    view: effectFactoryChainFirstTextureView!,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 1, g: 1, b: 1, a: 1.0 },
                },
                //@location(1) brightness: This corresponds to the brightness output
                // used for bloom or other post-processing effects.
                {
                    view: postProcessTextureBloom.current!.createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 1, g: 1, b: 1, a: 1.0 },
                }
            ],
        });
        //implicity has pipeline for applyScreenFX.wgsl
        spriteRendererRef.current?.framePass(passEncoder);
        items.forEach((item) => {
            item.draw(spriteRendererRef.current!);
        });
        spriteRendererRef.current?.frameEnd();
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        //SCREENFX
        //Apply each post-processing effect sequentially
        //each effect.draw has its own encoder and render pass
        //based on the color attachment order in the render pass we get the combination of color and luminance because of how we blend in the sprite pipeline visually
        //the gpu renders to both textures in the render pass

        //in our config above we set that if there are FXs the first texture view is the first texture in the chain
        //since we wrote to it in the render pass with effectFactoryChainFirstTextureView
        //the output is written to it's screenTexture
        //The last effect in the chain writes to context.getCurrentTexture().createView(), which is the final output to the canvas.
        //since the brightness texture is set for bloomFX it is able to use the brightness texture as the input texture along with the snapshot of the previous effect
        //that is the output of the sprite renderer pass

        //The draw method of each effect sets up its render pass, reads from the previous effect’s screenTexture, and writes to its own screenTexture.
        effectFactoryRef.current?.effects.forEach((effect, index) => {
            //snapshot the state of the texture to use as the input texture for the next effect
            const nextTextureView = (index < effectFactoryRef.current!.effects.length - 1)
                ? effectFactoryRef.current!.effects[index + 1].screenTexture.texture.createView()
                : context.getCurrentTexture().createView();
            //the screen texture is set a bindgroup and has a new "screenwide" quad drawn over it to apply said FX
            effect.draw(nextTextureView);
        });
        //SPRITEFX
        items.forEach((item) => {
            const postRenderComponents = item.components?.[ComponentType.PostRender] || [];
            for(const postRenderComponent of postRenderComponents){
                postRenderComponent.performAction(now, item);
            }
        });

        window.requestAnimationFrame(() => draw(items));
    }, [canvas, context, device]);


    return (
        <WebGPURenderContext.Provider value={{ canvas, context, device, drawItems: draw, inputManager: inputManagerRef.current}}>
            {children}
        </WebGPURenderContext.Provider>
    );
};
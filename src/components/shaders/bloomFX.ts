import { Texture } from "../simpleComponents/texture.ts";
import { BufferUtils } from "../simpleComponents/bufferUtils.ts";
import shaderSource from './bloomFX.wgsl?raw';
import { PostProcessingEffect } from "./effectFactory.ts";
import {BloomBlurFX} from "./bloomBlurFX.ts";

export class BloomFX implements PostProcessingEffect {
    private gpuPipeline!: GPURenderPipeline;
    private gpuBuffer!: GPUBuffer;  // vertex buffer

    public screenTexture!: Texture;
    private screenTextureBindGroup!: GPUBindGroup;

    public brightnessTexture!: Texture;
    private brightnessTextureBindGroup!: GPUBindGroup;

    private textureBindGroupLayout!: GPUBindGroupLayout;
    private blurFX!: BloomBlurFX;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    private createBindGroup(texture: Texture): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.textureBindGroupLayout,
            entries: [
                { binding: 0, resource: texture.sampler },
                { binding: 1, resource: texture.texture.createView() }
            ]
        });
    }

    public async init() {
        [this.screenTexture, this.brightnessTexture] = await Promise.all([
            Texture.createEmptyTexture(this.device, this.width, this.height),
            Texture.createEmptyTexture(this.device, this.width, this.height)
        ]);

        this.gpuBuffer = BufferUtils.createVertexBuffer(this.device, BufferUtils.defaultVertexBufferData);

        this.textureBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
            ]
        });

        this.screenTextureBindGroup = this.createBindGroup(this.screenTexture);
        this.brightnessTextureBindGroup = this.createBindGroup(this.brightnessTexture);

        const shaderModule = this.device.createShaderModule({ code: shaderSource });

        this.gpuPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.textureBindGroupLayout,// screen texture group (0)
                    this.textureBindGroupLayout // brightness texture group (1)
                ]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [
                    {
                        arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x2" }, // x, y
                            { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" } // u, v
                        ]
                    }
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: "bgra8unorm" }]
            },
            primitive: { topology: "triangle-list" }
        });
        this.blurFX = new BloomBlurFX(this.device, this.width, this.height);
        await this.blurFX.init();
    }

    public updateScreenTexture(texture: Texture) {
        this.screenTexture = texture;
        this.screenTextureBindGroup = this.createBindGroup(this.screenTexture);
    }


    public draw(destinationTextureView: GPUTextureView) {
        this.blurFX.draw(this.brightnessTexture);
        this.blurFX.draw(this.brightnessTexture);
        this.blurFX.draw(this.brightnessTexture);
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: destinationTextureView, loadOp: "clear", storeOp: "store" }]
        });
        passEncoder.setPipeline(this.gpuPipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, this.screenTextureBindGroup);
        passEncoder.setBindGroup(1, this.brightnessTextureBindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }


}

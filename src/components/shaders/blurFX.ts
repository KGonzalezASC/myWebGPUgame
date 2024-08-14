import {Texture} from "../simpleComponents/texture.ts";
import {BufferUtils} from "../simpleComponents/bufferUtils.ts";
import shaderSource from './blurFX.wgsl?raw';
import {PostProcessingEffect} from "./effectFactory.ts";

export class BlurFX implements PostProcessingEffect {
    private gpuBuffer!: GPUBuffer;
    public  screenTexture!: Texture;
    public  screenTextureVerticalPass!: Texture;
    private textureBindGroupHorizontalPass!: GPUBindGroup;
    private textureBindGroupVerticalPass!: GPUBindGroup;
    private gpuHorizontalPassPipeline!: GPURenderPipeline;
    private gpuVerticalPassPipeline!: GPURenderPipeline;
    public  doHorizontalPass = true;
    public  doVerticalPass = true;
    private bindGroupLayout!: GPUBindGroupLayout;
    private uniformBuffer!: GPUBuffer;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    public async init() {
        [this.screenTexture, this.screenTextureVerticalPass] = await Promise.all([
            Texture.createEmptyTexture(this.device, this.width, this.height),
            Texture.createEmptyTexture(this.device, this.width, this.height)
        ]);

        this.gpuBuffer = BufferUtils.createVertexBuffer(this.device, BufferUtils.defaultVertexBufferData);

        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
            ]
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 4, // Size of an i32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.textureBindGroupHorizontalPass = this.createBindGroup(this.screenTexture);
        this.textureBindGroupVerticalPass = this.createBindGroup(this.screenTextureVerticalPass);

        this.gpuHorizontalPassPipeline = this.createPipeline(true);
        this.gpuVerticalPassPipeline = this.createPipeline(false);
    }

    private createPipeline(horizontal: boolean): GPURenderPipeline {
        const shaderModule = this.device.createShaderModule({ code: shaderSource });

        return this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [{
                    arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" },
                        { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: horizontal ? "fragmentMainHorizontal" : "fragmentMainVertical",
                targets: [{ format: "bgra8unorm" }]
            },
            primitive: { topology: "triangle-list" }
        });
    }

    private createBindGroup(texture: Texture): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: texture.sampler },
                { binding: 1, resource: texture.texture.createView() },
                { binding: 2, resource: { buffer: this.uniformBuffer } }
            ]
        });
    }

    public updateScreenTexture(texture: Texture) {
        this.screenTexture = texture;
        this.textureBindGroupHorizontalPass = this.createBindGroup(this.screenTexture);
        this.textureBindGroupVerticalPass = this.createBindGroup(this.screenTextureVerticalPass);
    }

    //if we are doing the horizontal pass we need to create a texture view
    //to render to for the vertical
    //its like how we do in renderprovider.tsx where we create a texture view with the first texture and
    //then use that texture view as the texture to render to for the next pass to use
    //if we are not doing the horizontal pass we use the destination texture view
    //as the texture view to render to for the vertical pass
    public draw(destinationTextureView: GPUTextureView, isSpriteFX: boolean = false) {
        const uniformData = new Int32Array([isSpriteFX ? 1 : 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        if (this.doHorizontalPass) {
            this.runPass(this.gpuHorizontalPassPipeline, this.textureBindGroupHorizontalPass, this.doVerticalPass ? this.screenTextureVerticalPass.texture.createView() : destinationTextureView);
        }

        if (this.doVerticalPass) {
            this.runPass(this.gpuVerticalPassPipeline, this.textureBindGroupVerticalPass, destinationTextureView);
        }
    }

    private runPass(pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, textureView: GPUTextureView) {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                { view: textureView, loadOp: "clear", storeOp: "store" }
            ]
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}

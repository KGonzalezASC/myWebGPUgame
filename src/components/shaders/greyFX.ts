import { Texture } from "../simpleComponents/texture.ts";
import { BufferUtils } from "../simpleComponents/bufferUtils.ts";
import shaderSource from './greyFX.wgsl?raw';
import { PostProcessingEffect } from "./effectFactory.ts";

export class GreyFX implements PostProcessingEffect {
    public screenTexture!: Texture;
    private gpuBuffer!: GPUBuffer;
    private textureBindGroup!: GPUBindGroup;
    private gpuPipeline!: GPURenderPipeline;
    private bindGroupLayout!: GPUBindGroupLayout;
    private uniformBuffer!: GPUBuffer;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    public async init() {
        this.screenTexture = await Texture.createEmptyTexture(this.device, this.width, this.height);

        this.gpuBuffer = BufferUtils.createVertexBuffer(this.device, BufferUtils.defaultVertexBufferData);

        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
            ]
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.textureBindGroup = this.createBindGroup(this.screenTexture);
        this.gpuPipeline = this.createPipeline();
    }

    private createPipeline(): GPURenderPipeline {
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
                entryPoint: "fragmentMain",
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
        //any time the screen texture changes we need to update the bind group
        this.textureBindGroup = this.createBindGroup(this.screenTexture);
    }

    public draw(destinationTextureView: GPUTextureView, isSpriteFX: boolean = false) {
        const uniformData = new Uint32Array([isSpriteFX ? 1 : 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            //if the destination has content we are clearing it (import for next frame)
            colorAttachments: [{ view: destinationTextureView, loadOp: "clear", storeOp: "store" }]
        });
        passEncoder.setPipeline(this.gpuPipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, this.textureBindGroup); //this is the current  texture being passed in
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}

import { Texture } from "../simpleComponents/texture.ts";
import { BufferUtils } from "../simpleComponents/bufferUtils.ts";
import shaderSource from './textureFX.wgsl?raw';
import { PostProcessingEffect } from "./effectFactory.ts";

export class TextureFX implements PostProcessingEffect {
    public screenTexture!: Texture;
    private gpuBuffer!: GPUBuffer;
    private screenTextureBindGroup!: GPUBindGroup;
    private gpuPipeline!: GPURenderPipeline;
    private combineTexture!: Texture;
    private combineTextureBindGroup!: GPUBindGroup;
    private textureBindGroupLayout!: GPUBindGroupLayout;
    private mixValue: number = 0.55;
    private mixValueBuffer!: GPUBuffer;
    private mixValueBindGroup!: GPUBindGroup;
    private isSpriteFXBuffer!: GPUBuffer;
    private isSpriteFXBindGroup!: GPUBindGroup;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    public setCombineTexture(texture: Texture) {
        this.combineTexture = texture;
        this.combineTextureBindGroup = this.createBindGroup(this.combineTexture);
    }

    public updateScreenTexture(texture: Texture) {
        this.screenTexture = texture;
        this.screenTextureBindGroup = this.createBindGroup(this.screenTexture);
    }

    public async init() {
        this.screenTexture = await Texture.createEmptyTexture(this.device, this.width, this.height);
        this.gpuBuffer = BufferUtils.createVertexBuffer(this.device, BufferUtils.defaultVertexBufferData);
        this.mixValueBuffer = BufferUtils.createUniformBuffer(this.device, new Float32Array([this.mixValue]));
        this.isSpriteFXBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.textureBindGroupLayout = this.createTextureBindGroupLayout();
        const mixValueBindGroupLayout = this.createUniformBindGroupLayout();
        const isSpriteFXBindGroupLayout = this.createUniformBindGroupLayout();

        this.screenTextureBindGroup = this.createBindGroup(this.screenTexture);
        this.mixValueBindGroup = this.createUniformBindGroup(mixValueBindGroupLayout, this.mixValueBuffer);
        this.isSpriteFXBindGroup = this.createUniformBindGroup(isSpriteFXBindGroupLayout, this.isSpriteFXBuffer);

        this.gpuPipeline = this.createPipeline([
            this.textureBindGroupLayout,
            this.textureBindGroupLayout,
            mixValueBindGroupLayout,
            isSpriteFXBindGroupLayout
        ]);
    }

    private createTextureBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
            ]
        });
    }

    private createUniformBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} }]
        });
    }

    private createBindGroup(texture: Texture): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.textureBindGroupLayout,
            entries: [
                { binding: 0, resource: texture.sampler },
                { binding: 1, resource: texture.texture.createView() }
            ]
        });
    }

    private createUniformBindGroup(layout: GPUBindGroupLayout, buffer: GPUBuffer): GPUBindGroup {
        return this.device.createBindGroup({
            layout,
            entries: [{ binding: 0, resource: { buffer, offset: 0, size: buffer.size } }]
        });
    }

    private createPipeline(bindGroupLayouts: GPUBindGroupLayout[]): GPURenderPipeline {
        const shaderModule = this.device.createShaderModule({ code: shaderSource });
        return this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts }),
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

    public draw(destinationTextureView: GPUTextureView, isSpriteFX: boolean = false) {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: destinationTextureView, loadOp: "clear", storeOp: "store" }]
        });

        this.device.queue.writeBuffer(this.mixValueBuffer, 0, new Float32Array([this.mixValue]));
        this.device.queue.writeBuffer(this.isSpriteFXBuffer, 0, new Int32Array([isSpriteFX ? 1 : 0]));

        passEncoder.setPipeline(this.gpuPipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, this.screenTextureBindGroup);
        passEncoder.setBindGroup(1, this.combineTextureBindGroup);
        passEncoder.setBindGroup(2, this.mixValueBindGroup);
        passEncoder.setBindGroup(3, this.isSpriteFXBindGroup);
        passEncoder.draw(6, 1, 0, 0);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}

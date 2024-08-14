import { Texture } from "../simpleComponents/texture.ts";
import { BufferUtils } from "../simpleComponents/bufferUtils.ts";
import shaderSource from './wobbleFX.wgsl?raw';
import { PostProcessingEffect } from "./effectFactory.ts";

export class WobbleFX implements PostProcessingEffect {
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
            size: 4 * Float32Array.BYTES_PER_ELEMENT * 2, // 4 bytes (time) + 4 bytes (padding) = 2 elements
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
        this.textureBindGroup = this.createBindGroup(this.screenTexture);
    }

    public draw(destinationTextureView: GPUTextureView) {
        const time = performance.now() / 1000; // Example time value

        const uniformData = new Float32Array([
            time,
            0.0,            // Padding
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);


        // Create a command encoder and render pass encoder
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: destinationTextureView, loadOp: "clear", storeOp: "store" }]
        });

        // Set the pipeline, vertex buffer, and bind group
        passEncoder.setPipeline(this.gpuPipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, this.textureBindGroup);

        // Draw the full-screen quad
        passEncoder.draw(6, 1, 0, 0);
        passEncoder.end();

        // Submit the commands to the GPU
        this.device.queue.submit([commandEncoder.finish()]);
    }
}

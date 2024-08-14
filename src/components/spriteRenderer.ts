import { Texture } from "./simpleComponents/texture.ts";
import { Rect } from "./simpleComponents/rect.ts";
import { SpritePipeline } from "./spritePipeline.ts";
import { Camera } from "./simpleComponents/camera.ts";
import { BufferUtils } from "./simpleComponents/bufferUtils.ts";
import { Color } from "./simpleComponents/color.ts";
import { mat2d, vec2 } from 'gl-matrix';

const MAX_NUMBER_OF_SPRITES = 1000;
const FLOAT_PER_VERTEX = 7;
const FLOATS_PER_SPRITE = 4 * FLOAT_PER_VERTEX;
const INIDICES_PER_SPRITE = 6; // 2 triangles per sprite cause square

//Each BatchDrawCall contains a vertex buffer that holds the vertex data
//for all sprites in the batch.
export class BatchDrawCall {
    // This constructor having a pipeline as a parameter means that the batch draw call is associated with a pipeline.
    // This is because the pipeline is created for each texture.
    constructor(public pipeline: SpritePipeline) { }
    public vertexData = new Float32Array(MAX_NUMBER_OF_SPRITES * FLOATS_PER_SPRITE);
    public instanceCount = 0;
}

export class SpriteRenderer {
    private currentTexture: Texture | null = null;
    private indexBuffer!: GPUBuffer;
    private projectionViewMatrixBuffer!: GPUBuffer;
    private camera: Camera;
    private passEncoder!: GPURenderPassEncoder;
    private defaultColor:Color = new Color();


    private rotationMatrix = mat2d.create();
    private rotationOrigin = vec2.create();
    //these are the 4 corners of the sprite used to rotate the sprite
    //preallocated to avoid creating new vectors every frame
    private p0 = vec2.create();
    private p1 = vec2.create();
    private p2 = vec2.create();
    private p3 = vec2.create();


    /**
     * Pipelines created for each texture.
     */
    private pipelinesPerTexture: { [id: string]: SpritePipeline } = {};

    /**
     * The draw calls per specific texture.
     * increasing batch call does not increment the number of vertex buffers but reuses the same vertex buffer unless we bypass the max number of sprites.
     * each batch draw call has a vertex data which is written to the vertex buffer.
     */
    private batchDrawCallPerTexture: { [id: string]: Array<BatchDrawCall> } = {};

    /**
     * The buffers which are currently allocated and used for vertex data.
     * When a buffer is not used anymore it is pushed back to this array.
     * This way we can reuse the buffers.
     * There is a buffer for each sprite but since both are square we do not increase the number of index buffers.
     * We just reuse the same index buffer.
     * if we bypass the max number of sprites, we create a new batch draw call which
     * creates a new vertex buffer.
     */
    private allocatedVertexBuffers: Array<GPUBuffer> = [];

    constructor(private device: GPUDevice, private width: number, private height: number) {
        //the camera is used to update the projection view matrix buffer every frame to update the sprites position in the camera
        //it is created once and reused across frames
        this.camera = new Camera(this.width, this.height);
    }

    private setupIndexBuffer = () => {
        const data = new Uint16Array(MAX_NUMBER_OF_SPRITES * INIDICES_PER_SPRITE);

        for (let i = 0; i < MAX_NUMBER_OF_SPRITES; i++) {
            // t1
            data[i * INIDICES_PER_SPRITE] = i * 4;
            data[i * INIDICES_PER_SPRITE + 1] = i * 4 + 1;
            data[i * INIDICES_PER_SPRITE + 2] = i * 4 + 2;

            // t2
            data[i * INIDICES_PER_SPRITE + 3] = i * 4 + 2;
            data[i * INIDICES_PER_SPRITE + 4] = i * 4 + 3;
            data[i * INIDICES_PER_SPRITE + 5] = i * 4;
        }

        this.indexBuffer = BufferUtils.createIndexBuffer(this.device, data);
    };

    public initialize = () => {
        // Uniform buffers are used to pass data to the shaders for data that is constant for the entire frame read-only.
        this.projectionViewMatrixBuffer = BufferUtils.createUniformBuffer(this.device, new Float32Array(16));
        // Index buffer helps to draw the triangles for the sprites by reusing the vertices.
        //even if we bypass the max number of sprites, we do not create a new index buffer.
        this.setupIndexBuffer();
    };

    // It updates the camera.
    // It creates a batch draw call per texture.
    // Called every frame.
    public framePass = (passEncoder: GPURenderPassEncoder) => {
        //a pass encoder is created for each frame so we need to update the reference to the current pass encoder
        this.passEncoder = passEncoder;
        // Clear the batch draw calls per texture.
        this.batchDrawCallPerTexture = {};

        //set current texture to null
        this.currentTexture = null;

        this.camera.update();

        this.device.queue.writeBuffer(
            this.projectionViewMatrixBuffer,
            0,
            this.camera.projectionViewMatrix as Float32Array
        );
    };

   //Initial State: No BatchDrawCall exists.
   // First Sprite: A BatchDrawCall is created, and the first sprite's vertex data
   // is added to its vertex buffer.
   // Subsequent Sprites: Each subsequent sprite's vertex data is added to
   // the current BatchDrawCall.
   // Batch Full: When the batch reaches MAX_NUMBER_OF_SPRITES (e.g., 1000),
   // a new BatchDrawCall is created, and subsequent sprites are added to this new batch.
   // Frame End: At the end of the frame, all batches are drawn. If there are two batches (because you have 500 sprites, which fit into one batch), two draw calls are issued.


    //draws sprite for specific texture and rect
    public drawSprite = (texture: Texture, rect: Rect) => {
        if (this.currentTexture !== texture) {
            this.currentTexture = texture;

            //Each texture has a unique pipeline, which means each texture
            //could use a different set of shaders and GPU states.
            let pipeline = this.pipelinesPerTexture[texture.id];
            if (!pipeline) {
                // Create once per texture. a pipeline is generally created once and reused across frames
                pipeline = SpritePipeline.create(this.device, texture, this.projectionViewMatrixBuffer);
                //cache the pipeline for the texture
                this.pipelinesPerTexture[texture.id] = pipeline;
            }
        }

        if (!this.batchDrawCallPerTexture[texture.id]) {
            this.batchDrawCallPerTexture[texture.id] = [];
        }
        // we are getting the last batch draw call for the texture
        const arrayOfBatchCalls = this.batchDrawCallPerTexture[texture.id];
        let batchDrawCall = arrayOfBatchCalls[arrayOfBatchCalls.length - 1];
        // If there is no batch draw call or the instance count is greater than the max number of sprites
        // then create a new batch draw call.
        if (!batchDrawCall || batchDrawCall.instanceCount >= MAX_NUMBER_OF_SPRITES) {
            batchDrawCall = new BatchDrawCall(this.pipelinesPerTexture[texture.id]);
            this.batchDrawCallPerTexture[texture.id].push(batchDrawCall);
        }

        const i = batchDrawCall.instanceCount * FLOATS_PER_SPRITE;

        // Top left
        batchDrawCall.vertexData[i] = rect.x;
        batchDrawCall.vertexData[1 + i] = rect.y;
        batchDrawCall.vertexData[2 + i] = 0.0;
        batchDrawCall.vertexData[3 + i] = 0.0;
        batchDrawCall.vertexData[4 + i] = 1.0;
        batchDrawCall.vertexData[5 + i] = 1.0;
        batchDrawCall.vertexData[6 + i] = 1.0;

        // Top right
        batchDrawCall.vertexData[7 + i] = rect.x + rect.width;
        batchDrawCall.vertexData[8 + i] = rect.y;
        batchDrawCall.vertexData[9 + i] = 1.0;
        batchDrawCall.vertexData[10 + i] = 0.0;
        batchDrawCall.vertexData[11 + i] = 1.0;
        batchDrawCall.vertexData[12 + i] = 1.0;
        batchDrawCall.vertexData[13 + i] = 1.0;

        // Bottom right
        batchDrawCall.vertexData[14 + i] = rect.x + rect.width;
        batchDrawCall.vertexData[15 + i] = rect.y + rect.height;
        batchDrawCall.vertexData[16 + i] = 1.0;
        batchDrawCall.vertexData[17 + i] = 1.0;
        batchDrawCall.vertexData[18 + i] = 1.0;
        batchDrawCall.vertexData[19 + i] = 1.0;
        batchDrawCall.vertexData[20 + i] = 1.0;

        // Bottom left
        batchDrawCall.vertexData[21 + i] = rect.x;
        batchDrawCall.vertexData[22 + i] = rect.y + rect.height;
        batchDrawCall.vertexData[23 + i] = 0.0;
        batchDrawCall.vertexData[24 + i] = 1.0;
        batchDrawCall.vertexData[25 + i] = 1.0;
        batchDrawCall.vertexData[26 + i] = 1.0;
        batchDrawCall.vertexData[27 + i] = 1.0;

        batchDrawCall.instanceCount++;
    };


    public drawSpriteSource = (texture: Texture, rect: Rect, sourceRect: Rect, color: Color = this.defaultColor, rt=0, rtAnchor: vec2|null=null) => {
        if (this.currentTexture !== texture) {
            this.currentTexture = texture;

            //Each texture has a unique pipeline, which means each texture
            //could use a different set of shaders and GPU states.
            let pipeline = this.pipelinesPerTexture[texture.id];
            if (!pipeline) {
                // Create once per texture. a pipeline is generally created once and reused across frames
                pipeline = SpritePipeline.create(this.device, texture, this.projectionViewMatrixBuffer);
                //cache the pipeline for the texture
                this.pipelinesPerTexture[texture.id] = pipeline;
            }
        }

        if (!this.batchDrawCallPerTexture[texture.id]) {
            this.batchDrawCallPerTexture[texture.id] = [];
        }
        // we are getting the last batch draw call for the texture
        const arrayOfBatchCalls = this.batchDrawCallPerTexture[texture.id];
        let batchDrawCall = arrayOfBatchCalls[arrayOfBatchCalls.length - 1];
        // If there is no batch draw call or the instance count is greater than the max number of sprites
        // then create a new batch draw call.
        if (!batchDrawCall || batchDrawCall.instanceCount >= MAX_NUMBER_OF_SPRITES) {
            batchDrawCall = new BatchDrawCall(this.pipelinesPerTexture[texture.id]);
            this.batchDrawCallPerTexture[texture.id].push(batchDrawCall);
        }

        const i = batchDrawCall.instanceCount * FLOATS_PER_SPRITE;
        //from texture coordinates to uv coordinates (0-1)
        const u0 = sourceRect.x / texture.width;
        const v0 = sourceRect.y / texture.height;
        const u1 = (sourceRect.x + sourceRect.width) / texture.width;
        const v1 = (sourceRect.y + sourceRect.height) / texture.height;
        vec2.set(this.p0, rect.x, rect.y);
        vec2.set(this.p1, rect.x + rect.width, rect.y);
        vec2.set(this.p2, rect.x + rect.width, rect.y + rect.height);
        vec2.set(this.p3, rect.x, rect.y + rect.height);

        if (rt !== 0) {
            if (rtAnchor === null) {
                vec2.copy(this.rotationOrigin, this.p0);
            } else {
                this.rotationOrigin[0] = rtAnchor[0] * rect.width + this.p0[0];
                this.rotationOrigin[1] = rtAnchor[1] * rect.height + this.p0[1];
            }

            mat2d.identity(this.rotationMatrix);
            mat2d.translate(this.rotationMatrix, this.rotationMatrix, this.rotationOrigin);
            mat2d.rotate(this.rotationMatrix, this.rotationMatrix, rt);
            mat2d.translate(this.rotationMatrix, this.rotationMatrix, [-this.rotationOrigin[0], -this.rotationOrigin[1]]);
            //apply rotation to the 4 corners of the sprite
            vec2.transformMat2d(this.p0, this.p0, this.rotationMatrix);
            vec2.transformMat2d(this.p1, this.p1, this.rotationMatrix);
            vec2.transformMat2d(this.p2, this.p2, this.rotationMatrix);
            vec2.transformMat2d(this.p3, this.p3, this.rotationMatrix);
        }
        // Top left
        batchDrawCall.vertexData.set([this.p0[0], this.p0[1], u0, v0, color.r, color.g, color.b], i);
        // Top right
        batchDrawCall.vertexData.set([this.p1[0], this.p1[1], u1, v0, color.r, color.g, color.b], i + 7);
        // Bottom right
        batchDrawCall.vertexData.set([this.p2[0], this.p2[1], u1, v1, color.r, color.g, color.b], i + 14);
        // Bottom left
        batchDrawCall.vertexData.set([this.p3[0], this.p3[1], u0, v1, color.r, color.g, color.b], i + 21);

        batchDrawCall.instanceCount++;
        //old code that uses vectors instead of matrix
        // if(rt!=0){
        //     //rotate the sprite around the center
        //     //vec2.copy is used to copy the value of v0 to rotationOrigin
        //     if(rtAnchor==null){
        //         vec2.copy(this.rotationOrigin, this.v0);
        //     }
        //     else{
        //         //normalized coordinates
        //         this.rotationOrigin[0] = rtAnchor[0] * rect.width + this.v0[0];
        //         this.rotationOrigin[1] = rtAnchor[1] * rect.height + this.v0[1];
        //     }
        //     vec2.rotate(this.v0, this.v0, this.rotationOrigin, rt);
        //     vec2.rotate(this.v1, this.v1, this.rotationOrigin, rt);
        //     vec2.rotate(this.v2, this.v2, this.rotationOrigin, rt);
        //     vec2.rotate(this.v3, this.v3, this.rotationOrigin, rt);
        // }
        //
        // // Top left
        // batchDrawCall.vertexData[i] = this.v0[0];
        // batchDrawCall.vertexData[1 + i] = this.v0[1];
        // batchDrawCall.vertexData[2 + i] = u0;
        // batchDrawCall.vertexData[3 + i] = v0;
        // batchDrawCall.vertexData[4 + i] = color.r;
        // batchDrawCall.vertexData[5 + i] = color.g;
        // batchDrawCall.vertexData[6 + i] = color.b;
        //
        // // Top right
        // batchDrawCall.vertexData[7 + i] = this.v1[0];
        // batchDrawCall.vertexData[8 + i] = this.v1[1];
        // batchDrawCall.vertexData[9 + i] = u1;
        // batchDrawCall.vertexData[10 + i] = v0;
        // batchDrawCall.vertexData[11 + i] = color.r;
        // batchDrawCall.vertexData[12 + i] = color.g;
        // batchDrawCall.vertexData[13 + i] = color.b;
        //
        // // Bottom right
        // batchDrawCall.vertexData[14 + i] = this.v2[0];
        // batchDrawCall.vertexData[15 + i] = this.v2[1];
        // batchDrawCall.vertexData[16 + i] = u1;
        // batchDrawCall.vertexData[17 + i] = v1;
        // batchDrawCall.vertexData[18 + i] = color.r;
        // batchDrawCall.vertexData[19 + i] = color.g;
        // batchDrawCall.vertexData[20 + i] = color.b;
        //
        // // Bottom left
        // batchDrawCall.vertexData[21 + i] = this.v3[0];
        // batchDrawCall.vertexData[22 + i] = this.v3[1];
        // batchDrawCall.vertexData[23 + i] = u0;
        // batchDrawCall.vertexData[24 + i] = v1;
        // batchDrawCall.vertexData[25 + i] = color.r;
        // batchDrawCall.vertexData[26 + i] = color.g;
        // batchDrawCall.vertexData[27 + i] = color.b;
        // batchDrawCall.instanceCount++;
    };


    //now that we have all the vertex data for each sprite in the batch draw calls
    //we can draw them to the screen and create vertex buffers for each batch draw call
    public frameEnd = () => {
        const usedVertexBuffers = [];

        for (const key in this.batchDrawCallPerTexture) {
            const arrayOfBatchDrawCalls = this.batchDrawCallPerTexture[key];
            //for each batch draw call, we create a vertex buffer and write the vertex data to it
            for (const batchDrawCall of arrayOfBatchDrawCalls) {
                if (batchDrawCall.instanceCount === 0) continue;

                let vertexBuffer = this.allocatedVertexBuffers.pop();
                if (!vertexBuffer) {
                    vertexBuffer = BufferUtils.createVertexBuffer(this.device, batchDrawCall.vertexData);
                } else {
                    this.device.queue.writeBuffer(vertexBuffer, 0, batchDrawCall.vertexData);
                }

                usedVertexBuffers.push(vertexBuffer);
                const spritePipeline = batchDrawCall.pipeline;

                // Drawing
                this.passEncoder.setPipeline(spritePipeline.pipeline);
                this.passEncoder.setIndexBuffer(this.indexBuffer, "uint16");
                this.passEncoder.setVertexBuffer(0, vertexBuffer);
                this.passEncoder.setBindGroup(0, spritePipeline.projectionViewBindGroup);
                this.passEncoder.setBindGroup(1, spritePipeline.textureBindGroup);
                this.passEncoder.drawIndexed(6 * batchDrawCall.instanceCount); // Draw 6 vertices per instance
            }
        }

        for (const vertexBuffer of usedVertexBuffers) {
            this.allocatedVertexBuffers.push(vertexBuffer);
        }
    };
}

import { mat4 } from "gl-matrix";

export class Camera{
    private projection!: mat4;
    private view!: mat4;

    public projectionViewMatrix: mat4;

    constructor(public width: number, public height: number) {
        this.projectionViewMatrix = mat4.create();
        this.update();
    }

    public update(){
        //since we are using a 2d camera we can just look at the z axis
        this.view = mat4.lookAt(mat4.create(), [0, 0, 1], [0, 0, 0], [0, 1, 0]);
        this.projection = mat4.ortho(mat4.create(), 0, this.width, this.height, 0, -1, 1);


        mat4.multiply(this.projectionViewMatrix, this.projection, this.view);
    }
}
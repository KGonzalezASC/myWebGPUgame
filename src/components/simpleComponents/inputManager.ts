export class InputManager{
    //is
    private keyDown: { [key: string]: boolean } = {};

    constructor() {
        window.addEventListener('keydown', (e)=>this.keyDown[e.key] = true);
        window.addEventListener('keyup', (e)=>this.keyDown[e.key] = false);
    }

    isKeyDown(key: string): boolean {
        return this.keyDown[key] || false;
    }

    isKeyUp(key: string): boolean {
        return !this.keyDown[key] || false;
    }

    //start queeing inputs eventually..
}
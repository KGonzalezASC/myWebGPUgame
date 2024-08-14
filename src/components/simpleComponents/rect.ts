export class Rect
{
    constructor(public x: number=0,public y: number=0,public width: number=0, public height: number=0)
    {
    }
    //copy by value
    copy(): Rect
    {
        return new Rect(this.x, this.y, this.width, this.height);
    }

    offset = (number: number, number2: number) => {
        return new Rect(this.x + number, this.y + number2, this.width, this.height);
    }
}
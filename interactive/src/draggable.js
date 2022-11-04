export default function draggable(getXY, setXY, ctmNode) {
    return element => {
        element.style.cursor = "grab";
        let startX, startY, refX, refY, down;
        element.onpointerdown = event => {
            event.stopPropagation();
            element.setPointerCapture(event.pointerId);
            let { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform((ctmNode || element.parentNode).getCTM().inverse());
            [refX, refY] = getXY();
            startX = x;
            startY = y;
            down = true;
            console.log("start", refX, refY, startX, startY);
        };

        element.onpointermove = event => {
            let { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform((ctmNode || element.parentNode).getCTM().inverse());
            if (down) setXY(x - startX + refX, y - startY + refY);
        };

        element.onpointerup = event => {
            down = false;
            element.releasePointerCapture(event.pointerId);
        };
    };
}

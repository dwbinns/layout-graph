import Graph from "dag";
import draggable from "./draggable.js";
import parseDOT, { parseRecord } from "dag/dot";
import AutoMap from "auto-creating-map";
import { SVG, style, attr, Data } from "ui-io";
import controls from "./controls.js";
import x11colors from "./x11colors.js";
const { g, rect, text, path, svg, defs, marker, filter, feDropShadow } = SVG(document);


function identity(position, location) {
    return [position, location];
}

function formatColour(name, defaultColour) {
    let colour = x11colors.get(name);
    if (!colour) return defaultColour;
    return "#" + colour.map(v => v.toString(16).padStart(2, "0")).join("");
}

class SVGPanZoomContainer {
    constructor() {
        this.container = g();
        this.graph = new Graph(identity, identity);
        this.node = svg(this.container,
            attr({ viewBox: "0 0 200 200" }),
        );

        this.node.addEventListener("wheel", event => {
            let { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(this.container.getCTM().inverse());
            let zoom = 2 ** (- event.deltaY / 1000);
            console.log(zoom, event.deltaX, event.deltaY);
            let zoomTransform = this.container.ownerSVGElement.createSVGTransform();
            let m2 = this.container.ownerSVGElement.createSVGMatrix().translate(x, y).scale(zoom, zoom).translate(-x, -y);
            zoomTransform.setMatrix(m2);
            this.container.transform.baseVal.appendItem(zoomTransform);
            this.container.transform.baseVal.consolidate();
            console.log(this.container.transform);
        });

        draggable(() => [0, 0], (x, y) => {
            let translateTransform = this.container.ownerSVGElement.createSVGTransform();
            translateTransform.setTranslate(x, y);
            this.container.transform.baseVal.appendItem(translateTransform);
            this.container.transform.baseVal.consolidate();
        }, this.container)(this.node);
    }
}

class SVGChart {

    autoUpdate = true;

    constructor() {
        this.container = g();
        this.node = g(
            defs(
                marker(
                    attr({ id: "arrow", viewBox: "0 0 6 6", refX: 3, refY: 3, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }),
                    path(attr({ d: "M 0 0 L 6 3 L 0 6 L 1 3 z" }))
                ),
                filter(attr({ id: "selected" }),
                    feDropShadow(attr({ dx: 0, dy: 0, stdDeviation: "0.5", "flood-color": "red" }))
                )
            ),
            this.container
        );
        this.resetGraph();
    }

    resetGraph() {
        this.container.replaceChildren();
        this.graph = new Graph(identity, identity);
    }

    addNode() {
        new SVGNode(chart);
        this.checkLayout();
    }

    deleteNodes() {
        selectedNodes$.get().forEach(node => node.remove());
        this.checkLayout();
    }

    deleteEdges() {
        let selected = selectedNodes$.get();
        this.graph.removeEdges(this.graph.edges.filter(e =>
            selected.find(({ graphNode }) => e.fromPort.node == graphNode) &&
            selected.find(({ graphNode }) => e.toPort.node == graphNode)
        ));
        this.checkLayout();
    }

    checkLayout() {
        if (this.autoUpdate) this.graph.updateLayout();
    }

    importDOT(text) {
        let { edges, nodes } = parseDOT(text);

        this.resetGraph();

        let nodeMap = new AutoMap(({ id, attributes }) => new SVGNode(this, id, attributes));
        console.log(nodes);
        nodes.forEach(node => nodeMap.get(node));
        console.log(edges);
        edges.forEach(({ tail, head, attributes }) => new SVGEdge(this, nodeMap.get(tail.node), nodeMap.get(head.node), attributes));
        this.checkLayout();
    }


    *iterateLayout() {
        for (let name of this.graph.updateLayoutIterator()) {
            let state = this.graph.getState();
            console.log(state);
            yield [name, () => this.graph.setState(state)];
            this.graph.refresh();
        }
    }

    remove() {
        this.svgElement.remove();
    }
}

class SVGTextLabel {
    #height;
    #width;
    constructor(container, { id, label }) {
        this.frame = rect(
            style({
                fill: '#fff',
                stroke: colour,
                strokeWidth: 1,
            }),
        );
        this.nodeText = text(
            style({ fill: '#000', fontSize: 5, textAnchor: 'middle', alignmentBaseline: 'central' }),
            label
        );
        this.id = id;
        this.node = g(frame, nodeText);
        container.append(this.node);
        this.#width = nodeText.getComputedTextLength() + 10;
        this.#height = 10;
    }

    getPorts() {
        return id ? [{ id, x: 0, y: 0 }] : [];
    }

    get width() { return this.#width; }

    set width(width) {
        this.#width = width;
        frame.style.width = width;
        frame.style.x = -width / 2;
    }

    get height() { return this.#height; }

    set height(height) {
        this.#height = height;
        frame.style.height = height;
        frame.style.y = -height / 2;
    }
}

class SVGVerticalList {
    #height;
    #width;
    constructor(container, items) {
        this.components = items.map(item => SVGVerticalList.get(container, item));
        this.#height = sum(...this.components.map(c => c.height));
        this.#width = max(...this.components.map(c => c.width));
        this.node = g(this.components.map(({ node }) => node));
        this.height = this.#height;
    }

    get height() { return this.#height; }

    set height(height) {
        let extra = (height - this.#height) / this.components.length;
        this.#height = height;
        let y = height / 2;
        this.offsets = this.components.map(component => {
            component.height = component.height + extra;
            y += component.height / 2;
            let offset = y;
            component.node.setAttribute('transform', `translate(0 ${offset})`);
            y += component.height / 2;
            return offset;
        });
    }

    get width() { return this.#width; }

    set width(width) {


        this.#width = width;
        for (let component of this.components) {
            component.width = width;
        }

    }

    getPorts() {
        return this.components.flatMap((c, index) =>
            c.getPorts().map(({ id, x, y }) =>
                ({ id, x, y: y + this.offsets[index] })
            )
        );
    }

    static get(container, record) {
        if (record instanceof Array) {
            return new SVGVerticalList(container, record);
        }
        return new SVGTextLabel(container, record);
    }
}

class SVGHorizontalList {
    #height;
    #width;
    constructor(container, items) {
        this.components = items.map(item => SVGVerticalList.get(container, item));
        this.#height = max(...this.components.map(c => c.height));
        this.#width = sum(...this.components.map(c => c.width));
        this.node = g(this.components.map(({ node }) => node));
        this.width = this.#width;
    }

    get height() { return this.#height; }

    set height(height) {
        this.#height = height;
        for (let component of this.components) {
            component.height = height;
        }
    }

    get width() { return this.#width; }

    set width(width) {
        let extra = (width - this.#width) / this.components.length;
        this.#width = width;
        let x = width / 2;
        this.offsets = this.components.map(component => {
            component.width = component.width + extra;
            x += component.width / 2;
            let offset = x;
            component.node.setAttribute('transform', `translate(${offset} 0)`);
            x += component.width / 2;
            return offset;
        });
    }

    getPorts() {
        return this.components.flatMap((c, index) =>
            c.getPorts().map(({ id, x, y }) =>
                ({ id, x: x + this.offsets[index], y })
            )
        );
    }

    static get(container, record) {
        if (record instanceof Array) {
            return new SVGHorizontalList(container, record);
        }
        return new SVGTextLabel(container, record);
    }
}

class SVGNode {

    static counter = 0;

    constructor(chart, id = `N${SVGNode.counter++}`, attributes = new Map()) {
        console.log("node attr", attributes);

        let label = parseRecord(attributes.get("label") || id);

        let colour = formatColour(attributes.get("color"), '#000');

        let isSelected$ = selectedNodes$.to(list => list.includes(this));
        let frame = rect(
            style({
                x: -20, y: -5,
                width: 40, height: 10,
                fill: '#fff',
                stroke: colour,
                strokeWidth: 1,
                filter: isSelected$.if("url(#selected)", "none"),
                paintOrder: "stroke"
            }),
        );

        let nodeText = text(style({ fill: '#000', fontSize: 5, textAnchor: 'middle', alignmentBaseline: 'central' }), attributes?.get("label") || id);
        let nodeHandle = g(
            frame,
            nodeText,
            draggable(() => node.getXY(), (x, y) => node.setXY(x, y)),
        );

        chart.container.appendChild(nodeHandle);

        let width = nodeText.getComputedTextLength() + 10;

        frame.style.width = width;
        frame.style.x = -width / 2;

        let node = chart.graph.node(width, 10, id);
        node.watch(n => {
            if (!n) nodeHandle.remove();
            else {
                let [x, y] = n.getXY();
                nodeHandle.setAttribute('transform', `translate(${x} ${y})`);
                console.log(nodeHandle.getAttribute('transform'));
                //nodeHandle.style.cy = y;
            }
        });

        nodeHandle.onclick = event => {
            let isSelected = selectedNodes$.get().includes(this);
            if (event.shiftKey && !isSelected) {
                selectedNodes$.get().forEach(from =>
                    new SVGEdge(this.chart, from, this)
                );
                this.chart.checkLayout();

            } else if (isSelected) {
                selectedNodes$.set(selectedNodes$.get().filter(n => n != this));
            } else if (event.ctrlKey) {
                selectedNodes$.set([...selectedNodes$.get(), this]);
            } else {
                selectedNodes$.set([this]);
            }
        };
        this.graphNode = node;
        this.chart = chart;
    }

    remove() {
        this.graphNode.remove();
    }


}

class SVGEdge {
    constructor(chart, from, to, attributes = new Map()) {
        let colour = formatColour(attributes.get("color"), "#000");

        let edgeLine = path(
            style({ strokeWidth: 1, stroke: colour, fill: 'none' }),
            attr({ "marker-end": "url(#arrow" })
        );
        console.log("edge attr", attributes);

        let labelText = attributes.has("label") ? text(
            style({ fill: '#000', fontSize: 5, textAnchor: 'middle', alignmentBaseline: 'central' }),
            attributes.get("label")
        ) : null;
        let node = g(edgeLine, labelText);
        chart.container.appendChild(node);

        let labelWidth = labelText ? labelText.getComputedTextLength() + 10 : undefined;

        this.edge = chart.graph.edge(from.graphNode, to.graphNode, labelWidth);
        this.edge.watch(e => {
            if (!e) node.remove();
            else {
                edgeLine.setAttribute("d", e.getRoute());
                if (labelText) {
                    let [x, y] = this.edge.labelNode.getXY();
                    labelText.setAttribute('transform', `translate(${x} ${y})`);
                }
            }

        });

    }

    remove() {
        this.edge.remove();
    }
}

let selectedNodes$ = new Data([]);

let panZoom = new SVGPanZoomContainer();
let chart = new SVGChart();
panZoom.container.append(chart.node);

document.body.append(panZoom.node);

document.body.append(controls(chart));

// document.querySelector(".addnode").onclick = addNode;
// document.querySelector(".addedge").onclick = addEdge;
// document.querySelector(".update").onclick = () => chart.graph.updateLayout();
// document.querySelector(".source").onclick = switchSource;
// document.querySelector(".example").onclick = showExample;

// let iterator;

// function next() {
//     if (!iterator) return;

//     let result = iterator.next();

//     document.querySelector(".step").innerText = result.value;

//     if (result.done) {
//         console.log("done");
//         iterator = null;
//         document.querySelector(".step").style.display = "none";
//     }
//     graph.refresh();
// }

// document.querySelector(".start").onclick = () => {
//     if (iterator) {
//         iterator.throw(new Error());
//     }

//     iterator = graph.updateLayoutIterator();

//     next();

//     document.querySelector(".step").style.display = null;
// }

// document.querySelector(".step").onclick = next;





let source = false;
function switchSource() {
    source = !source;
    let textarea = document.querySelector("textarea");
    let svg = document.querySelector("svg");
    svg.style.display = source ? "none" : null;
    textarea.style.display = source ? null : "none";

    if (source) {
        textarea.value = graph.toDot();
    } else {
        importDOTText(textarea.value);

    }
}


function showExample() {
    // importDOTText(`
    // digraph test123 {
    //     a -> b -> c -> a;
    // }`);

    importDOTText(`
    `);
}
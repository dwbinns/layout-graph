import AutoMap from "auto-creating-map";

const abs = a => a >= 0 ? a : - a;

const max = values => values.reduce((m, v) => v > m ? v : m, -Infinity);

const min = values => values.reduce((m, v) => v < m ? v : m, +Infinity);

const avg = values => values.reduce((t, v) => t + v, 0) / values.length;

const rangeIncludes = (from, to) => range(from, to + 1);

const range = (from, to) =>
    to > from
        ? new Array(to - from).fill().map((_, index) => index + from)
        : [];

class Port {
    constructor(node, offsetPosition, offsetLocation, id, autoIncoming) {
        this.node = node;
        this.offsetPosition = offsetPosition;
        this.offsetLocation = offsetLocation;
        this.id = id;
        this.autoIncoming = autoIncoming;
    }

    adjust(nodeToEdges, isHigherRank) {
        if (this.autoIncoming == undefined) return;
        let edges = nodeToEdges.get(this.node)
            .filter(e => (isHigherRank ? e.maxRankNode : e.minRankNode) == this.node);
        let needsSeparation = edges.some(e => e.reverse) && edges.some(e => !e.reverse);
        this.offsetPosition = (needsSeparation ? (this.autoIncoming == isHigherRank ? 1 : -1) : 0) * this.node.size / 4;
        this.offsetLocation = (isHigherRank ? -1 : 1) * this.node.depth / 2;
    }

    get position() {
        return this.node.position + this.offsetPosition;
    }

    get location() {
        return this.node.location + this.offsetLocation;
    }

    get rank() {
        return this.node.rank;
    }

    // addEdge(edge) {
    //     this.edges.push(edge);
    //     this.node.addEdge(edge);
    // }

    get dotId() {
        return this.id ? `${this.node.id}:${this.id}` : this.node.id;
    }
}

class Node {
    //edges = [];
    rank = 0;
    size = 1;
    depth = 0;
    position = 0;
    location = 0;
    node = this;
    watch = observers();


    constructor(graph, size, depth, id) {
        this.graph = graph;
        this.size = size;
        this.depth = depth;

        this.setLocation(depth, 0);
        this.id = id;
    }

    autoPort(incoming) {
        return new Port(this, 0, 0, this.id, incoming);
    }

    setBeyond(nodeToEdges, rank) {
        if (rank < this.rank) return;
        this.rank = rank + 1;
        nodeToEdges.get(this).forEach(e => e.updateRank(nodeToEdges, this));
    }

    findTo(nodeToEdges, node) {
        return nodeToEdges.get(this).some(e => e.findTo(nodeToEdges, this, node));
    }

    setLocation(rankDepth, location) {
        this.rankDepth = rankDepth;
        this.location = location;
    }


    get afterRank() {
        return this.location + this.rankDepth / 2;
    }

    get beforeRank() {
        return this.location - this.rankDepth / 2;
    }

    set(rank, edge) {
        this.rank = rank;
        this.edge = edge;
        return this;
    }

    updatePosition(nodeToEdges, forwards, amplitude) {
        let positions = (this.edge ? [this.edge] : nodeToEdges.get(this))
            .map(e => e.getPort(this.rank + (forwards ? -1 : 1)))
            .filter(Boolean)
            .map(p => p.position);
        if (!positions.length) return;

        this.position += (avg(positions) - this.position) * amplitude;
    }

    get maxPosition() {
        return this.position + this.size / 2;
    }

    get minPosition() {
        return this.position - this.size / 2;
    }

    getXY() {
        return this.graph.transform(this.position, this.location);
    }

    setXY(x, y) {
        [this.position, this.location] = this.graph.inverseTransform(x, y);
        this.watch.notify(this);
        this.graph.edges.filter(e => e.toPort.node == this || e.fromPort.node == this).forEach(e => e.watch.notify(e));
    }

    remove() {
        this.graph.removeNode(this);
    }

    getState(key) {
        let { position, location } = this;
        return { key, position, location };
    }

    setState(nodeState) {
        if (!nodeState) return;
        this.position = nodeState.position;
        this.location = nodeState.location;
    }
}

function observers() {
    let callbacks = [];
    const observe = callback => callbacks.push(callback);
    observe.notify = (...args) => callbacks.forEach(callback => callback(...args));
    return observe;
}

function spline({ arrowLength }, from, to, transform, isFirst, isLast) {

    let fromRankLocation = from.rank < to.rank ? from.node.afterRank : from.node.beforeRank;
    let toRankLocation = from.rank < to.rank ? to.node.beforeRank : to.node.afterRank;
    let centralLocation = (fromRankLocation + toRankLocation) / 2;
    return [
        `${isFirst ? "M" : "L"} ${transform(from.position, from.location)}`,
        `L ${transform(from.position, fromRankLocation)}`,
        `C ${transform(from.position, centralLocation)} ${transform(to.position, centralLocation)} ${transform(to.position, toRankLocation)}`,
        `L ${transform(to.position, to.location + (from.rank < to.rank ? -1 : 1) * (isLast ? arrowLength : 0))}`,
    ];
}

class Edge {
    constructor(graph, fromPort, toPort, labelSize) {
        if (!(fromPort instanceof Port)) throw new Error("from not a port");
        if (!(toPort instanceof Port)) throw new Error("to not a port");
        this.graph = graph;
        this.fromPort = fromPort;
        this.toPort = toPort;
        this.labelSize = labelSize;
        // fromPort.addEdge(this);
        // toPort.addEdge(this);

        //this.reverse = reverse;
        this.watch = observers();
        this.intermediatePorts = new AutoMap(rank => new Port(new Node(this.graph, 0, 0).set(rank, this), 0, 0));
    }

    get hasLabel() {
        return this.labelSize != undefined;
    }

    adjustPorts(nodeToEdges) {
        this.fromPort.adjust(nodeToEdges, this.reverse);
        this.toPort.adjust(nodeToEdges, !this.reverse);
        if (this.hasLabel) {
            this.labelNode = this.intermediatePorts.get(this.minRankNode.rank + 1).node;
            for (let rank of this.intermediateRanks) {
                let port = this.intermediatePorts.get(rank);
                port.node.size = port.node == this.labelNode ? this.labelSize : 0;
                port.offsetPosition = -port.node.size / 2;
            }
        } else {
            this.labelNode = null;
        }
    }

    findTo(nodeToEdges, from, to) {
        if (this.minRankNode == from) {
            return this.maxRankNode == to || this.maxRankNode.findTo(nodeToEdges, to);
        }
        return false;
    }

    get intermediateRanks() {
        return rangeIncludes(this.minRankNode.rank + 1, this.maxRankNode.rank - 1);
    }

    get minRankNode() {
        return this.reverse ? this.toPort.node : this.fromPort.node;
    }

    get maxRankNode() {
        return this.reverse ? this.fromPort.node : this.toPort.node;
    }

    updateRank(nodeToEdges, node) {
        if (this.minRankNode == node) this.maxRankNode.setBeyond(nodeToEdges, this.minRankNode.rank + (this.hasLabel ? 1 : 0));
    }

    getPort(rank) {
        if (this.fromPort.rank == rank) return this.fromPort;
        if (this.toPort.rank == rank) return this.toPort;
        if (rank > this.minRankNode.rank && rank < this.maxRankNode.rank) return this.intermediatePorts.get(rank);
    }

    getNode(rank) {
        return this.getPort(rank)?.node;
    }

    getRoute() {

        const toSVG = ([x, y]) => `${x} ${y}`;
        const transform = (x, y) => toSVG(this.graph.transform(x, y));

        let ports = range(this.minRankNode.rank, this.maxRankNode.rank)
            .map(rank => [this.getPort(rank), this.getPort(rank + 1)]);

        if (this.reverse) {
            ports = ports.map(([from, to]) => [to, from]).reverse();
        }

        return ports
            .map(([from, to], index, array) => spline(this.graph.settings, from, to, transform, index == 0, index == array.length - 1))
            .join(" ");
    }

    getLabelXY() {

    }

    distanceBetween(fromRank, toRank) {
        let fromPort = this.getPort(fromRank);
        let toPort = this.getPort(toRank);
        if (!fromPort || !toPort) return null;
        return abs(fromPort.position - toPort.position);
    }

    remove() {
        this.graph.removeEdge(this);
    }

    getState() {
        let edge = this;
        let nodes = range(this.minRankNode.rank + 1, this.maxRankNode.rank)
            .map(rank => this.getPort(rank).node.getState(rank));
        return { edge, nodes };
    }

    setState(edgeState) {
        if (!edgeState) return;
        let { nodes } = edgeState;
        range(this.minRankNode.rank + 1, this.maxRankNode.rank)
            .map(rank => this.getPort(rank).node.setState(nodes.find(({ key }) => key == rank)));
    }
}

class Rank {
    constructor(graph, nodeList) {
        this.graph = graph;
        this.nodes = [...new Set(nodeList)];
    }

    sort() {
        this.nodes.sort((a, b) => a.position - b.position);
    }

    getMiddle() {
        return avg(this.nodes.map(node => node.position));
    }

    shiftPosition(shift) {
        this.nodes.forEach(node => node.position += shift);
    }

    detangle(nodeToEdges, forwards, amplitude) {
        this.nodes.forEach(node => node.updatePosition(nodeToEdges, forwards, amplitude));
        this.sort();
        for (let i = 1; i < this.nodes.length; i++) {
            let overlap = this.nodes[i - 1].maxPosition + this.graph.settings.nodeGap - this.nodes[i].minPosition;
            if (overlap > 0) this.nodes[i].position += overlap / 2;
            //console.log("overlap", this.nodes[i].maxPosition, this.graph.settings.nodeGap, this.nodes[i + 1].minPosition, overlap);
            // if (overlap > 0) {
            //     this.nodes.slice(0, i).forEach(n => n.position -= overlap / 2);
            //     this.nodes.slice(i).reduce(n => n.position += overlap / 2);
            // }
        }
        for (let i = this.nodes.length - 1; i > 0; i--) {
            let overlap = this.nodes[i - 1].maxPosition + this.graph.settings.nodeGap - this.nodes[i].minPosition;
            if (overlap > 0) this.nodes[i - 1].position -= overlap;
            //console.log("overlap", this.nodes[i].maxPosition, this.graph.settings.nodeGap, this.nodes[i + 1].minPosition, overlap);
            // if (overlap > 0) {
            //     this.nodes.slice(0, i).forEach(n => n.position -= overlap / 2);
            //     this.nodes.slice(i).reduce(n => n.position += overlap / 2);
            // }
        }
        //this.nodes.reduce((position, node) => node.advance(position) + this.graph.settings.nodeGap, 0);
    }

    getMinPosition() {
        return min(this.nodes.map(node => node.position - node.size / 2));
    }

    setLocation(location) {
        let { rankMargin } = this.graph.settings;
        let depth = max(this.nodes.map(n => n.depth)) + rankMargin * 2;
        location += depth / 2;
        this.nodes.forEach(n => n.setLocation(depth, location));
        location += depth / 2;
        return location;
    }
}

export default class Graph {
    constructor(transform, inverseTransform, settings = {}) {
        this.transform = transform;
        this.inverseTransform = inverseTransform;
        this.counter = 0;
        this.settings = { margin: 5, nodeGap: 5, arrowLength: 3, rankMargin: 8, rankSeparationRatio: 2, ...settings };
    }

    toDot() {
        return `
digraph {
    ${this.edges.map(edge => `${edge.from.dotId} -> ${edge.to.dotId};`).join("\n    ")}
}
        `;
    }

    edges = [];
    nodes = [];

    node(size, depth, id) {
        let node = new Node(this, size, depth, id);
        this.nodes.push(node);
        return node;
    }

    removeNode(node) {
        this.removeEdges(
            this.edges
                .filter(e => e.fromPort.node == node || e.toPort.node == node)
        );
        node.watch.notify(null);
        this.nodes = this.nodes.filter(n => n != node);
    }

    removeEdges(edges) {
        console.log("remove edges", edges);
        edges.forEach(e => e.watch.notify(null));
        this.edges = this.edges.filter(e => !edges.includes(e));
    }

    removeEdge(edge) {
        edge.watch.notify(null);
        this.edges = this.edges.filter(e => e != edge);
    }

    port(node, offsetPosition, offsetLocation) {
        return new Port(node, offsetPosition, offsetLocation);
    }

    edge(from, to, labelSize) {
        if (from.node == to.node) throw new Error("Self edges not supported");
        // let reverse = to.node.findTo(from.node);
        // if (reverse) [from, to] = [to, from];

        //console.log("edge:", from.id, "->", to.id, reverse);

        let fromPort = from instanceof Port ? from : from.autoPort(false);
        let toPort = to instanceof Port ? to : to.autoPort(true);

        // let fromPort = from.autoPort;
        // let toPort = to.autoPort;

        let edge = new Edge(this, fromPort, toPort, labelSize);
        this.edges.push(edge);
        return edge;
    }

    updateLayout(options) {
        for (let item of this.updateLayoutIterator(options)) {
            //            console.log(item);
        }
    }

    setRankLocations(ranks) {
        let location = 0;
        let { rankSeparationRatio } = this.settings;

        for (let rank = 0; rank < ranks.length; rank++) {
            location = ranks[rank].setLocation(location);
            //console.log("Distances", this.edges.map(e => e.distanceBetween(rank, rank + 1)));
            location += max(this.edges.map(e => e.distanceBetween(rank, rank + 1))) / rankSeparationRatio;
        }

        //console.log("rank location", location);
    }

    *updateLayoutIterator({ detanglePasses = 6 } = {}) {

        yield `start`;

        let nodeToEdges = new AutoMap(() => []);

        this.nodes.forEach(n => n.rank = 0);

        this.edges.forEach(edge => {
            edge.reverse = edge.toPort.node.findTo(nodeToEdges, edge.fromPort.node);
            edge.updateRank(nodeToEdges, edge.minRankNode);
            nodeToEdges.get(edge.fromPort.node).push(edge);
            nodeToEdges.get(edge.toPort.node).push(edge);
        });

        this.edges.forEach(n => n.adjustPorts(nodeToEdges));

        console.log("Nodes", this.nodes.map(({id, rank}) => `${id}: ${rank}`));
        console.log("Edges", this.edges.map(({fromPort, toPort, reverse, minRankNode, maxRankNode}) => `${fromPort.node.id}->${toPort.node.id} ${reverse} ${minRankNode.rank} ${maxRankNode.rank}`));

        let maxrank = max(this.nodes.map(n => n.rank));

        let ranks = rangeIncludes(0, maxrank)
            .map(rank => new Rank(this, [
                ...this.edges.map(edge => edge.getNode(rank)).filter(Boolean),
                ...this.nodes.filter(n => n.rank == rank),
            ]));

        let interactive = true;

        for (let pass = 0; pass < detanglePasses; pass++) {
            if (interactive) {
                this.setRankLocations(ranks);
                yield 'set rank locations';
            }

            let amplitude = 2 ** ((2 - pass) / 4);

            for (let rank = 0; rank <= maxrank; rank++) {
                ranks[rank].detangle(nodeToEdges, true, amplitude);
                yield `detangle forward ${pass}:${rank}`;
            }

            for (let rank = maxrank; rank >= 0; rank--) {
                ranks[rank].detangle(nodeToEdges, false, amplitude);
                yield `detangle backwards ${pass}:${rank}`;
            }


            let minPosition = min(ranks.map(nodes => nodes.getMinPosition()));
            ranks.forEach(nodes => nodes.shiftPosition(-minPosition + this.settings.margin));
            yield `align left`;
        }

        this.setRankLocations(ranks);
        yield 'set rank locations';


        this.refresh();
    }

    getState() {
        return {
            nodes: this.nodes.map(n => n.getState(n)),
            edges: this.edges.map(e => e.getState()),
        };
    }

    setState({ nodes, edges }) {
        //console.log("set graph state", nodes);
        this.nodes.forEach(node => node.setState(nodes.find(({ key }) => key == node)));
        this.edges.forEach(edge => edge.setState(edges.find(e => e.edge == edge)));
        this.refresh();
    }

    refresh() {
        this.nodes.map(n => n.watch.notify(n));
        this.edges.map(e => e.watch.notify(e));
    }


}
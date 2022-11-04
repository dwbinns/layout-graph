import Tokens from "./tokens.js";
import AutoMap from "auto-creating-map";
import parseRecord from "./parseRecord.js";

const word = /[\w_][\w\d_]*/;
const string = /"([^"]*(\\")?)*"/;
const number = /-?(\.[0-9]*|[0-9]*(\.[0-9]*)?)/;

function identifier(tokens) {
    return tokens.consume(word)
        ?? tokens.consume(string)?.replaceAll(/\"/g, '"').replaceAll(/^"|"$/g, '')
        ?? tokens.consume(number);
}

function getSubgraph(tokens, nodeIdMap, edges) {
    if (tokens.consume("subgraph")) {
        return graph(tokens, nodeIdMap, edges);
    }
    if (tokens.consume("{")) {
        return graphContent(undefined, tokens, nodeIdMap, edges);
    }
}


function identifierOrSubgraph(tokens, nodeIdMap, edges) {
    if (tokens.consume("subgraph")) {
        return graph(tokens, nodeIdMap, edges);
    }
    if (tokens.consume("{")) {
        return graphContent(undefined, tokens, nodeIdMap, edges);
    }
    let id = identifier(tokens);
    if (!id) tokens.expected("identifier or subgraph");
    return id;

}

function space(tokens) {
    while (tokens.consume(/\s+/) || tokens.consume(/\/\*[^]*\*\//) || tokens.consume(/\/\/.*/)) { }
}

function attributes(tokens) {
    let attributes = new Map();
    if (tokens.consume("[")) {
        while (!tokens.consume("]")) {
            let id = identifier(tokens);
            tokens.expect("=");
            attributes.set(id, identifier(tokens));
            tokens.consume([";", ","]);
        }
    }
    return attributes;
}

function mergeAttributes(target, ...sources) {
    for (let source of sources) {
        for (let [key, value] of source) {
            target.set(key, value);
        }
    }
}

function graph(tokens, nodeIdMap, edges) {
    let id = identifier(tokens)
    tokens.expect("{");
    return graphContent(id, tokens, nodeIdMap, edges);
}

function getEndpoint(node, tokens) {
    
    let port;
    let compass;

    if (tokens.consume(":")) {
        port = identifier(tokens);
        if (!port) tokens.expected("port");
        if (tokens.consume(":")) {
            compass = identifier(tokens);
            if (!port) tokens.expected("compass");
        }
    }

    return [{node, port, compass}];
}

function edgeOp(tokens, from, graph, edges, nodeIdMap, edgeAttributes) {
    let statementEdges = [];
    let found = false;

    while (tokens.consume(["->", "--"])) {
        found = true;
        let subgraph = getSubgraph(tokens, nodeIdMap, edges);
        graph.subgraphs.push(subgraph);
        let to = subgraph 
            ? subgraph.nodes.map(node => ({node})) 
            : getEndpoint(nodeIdMap.get(identifier(tokens), graph.nodes), tokens);

        for (let tail of from) {
            for (let head of to) {
                statementEdges.push({ tail, head, attributes: new Map() });
            }
        }

        from = to;
    }

    if (!found) return false;
 
    let statementAttributes = attributes(tokens);
    
    statementEdges.forEach(edge => mergeAttributes(edge.attributes, edgeAttributes, statementAttributes));
    edges.push(...statementEdges);
}

function statement(tokens, graph, nodeIdMap, nodeAttributes, edgeAttributes, edges) {
    if (tokens.consume("node")) {
        attributes(tokens).forEach((v, k) => nodeAttributes.set(k, v));
        return;
    }
    if (tokens.consume("edge")) {
        attributes(tokens).forEach((v, k) => edgeAttributes.set(k, v));
        return;
    }

    let subgraph = getSubgraph(tokens, nodeIdMap, edges);

    if (subgraph) {
        graph.subgraphs.push(subgraph);
        let from = subgraph.nodes.map(node => ({node}));
        edgeOp(tokens, from, graph, edges, nodeIdMap, nodeAttributes, edgeAttributes);
        return;
    }

    let id = identifier(tokens);
    if (id != undefined) {
        if (tokens.consume("=")) {
            graph.attributes.set(id, identifier(tokens));
            return;
        }
        let node = nodeIdMap.get(id, graph.nodes);
        let from = getEndpoint(node, tokens);

        if (edgeOp(tokens, from, graph, edges, nodeIdMap, nodeAttributes, edgeAttributes)) return;

        let statementAttributes = attributes(tokens);
        mergeAttributes(node.attributes, nodeAttributes, statementAttributes);

        return;
    }

    tokens.expected("statement");
    
}

function graphContent(id, tokens, nodeIdMap, edges) {

    let nodeAttributes = new Map();

    let edgeAttributes = new Map();

    let graph = {
        id,
        nodes: [],
        attributes: new Map(),
        subgraphs: [],
    };

    function getNodes(subject) {
        if (subject.nodes) {
            graph.subgraphs.push(subject);
            return subject.nodes;
        }
        if (typeof subject == "string") {
            return [nodeIdMap.get(subject, graph.nodes)];
        }
        tokens.expected("Identifier or subgraph");
    }

    console.log("START GRAPH");

    while (!tokens.consume('}')) {

        statement(tokens, graph, nodeIdMap, nodeAttributes, edgeAttributes, edges);

        // if (tokens.consume("node")) {
        //     attributes(tokens).forEach((v, k) => nodeAttributes.set(k, v));
        // } else if (tokens.consume("edge")) {
        //     attributes(tokens).forEach((v, k) => edgeAttributes.set(k, v));
        // } else {
        //     let subgraph = subgraph(tokens, nodeIdMap, edges);

        //     if (subgraph) {
                
        //     } else {
        //         let id = identifier(tokens);
        //         if (id) {
        //             if (tokens.consume("=")) {
        //                 graph.attributes.set(subject, identifier(tokens));
        //             } else {}

        //         } else {
        //             tokens.expected("statement");
        //         }
        //     }

            

        //     if (id && tokens.consume("=")) {
        //         graph.attributes.set(subject, identifier(tokens));
        //     } else {
                
        //     }

            



        //     let subject = identifierOrSubgraph(tokens, nodeIdMap, edges);
        //     console.log("Subject", subject);

        //     if (tokens.consume("=") && !subject.nodes) {
        //         graph.attributes.set(subject, identifier(tokens));
        //     } else {
        //         let statementEdges = [];
        //         let tailNodes = getNodes(subject);

        //         while (tokens.consume(["->", "--"])) {
        //             let headNodes = getNodes(identifierOrSubgraph(tokens, nodeIdMap, edges));
        //             console.log("Head", JSON.stringify(headNodes));
        //             for (let tail of tailNodes) {
        //                 for (let head of headNodes) {
        //                     console.log("parse.edge:", tail.id, "->", head.id);
        //                     statementEdges.push({ tail, head, attributes: new Map() });
        //                 }
        //             }
        //             tailNodes = headNodes;
        //         }
        //         let statementAttributes = attributes(tokens);
        //         if (statementEdges.length) {
        //             statementEdges.forEach(edge => mergeAttributes(edge.attributes, edgeAttributes, statementAttributes));
        //             edges.push(...statementEdges);
        //         } else {
        //             tailNodes.forEach(node => mergeAttributes(node.attributes, nodeAttributes, statementAttributes));
        //         }
        //     }
        // }

        tokens.consume(";");
        console.log("parse.line ;")

    }

    console.log("END GRAPH");

    return graph;
}

export default function parseDOT(graphText) {
    // https://graphviz.org/doc/info/lang.html
    let tokens = new Tokens(graphText, space);
    tokens.consume(word, "strict");
    tokens.expect(word, ["graph", "digraph"]);

    let nodeIdMap = new AutoMap((id, nodes) => {
        let node = { id, attributes: new Map() };
        nodes.push(node);
        return node;
    })

    let edges = [];

    return {
        root: graph(tokens, nodeIdMap, edges),
        edges: edges,
        nodes: [...nodeIdMap.values()],
    };
}

export { parseRecord };
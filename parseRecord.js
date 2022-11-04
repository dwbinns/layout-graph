import Tokens from "./tokens.js";
import AutoMap from "auto-creating-map";

function parseField(tokens) {
    if (tokens.consume('{')) {
        let fields = [];
        while (true) {
            fields.push(parseField(tokens));
            let delimiter = tokens.consume(["}", "|"]);
            if (!delimiter) tokens.expected("delimiter");
            console.log(delimiter);
            if (delimiter == "}") break;
        }
        return fields;
    }
    let id;
    if (tokens.consume('<')) {
        id = tokens.consume(/[^>]*/);
        tokens.expect(">");
    }
    let label = tokens.consume(/[^|}]+/); 
    return {id, label};
}

export default function parseRecord(labelText) {
    console.log("pr", labelText);
    return parseField(new Tokens(labelText));
}
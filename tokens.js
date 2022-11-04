export default class Tokens {
    constructor(text, ignore = /\s+/) {
        this.text = text;
        this.location = 0;
        this.ignore = ignore;
    }

    consume(matches, check) {
        if (!this.amIgnoring) {
            this.amIgnoring = true;
            this.consume(this.ignore);
            this.amIgnoring = false;
        }

        let result;
        for (let match of matches instanceof Array ? matches : [matches]) {
            if (typeof match == "function") {
                result = match(this);
            }
            if (match instanceof RegExp) {
                let sticky = new RegExp(match, "y");
                sticky.lastIndex = this.location;
                result = this.text.match(sticky)?.[0];
            }
            if (typeof match == "string") {
                if (this.text.slice(this.location).startsWith(match)) {
                    result = match;
                }
            }
            if (result) break;
        }
        if (!result) return;
        if (typeof check == "function" && !check(result)) return;
        if (check instanceof Array && !check.includes(result)) return;
        if (typeof check == "string" && check != result) return;
        this.location += result.length;
        return result;
    }

    expected(message) {
        let lineNumber = this.text.slice(0, this.location).split("\n").length;
        let lineText = this.text.split("\n")[lineNumber - 1];
        let columnNumber = this.location - ("\n" + this.text.slice(0, this.location)).lastIndexOf("\n") + 1;
        let marker = '^'.padStart(columnNumber);
        throw new Error([`Expected: ${message}, at ${lineNumber}:${columnNumber}`, lineText, marker].join("\n"));
    }

    expect(match, check, description) {
        if (!this.consume(match, check)) {
            const expected = description || (
                check instanceof Array ? check.join(" or ")
                    : typeof match == "string" ? match
                        : check
            );
            this.expected(expected);
        }
    }
}
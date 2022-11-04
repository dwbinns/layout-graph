import { Data, HTML, style, properties, on, SVG } from "ui-io";
const { div, button, input, label } = HTML(document);

const tab = (selected$, value, ...content) => {
    if (!selected$.get()) selected$.set(value);
    return button(
        style({
            border: 'none',
            background: selected$.is(value).if("#aaa", null),
            padding: '10px',
        }),
        on('click', () => selected$.set(value)),
        ...content
    );
}

function editTab(chart) {
    return div(
        style({ display: 'flex', flexDirection: 'column', gap: '10px' }),
        button('Add node', on('click', () => chart.addNode())),
        button('Delete nodes', on('click', () => chart.deleteNodes())),
        button('Delete edges', on('click', () => chart.deleteEdges())),
    );
}

function examplesTab(chart) {
    return div(
        style({ display: 'flex', flexDirection: 'column', gap: '10px' }),
        button('Example', on('click', () => chart.importDOT(`
        digraph test123 {
            a -> b -> c;
            a -> {x y};
            b [shape=box];
            c [label="hello world",color=blue,fontsize=24,
            fontname="Palatino-Italic",fontcolor=red,style=filled];
            a -> z [label="hi", weight=100];
            x -> z [label="multi-line label"];
            edge [style=dashed,color=red];
            b -> x;
            {rank=same; b x}
        }
        `))),
        button('3 node Loop', on('click', () => chart.importDOT(`
        digraph a {
            a -> b -> c -> a;
            d -> e;
        }
        `))),
        button('2 node Loop', on('click', () => chart.importDOT(`
        digraph a {
            a -> b -> a;
        }
        `))),
        button('other example', on('click', () => chart.importDOT(`
        digraph G {
            size ="4,4";
            main [shape=box]; /* this is a comment */
            main -> parse [weight=8];
            parse -> execute;
            main -> init [style=dotted];
            main -> cleanup;
            execute -> { make_string; printf}
            init -> make_string;
            edge [color=red]; // so is this
            main -> printf [style=bold,label="100 times"];
            make_string [label="make a\nstring"];
            node [shape=box,style=filled,color=".7 .3 1.0"];
            execute -> compare;
        }
        `))),
        button('records', on('click', () => chart.importDOT(`
        digraph RecordShapedNodes {

            rec_horizontal [ shape=record label="Vertical bars|seperate|the individual field" ]
         
            rec_vertical   [ shape=record label="The initial|{orientation|(top down|or left right)}|{is dependent|{on the|value}|{of|rankdir}|and can be|changed with curly braces}}"]
         
            rec_Mrecord    [ shape=Mrecord label="{An Mrecord|has rounded|corners}" ]
         
            rec_ports_1    [ shape=record  label="{ports|<from_2>to connect}|{allow|<to_1>fields and/or nodes}" ]
         
            rec_ports_2    [ shape=record  label="foo|<to_2>bar|baz}" ]
         
            rec_horizontal -> rec_vertical -> rec_Mrecord[ style=invis ]
         
            rec_Mrecord -> rec_ports_1:to_1
            rec_ports_1:from_2 -> rec_ports_2:to_2
         
         }
         `))),
    );
}

function layoutTab(chart) {
    let stages$ = new Data([]);
    let auto$ = new Data(chart.autoUpdate);
    auto$.observe(chart, enabled => chart.autoUpdate = enabled);

    let inprogress$ = new Data(false);

    async function update() {
        stages$.set([]);
        inprogress$.set(true);
        for (let item of chart.iterateLayout()) {
            stages$.append(item)
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        inprogress$.set(false);
    }

    let disable$ = Data.from(inprogress$, auto$, (inprogress, auto) => auto || inprogress);

    return div(
        label(
            input(properties({ type: "checkbox", checked: auto$ }), on('input', event => auto$.set(event.target.checked))),
            "Auto update"
        ),
        div(
            style({ display: 'flex', flexDirection: 'column', pointerEvents: disable$.if('none', null) }),
            button(on('click', update), 'Update'),
            stages$.to(stages =>
                stages.map(([name, restore]) =>
                    button(
                        on('click', restore),
                        style({background: 'none', border: 'none'}),
                        name
                    )
                )
            )
        )
    );
}

export default function controls(chart) {
    let tab$ = new Data();

    return div(
        style({
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: '200px',
            userSelect: 'none',
            padding: '10px',
            background: '#ddd',
            display: 'flex',
            flexDirection: 'column',
        }),
        div(
            style({
                display: 'flex',
                borderBottom: '2px solid #aaa',
                justifyContent: 'space-between',
                marginBottom: '10px',
            }),
            tab(tab$, editTab(chart), 'Edit'),
            tab(tab$, examplesTab(chart), 'Sample'),
            tab(tab$, layoutTab(chart), 'Layout')
        ),
        div(
            style({
                overflow: 'overlay',
                flexGrow: 1,
                height: 0,
                scrollbarGutter: 'stable',
            }),
            tab$
        ),

    );
}
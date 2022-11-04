

console.dir(parseDOT(`
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
`), {depth: null});

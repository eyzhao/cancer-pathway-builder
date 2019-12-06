d3.json("states.json", function (states) {
    var colorScale = d3.scale.category20();

    var scrollSVG = d3.select(".viewport").append("svg")
        .attr("class", "scroll-svg");

    var defs = scrollSVG.insert("defs", ":first-child");

    createFilters(defs);

    var chartGroup = scrollSVG.append("g")
        .attr("class", "chartGroup")
        //.attr("filter", "url(#dropShadow1)"); // sometimes causes issues in chrome

    chartGroup.append("rect")
        .attr("fill", "#FFFFFF");

    var infoSVG = d3.select(".information").append("svg")
        .attr("class", "info-svg");

    var braceGroup = infoSVG.append("g")
        .attr("transform", "translate(0,0)");

    braceGroup.append("path")
        .attr("class", "brace")
        .attr("d", makeCurlyBrace(10, 380, 10, 20, 30, 0.55));

    var braceLabelGroup = braceGroup.append("g")
        .attr("transform", "translate(45, 176)");

    braceLabelGroup.append("text")
        .attr("class", "infotext")
        .attr("transform", "translate(0, 0)")
        .text("50 data items but only ");

    braceLabelGroup.append("text")
        .attr("class", "infotext")
        .attr("transform", "translate(-1, 30)")
        .text("15 dom nodes rendered");

    braceLabelGroup.append("text")
        .attr("class", "infotext")
        .attr("transform", "translate(0, 60)")
        .text("at any given time!");

    var rowEnter = function(rowSelection) {
        rowSelection.append("rect")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("width", "250")
            .attr("height", "24")
            .attr("fill-opacity", 0.25)
            .attr("stroke", "#999999")
            .attr("stroke-width", "2px");
        rowSelection.append("text")
            .attr("transform", "translate(10,15)");
    };
    var rowUpdate = function(rowSelection) {
        rowSelection.select("rect")
            .attr("fill", function(d) {
                return colorScale(d.id);
            });
        rowSelection.select("text")
            .text(function (d) {
                return (d.index + 1) + ". " + d.label;
            });
    };

    var rowExit = function(rowSelection) {
    };

    var virtualScroller = d3.VirtualScroller()
        .rowHeight(30)
        .enter(rowEnter)
        .update(rowUpdate)
        .exit(rowExit)
        .svg(scrollSVG)
        .totalRows(50)
        .viewport(d3.select(".viewport"));

    // tack on index to each data item for easy to read display
    states.items.forEach(function(nextState, i) {
        nextState.index = i;
    });

    virtualScroller.data(states.items, function(d) { return d.id; });

    chartGroup.call(virtualScroller);

    function createFilters(svgDefs) {
        var filter = svgDefs.append("svg:filter")
            .attr("id", "dropShadow1")
            .attr("x", "0")
            .attr("y", "0")
            .attr("width", "200%")
            .attr("height", "200%");

        filter.append("svg:feOffset")
            .attr("result", "offOut")
            .attr("in", "SourceAlpha")
            .attr("dx", "1")
            .attr("dy", "1");

        filter.append("svg:feColorMatrix")
            .attr("result", "matrixOut")
            .attr("in", "offOut")
            .attr("type", "matrix")
            .attr("values", "0.1 0 0 0 0 0 0.1 0 0 0 0 0 0.1 0 0 0 0 0 0.2 0");

        filter.append("svg:feGaussianBlur")
            .attr("result", "blurOut")
            .attr("in", "matrixOut")
            .attr("stdDeviation", "1");

        filter.append("svg:feBlend")
            .attr("in", "SourceGraphic")
            .attr("in2", "blurOut")
            .attr("mode", "normal");
    }
});

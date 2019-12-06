function d3_rebind(target, source, method) {
  return function() {
    var value = method.apply(source, arguments);
    return value === source ? target : value;
  };
}

function draw_virtual_scroller() {
  d3.json("states.json", function (states) {
      var scrollSVG = d3.select("3panel").append("svg")
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
          .viewport(d3.select("#panel"));

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
}

d3.VirtualScroller = function() {
    var enter = null,
        update = null,
        exit = null,
        data = [],
        dataid = null,
        svg = null,
        viewport = null,
        totalRows = 0,
        position = 0,
        rowHeight = 24,
        totalHeight = 0,
        minHeight = 0,
        viewportHeight = 0,
        visibleRows = 0,
        delta = 0,
        dispatch = d3.dispatch("pageDown","pageUp");

    function virtualscroller(container) {
        function render(resize) {
            if (resize) {                                                                      // re-calculate height of viewport and # of visible row
                viewportHeight = parseInt(viewport.style("height"));
                visibleRows = Math.ceil(viewportHeight / rowHeight) + 1;                       // add 1 more row for extra overlap; avoids visible add/remove at top/bottom 
            }
            var scrollTop = viewport.node().scrollTop;
            totalHeight = Math.max(minHeight, (totalRows * rowHeight));
            svg.style("height", totalHeight + "px")                                            // both style and attr height values seem to be respected
                .attr("height", totalHeight);
            var lastPosition = position;
            position = Math.floor(scrollTop / rowHeight);
            delta = position - lastPosition;
            scrollRenderFrame(position);
        }


        function scrollRenderFrame(scrollPosition) {
            container.attr("transform", "translate(0," + (scrollPosition * rowHeight) + ")");   // position viewport to stay visible
            var position0 = Math.max(0, Math.min(scrollPosition, totalRows - visibleRows + 1)), // calculate positioning (use + 1 to offset 0 position vs totalRow count diff) 
                position1 = position0 + visibleRows;
            container.each(function() {                                                         // slice out visible rows from data and display
                var rowSelection = container.selectAll(".row")
                    .data(data.slice(position0, Math.min(position1, totalRows)), dataid);
                rowSelection.exit().call(exit).remove();
                rowSelection.enter().append("g")
                    .attr("class", "row")
                    .call(enter);
                rowSelection.order();
                var rowUpdateSelection = container.selectAll(".row:not(.transitioning)");       // do not position .transitioning elements
                rowUpdateSelection.call(update);
                rowUpdateSelection.each(function(d, i) {
                    d3.select(this).attr("transform", function(d) {
                        return "translate(0," + ((i * rowHeight)) + ")";
                    });
                });
            });

            if (position1 > (data.length - visibleRows)) {                                      // dispatch events 
                dispatch.pageDown({
                    delta: delta
                });
            } else if (position0 < visibleRows) {
                dispatch.pageUp({
                    delta: delta
                });
            }
        }

        virtualscroller.render = render;                                                        // make render function publicly visible 
        viewport.on("scroll.virtualscroller", render);                                          // call render on scrolling event
        render(true);                                                                           // call render() to start
    }

    virtualscroller.render = function(resize) {                                                 // placeholder function that is overridden at runtime
    };

    virtualscroller.data = function(_, __) {
        if (!arguments.length) return data;
        data = _;
        dataid = __;
        return virtualscroller;
    };

    virtualscroller.dataid = function(_) {
        if (!arguments.length) return dataid;
        dataid = _;
        return virtualscroller;
    };

    virtualscroller.enter = function(_) {
        if (!arguments.length) return enter;
        enter = _;
        return virtualscroller;
    };

    virtualscroller.update = function(_) {
        if (!arguments.length) return update;
        update = _;
        return virtualscroller;
    };

    virtualscroller.exit = function(_) {
        if (!arguments.length) return exit;
        exit = _;
        return virtualscroller;
    };

    virtualscroller.totalRows = function(_) {
        if (!arguments.length) return totalRows;
        totalRows = _;
        return virtualscroller;
    };

    virtualscroller.rowHeight = function(_) {
        if (!arguments.length) return rowHeight;
        rowHeight = +_;
        return virtualscroller;
    };

    virtualscroller.totalHeight = function(_) {
        if (!arguments.length) return totalHeight;
        totalHeight = +_;
        return virtualscroller;
    };

    virtualscroller.minHeight = function(_) {
        if (!arguments.length) return minHeight;
        minHeight = +_;
        return virtualscroller;
    };

    virtualscroller.position = function(_) {
        if (!arguments.length) return position;
        position = +_;
        if (viewport) {
            viewport.node().scrollTop = position;
        }
        return virtualscroller;
    };

    virtualscroller.svg = function(_) {
        if (!arguments.length) return svg;
        svg = _;
        return virtualscroller;
    };

    virtualscroller.viewport = function(_) {
        if (!arguments.length) return viewport;
        viewport = _;
        return virtualscroller;
    };

    virtualscroller.delta = function() {
        return delta;
    };

    d3_rebind(virtualscroller, dispatch, "on");

    return virtualscroller;
};

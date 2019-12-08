const svg_height = 1000,
      svg_width = 1000,
      grid_point_radius = 0.5,
      gene_radius = 6,
      gene_group_width = 30,
      gene_group_radius = gene_group_width/2,
      gene_text_offset = 18,
      gene_text_size = '14px',
      gene_panel_arrow_top_padding = 100,
      gene_panel_arrow_size = 20,
      gene_panel_capacity = 28,
      gene_panel_left_padding = 80,
      gene_panel_spacing = 100,
      gene_panel_top_padding = 180,
      gene_panel_color = '#F8F8F8',
      gene_panel_width = 250,
      active_width = svg_width - gene_panel_width,
      grid_size = 40,
      grid_offset = grid_size/2,
      node_mode_switch_coordinates = [800, 40],
      edge_mode_switch_coordinates = [800, 60],
      switch_radius = 8
      switch_off_color = '#BBBBBB'
      switch_on_color = '#DD2222',
      edge_width = 1,
      selected_edge_width = 3,
      hover_edge_width = 10,
      mutation_class_shorthand = {
        'Silent': 'si',
        'Splice_Site': 'splice',
        'Frame_Shift_Del': 'fs del',
        'Frame_Shift_Ins': 'fs ins',
        'Translation_Start_Site': 'tss',
        'Missense_Mutation': 'mis',
        'Nonsense_Mutation': 'stop',
        'Nonstop_Mutation': 'nonstop',
        'In_Frame_Del': 'if del',
        'In_Frame_Ins': 'if ins',
      }

function sanitizeString(str){
    str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
    return str.trim();
}

function add_gene_to_panel(diagram, gene_name) {
  position = diagram.genes.panel.length
  x = active_width + gene_panel_left_padding + ((position) % 2) * gene_panel_spacing
  y = gene_panel_top_padding + Math.floor(position/2) * 60

  draw_gene(diagram, diagram.view_layers.gene_panel, gene_name, [x, y])
  diagram.genes.panel.push(gene_name)
}

function panel_to_frontlog(diagram, gene_name) {
  var idx = diagram.genes.panel.indexOf(gene_name);
  diagram.genes.panel.splice(idx, 1);
  diagram.genes.frontlog.push(gene_name);
  diagram.svg.select(`#${gene_name}`).remove();
}

function frontlog_to_panel(diagram, gene_name) {
  var idx = diagram.genes.frontlog.indexOf(gene_name);
  diagram.genes.frontlog.pop(idx);
  diagram.genes.panel.unshift(gene_name);
}

function latest_frontlog(diagram, count) {
  frontlog = diagram.genes.frontlog

  if (frontlog.length < count) {
    count = frontlog.length
  }

  return(frontlog.slice(frontlog.length-count, frontlog.length).reverse())
}

function panel_to_backlog(diagram, gene_name) {
  var idx = diagram.genes.panel.indexOf(gene_name);
  diagram.genes.panel.splice(idx, 1);
  diagram.genes.backlog.unshift(gene_name);
  d3.select(`#${gene_name}`).remove();
}

function backlog_to_panel(diagram, gene_name) {
  var idx = diagram.genes.backlog.indexOf(gene_name);
  diagram.genes.backlog.splice(idx, 1);
  diagram.genes.panel.push(gene_name);
}

function add_gene_to_backlog(diagram, gene_name) {
  diagram.genes.backlog.push(gene_name);
}

function get_gene_position(gene_group_element) {
  transform_value = gene_group_element.attr('transform')
  coords = transform_value.match(/translate\(([-\d]+),([-\d]+)\)/);
  return(
    [
      parseFloat(coords[1]) + gene_group_radius,
      parseFloat(coords[2]) + gene_group_radius
    ]
  )
}

function move_gene(gene_group_element, coord, offset_x = 0, offset_y = 0) {
  gene_group_element
    .attr('transform', `translate(${coord[0] + offset_x},${coord[1] + offset_y})`)
}

function draw_gene(diagram, svg, gene_name, coord) {
  gene_group = svg.append('g')
    .attr('transform', `translate(${coord[0] - gene_group_radius},${coord[1] - gene_group_radius})`)
    .attr('id', gene_name)
    .attr('class', 'gene_group')

  gene_node = gene_group.append('circle')
    .attr('cx', gene_group_radius)
    .attr('cy', gene_group_radius)
    .attr('r', gene_radius)
    .style('stroke', 'black')
    .style('fill', 'white')

  gene_text = gene_group.append('text')
    .attr('x', gene_group_radius)
    .attr('y', gene_group_radius - gene_text_offset)
    .attr('text-anchor', 'middle')
    .text(gene_name)
    .style('font-size', gene_text_size)

  drag_handler = get_gene_drag_handler(diagram)
  drag_handler(gene_group)

  return(gene_group)
}

function snap_to_grid_1d(x, offset) {
  var lower_gap = x % grid_size + grid_offset + offset;
  var upper_gap = grid_size - lower_gap;

  if (lower_gap < upper_gap) {
    new_x = x - lower_gap
  } else {
    new_x = x + upper_gap
  }

  return(new_x)
}

function snap_to_grid(coordinates, offset=0) {
  var x = coordinates[0];
  var y = coordinates[1];
  return([snap_to_grid_1d(x, offset), snap_to_grid_1d(y, offset)])
}

function sketch_edge(diagram, origin_object) {
  start_position = origin_object.start_position
  current_position = [d3.event.x, d3.event.y]
  below_station = [start_position[0], start_position[1] + grid_size/2]
  d_text = `M ${start_position[0]} ${start_position[1]} `

  if (current_position[1] > (start_position[1] + grid_size / 4)) {
    d_text += `L ${start_position[0]} ${start_position[1] + grid_size/2} `

    if (current_position[1] > (start_position[1] + 3 * grid_size / 4)) {
      nearest_grid_point = snap_to_grid(current_position)
      d_text += `L ${nearest_grid_point[0]} ${nearest_grid_point[1]}`
    }
  }

  active_edge = diagram.svg.select('.active_edge')
  active_edge
    .attr('d', d_text)
}

function get_unique_edge_id(diagram) {
  existing_edge = diagram.svg.select('.edge')
  if (existing_edge.empty()) {
    return('edge_0')
  } else {
    var latest_edge_id = diagram.svg.select('.edge').attr('id');
    var numeric_value = parseInt(latest_edge_id.split('_')[1]) + 1;
    var new_edge_id = 'edge_' + String(numeric_value);
    return(new_edge_id)
  }
}

function select_edge(diagram, edge_object) {
  if (! (diagram.current_selection == null)) {
    diagram.current_selection.deselector(diagram)
  }
  diagram.current_selection = {
    selected_object: edge_object
      .style('stroke', 'red')
      .style('stroke-width', selected_edge_width),
    deselector: deselect_edge,
    deletor: delete_edge
  }
}

function deselect_edge(diagram) {
  diagram.current_selection.selected_object
    .style('stroke', 'black')
    .style('stroke-width', edge_width)
}

function delete_edge(diagram) {
  diagram.current_selection.selected_object.remove()
}

function delete_selected_object(diagram) {
  if (diagram.current_selection == null) {
    console.log('No object selected')
  } else {
    diagram.current_selection.deletor(diagram)
  }
}

function make_gene_active(diagram, gene_name) {
  if (diagram.genes.panel.includes(gene_name)) {
    var idx = diagram.genes.panel.indexOf(gene_name);
    diagram.genes.panel.splice(idx, 1);
    diagram.genes.active.add(gene_name);
  }
}

function make_gene_inactive(diagram, gene_name) {
  if (diagram.genes.active.has(gene_name)) {
    diagram.genes.active.delete(gene_name);
    diagram.genes.panel.unshift(gene_name);
  }
}

function get_gene_drag_handler(diagram) {
  var drag_handler = d3.drag()
    .on('start', function() {
      var current = d3.select(this);
      var current_position = get_gene_position(current)
      this.start_position = current_position;
      deltaX = current_position[0] - d3.event.x;
      deltaY = current_position[1] - d3.event.y;
    })
    .on('drag', function() {
      if (diagram.mode == 'edge_mode' && this.start_position[0] < active_width) {
        active_edge = diagram.svg.select('.active_edge')
        if (active_edge.empty()) {
        active_edge = diagram.view_layers.edge_layer
          .insert('path', ':first-child')
          .attr('id', get_unique_edge_id(diagram))
          .attr('class', 'active_edge')
          .style('fill', 'none')
          .style('stroke', 'black')
        }
        sketch_edge(diagram, this)
      } else {
        var new_x = d3.event.x + deltaX;
        var new_y = d3.event.y + deltaY;
        move_gene(d3.select(this), [new_x, new_y])
      }
    })
    .on('end', function() {
      if (diagram.mode == 'edge_mode' && this.start_position[0] < active_width) {
        active_edge = diagram.svg.select('.active_edge')
        edge_id = `#${active_edge.attr('id')}`
        active_edge
          .attr('class', 'edge')
        diagram.svg.selectAll('.edge')
          .on('mouseover', function() {
            d3.select(this).style('stroke-width', hover_edge_width)
          })
          .on('mouseout', function() {
            if (diagram.is_selected(d3.select(this))) {
              d3.select(this).style('stroke-width', selected_edge_width)
            } else {
              d3.select(this).style('stroke-width', edge_width)
            }
          })
          .on('click', function() {
            select_edge(diagram, d3.select(this))
          })
      } else {
        if (d3.event.x < active_width) {
          move_gene(
            d3.select(this),
            snap_to_grid(
              [d3.event.x, d3.event.y],
              offset = gene_group_radius
            )
          )
          make_gene_active(diagram, this.id)
          refresh_gene_panel(diagram)
        } else if (d3.event.x > active_width && d3.event.x < svg_width) {
          make_gene_inactive(diagram, this.id)
          refresh_gene_panel(diagram)
        } else {
          move_gene(
            d3.select(this),
            this.start_position,
            offset_x = -gene_group_radius,
            offset_y = -gene_group_radius
          )
        }
      }
    })

  return(drag_handler)
}


function get_foldchange_color_scale(domain) {
  fc_color = d3.scaleLinear().domain(domain)
    .interpolate(d3.interpolateHsl)
    .range([d3.rgb('#0000FF'), d3.rgb('#DDDDDD'), d3.rgb('#FF0000')])

  return(fc_color)
}

function label_mutation(diagram, gene, data) {
  gene_group = diagram.svg.select(`#${gene}`)

  gene_group
    .append('circle')
    .attr('cx', 0)
    .attr('cy', 1/3 * gene_group_width)
    .attr('r', 4.5)
    .style('fill', 'black')

  gene_group
    .append('circle')
    .attr('cx', 0)
    .attr('cy', 1/3 * gene_group_width)
    .attr('r', 2)
    .style('fill', 'white')

  gene_group
    .append('text')
    .attr('class', 'mutation_label')
    .attr('x', -10)
    .attr('y', 1/3 * gene_group_width)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .text(mutation_class_shorthand[data['Variant_Classification']])
    .style('font-size', 13)

}

function update_mutation_layer(diagram) {
  var mutated_active_genes = get_active_genes_with_mutations(diagram)

  for (gene in mutated_active_genes) {
    label_mutation(
      diagram,
      gene,
      mutated_active_genes[gene]
    )
  }
}

function get_active_genes_with_mutations(diagram) {
  mutation_data = diagram.data.mutation
  var mutation_subset = mutation_data
    .filter(row => diagram.genes.active.has(row.Hugo_Symbol) || diagram.genes.panel.includes(row.Hugo_Symbol))
    .reduce((obj, row) => {
      obj[row.Hugo_Symbol] = row
      return obj
    }, {})

  return(mutation_subset)
}

function add_mutation_layer(diagram, mutation_data) {
  diagram.data.mutation = mutation_data
  update_mutation_layer(diagram)
  diagram.data_layers.push('mutations')
}

function get_active_genes_with_expression_foldchange(diagram) {
  var expression_subset = diagram.data.expression.foldchange
    .filter(row => diagram.genes.active.has(row.Description) || diagram.genes.panel.includes(row.Description))
    .reduce((obj, row) => {
      obj[row.Description] = row
      return obj
    }, {})
  return(expression_subset)
}

function add_expression_foldchange_layer(diagram, expression_foldchange_data, clipping_value = 3) {
  diagram.data.expression.foldchange = expression_foldchange_data;

  update_expression_foldchange_layer(diagram)
	draw_expression_slider(diagram)
  diagram.data_layers.push('expression_foldchange')
}

function modify_gene_fill(gene, color) {
  d3.select('#' + gene)
    .select('circle')
    .style('fill', color)
}

function update_expression_foldchange_layer(diagram) {
  var expression_subset = get_active_genes_with_expression_foldchange(diagram)

  clipping_value = diagram.options.expression_clipping_value
  color_scale = get_foldchange_color_scale([-clipping_value, 0, clipping_value])

  for (gene in expression_subset) {
    modify_gene_fill(gene, color_scale(expression_subset[gene].log2_fc_mean))
  }
}

function initialize_workspace() {
  var svg = d3.select('#workspace')
    .append('svg')
    .attr('id', 'svg-workspace')
    .attr('width', svg_height)
    .attr('height', svg_width);

  return(svg)
}

function create_mode_switch(diagram, mode_id, mode_label, coordinates) {
  mode_switch_group = diagram.svg.select('#interface_layer')
    .append('g')
    .attr('id', `${mode_id}_group`)
    .attr('transform', `translate(${coordinates[0]}, ${coordinates[1]})`)

  mode_switch_group.append('circle')
    .attr('id', `${mode_id}_switch`)
    .attr('class', `mode_switch`)
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', switch_radius)
    .style('fill', switch_off_color)

  mode_switch_group.append('text')
    .attr('id', `${mode_id}_switch_text`)
    .attr('class', 'mode_switch_text')
    .attr('x', switch_radius + 5)
    .attr('y', 0)
    .attr('text-anchor', 'left')
    .attr('dominant-baseline', 'middle')
    .text(mode_label)
    .style('font-size', 16)
    .style('fill', switch_off_color)

  return(mode_switch_group)
}

function initialize_interface_layer(diagram) {
  var interface_layer = diagram.svg.append('g')
    .attr('id', 'interface_layer')

  create_mode_switch(
    diagram,
    'edge_mode',
    'edge mode',
    edge_mode_switch_coordinates
  ).on('click', function() {
      activate_mode('diagram', 'edge_mode')
    })

  create_mode_switch(
    diagram,
    'node_mode',
    'node mode',
    node_mode_switch_coordinates
  ).on('click', function() {
      activate_mode(diagram, 'node_mode')
    })

  var x0 = active_width + gene_panel_left_padding,
      y0 = gene_panel_arrow_top_padding,
      x1 = x0 - gene_panel_arrow_size,
      y1 = y0 + gene_panel_arrow_size,
      y2 = y0 + gene_panel_arrow_size / 2

  interface_layer.append('path')
    .attr('id', 'gene_panel_left_arrow')
    .attr('d', `M ${x0} ${y0} L ${x0} ${y1} L ${x1} ${y2} Z`)
    .style('fill', 'black')
    .on('click', () => {
      shift_gene_panel(diagram, 'left')
    })

  var x0 = active_width + gene_panel_left_padding + gene_panel_spacing,
      x1 = x0 + gene_panel_arrow_size

  interface_layer.append('path')
    .attr('id', 'gene_panel_right_arrow')
    .attr('d', `M ${x0} ${y0} L ${x0} ${y1} L ${x1} ${y2} Z`)
    .style('fill', 'black')
    .on('click', () => {
      shift_gene_panel(diagram, 'right')
    })

  interface_layer.append('rect')
    .attr('x', active_width + gene_panel_left_padding)
    .attr('y', y0)
    .attr('width', gene_panel_spacing) 
    .attr('height', y1-y0)
    .style('fill', '#CCCCCC')
  interface_layer.append('text')
    .attr('id', 'gene_panel_data_type_label')
    .attr('x', active_width + gene_panel_left_padding + gene_panel_spacing/2)
    .attr('y', y2 + 1)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .text('GENES')

  activate_mode(diagram, 'node_mode')
}

function shift_gene_panel(diagram, direction) {
  if (direction == 'right') {
    var panel_genes = [];
    for (g of diagram.genes.panel) {
      panel_genes.push(g)
    }
    if (diagram.genes.backlog.length > 0) {
      for (g of panel_genes) {
        panel_to_frontlog(diagram, g)
      }
    }
    refresh_gene_panel(diagram)
  } else if (direction == 'left') {
    if (diagram.genes.frontlog.length > 0) {
      for (g of latest_frontlog(diagram, gene_panel_capacity)) {
        frontlog_to_panel(diagram, g)
      }
      refresh_gene_panel(diagram)
    }
  }
}

function activate_mode(diagram, mode_id) {
  console.log(mode_id)
  diagram.mode = mode_id
  // deactivate all mode switches
  d3.selectAll('.mode_switch')
    .style('fill', switch_off_color)
  d3.selectAll('.mode_switch_text')
    .style('fill', switch_off_color)

  // activate chosen mode switch
  d3.select(`#${mode_id}_switch`)
    .style('fill', switch_on_color)
  d3.select(`#${mode_id}_switch_text`)
    .style('fill', switch_on_color)
}

function initialize_grid_layer(diagram) {
  var grid_layer = diagram.svg.append('g')
    .attr('id', 'grid_layer')
  for (var i = grid_offset; i < active_width; i += grid_size) {
    for (var j = grid_offset; j < active_width; j += grid_size) {
      grid_layer.append('circle')
        .attr('cx', i)
        .attr('cy', j)
        .attr('r', grid_point_radius)
        .style('fill', '#888888')
    }
  }
}

function initialize_gene_layer(diagram) {
  var gene_layer = diagram.svg.append('g')
    .attr('id', 'gene_layer')
  return(gene_layer)
}

function initialize_edge_layer(diagram) {
  var edge_layer = diagram.svg.append('g')
    .attr('id', 'edge_layer')
  return(edge_layer)
}

function initialize_gene_panel(diagram) {
  var gene_panel_x = svg_width - gene_panel_width
  var gene_panel = diagram.svg
    .append('g')
      .attr('id', 'gene_panel')

  gene_panel
    .append('rect')
      .attr('width', gene_panel_width)
      .attr('height', svg_height)
      .attr('x', active_width)
      .attr('y', 0)
      .style('fill', '#F8F8F8')

  return(gene_panel)
}

function refresh_gene_panel(diagram) {
  while (diagram.genes.panel.length > gene_panel_capacity) {
    panel_to_backlog(
      diagram,
      diagram.genes.panel[diagram.genes.panel.length - 1]
    )
  }
  while (diagram.genes.panel.length < gene_panel_capacity && diagram.genes.backlog.length > 0) {
    backlog_to_panel(
      diagram,
      diagram.genes.backlog[0]
    )
  }

  var panel_gene_list = diagram.genes.panel;

  for (gene_name of diagram.genes.panel) {
    d3.select(`#${gene_name}`).remove()
  }

  diagram.genes.panel = [];

  for (gene_name of panel_gene_list) {
    add_gene_to_panel(diagram, gene_name)
  }

  update_expression_foldchange_layer(diagram)
  update_mutation_layer(diagram)
}

function draw_expression_slider(diagram) {
  var data = [0, 2, 4, 6, 8, 10];

  var sliderSimple = d3
    .sliderBottom()
    .min(d3.min(data))
    .max(d3.max(data))
    .width(300)
    .tickFormat(d3.format('.2'))
    .ticks(6)
    .default(3)
    .on('onchange', val => {
      d3.select('p#expression-slider-value').text(d3.format('.2')(val));
      diagram.options.expression_clipping_value = val;
      update_expression_foldchange_layer(diagram);
    });

  var gSimple = d3
    .select('div#expression-slider')
    .append('svg')
    .attr('width', 500)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)');

  gSimple.call(sliderSimple);

  d3.select('p#expression-slider-value').text(d3.format('.2%')(sliderSimple.value()));
}

function main() {
  let diagram = {
    svg: initialize_workspace(),
    current_selection: null,
    genes: {
      active: new Set(),
      panel: [],
      frontlog: [],
      backlog: []
    },
    mode: null,
    view_layers: {},
    data_layers: [],
    data: {
      expression: {
        foldchange: {}
      },
      mutation: {}
    },
    options: {
      expression_clipping_value: 3
    }
  }

  let key_listeners = {
    '8': () => { delete_selected_object(diagram) }, // delete
    '27': () => { diagram.deselect_all() },
    '69': () => { activate_mode(diagram, 'edge_mode') }, // e
    '78': () => { activate_mode(diagram, 'node_mode') }, // n
    '190': () => {
      shift_gene_panel(diagram, 'right') }, // .
    '188': () => {
      shift_gene_panel(diagram, 'left') }, // ,
  }

  diagram.is_selected = function(obj) {
    if (this.current_selection == null) {
      return false
    } else {
      selected_obj_id = this.current_selection.selected_object.attr('id')
      if (selected_obj_id == obj.attr('id')) {
        return true
      } else {
        return false
      }
    }
  }

  diagram.deselect_all = function() {
    this.current_selection.deselector(diagram)
    this.current_selection = null;
  }

  d3.select('body').on('keydown', function() {
    if (document.activeElement.tagName == 'BODY') {
      if (String(d3.event.keyCode) in key_listeners) {
        key_listeners[String(d3.event.keyCode)]()
      } else {
        console.log(`Uncaught key event: ${d3.event.keyCode}`)
      }
    }
  })

  diagram.view_layers.grid_layer = initialize_grid_layer(diagram)
  diagram.view_layers.edge_layer = initialize_edge_layer(diagram)
  diagram.view_layers.gene_layer = initialize_gene_layer(diagram)
  diagram.view_layers.gene_panel = initialize_gene_panel(diagram)
  diagram.view_layers.interface_layer = initialize_interface_layer(diagram)

  d3.tsv("data/example_gtex_comparison.tsv", (expression_foldchange_data) => {
    add_expression_foldchange_layer(diagram, expression_foldchange_data)

    d3.tsv("data/example_mutations.maf", (mutation_data) => {
      add_mutation_layer(diagram, mutation_data)

      d3.tsv("data/reference/cosmic_census_genes.txt", (mutation_data) => {
        genes = mutation_data
          .map(row => row.genename)

        for (g of genes) {
          add_gene_to_backlog(diagram, g)
        }

        refresh_gene_panel(diagram);
      })
    })
  })

}

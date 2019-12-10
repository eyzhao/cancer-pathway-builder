const svg_height = 1500,
      svg_width = 1250,
      grid_point_radius = 0.5,
      gene_radius = 6,
      gene_group_width = 30,
      gene_group_radius = gene_group_width/2,
      gene_text_offset = 14,
      gene_text_size = '14px',
      gene_panel_arrow_top_padding = 180,
      gene_panel_arrow_size = 20,
      gene_panel_capacity = 26,
      gene_panel_left_padding = 80,
      gene_panel_spacing = 100,
      gene_panel_top_padding = 260,
      gene_panel_color = '#F8F8F8',
      gene_panel_width = 250,
      fusion_symbol_height = 20,
      active_width = svg_width - gene_panel_width,
      grid_size = 30,
      grid_offset = grid_size/2,
      node_mode_switch_coordinates = [active_width + 50, 40],
      edge_mode_switch_coordinates = [active_width + 50, 60],
      arrow_length = 10,
      switch_radius = 8
      switch_off_color = '#BBBBBB'
      switch_on_color = '#DD2222',
      edge_width = 1,
      selected_edge_width = 3,
      hover_edge_width = 10,
      search_delay_ms = 500,
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
      },
      max_copynumber_radius = 8,
      copynumber_radius_overflow = 2,
      underexpressed_color = 'blue',
      overexpressed_color = 'red',
      copy_gain_color = 'red',
      copy_loss_color = 'blue'

class Diagram {
  constructor() {
    this.initialize_variables();
    this.load_annotation_data();
    this.load_all_genes();
  }

  reconstruct_from_file(load_data) {
    this.load_variables_from_file(load_data);
    this.load_annotation_data();
    this.load_all_genes();
    redraw_active_genes(this);
    apply_edge_events(this);
  }

  load_all_genes() {
    d3.tsv("data/reference/all_genes.txt", (gene_data) => {
      var genes = gene_data.map(row => row.genename)
      this.genes.all = genes
    })

    var fusion_label = d3.select('#interface_layer').append('text')
      .attr('x', active_width + gene_panel_left_padding)
      .attr('y', 120 + gene_group_radius - gene_text_offset)
      .attr('text-anchor', 'middle')
      .text('Fusion')
      .style('font-size', gene_text_size)

    var complex_label = d3.select('#interface_layer').append('text')
      .attr('x', active_width + gene_panel_left_padding + gene_panel_spacing)
      .attr('y', 120 + gene_group_radius - gene_text_offset)
      .attr('text-anchor', 'middle')
      .text('Complex')
      .style('font-size', gene_text_size)

    draw_fusion(this, [active_width + gene_panel_left_padding, 140])
    draw_fusion(this, [active_width + gene_panel_left_padding, 140])
    draw_complex(this, [active_width + gene_panel_left_padding + gene_panel_spacing, 140])
    draw_complex(this, [active_width + gene_panel_left_padding + gene_panel_spacing, 140])
  }

  load_variables_from_file(load_data) {
    console.log('LOAD DATA')
    console.log(load_data)
    this.svg.select('#gene_layer').remove()
    this.svg.select('#edge_layer').remove()
    d3.select('#svg-workspace').append('g').attr('id', 'edge_layer').html(load_data.view_layers.edge_layer)
    d3.select('#svg-workspace').append('g').attr('id', 'gene_layer').html(load_data.view_layers.gene_layer)
    this.svg = d3.select('#svg-workspace')
    this.current_selection = null;
    this.genes = {
      active: new Set(load_data.genes.active),
      panel_range: [0, gene_panel_capacity],
      panel: [],
      search: null,
      all: []
    }
    this.mode = null
    this.view_layers = load_data.view_layers
    this.data_layers = load_data.data_layers
    this.data = {
      paths: load_data.data.paths
    }
    this.options = load_data.options
    this.feature = {
      search: null
    }
    console.log(this)
  }

  initialize_variables() {
    this.svg = this.initialize_workspace();
    this.current_selection = null;
    this.genes = {
      active: new Set(),
			panel_range: [0, gene_panel_capacity],
      panel: [],
      searched: null,
      all: [],
    };
    this.mode = null
    this.view_layers = {}
    this.data_layers = []
    this.data = {
      paths: {
        mutation: 'data/example_mutations.maf',
        expression_foldchange: 'data/example_gtex_comparison.tsv',
        copynumber: 'data/example_cna.tsv'
      }
    };
    this.options = {
      expression_clipping_value: 3
    };
    this.feature = {
      search: null
    }

    this.view_layers.grid_layer = this.initialize_grid_layer()
    this.view_layers.gene_panel = this.initialize_gene_panel()
    this.view_layers.interface_layer = this.initialize_interface_layer()
    this.view_layers.edge_layer = this.initialize_edge_layer()
    this.view_layers.gene_layer = this.initialize_gene_layer()
  }

  load_annotation_data() {
    this.load_data_object(this.data.paths)
      .then(() => {
      return Promise.all([
        this.add_expression_foldchange_layer(),
        this.add_mutation_layer(),
        this.add_copynumber_layer(),
        this.load_cosmic_census_genes('data/reference/cosmic_census_genes.txt')
      ])
    })
      .then(() => {
        console.log(this.data.expression_foldchange);
        refresh_gene_panel(this)
      })
  }

  initialize_workspace() {
    var svg = d3.select('#workspace')
      .append('svg')
      .attr('id', 'svg-workspace')
      .attr('width', svg_height)
      .attr('height', svg_width)
      .attr('viewBox', `0 0 ${svg_width} ${svg_height}`)
      .attr('xmlns', 'http://www.w3.org/2000/svg')

    var defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('markerWidth', arrow_length)
      .attr('markerHeight', arrow_length)
      .attr('refX', 0)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .attr('markerUnits', 'strokeWidth')
      .append('path')
        .attr('d', 'M0,0 L0,6 L9,3 z')
        .style('fill', '#000000')

		defs.append('marker')
      .attr('id', 'inhibit')
      .attr('markerWidth', 2)
      .attr('markerHeight', 12)
      .attr('refX', 0)
      .attr('refY', 6)
      .attr('orient', 'auto')
      .attr('markerUnits', 'strokeWidth')
      .append('path')
        .attr('d', 'M0,0 L0,12 L2,12 L2,0 Z')
        .style('fill', '#000000')

    return(svg)
  }

  save_svg(embed = false) {
    var fileName = 'pathway_data.json';

    var svg_copy = this.get_svg_copy()
    console.log(this.genes.active)
    var save_data = {
      'data': {
        'paths': this.data.paths
      },
      'data_layers': this.data_layers,
      'genes': {
        'active': [...this.genes.active]
      },
      'options': this.options,
      'view_layers': {
        'gene_layer': svg_copy.select('#gene_layer').node().innerHTML,
        'edge_layer': svg_copy.select('#edge_layer').node().innerHTML
      }
    }
    console.log(save_data)

    // Create a blob of the data
    var fileToSave = new Blob([JSON.stringify(save_data)], {
        type: 'application/json',
        name: fileName
    });

    // Save the file
    saveAs(fileToSave, fileName);
  }

  load_pathway(file_data) {
    var save_data = JSON.parse(file_data)
    this.reconstruct_from_file(save_data)
  }

  get_svg_copy() {
    var content = d3.select('#workspace').html();
    var div = d3.select('#hidden')
        .html(content);
    var svg_copy = d3.select('#hidden').select('svg')
    svg_copy.select('#grid_layer').remove()
    svg_copy.select('#interface_layer').remove()
    svg_copy.select('#gene_panel').remove()
    svg_copy.selectAll('.gene_group_inactive').remove()
    svg_copy.selectAll('.gene_group_panel').remove()
    svg_copy.selectAll('.fusion_group').remove()
    svg_copy.selectAll('.complex_group').remove()
    return(svg_copy)
  }

  clear_svg_copy() {
    d3.select('#hidden').select('svg').remove()
  }

  export_svg() {
    var svg_copy = this.get_svg_copy()
    var svgData = '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'.concat(svg_copy.node().outerHTML);
    var svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "pathway.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    clear_svg_copy()
  }


  initialize_grid_layer() {
    var grid_layer = this.svg.append('g')
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

  initialize_gene_layer() {
    var gene_layer = this.svg.append('g')
      .attr('id', 'gene_layer')
    return(gene_layer)
  }

  initialize_edge_layer() {
    var edge_layer = this.svg.append('g')
      .attr('id', 'edge_layer')
    return(edge_layer)
  }

  initialize_gene_panel() {
    var gene_panel_x = svg_width - gene_panel_width
    var gene_panel = this.svg
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

  initialize_interface_layer() {
    var interface_layer = this.svg.append('g')
      .attr('id', 'interface_layer')

    this.create_mode_switch(
      'edge_mode',
      'edge mode',
      edge_mode_switch_coordinates
    ).on('click', ev => {
        this.activate_mode('edge_mode')
      })

    this.create_mode_switch(
      'node_mode',
      'node mode',
      node_mode_switch_coordinates
    ).on('click', function() {
        this.activate_mode('node_mode')
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
        this.shift_gene_panel('left')
      })

    var x0 = active_width + gene_panel_left_padding + gene_panel_spacing,
        x1 = x0 + gene_panel_arrow_size

    interface_layer.append('path')
      .attr('id', 'gene_panel_right_arrow')
      .attr('d', `M ${x0} ${y0} L ${x0} ${y1} L ${x1} ${y2} Z`)
      .style('fill', 'black')
      .on('click', () => {
        this.shift_gene_panel('right')
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

    this.activate_mode('node_mode')
  }

	deselect_all() {
    this.current_selection.deselector(this)
	}

  load_data_object(data_object) {
    // Loads an object with paths to data
    return new Promise((resolve, reject) => {
      this.data.paths = data_object;
      resolve(0)
    })
  }

  get_active_genes(dataset, gene_name_col = 'Hugo_Symbol') {
    var active_subset = dataset
      .filter(row => this.genes.active.has(row[gene_name_col]) || this.genes.panel.includes(row[gene_name_col]))
      .reduce((obj, row) => {
        obj[row[gene_name_col]] = row
        return obj
      }, {})

    return(active_subset)
  }

  add_expression_foldchange_layer(clipping_value = 3) {
    return new Promise((resolve, reject) => {
      d3.tsv(this.data.paths.expression_foldchange, (expression_foldchange_data) => {
        this.data.expression_foldchange = expression_foldchange_data;
        draw_expression_slider(this)
        this.data_layers.push('expression_foldchange')
        resolve(0)
      })
    })
  }

  add_mutation_layer() {
    return new Promise((resolve, reject) => {
      d3.tsv(this.data.paths.mutation, (mutation_data) => {
        this.data.mutation = mutation_data
        this.data_layers.push('mutation')
        resolve(0)
      })
    })
  }

  add_copynumber_layer() {
    return new Promise((resolve, reject) => {
      d3.tsv(this.data.paths.copynumber, (copynumber_data) => {
        this.data.copynumber = copynumber_data.filter(row => ! (row.cna_value == 0))
        this.data.max_copynumber = copynumber_data.map(row => row.cna_value).reduce((a,b) => {
          if (a == null) {
            return b 
          } else if (b == null) {
            return a
          } else {
            return Math.max(a,b)
          }
        })
        this.data_layers.push('copynumber')
        resolve(0)
      })
    })
  }

  update_copynumber_layer() {
    var copynumber_active_genes = this.get_active_genes(this.data.copynumber, 'Hugo_Symbol')

    for (var gene in copynumber_active_genes) {
      this.label_copynumber(gene, copynumber_active_genes[gene])
      this.label_copynumber(gene + '-inactive', copynumber_active_genes[gene])
    }
  }

  label_copynumber(gene, data) {
    var gene_group = this.svg.select(`#${gene}`)

    gene_group.select('.gene_node')
      .style('stroke', 'white')
      .style('stroke-width', 1.5)

		var max_copynumber_domain = Math.max(this.data.max_copynumber, 2)

		if (max_copynumber_domain < 5 || data.cna_value < 0) {
			// For small max copynumber, then use a linear scaling
			// Also, for copy loss, use linear scaling (because -2 is the max loss)
			var copynumber_radius = Math.abs((data.cna_value / max_copynumber_domain) * max_copynumber_radius);
		} else {
			// If copynumbers 5 or greater exist, then switch to a sqrt scaling to better differentiate the lower range
			var copynumber_radius = Math.abs(max_copynumber_radius / Math.sqrt(max_copynumber_domain) * Math.sqrt(data.cna_value))
		}
		gene_group.attr('effective_radius', copynumber_radius + gene_radius)

    if (gene_group.select('.copynumber_group').empty()) {
			var mutation_group = gene_group.select('.mutation_group')

      if (copynumber_radius > copynumber_radius_overflow) {
        gene_group.select('.gene_text')
          .attr('y', gene_group_radius - gene_text_offset - (copynumber_radius - copynumber_radius_overflow))
        if (! mutation_group.empty()) {
          var mutation_group_x_translate = - (copynumber_radius - copynumber_radius_overflow);
          mutation_group.attr('transform', `translate(${mutation_group_x_translate}, 0)`)
        }
      }
      
      var copynumber_group = gene_group.insert('g', ':first-child')
        .attr('class', 'copynumber_group')

      copynumber_group.append('circle')
        .attr('cx', gene_group_radius)
        .attr('cy', gene_group_radius)
        .attr('r', copynumber_radius + gene_radius)
        .style('fill', data.cna_value > 0 ? copy_gain_color : copy_loss_color)
    }

  }

  load_cosmic_census_genes(cosmic_census_genes_path) {
    return new Promise((resolve, reject) => {
      d3.tsv("data/reference/cosmic_census_genes.txt", (gene_data) => {
        var genes = gene_data
          .map(row => row.genename)

        for (var g of genes) {
          add_gene_to_panel(this, g)
        }
        resolve(0)
      })
    })
  }

  activate_mode(mode_id) {
    console.log(mode_id)
    this.mode = mode_id
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

  create_mode_switch(mode_id, mode_label, coordinates) {
    var mode_switch_group = this.svg.select('#interface_layer')
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

  shift_gene_panel(direction) {
    if (direction == 'right') {
			if (this.genes.panel_range[1] < this.genes.panel.length) {
				this.genes.panel_range[0] += gene_panel_capacity;
				this.genes.panel_range[1] += gene_panel_capacity;
				refresh_gene_panel(this)
			}
    } else if (direction == 'left') {
			if (this.genes.panel_range[0] > 0) {
				this.genes.panel_range[0] -= gene_panel_capacity;
				this.genes.panel_range[1] -= gene_panel_capacity;
				refresh_gene_panel(this)
			}
    }
  }

  clear_search() {
    this.genes.searched = null;
    refresh_gene_panel(this)
  }

  run_search(search_value) {
    var search_value_raw = d3.select('#search').node().value;
    var search_value = sanitize_search_string(search_value_raw).toUpperCase();
    if (search_value === '') {
      this.clear_search()
    } else {
      // Find all matching genes and arrange them so that the earlier the
      // matching string occurs, the higher up the list they will be
      var search_result_genes = this.genes.all
        .map(g => [g, g.search(search_value)])
        .filter(g => g[1] != -1)
        .sort((a, b) => a[1] - b[1])
        .map(g => g[0])
      this.display_searched_genes(search_result_genes)
    }
  }

  display_searched_genes(gene_list) {
    if (gene_list.length > gene_panel_capacity) {
      gene_list = gene_list.slice(0, gene_panel_capacity)
    }

    this.genes.searched = gene_list;
    refresh_gene_panel(this);
  }

  is_selected(obj) {
    if (this.current_selection == null) {
      return false
    } else {
      var selected_obj_id = this.current_selection.selected_object.attr('id')
      if (selected_obj_id == obj.attr('id')) {
        return true
      } else {
        return false
      }
    }
  }

  select_all() {
    this.current_selection.deselector(diagram)
    this.current_selection = null;
  }
}

function sanitizeString(str){
  str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
  return str.trim();
}

function sanitize_search_string(str) {
  str = str.replace(/\W/g, '')
  return(str)
}

function draw_genes_in_panel(diagram, gene_list) {
  for (gene_name of gene_list) {
    position = gene_list.indexOf(gene_name);
    var x = active_width + gene_panel_left_padding + ((position) % 2) * gene_panel_spacing;
    var y = gene_panel_top_padding + Math.floor(position/2) * 60;

    draw_gene(diagram, diagram.view_layers.gene_panel, gene_name, [x, y], 'gene_group_inactive', inactive = true)
		if (! diagram.genes.active.has(gene_name)) {
			draw_gene(diagram, diagram.view_layers.gene_panel, gene_name, [x, y], 'gene_group_panel')
		}
    diagram.genes.panel.push(gene_name)
  }
}

function add_gene_to_panel(diagram, gene_name) {
  diagram.genes.panel.push(gene_name);
}

function get_gene_position(gene_group_element) {
  var transform_value = gene_group_element.attr('transform')
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

function draw_fusion(diagram, coord) {
  var fusion_group = diagram.svg.select('#gene_layer').insert('g', ':first-child')
    .attr('transform', `translate(${coord[0] - gene_group_radius},${coord[1] - gene_group_radius})`)
    .attr('id', get_unique_id(diagram, 'fusion_group', 'fusion'))
    .attr('class', 'fusion_group')

  var x0 = gene_group_radius - 2, y0 = gene_group_radius - fusion_symbol_height/2,
      x1 = x0 - fusion_symbol_height/2, y1 = y0 + fusion_symbol_height/2,
      x2 = x0, y2 = (y0 + y1) / 2, y2 = y1 + fusion_symbol_height/2,
      x3 = x0 + fusion_symbol_height/2, y3 = y1;

  fusion_group.append('path')
    .attr('d', `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`)
    .style('fill', 'black')

  drag_handler = get_gene_drag_handler(diagram)
  drag_handler(fusion_group)
}

function draw_complex(diagram, coord) {
  var complex_group = diagram.svg.select('#gene_layer').insert('g', ':first-child')
    .attr('transform', `translate(${coord[0] - gene_group_radius},${coord[1] - gene_group_radius})`)
    .attr('id', get_unique_id(diagram, 'complex_group', 'complex'))
    .attr('class', 'complex_group')

  complex_group.append('rect')
    .attr('x', gene_group_radius - 6)
    .attr('y', gene_group_radius - 6)
    .attr('height', 12)
    .attr('width', 12)
    .style('fill', 'white')
    .style('stroke-width', 2)
    .style('stroke', 'black')

  drag_handler = get_gene_drag_handler(diagram)
  drag_handler(complex_group)
}

function draw_gene(diagram, svg, gene_name, coord, element_class, inactive = false) {
  gene_group = diagram.svg.select('#gene_layer').append('g')
    .attr('transform', `translate(${coord[0] - gene_group_radius},${coord[1] - gene_group_radius})`)
		.attr('effective_radius', gene_radius)
		.attr('class', element_class)

  gene_node = gene_group.append('circle')
    .attr('class', 'gene_node')
    .attr('cx', gene_group_radius)
    .attr('cy', gene_group_radius)
    .attr('r', gene_radius)
    .style('stroke', 'black')
    .style('stroke-width', 1)
    .style('fill', 'white')

  gene_text = gene_group.append('text')
    .attr('class', 'gene_text')
    .attr('x', gene_group_radius)
    .attr('y', gene_group_radius - gene_text_offset)
    .attr('text-anchor', 'middle')
    .text(gene_name)
    .style('font-size', gene_text_size)

	if (inactive) {
		gene_group
			.style('opacity', '0.3')
			.attr('id', gene_name + '-inactive')
	} else {
    console.log('applying drag handler to ' + gene_name)
		gene_group
			.attr('id', gene_name)
		drag_handler = get_gene_drag_handler(diagram)
		drag_handler(gene_group)
	}

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

function get_gene_at_point(diagram, coord) {
	console.log(diagram.genes.active)
  for (g of diagram.genes.active) {
    var pos = get_gene_position(d3.select(`#${g}`))
    if (arrays_equal(coord, pos)) {
      return g
    }
  }
  return null
}

function sketch_edge(diagram, origin_object) {
  start_position = origin_object.start_position
  current_position = [d3.event.x, d3.event.y]
  nearest_grid_point = snap_to_grid(current_position)
  below_station = [start_position[0], start_position[1] + grid_size/2]
  d_text = `M ${start_position[0]} ${start_position[1]} `
  var gene_at_tip = get_gene_at_point(diagram, nearest_grid_point)

  active_edge = diagram.svg.select('.active_edge')


  if (current_position[1] > (start_position[1] + grid_size / 4)) {
    d_text += `L ${start_position[0]} ${start_position[1] + grid_size/2} `

    if (current_position[1] > (start_position[1] + 3 * grid_size / 4)) {
      d_text += `L ${nearest_grid_point[0]} ${nearest_grid_point[1]}`
    }
    active_edge.attr('marker-end', 'none')
  } else {
		if (gene_at_tip != null) {
			var gene_effective_radius = Number(d3.select(`#${gene_at_tip}`).attr('effective_radius'))
		} else {
			var gene_effective_radius = gene_radius
		}
    if (arrays_equal(start_position, nearest_grid_point)) {
			d_text += ''
		} else {
			var dx = nearest_grid_point[0] - start_position[0],
					dy = nearest_grid_point[1] - start_position[1],
					length = Math.sqrt(dx * dx + dy * dy),
					shorten_x = (gene_effective_radius + arrow_length) * dx / length,
					shorten_y = (gene_effective_radius + arrow_length) * dy / length

			d_text += `L ${nearest_grid_point[0] - shorten_x} ${nearest_grid_point[1] - shorten_y}`
			active_edge.attr('marker-end', 'url(#arrow)')
		}
  }

  active_edge
    .attr('d', d_text)
}

function get_unique_id(diagram, class_name, id_prefix = class_name) {
  existing = diagram.svg.select(`.${class_name}`)
  if (existing.empty()) {
    return(`${id_prefix}_0`)
  } else {
    var latest_id = diagram.svg.select(`.${class_name}`).attr('id');
    var numeric_value = parseInt(latest_id.split('_')[1]) + 1;
    var new_edge_id = `${id_prefix}_` + String(numeric_value);
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
    deletor: delete_edge,
		context_menu: {
			'choices': ['Inhibit', 'Delete'],
			'actions': {
				'Inhibit': switch_edge_to_inhibit,
				'Delete': delete_edge
			}
		}
  }
}

function launch_context_menu(diagram, coordinates) {
	diagram.current_selection.context_menu
	var context_menu_group = diagram.svg.append('g')
		.attr('id', 'context_menu')

	var context_menu_padding = 3
	
	var choice_groups = [];
	for (choice of diagram.current_selection.context_menu.choices) {
		var i = diagram.current_selection.context_menu.choices.indexOf(choice)
		choice_groups.push(context_menu_group.append('g').attr('choice', choice).attr('class', 'context_menu_choice'))
		var choice_text = choice_groups[i].append('text')
			.attr('class', 'context_menu_choice_text')
			.text(choice)
			.attr('x', coordinates[0] + 30)
			.attr('y', coordinates[1] + 10 + i * 30)
	}

	var max_bbox_width = choice_groups.map(g => g.node().getBBox().width).reduce((a,b) => Math.max(a,b))

	for (choice of diagram.current_selection.context_menu.choices) {
		var i = diagram.current_selection.context_menu.choices.indexOf(choice)
		var bbox = choice_groups[i].select('.context_menu_choice_text').node().getBBox()
		choice_groups[i].insert('rect', ':first-child')
			.attr('x', bbox.x - context_menu_padding)
			.attr('y', bbox.y - context_menu_padding)
			.attr('height', bbox.height + 2 * context_menu_padding)
			.attr('width', max_bbox_width + 2 * context_menu_padding)
			.attr('fill', gene_panel_color)
	}

	d3.selectAll('.context_menu_choice').on('click', function() {
		choice = d3.select(this).attr('choice')
		diagram.current_selection.context_menu.actions[choice](diagram)
		d3.select('#context_menu').remove()
	})


}

function deselect_edge(diagram) {
  diagram.current_selection.selected_object
    .style('stroke', 'black')
    .style('stroke-width', edge_width)

	d3.select('#context_menu').remove()
}

function delete_edge(diagram) {
  diagram.current_selection.selected_object.remove()
	d3.select('#context_menu').remove()
}

function shorten_edge(diagram, edge_obj, shorten_by) {
	console.log('shortening')
	var d_str = edge_obj.attr('d')
	var d_str_spl = d_str.split(' L ')
	var end_of_edge = d_str_spl[d_str_spl.length - 1].split(' ')
	var second_last = d_str_spl[d_str_spl.length - 2].split(' ')
	var start_of_d_str = d_str_spl.slice(0, d_str_spl.length - 2)

	var dx = end_of_edge[0] - second_last[0]
	var dy = end_of_edge[1] - second_last[1]
	var edge_length = Math.sqrt(dx*dx + dy*dy)
	var shorten_x = dx / edge_length * shorten_by
	var shorten_y = dy / edge_length * shorten_by

	var new_end_of_edge = [end_of_edge[0] - shorten_x, end_of_edge[1] - shorten_y]
	var new_d_str = start_of_d_str.concat([second_last.join(' '), new_end_of_edge.join(' ')]).join(' L ')
	edge_obj.attr('d', new_d_str)
}

function switch_edge_to_inhibit(diagram) {
  var edge_to_edit = diagram.current_selection.selected_object;
	if (edge_to_edit.attr('marker-end') == null || edge_to_edit.attr('marker-end') == 'none') {
		shorten_edge(diagram, edge_to_edit, 40);
	}
	edge_to_edit.attr('marker-end', 'url(#inhibit)')
}

function delete_selected_object(diagram) {
  if (diagram.current_selection == null) {
    console.log('No object selected')
  } else {
    diagram.current_selection.deletor(diagram)
  }
}

function make_gene_active(diagram, gene_name) {
  console.log(gene_name)
	diagram.genes.active.add(gene_name);
	var gene_group = d3.select(`#${gene_name}`);

  if (gene_group.attr('class') == 'fusion_group') {
    draw_fusion(diagram, [active_width + gene_panel_left_padding, 140])
    gene_group.attr('class', 'fusion_group_active');
  } else if (gene_group.attr('class') == 'complex_group') {
    draw_complex(diagram, [active_width + gene_panel_left_padding + gene_panel_spacing, 140])
    gene_group.attr('class', 'complex_group_active');
  } else {
    gene_group.attr('class', 'gene_group_active');
    var bbox = gene_group.select('.gene_text').node().getBBox();
    var gene_text_backing = gene_group.insert('rect', ':first-child')
      .attr('class', 'gene_title_backing')
      .attr('x', bbox.x)
      .attr('y', bbox.y)
      .attr('height', bbox.height)
      .attr('width', bbox.width)
      .style('fill', 'white')
  }
}

function put_gene_on_panel(diagram, gene_name) {
	var gene_group = d3.select(`#${gene_name}`);

  if (gene_group.attr('class') == 'fusion_group') {
      diagram.svg.select(`#${gene_name}`).remove();
  } else {
    if (diagram.genes.active.has(gene_name)) {
      diagram.genes.active.delete(gene_name);
      diagram.svg.select(`#${gene_name}`).remove();
    }
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
        active_edge = d3.select('#edge_layer')
          .insert('path', ':first-child')
          .attr('id', get_unique_id(diagram, 'edge'))
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
        apply_edge_events(diagram) 
      } else {
				// Not edge mode - is moving gene instead
				var now_active = d3.event.x < active_width;
				var now_panel = d3.event.x > active_width && d3.event.x < svg_width
        if (now_active) {
          move_gene(
            d3.select(this),
            snap_to_grid(
              [d3.event.x, d3.event.y],
              offset = gene_group_radius
            )
          )
          make_gene_active(diagram, this.id)
          refresh_gene_panel(diagram)
        } else if (now_panel) {
          put_gene_on_panel(diagram, this.id)
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

function apply_edge_events(diagram) {
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
      launch_context_menu(diagram, d3.mouse(this))
    })
}

function get_foldchange_color_scale(domain) {
  fc_color = d3.scaleLinear().domain(domain)
    .interpolate(d3.interpolateHsl)
    .range([d3.rgb(overexpressed_color), d3.rgb('#DDDDDD'), d3.rgb(underexpressed_color)])

  return(fc_color)
}

function label_mutation(diagram, gene, data) {
  gene_group = diagram.svg.select(`#${gene}`)

  if (gene_group.select('.mutation_group').empty()) {
    mutation_group = gene_group
      .append('g')
      .attr('class', 'mutation_group')

    mutation_group
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 1/3 * gene_group_width)
      .attr('r', 4.5)
      .style('fill', 'black')

    mutation_group
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 1/3 * gene_group_width)
      .attr('r', 2)
      .style('fill', 'white')

    mutation_group
      .append('text')
      .attr('class', 'mutation_label')
      .attr('x', -10)
      .attr('y', 1/3 * gene_group_width)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(mutation_class_shorthand[data['Variant_Classification']])
      .style('font-size', 13)
  }
}

function update_mutation_layer(diagram) {
  var mutated_active_genes = diagram.get_active_genes(diagram.data.mutation, 'Hugo_Symbol')

  for (gene in mutated_active_genes) {
    label_mutation(diagram, gene, mutated_active_genes[gene])
    label_mutation(diagram, gene + '-inactive', mutated_active_genes[gene])
  }
}

function modify_gene_fill(gene, color) {
  d3.select('#' + gene)
    .select('.gene_node')
    .style('fill', color)
}

function update_expression_foldchange_layer(diagram) {
  var expression_subset = diagram.get_active_genes(diagram.data.expression_foldchange, gene_name_col = 'Description')

  clipping_value = diagram.options.expression_clipping_value
  color_scale = get_foldchange_color_scale([-clipping_value, 0, clipping_value])

  for (gene in expression_subset) {
    modify_gene_fill(gene, color_scale(expression_subset[gene].log2_fc_mean))
    modify_gene_fill(gene + '-inactive', color_scale(expression_subset[gene].log2_fc_mean))
  }
}

function refresh_gene_panel(diagram) {
	var panel_genes_visible = diagram.genes.panel.slice(diagram.genes.panel_range[0], diagram.genes.panel_range[1]);
	console.log(panel_genes_visible)
	d3.selectAll(`.gene_group_panel`).remove()
  d3.selectAll(`.gene_group_inactive`).remove()
  for (gene_name of panel_genes_visible) {
  }

  if (diagram.genes.searched != null) {
    draw_genes_in_panel(diagram, diagram.genes.searched)
  } else {
		var panel_genes_visible = diagram.genes.panel.slice(
			diagram.genes.panel_range[0],
			Math.min(diagram.genes.panel_range[1], diagram.genes.panel.length)
		)
    draw_genes_in_panel(diagram, panel_genes_visible)
  }

  update_expression_foldchange_layer(diagram)
  update_mutation_layer(diagram)
  diagram.update_copynumber_layer()
}

function redraw_active_genes(diagram) {
  for (g of diagram.genes.active) {
    var gene_group = d3.select(`#${g}`)
    var position = get_gene_position(gene_group)
    gene_group.remove()
    draw_gene(diagram, diagram.svg, g, position, 'gene_group_active')
  }
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

function arrays_equal(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function main() {
  let diagram = new Diagram();
  let key_listeners = {
    '8': () => { delete_selected_object(diagram) }, // delete
    '27': () => { diagram.deselect_all() },
    '69': () => { diagram.activate_mode('edge_mode') }, // e
    '78': () => { diagram.activate_mode('node_mode') }, // n
    '190': () => {
      diagram.shift_gene_panel('right') }, // .
    '188': () => {
      diagram.shift_gene_panel('left') }, // ,
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

  d3.select('#search').on('keyup', function() {
    var search_value = d3.select('#search').node().value

    if (! (diagram.feature.search_timeout == null)) {
      clearTimeout(diagram.feature.search_timeout);
    }
    diagram.feature.search_timeout = setTimeout(() => { diagram.run_search() }, search_delay_ms);
  })

  d3.select('#download_button').on('click', function() {
    diagram.export_svg()
  })

  d3.select('#save_button').on('click', function() {
    diagram.save_svg()
  })

  d3.select('#file_loader').on('change', function() {
    console.log(this)
    var file = document.querySelector('#file_loader').files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
      var contents = event.target.result;
      diagram.load_pathway(contents)
    };
    reader.readAsText(file)
  })
}


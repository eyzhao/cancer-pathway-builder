const svg_height = 1000,
      svg_width = 800,
      gene_radius = 6,
      gene_group_width = 20,
      gene_group_radius = gene_group_width/2,
      gene_text_offset = 12,
      gene_text_size = '12px',
      gene_panel_color = '#F8F8F8',
      gene_panel_width = 200

function sanitizeString(str){
    str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
    return str.trim();
}

function add_gene_to_panel(diagram, gene_name) {
  position = diagram.genes.panel.length
  x = 60 + ((position) % 2) * 60
  y = 60 + Math.floor(position/2) * 60

  draw_gene(diagram.gene_panel, gene_name, [x, y])
  diagram.genes.panel.push(gene_name)
}

function draw_gene(svg, gene_name, coord) {
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

  return(gene_group)
}

function get_foldchange_color_scale(domain) {
  fc_color = d3.scaleLinear().domain(domain)
    .interpolate(d3.interpolateHsl)
    .range([d3.rgb('#0000FF'), d3.rgb('#DDDDDD'), d3.rgb('#FF0000')])

  return(fc_color)
}

function add_expression_foldchange_layer(diagram, expression_foldchange_data, clipping_value = 3) {
  expression_subset = expression_foldchange_data
    .filter(row => diagram.genes.active.has(row.Description) || diagram.genes.panel.includes(row.Description))
    .reduce((obj, row) => {
      obj[row.Description] = row
      return obj
    }, {})

  diagram.data.expression.foldchange = expression_subset

  update_expression_foldchange_layer(diagram, clipping_value)
	draw_expression_slider(diagram)
  diagram.view_layers.push('expression_foldchange')
}

function modify_gene_fill(gene, color) {
  d3.select('#' + gene)
    .select('circle')
    .style('fill', color)
}

function update_expression_foldchange_layer(diagram, clipping_value = 3) {
  expression_foldchange_data = diagram.data.expression.foldchange
  color_scale = get_foldchange_color_scale([-clipping_value, 0, clipping_value])

  for (gene of diagram.genes.active) {
    modify_gene_fill(gene, color_scale(expression_subset[gene].log2_fc_mean))
  }

  for (gene of diagram.genes.panel) {
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

function initialize_gene_layer(diagram) {
  var gene_layer = diagram.svg.append('g')
    .attr('id', 'gene_layer')
  return(gene_layer)
}

function initialize_gene_panel() {
  var svg = d3.select('#panel')
    .append('svg')
    .attr('id', 'svg-workspace')
    .attr('width', gene_panel_width)
    .attr('height', svg_height);

  return(svg)
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
    .default(0.015)
    .on('onchange', val => {
      d3.select('p#expression-slider-value').text(d3.format('.2')(val));
      update_expression_foldchange_layer(diagram, clipping_value = val);
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
    gene_panel: initialize_gene_panel(),
    genes: {
      panel: [],
      active: new Set()
    },
    view_layers: [],
    data: {
      expression: {
        foldchange: {}
      }
    }
  }

  diagram.gene_layer = initialize_gene_layer(diagram)

  add_gene_to_panel(diagram, 'TP53')
  add_gene_to_panel(diagram, 'KRAS')
  add_gene_to_panel(diagram, 'ATM')
  add_gene_to_panel(diagram, 'BRCA1')
  add_gene_to_panel(diagram, 'BRCA2')

  d3.tsv("data/example_gtex_comparison.tsv", (expression_foldchange_data) => {
    add_expression_foldchange_layer(diagram, expression_foldchange_data)
  })
}

var graph;
var lastEgoId = '';

window.onload = function(){
	// Change the picture when clicking on the inputs
	$("#settings").submit(function (e) {
		makeHeatmap(graph,true);
		return false;
	});
	$("#render").bind("click", function (){
		makeHeatmap(graph,true);
	});
	
	// Other buttons
	$("#save").bind("click", function (){
		var oCanvas = document.getElementById("canvas") || false;
		var svgdiv = $('#svgdiv') || false;
		if(oCanvas){
			Canvas2Image.saveAsPNG(oCanvas);
		} else if(svgdiv){
			var svg = svgdiv.svg('get');
			
			// Blob Builder
			window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
			var bb = new BlobBuilder;
			
			bb.append(svg.toSVG());
			var blob = bb.getBlob("text/xml+svg;charset=utf-8");
			saveAs(blob, "NetImage.svg");
		}
	})
	$("#makeitbig").bind("click",function() {
		makeHeatmap(graph);
	});


// START - Autoload Test Mode
	$.get("test.gexf", function(data){
		preview.parseGEXF($.parseXML(data)/*,	"s12227967"*/);
	});
// END - Autoload Test Mode
}
var worker;
var params;
	
var makeHeatmap = function(graph) {
	// Close worker if needed
	try{worker.terminate();}catch(e){}
	
	if(graph){
		params = {action:'compute', canvas:{}, boundaries:{}, color:{}, labels:{}, filters:{}};

		params.canvas.w = parseFloat($('#canvas_width').attr('value'));
		params.canvas.h = parseFloat($('#canvas_height').attr('value'));
		params.pixelZoom = parseInt($('#pixelsSize').attr('value'));
		
		params.color.min = parseFloat($('#color_min').attr('value'))/360;
		params.color.max = parseFloat($('#color_max').attr('value'))/360;
		
		params.topoIntensityDecrease = parseInt($('#intensityDecrease').attr('value'));
		
		params.margin = 0.05 * Math.min(params.canvas.w,params.canvas.h);
		
		params.output = $("#outputFormat").val();
		
		if(params.output == "SVG"){
			$("#drawspace").html('<div id="svgdiv" style="width:'+(params.canvas.w*params.pixelZoom)+'px; height:'+(params.canvas.h*params.pixelZoom)+'px;"></div>');
			$('#svgdiv').svg();
			var svg = $('#svgdiv').svg('get');
			svg.configure({viewBox: 0+' '+0+' '+(params.canvas.w)+' '+(params.canvas.h)}, true);
		} else {
			$("#drawspace").html('<canvas id="canvas" width="'+(params.canvas.w*params.pixelZoom)+'" height="'+(params.canvas.h*params.pixelZoom)+'" style="border:1px solid black">Your browser doesn\'t support CANVAS. Burn in Hell or get another one.</canvas>');
			var canvas = document.getElementById('canvas');
			var context = canvas.getContext('2d');
		}
		
		params.boundaries.xmin = d3.min(graph.nodes, function (node) {return node.x ;});
		params.boundaries.xmax = d3.max(graph.nodes, function (node) {return node.x ;});
		params.boundaries.ymin = d3.min(graph.nodes, function (node) {return node.y ;});
		params.boundaries.ymax = d3.max(graph.nodes, function (node) {return node.y ;});
		
		params.ratio = Math.max(params.boundaries.xmax-params.boundaries.xmin, params.boundaries.ymax-params.boundaries.ymin);
		
		params.nodes = [];
		var egoId = $("#egoSelectMenu").val();
		
		if(egoId != "none"){
			// Select Ego Network
			params.nodes = graph.nodes.filter(function(node){
				if(node.id == egoId)
					params.ego = node;
				return node.id == egoId || graph.edges.some(function(edge){
					return (edge.sourceID == egoId && edge.targetID == node.id) || (edge.targetID == egoId && edge.sourceID == node.id);
				});
			});
		} else {
			params.nodes = graph.nodes;
		}
		
		params.spreading = parseFloat($('#spreading').attr('value'));
		params.steps = parseFloat($('#gradient_steps').attr('value'));
		params.approximation = parseFloat($('#approximation').attr('value'));
		params.weighted = $('#weight').is(':checked');
		params.lightnessRatio = parseFloat($('#lightness_ratio').attr('value'));
		
		params.labels.threshold = parseFloat($('#labelsThreshold').attr('value'));
		
		//params.filters.enhanceBorders = $('#enhanceBorders').is(':checked');
		
		// Link spreading to the size of the canvas
		params.spreading *= 0.005 * (Math.min(params.canvas.w, params.canvas.h) - 2 * params.margin);
		
		// Choose the right worker depending on which heatmap to compute.
		if($('#bnw_heatmap').is(':checked')){
			worker = new Worker('ww_compute_bnw_heatmap.js');
		} else if($('#color_heatmap').is(':checked')){
			worker = new Worker('ww_compute_color_heatmap.js');
		} else if($('#voronoi').is(':checked')){
			worker = new Worker('ww_compute_voronoi.js');
		} else if($('#overlay_heatmap').is(':checked')){
			worker = new Worker('ww_compute_spotcloud.js');
		} else if($('#gradient_voronoi').is(':checked')){
			worker = new Worker('ww_compute_voronoi_gradient.js');
		} else if($('#gradient_voronoi_color').is(':checked')){
			worker = new Worker('ww_compute_voronoi_gradient_color.js');
		} else if($('#monadic').is(':checked')){
			params.nodes = graph.nodes;
			if(params.ego){
				worker = new Worker('ww_compute_monadic.js');
			} else {
				alert("Please select an Ego node for Monadic mode.");
			}
		} else if($('#monadic_color').is(':checked')){
			params.nodes = graph.nodes;
			if(params.ego){
				worker = new Worker('ww_compute_monadic_color.js');
			} else {
				alert("Please select an Ego node for Monadic mode.");
			}
		} else if($('#topomonadic').is(':checked')){
			if(params.ego){
				computeDistancesToEgo(params.ego);
				params.nodes = graph.nodes;
				worker = new Worker('ww_compute_topomonadic.js');
			} else {
				alert("Please select an Ego node for Monadic mode.");
			}
		} else if($('#topomonadic_color').is(':checked')){
			if(params.ego){
				computeDistancesToEgo(params.ego);
				params.nodes = graph.nodes;
				worker = new Worker('ww_compute_topomonadic_color.js');
			} else {
				alert("Please select an Ego node for Monadic mode.");
			}
		}
		
		if(worker){
			// Tell what to do when the worker sends notifications
			worker.addEventListener('message', function(e) {
				switch (e.data.notification) {
					case 'draw':
						var draw;
						if(params.output == "SVG"){
							svg.clear();
							draw = function(r, g, b, a, x, y, w, h, zoom){
								if(a == '255'){
									var style = {
										fill: d3.rgb(r, g, b).toString(),
									};
									svg.rect(
										x,
										y,
										w,
										h,
										style
									);
								}
							}
						} else {
							draw = function(r, g, b, a, x, y, w, h, zoom){
								context.fillStyle = "rgba("+r+","+g+","+b+","+a+")";
								context.fillRect(x*zoom, y*zoom, w*zoom, h*zoom);
							}
						}
						for(x=0; x<params.canvas.w; x+=e.data.resolution){
							for(y=0; y<params.canvas.h; y+=e.data.resolution){
								var r = e.data.pixMap.charCodeAt(4*(x*params.canvas.h+y))
								var g = e.data.pixMap.charCodeAt(4*(x*params.canvas.h+y)+1)
								var b = e.data.pixMap.charCodeAt(4*(x*params.canvas.h+y)+2)
								var a = e.data.pixMap.charCodeAt(4*(x*params.canvas.h+y)+3)
								draw(r, g, b, a, x, y, parseInt(e.data.resolution), parseInt(e.data.resolution), params.pixelZoom);
							}
						}
						
						if(Math.round(100*e.data.progress) == 100){
							$('#save').val("Download");
							$('#draw_progress').html("Rendering complete ("+Math.round(0.001*e.data.timelapse)+"s)");
						} else {
							$('#save').val("(not ready yet)");
							$('#draw_progress').html("Progress: "+(Math.round(1000*e.data.progress)/10)+"%<br/>(still "+Math.round(0.001*e.data.timelapse * (1/e.data.progress - 1))+"s)");
						}
						break;
						
					case 'unexpected request':
						console.log('Worker unexpected request: '+e.data.message);
						break;
						
					case 'log':
						console.log(e.data.message);
						break;
						
					default:
						console.log('Worker unhandled notification: ' + e.data);
				};
			}, false);
			
			// Launch worker
			worker.postMessage(params);
		}
	}
}

buildEgoGraphUI = function(preselectedId){
	preselectedId = preselectedId || '';
	$("#egoSelectMenu").html('<option value="none">Ego Mode: Select a Node...</option>'
		+graph.nodes.sort(function(n1,n2){
			if(n1.label < n2.label)
				return -1;
			if (n1.label > n2.label)  
				return 1;
			return 0;  
			}).map(function(node){
				return '<option value="'+node.id+'"'+((node.id == preselectedId)?(" selected=true"):(""))+'>'+node.id+' - '+node.label+'</option>';
			}).join("")
	);
}

filter_blur = function(){
	$('#canvas').pixastic("blurfast", {amount:0.1});
}

filter_posterize = function(){
	var ratio = params.pixelZoom * 0.01 * (Math.min(params.canvas.w, params.canvas.h) - 2 * params.margin);
	$('#canvas').pixastic("unsharpmask", {amount:120, radius:2*ratio, threshold:0}, function(){
		//$('#canvas').pixastic("blur", {});
	});
}

drawLabels = function(){
	var canvas = document.getElementById('canvas');
	var context = canvas.getContext('2d');
	
	context.save();
		
	context.shadowOffsetY = 1;
	context.shadowBlur = 3;
	context.shadowColor = "#000";

	context.textAlign = "center";
	context.textBaseline = "middle";
	
	params.nodes.forEach(function(node){
		if(node.size > params.labels.threshold){
			x = params.margin + (node.x-params.boundaries.xmin) * (params.canvas.w-2*params.margin) / params.ratio;
			y = params.margin + (node.y-params.boundaries.ymin) * (params.canvas.h-2*params.margin) / params.ratio;
			
			x *= params.pixelZoom;
			y *= params.pixelZoom;
			
			var size = Math.round( 2 * Math.min(100,Math.max(1,node.size)) * (Math.min(params.canvas.w, params.canvas.h) - 2 * params.margin) / params.ratio);
			size *= params.pixelZoom;
			size = Math.max(9, size);
			
			context.font = 'bold '+size+'px tahoma';
			context.fillStyle = '#000';
			context.fillText(node.label, x+1, y+1);
			context.fillStyle = '#fff';
			context.fillText(node.label, x, y);
			
		}
	});
	
	context.restore();
}

drawEdges = function(){
	var canvas = document.getElementById('canvas');
	var context = canvas.getContext('2d');
	
	context.save();
	
	context.shadowBlur = 3;
	context.shadowColor = "#000";

	var edges = graph.edges.map(function(e){return e;});
	edges = edges.map(function(edge){
		var sourceNodeIndex = params.nodes.map(function(n){return n.id;}).indexOf(edge.sourceID);
		var targetNodeIndex = params.nodes.map(function(n){return n.id;}).indexOf(edge.targetID);
		if(sourceNodeIndex>=0 && targetNodeIndex>=0){
			edge.keep = true;
			edge.sourceNode = params.nodes[sourceNodeIndex];
			edge.targetNode = params.nodes[targetNodeIndex];
		} else {
			edge.keep = false;
		}
		return edge;
	}).filter(function(edge){
		return edge.keep;
	}).forEach(function(edge){
		sourceNodex = params.margin + (edge.sourceNode.x-params.boundaries.xmin) * (params.canvas.w-2*params.margin) / params.ratio;
		sourceNodey = params.margin + (edge.sourceNode.y-params.boundaries.ymin) * (params.canvas.h-2*params.margin) / params.ratio;
		targetNodex = params.margin + (edge.targetNode.x-params.boundaries.xmin) * (params.canvas.w-2*params.margin) / params.ratio;
		targetNodey = params.margin + (edge.targetNode.y-params.boundaries.ymin) * (params.canvas.h-2*params.margin) / params.ratio;
		
		sourceNodex *= params.pixelZoom;
		sourceNodey *= params.pixelZoom;
		targetNodex *= params.pixelZoom;
		targetNodey *= params.pixelZoom;
		
		context.beginPath();
		context.strokeStyle = "rgba(220,220,220,"+Math.min(0.3, 3 * (Math.min(params.canvas.w, params.canvas.h) - 2 * params.margin) / params.ratio)+")";  
		context.moveTo(sourceNodex,sourceNodey);  
		context.lineTo(targetNodex,targetNodey);  
		context.closePath();
		context.stroke();
	});
	
	context.restore();
}

drawNodes = function(){
	var canvas = document.getElementById('canvas');
	var context = canvas.getContext('2d');
	
	context.save();
	
	context.shadowBlur = 3;
	context.shadowColor = "#000";
	
	params.nodes.forEach(function(node){
		nodex = params.margin + (node.x-params.boundaries.xmin) * (params.canvas.w-2*params.margin) / params.ratio;
		nodey = params.margin + (node.y-params.boundaries.ymin) * (params.canvas.h-2*params.margin) / params.ratio;
		
		nodex *= params.pixelZoom;
		nodey *= params.pixelZoom;
		
		var size = 2 * Math.min(100,Math.max(1,node.size)) * (Math.min(params.canvas.w, params.canvas.h) - 2 * params.margin) / params.ratio;
		size *= params.pixelZoom;
		context.fillStyle = "rgb(240,240,240)";
		
		context.beginPath();
		context.arc(nodex, nodey, size, 0, Math.PI*2, true); 
		context.closePath();
		context.fill();
	});
	postProcessPicture(params, context, true);
	$('#save').val("Download");
	$('#draw_progress').html("Rendering complete");
	
	context.restore();
}

computeDistancesToEgo = function(ego){
	if(lastEgoId != ego.id){
		$('#draw_progress').html("Computing Distances to Ego...");
		graph.nodes.forEach(function(node){
			node.computed = false;
			node.distanceToEgo = -1;
		});
		ego.computed = true;
		ego.distanceToEgo = 0;
		var currentFringe = [ego];
		var currentDistance = 0;
		while(currentFringe.length>0){
			var nextFringe = [];
			// Pour chaque lien...
			graph.edges.forEach(function(edge){
				var node2;
				// ... Si sa source est dans la frange...
				if(currentFringe.some(function(n){return n.id == edge.sourceID})){
					graph.nodes.some(function(n){
						if(n.id == edge.targetID){
							// ...node2 est sa cible...
							node2 = n;
							return true;
						}
						return false;
					});
				}
				// ... Et si sa cible est dans la frange...
				if(currentFringe.some(function(n){return n.id == edge.targetID})){
					graph.nodes.some(function(n){
						if(n.id == edge.sourceID){
							// ...node2 est sa source.
							node2 = n;
							return true;
						}
						return false;
					});
				}
				if(node2 && !node2.computed){
					// Donc si ce lien connecte la frange à autre chose, node2 est cet autre chose.
					// Si node2 n'a pas été calculé,
					node2.distanceToEgo = currentDistance + 1;
					node2.computed = true;
					nextFringe.push(node2);
				}
			});
			currentDistance++;
			currentFringe = nextFringe;
		}
		lastEgoId = ego.id;
		// console.log('Distances to Ego: '+graph.nodes.map(function(n){
			// if(n.computed)
				// return n.distanceToEgo;
			// return "∞";
		// }).join(' '));
	}
}

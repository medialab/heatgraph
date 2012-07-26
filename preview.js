var preview = {
	reader:undefined,
	abortRead:function(){
		preview.reader.abort();
	},
	errorHandler:function(evt){
		switch(evt.target.error.code) {
			case evt.target.error.NOT_FOUND_ERR:
				alert('File Not Found!');
				break;
			case evt.target.error.NOT_READABLE_ERR:
				alert('File is not readable');
				break;
			case evt.target.error.ABORT_ERR:
				break; // noop
			default:
				alert('An error occurred reading this file.');
		};
	},
	updateProgress:function(evt){
		// evt is an ProgressEvent.
		if (evt.lengthComputable) {
			var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
			// Increase the progress bar length.
			if (percentLoaded < 100) {
				var progress = document.querySelector('.percent');
				progress.style.width = percentLoaded + '%';
				progress.textContent = percentLoaded + '%';
			}
		}
	},
	handleFileSelect: function(evt) {
		// Reset progress indicator on new file selection.
		var progress = document.querySelector('.percent');
		progress.style.width = '0%';
		progress.textContent = '0%';
		
		preview.reader = new FileReader();
		preview.reader.onerror = preview.errorHandler;
		preview.reader.onprogress = preview.updateProgress;
		preview.reader.onabort = function(e) {
			alert('File read cancelled');
		};
		preview.reader.onloadstart = function(e) {
			$("#progress_bar").addClass("loading");
			$("#progress_bar_message").removeClass("fail_message");
			$("#progress_bar_message").removeClass("success_message");
			document.getElementById('progress_bar').className = 'loading';
		};
		preview.reader.onload = function(e) {
			// Ensure that the progress bar displays 100% at the end.
			var progress = document.querySelector('.percent');
			progress.style.width = '100%';
			progress.textContent = 'Reading: 100% - Now parsing...';
			setTimeout("preview.parseGEXF($.parseXML(preview.reader.result));", 2000);
		}
		
		preview.reader.readAsText(evt.target.files[0]);
	},

	parseGEXF: function(gexf, preselectedNodeId){
		preselectedNodeId = preselectedNodeId || "";
		var viz="http://www.gexf.net/1.2draft/viz";	// Vis namespace
		
		// Parse Attributes
		// This is confusing, so I'll comment heavily
		var nodesAttributes = [];	// The list of attributes of the nodes of the graph that we build in json
		var edgesAttributes = [];	// The list of attributes of the edges of the graph that we build in json
		var attributesNodes = gexf.getElementsByTagName("attributes");	// In the gexf (that is an xml), the list of xml nodes "attributes" (note the plural "s")
		
		for(i = 0; i<attributesNodes.length; i++){
			var attributesNode = attributesNodes[i];	// attributesNode is each xml node "attributes" (plural)
			if(attributesNode.getAttribute("class") == "node"){
				var attributeNodes = attributesNode.getElementsByTagName("attribute");	// The list of xml nodes "attribute" (no "s")
				for(ii = 0; ii<attributeNodes.length; ii++){
					var attributeNode = attributeNodes[ii];	// Each xml node "attribute"
					id = attributeNode.getAttribute("id");
					title = attributeNode.getAttribute("title");
					type = attributeNode.getAttribute("type");
					var attribute = {id:id, title:title, type:type};
					nodesAttributes.push(attribute);
					
				}
			} else if(attributesNode.getAttribute("class") == "edge"){
				var attributeNodes = attributesNode.getElementsByTagName("attribute");	// The list of xml nodes "attribute" (no "s")
				for(ii = 0; ii<attributeNodes.length; ii++){
					var attributeNode = attributeNodes[ii];	// Each xml node "attribute"
					var id = attributeNode.getAttribute("id");
					var title = attributeNode.getAttribute("title");
					var type = attributeNode.getAttribute("type");
					var attribute = {id:id, title:title, type:type};
					edgesAttributes.push(attribute);
					
				}
			}
		}
		
		var nodes = [];	// The nodes of the graph
		var nodesNodes = gexf.getElementsByTagName("nodes")	// The list of xml nodes "nodes" (plural)
		for(i=0; i<nodesNodes.length; i++){
			var nodesNode = nodesNodes[i];	// Each xml node "nodes" (plural)
			var nodeNodes = nodesNode.getElementsByTagName("node");	// The list of xml nodes "node" (no "s")
			for(ii=0; ii<nodeNodes.length; ii++){
				var nodeNode = nodeNodes[ii];	// Each xml node "node" (no "s")
				var id = nodeNode.getAttribute("id");
				var label = nodeNode.getAttribute("label") || id;
				
				//viz
				var size = 1;
				var x = 50 - 100*Math.random();
				var y = 50 - 100*Math.random();
				var r = Math.random();
				var g = Math.random();
				var b = Math.random();
				
				var sizeNodes = nodeNode.getElementsByTagName("size");
				if(sizeNodes.length>0){
					sizeNode = sizeNodes[0];
					size = parseFloat(sizeNode.getAttribute("value"));
				}
				var positionNodes = nodeNode.getElementsByTagName("position");
				if(positionNodes.length>0){
					positionNode = positionNodes[0];
					x = parseFloat(positionNode.getAttribute("x"));
					y = -parseFloat(positionNode.getAttribute("y"));
				}
				var colorNodes = nodeNode.getElementsByTagName("color");
				if(colorNodes.length>0){
					colorNode = colorNodes[0];
					r = parseFloat(colorNode.getAttribute("r"))/255;
					g = parseFloat(colorNode.getAttribute("g"))/255;
					b = parseFloat(colorNode.getAttribute("b"))/255;
				}
				
				// Create Node
				var node = {id:id, label:label, size:size, x:x, y:y, color:{r:r, g:g, b:b}, attributes:[]};	// The graph node
				
				// Attribute values
				var attvalueNodes = nodeNode.getElementsByTagName("attvalue");
				for(iii=0; iii<attvalueNodes.length; iii++){
					var attvalueNode = attvalueNodes[iii];
					var attr = attvalueNode.getAttribute("for");
					var val = attvalueNode.getAttribute("value");
					node.attributes.push({attr:attr, val:val});
				}
				nodes.push(node);
			}
		}

		var edges = [];
		var edgesNodes = gexf.getElementsByTagName("edges");
		for(i=0; i<edgesNodes.length; i++){
			var edgesNode = edgesNodes[i];
			var edgeNodes = edgesNode.getElementsByTagName("edge");
			for(ii=0; ii<edgeNodes.length; ii++){
				var edgeNode = edgeNodes[ii];
				var source = edgeNode.getAttribute("source");
				var target = edgeNode.getAttribute("target");
				var edge = {id:ii, sourceID:source, targetID:target, attributes:[]};
				var attvalueNodes = edgeNode.getElementsByTagName("attvalue");
				for(iii=0; iii<attvalueNodes.length; iii++){
					var attvalueNode = attvalueNodes[iii];
					var attr = attvalueNode.getAttribute("for");
					var al = attvalueNode.getAttribute("value");
					edge.attributes.push({attr:attr, val:val});
				}
				edges.push(edge);
			}
		}
		
		graph = {nodesAttributes:nodesAttributes, edgesAttributes:edgesAttributes, nodes:nodes, edges:edges};
		
		if(graph.nodes.length){
			$("#progress_bar_message").addClass("success_message");
			$("#progress_bar_message").html(graph.nodes.length+" nodes and "+graph.edges.length+" edges.");
			$("#validation").addClass("open");
			setTimeout('$("#progress_bar").removeClass("loading");', 2000);
			buildEgoGraphUI(preselectedNodeId);
			makeHeatmap(graph,true);

		} else {
			$("#progress_bar_message").addClass("fail_message");
			$("#progress_bar_message").html(graph.nodes.length+" nodes and "+graph.edges.length+" edges."+"<b> (above the limit)</b>");
			$("#validation").removeClass("open");
			setTimeout('$("#progress_bar").removeClass("loading");', 2000);
		}
	}
}

importScripts('underscore.js');
importScripts('colors.js');
self.addEventListener('message', function(e) {
	var data = e.data;
	switch (data.action) {
		case 'compute':
			if(true){
				// Init the pixMap
				var pixMap = _.range(data.canvas.w).map(function(x){
					return _.range(data.canvas.h).map(function(y){
						var pixel = {r:0, g:0, b:0, a:0, heat:0, computed:false};
						return pixel;
					});
				});
				
				var computedPixels = 0;
				var computedPixels_atLastUpdate = 0;
				var totalPixelsCount = data.canvas.w*data.canvas.h;
				var lastUpdateTime = (new Date()).getTime();
				
				var maxHeatR = 0;
				var maxHeatG = 0;
				var maxHeatB = 0;
				
				// Init geometrics
				_(data.nodes).each(function(node){
					node.scaledX = data.margin + (node.x-data.boundaries.xmin) * (data.canvas.w - 2*data.margin) / data.ratio;
					node.scaledY = data.margin + (node.y-data.boundaries.ymin) * (data.canvas.h - 2*data.margin) / data.ratio;
					
					if(data.weighted){
						node.halflife = Math.sqrt(node.size) * data.spreading;
					} else {
						node.halflife = data.spreading;
					}
					node.t_half = Math.log(2) / node.halflife;
					
					// Approximation
					node.limitDistance = -Math.log(data.approximation)/node.t_half;
				});
				
				function computePixel(x, y, nodes){
					var pixel = pixMap[x][y];
					
					pixel.heatR = _(nodes).reduce(function(sum, node){
						var d = Math.sqrt( Math.pow(node.scaledX - x,2) + Math.pow(node.scaledY - y,2));
						
						var nodeHeat = node.color.r;
						if(data.weighted){
							nodeHeat *= Math.sqrt(node.size) * Math.exp(- node.t_half * d);
						} else {
							nodeHeat *= Math.exp(- node.t_half * d);
						}
						
						return sum + nodeHeat;
						
					}, 0);
					pixel.heatG = _(nodes).reduce(function(sum, node){
						var d = Math.sqrt( Math.pow(node.scaledX - x,2) + Math.pow(node.scaledY - y,2));
						
						var nodeHeat = node.color.g;
						if(data.weighted){
							nodeHeat *= Math.sqrt(node.size) * Math.exp(- node.t_half * d);
						} else {
							nodeHeat *= Math.exp(- node.t_half * d);
						}
						
						return sum + nodeHeat;
						
					}, 0);
					pixel.heatB = _(nodes).reduce(function(sum, node){
						var d = Math.sqrt( Math.pow(node.scaledX - x,2) + Math.pow(node.scaledY - y,2));
						
						var nodeHeat = node.color.b;
						if(data.weighted){
							nodeHeat *= Math.sqrt(node.size) * Math.exp(- node.t_half * d);
						} else {
							nodeHeat *= Math.exp(- node.t_half * d);
						}
						
						return sum + nodeHeat;
						
					}, 0);
					
					
					if(pixel.heatR > maxHeatR)
						maxHeatR = pixel.heatR;
					if(pixel.heatG > maxHeatG)
						maxHeatG = pixel.heatG;
					if(pixel.heatB > maxHeatB)
						maxHeatB = pixel.heatB;
					
					pixel.computed = true;
					computedPixels++;
					
					return pixel;
				}
				
				var drawStack = [];

				function drawSquare(params){
					// Filter nodes
					params.nodes = _(params.nodes).filter(function(node){
						return Math.abs(params.xStart + params.squareLength/2 - node.scaledX)< node.limitDistance + params.squareLength/2
							&& Math.abs(params.yStart + params.squareLength/2 - node.scaledY)< node.limitDistance + params.squareLength/2;
					});
					
					// Compute if needed
					if(params.computeFirstPixel){
						var pixel = computePixel(params.xStart, params.yStart, params.nodes);
					}
					
					// Subdivide drawing if needed
					if(params.squareLength>1){
						var openOnRight = params.xStart + params.squareLength/2 < data.canvas.w;
						var openOnBottom = params.yStart + params.squareLength/2 < data.canvas.h;
						
						drawStack.push({
							xStart: params.xStart,
							yStart: params.yStart,
							squareLength: params.squareLength/2,
							computeFirstPixel: false,
							nodes:params.nodes
						});
						if(openOnRight)
							drawStack.push({
								xStart: params.xStart + params.squareLength/2,
								yStart: params.yStart,
								squareLength: params.squareLength/2,
								computeFirstPixel: true,
								nodes:params.nodes
							});
						if(openOnBottom)
							drawStack.push({
								xStart: params.xStart,
								yStart: params.yStart + params.squareLength/2,
								squareLength: params.squareLength/2,
								computeFirstPixel: true,
								nodes:params.nodes
							});
						if(openOnRight && openOnBottom)
							drawStack.push({
								xStart: params.xStart + params.squareLength/2,
								yStart: params.yStart + params.squareLength/2,
								squareLength: params.squareLength/2,
								computeFirstPixel: true,
								nodes:params.nodes
							});
					}
					
					// Draw the preview image if needed
					var endOfTheBlock = (params.xStart + params.squareLength >= data.canvas.w && params.yStart + params.squareLength >= data.canvas.h);
					var percentStepReachen = (computedPixels - computedPixels_atLastUpdate) > 0.05*totalPixelsCount;
					if(endOfTheBlock || percentStepReachen){
						computedPixels_atLastUpdate = computedPixels;
													
						// Update (due to maxHeat change) and serialize
						var serializedPixMap = "";
						_(pixMap).each(function(col,x){
							_(col).each(function(pixel,y){
								var maxHeat = Math.max(maxHeatR, maxHeatG, maxHeatB);
								if(pixel.computed){
									var normalized_heatR = pixel.heatR/maxHeat;
									var normalized_heatG = pixel.heatG/maxHeat;
									var normalized_heatB = pixel.heatB/maxHeat;
									if(data.steps>0){
										normalized_heatR = Math.floor(data.steps*normalized_heatR)/(data.steps-1);
										normalized_heatG = Math.floor(data.steps*normalized_heatG)/(data.steps-1);
										normalized_heatB = Math.floor(data.steps*normalized_heatB)/(data.steps-1);
									}
									pixel.r = Math.floor(255*normalized_heatR);
									pixel.g = Math.floor(255*normalized_heatG);
									pixel.b = Math.floor(255*normalized_heatB);
									pixel.a = 255;
								}
								serializedPixMap += String.fromCharCode(pixel.r,pixel.g,pixel.b,pixel.a);
							})
						});
						
						// Post result
						var resolution = params.squareLength;
						var currentTime = (new Date()).getTime();
						self.postMessage({notification:'draw', pixMap:serializedPixMap, resolution:resolution, progress:(computedPixels/totalPixelsCount), timelapse:(currentTime-lastUpdateTime)});
						//lastUpdateTime = currentTime;
					}
				}
				
				var squareLength = 1;
				while(squareLength < data.canvas.w || squareLength < data.canvas.h){
					squareLength *= 2;
				}
				
				drawStack.push({xStart:0, yStart:0, squareLength:squareLength, computeFirstPixel:true, nodes:data.nodes});
				while(drawStack.length>0){
					drawSquare(drawStack.shift());
				}
			} else {
				self.postMessage({notification:'unexpected request', message:'Unknown action: '+data});
			}
			break;
			
		default:
			self.postMessage({notification:'unexpected request', message:'Unknown action: '+data});
	};
}, false);

log = function(message){
	self.postMessage({notification:'log', message:message});
}
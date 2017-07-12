	window.requestNextAnimationFrame = 
		(function(){
			var originalWebkitMethod,
				wrapper = undefined,
				geckoVersion = 0,
				userAgent = navigator.userAgent,
				index = 0,
				self = this;
			if(window.webkitRequestAnimationFrame){
				wrapper = function(time){
					if(time === undefined){
						time = +new Date();
					}
					self.callback(time);
				};

				originalWebkitMethod = window.webkitRequestAnimationFrame;
				window.webkitRequestAnimationFrame = 
					function(callback,element){
						self.callback = callback;
						originalWebkitMethod(wrapper,element);
					}
			}

			if(window.mozRequestAnimationFrame){
				index = userAgent.indexOf('rv:');

				if(userAgent.indexOf('Gecko') != -1){
					geckoVersion = userAgent.substr(index + 3,3);
					if(geckoVersion === '2.0'){
						window.mozRequestAnimationFrame = undefined;
					}
				}
			}

			return window.requestAnimationFrame ||
				   window.webkitRequestAnimationFrame ||
				   window.mozRequestAnimationFrame ||
				   window.oRequestAnimationFrame ||
				   window.msRequestAnimationFrame ||
				   function(callback,element){
				   		var start,
				   			finish;
				   		window.setTimeout(function(){
				   			start = +new Date();
				   			callback(start);
				   			finish = +new Date();

				   			self.timeout = 1000/60 - (finish - start);
				   		},self.timeout);
				   };
		})();

	function windowToCanvas(canvas,x,y){//将浏览器坐标系转换成canvas坐标系
		var bbox = canvas.getBoundingClientRect();
		return {
			x : x - bbox.left * (canvas.width / bbox.width),
			y : y - bbox.top * (canvas.height / bbox.height)
		}
	}

	function createdashedLineTo(context){//通过扩展CanvasRenderingContext2D来绘制虚线
		var moveToFunction = CanvasRenderingContext2D.prototype.moveTo;
		//获取指向绘图环境对象中moveTo()方法的引用
		CanvasRenderingContext2D.prototype.lastMoveToLocation = {};
		//向canvas绘图环境中新增一个名为lastMoveToLocation的属性

		CanvasRenderingContext2D.prototype.moveTo = function(x,y){
		//重新定义绘图环境对象的moveTo方法，将传给该方法的点保存到lastMoveToLocation的属性之中
			moveToFunction.apply(context,[x,y]);
			this.lastMoveToLocation.x = x;
			this.lastMoveToLocation.y = y;
		}

		CanvasRenderingContext2D.prototype.dashedLineTo = function(x,y,dashLength){//扩展绘制虚线方法
			dashLength = dashLength === undefined ? 5 : dashLength;//虚线长度默认为5

			var startX = this.lastMoveToLocation.x;//获取起始点
			var startY = this.lastMoveToLocation.y;

			var deltaX = x - startX;//计算两点差值用于计算线段总长
			var deltaY = y - startY;

			var numDashes = Math.floor(Math.sqrt(deltaX * deltaX + deltaY * deltaY)/dashLength);//计算虚线个数

			for(var i = 0 ;i < numDashes; i++)
			{//绘制多个直线形成虚线  当i为奇数时设置起始点从而断开与上一点的连线  偶数时绘制直线
				this[i % 2 === 0 ? 'moveTo' : 'lineTo'](startX + (deltaX / numDashes)*i,
														startY + (deltaY /numDashes) * i);
			}
			this.moveTo(x,y);//将结束点重新设置起始点  方便之后多次调用
		}
	}

	//点对象构造方法
	var Point = function(x,y){
		this.x = x;
		this.y = y;
	}

	//多边形构造方法
	var Polygon = function(centerX,centerY,radius,sides,startAngle,strokeStyle,fillStyle,filled){
		this.x = centerX;
		this.y = centerY;
		this.radius = radius;
		this.sides =sides;
		this.startAngle = startAngle;
		this.strokeStyle = strokeStyle;
		this.fillStyle = fillStyle;
		this.filled = filled;
	}

	Polygon.prototype = {
		getPoints : function(){//获取多边形的各顶点
			var points = [],//存放顶点数组
				angle = this.startAngle || 0;//开始绘制的角度默认为0

				for(var i = 0 ; i < this.sides ; i++ )
				{
					points.push(new Point(this.x + this.radius * Math.sin(angle),
										  this.y + this.radius * Math.cos(angle)));
					angle += 2*Math.PI/this.sides;//每存入一个点  角度就加上每条边对应的圆心角  即2π/边的个数
				}
				return points;
		},
		createPath : function(context){//绘制多边形边的路径
			var points = this.getPoints();
			context.beginPath();
			context.moveTo(points[0].x,points[0].y);
			for(var i = 1; i < points.length ; i++)
			{
				context.lineTo(points[i].x,points[i].y);
			}
			context.closePath();
		},
		stroke : function(context){//绘制多边形并加上边的颜色
			context.save();
			this.createPath(context);
			context.strokeStyle = this.strokeStyle;
			context.stroke();
			context.restore();
		},
		fill : function(context){//绘制多边形并填充颜色
			context.save();
			this.createPath(context);
			context.fillStyle = this.fillStyle;
			context.fill();
			context.restore();
		},
		move : function(x,y){//用于拖拽多边形
			this.x = x;
			this.y = y;
		}
			
	}

	function saveDrawingSurface(context,canvas){//存储当前画布上的图片数据  并返回该数据
		return context.getImageData(0,0,canvas.width,canvas.height);
	}

	function restoreDrawingSurface(context,drawingImageDate){//将存储在变量中的图片数据重新绘制成图片
		context.putImageData(drawingImageDate,0,0);
	}

	var TextCursor = function(width,fillStyle,blink_on,blink_off){//文本输入光标构造函数
		this.fillStyle = fillStyle || 'rgba(0,0,0,.5)';
		this.width = width || 2;
		this.left = 0;
		this.top = 0;
		this.blink_on = blink_on || 500;
		this.blink_off = blink_off || 500;
	}

	TextCursor.prototype = {
		getHeight:function(context){//获取光标高度
			var h = context.measureText('M').width;//返回传给该方法的字符串所占据的宽度
			return h + h/6;//将返回值的7/6作为光标的高度  因为将字母‘M’的宽度在稍微增加一点 就可以得出近似的文本高度
		},

		createPath : function(context){//绘制光标路径
			context.beginPath();
			context.rect(this.left,this.top,this.width,this.getHeight(context));
		},

		draw : function(context,left,bottom){//绘制光标
			context.save();

			this.left = left;
			this.top = bottom - this.getHeight(context);//因为光标为矩形从左上角开始绘制  所以需要top定位  而文字定位是从文字的左下角开始绘制  因此需要减去文字高度

			this.createPath(context);
			context.fillStyle = this.fillStyle;
			context.fill();

			context.restore();
		},

		earse:function(context,imageData){//假定imageData为整个canvas
			context.putImageData(imageData,0,0,
								this.left,this.top,
								this.width,this.getHeight(context));
		},

		blinkCursor : function(context,imageData,loc){//光标闪烁效果
			var that = this;
			clearInterval(that.blinkingInterval);//先清除之前的定时器  避免计时器过多
			this.blinkingInterval = setInterval(function(e){
				that.earse(context,imageData);
				setTimeout(function(e){
					if(that.left == loc.x && 
					   that.top + that.getHeight(context) == loc.y)
							that.draw(context,loc.x,loc.y);
				},that.blink_off);
			},that.blink_off+that.blink_on);
		},

		moveCursor:function(context,imageData,loc){//光标移动
			this.earse(context,imageData);
			imageData = saveDrawingSurface(context,context.canvas);
			restoreDrawingSurface(context,imageData);

			this.draw(context,loc.x,loc.y);
			this.blinkCursor(context,imageData,loc);
			return imageData;
		}
	}

	var TextLine = function(x,y){//文本对象构造函数
		this.text = '';
		this.left = x;
		this.bottom = y;
		this.caret = 0;//插入文本位置
	}

	TextLine.prototype = {
		insert:function(text){//在光标后面插入文字
			this.text = this.text.substring(0,this.caret) + text + 
						this.text.substring(this.caret);
			this.caret += text.length;
		},

		removeCharacterBeforeCaret:function(){//删除光标前一个文字
			if(this.caret === 0)
				return;
			this.text = this.text.substring(0,this.caret-1)+
						this.text.substring(this.caret);
			this.caret --;
		},

		getWidth : function(context){//获取文本宽度
			return context.measureText(this.text).width;
		},

		getHeight : function(context){//获取文本高度
			var h = context.measureText('W').width;
			return h + h/6;
		},

		draw : function(context){
			context.save();
			context.texrAlign = 'start';
			context.textBaseline = 'bottom';

			context.strokeText(this.text,this.left,this.bottom);
			context.fillText(this.text,this.left,this.bottom);

			context.restore();
		},

		earse:function(context,imageData){
			context.putImageData(imageData,0,0);
		}
	}

	Paragraph = function(context,left,top,imageData,cursor){//文本段构造函数  
		this.context = context;//指向绘图环境对象的引用
		this.drawingSurface = imageData;//绘图表面的图像数据
		this.left = left;//文本段的x轴位置
		this.top = top;//文本段的y轴位置
		this.lines = [];//文本数组  存取文本对象
		this.activeLine = undefined;//当前编辑行
		this.cursor = cursor;//光标对象
		this.blinkingInterval = undefined;//光标闪烁定时器
	}

	Paragraph.prototype = {
		isPointInside:function(loc){//判断点是否在段落中
			var c = this.context;
			c.beginPath();
			c.rect(this.left,this.top,
				   this.getWidth(),this.getHeight());
			return c.isPointInPath(loc.x,loc.y);
		},

		getHeight:function(){//获取所有行的高
			var h = 0;
			this.lines.forEach(function(line){
				h += line.getHeight(this.context);
			});

			return h;
		},

		getWidth:function(){//获取最大宽度
			var w = 0,
				widest =0;

			this.lines.forEach(function(line){
				w = line.getWidth(this.context);
				if(w > widest)
					widest = w; 
			})
		},

		draw:function(){//绘制每一行
			this.lines.forEach(function(line){
				line.draw(this.context);
			})
		},

		earse:function(context,imageData){//擦除当前画布绘制上次保存的画布
			context.putImageData(imageData,0,0);
		},

		addLine : function(line){//向文本段对象中添加一个line对象
			this.lines.push(line);
			this.activeLine = line;
			this.moveCursor(line.left,line.bottom);
		},

		blinkCursor:function(x,y){//光标闪烁效果
			var self = this,
				BLINK_OUT = 200,
				BLINK_INTERVAL = 900;

			clearInterval(this.blinkingInterval);
			this.blinkingInterval = setInterval(function(e){
				self.cursor.earse(self.context,self.drawingSurface);

				setTimeout(function(e){
					self.cursor.draw(self.context,self.cursor.left,
									 self.cursor.top + self.cursor.getHeight(context));
				},BLINK_OUT);
			},BLINK_INTERVAL);
		},

		moveCursorCloseTo:function(x,y){//将光标移动到它所包含的字符之间，该方法会将光标放置在离给定的canvas位置最近的两个字符之间
			var line = this.getLine(y);

			if(line){
				line.caret = this.getColumn(line,x);
				this.activeLine = line;
				this.moveCursor(line.getContext(this.context),line.bottom);
			}
		},

		moveCursor:function(x,y){//重新定位文本光标  将光标移动到canvas之中的特定位置上
			this.cursor.earse(this.context,this.drawingSurface);
			this.cursor.draw(this.context,x,y);
			this.blinkCursor(x,y);
		},

		moveLineDown:function(start){//将指定行及其之后的行往下移
			var line;
			for(var i = start;i<this.lines.length;i++)
			{
				line = this.lines[i];
				line.bottom += line.getHeight(this.context);
			}
		},

		getLine:function(y){//获取给定位置最近的文本行
			var line;
			for(i = 0;i < this.lines.length ;i++)
			{
				line = this.lines[i];
				if(y > line.bottom - line.getHeight(context) && 
				   y < line.bottom){//y坐标在文本的高度范围内
					return line;
				}
			}
			return undefined;
		},

		getColumn:function(line,x){//获取离光标最近的两个字符
			var found = false,
				before,
				after,
				closest,
				tmpLine,
				column;

			tmpLine = new TextLine(line.left,line.bottom);
			tmpLine.insert(line.text);

			while(! found && tmpLine.text.length > 0){
				before = tmpLine.left + tmpLine.getWidth(this.context);
				tmpLine.removeCharacterBeforeCaret();
				after = tmpLine.left + tmpLine.getWidth(this.context);

				if(after < x ){
					closest = x - after < before - x ? after : before;
					column = closest === before?
							 tmpLine.text.length + 1 : tmpLine.text.length;
					found = true;
				}
			}
			return column;
		},

		activeLineIsOutOfText:function(){
			return this.activeLine.text.length === 0;
		},

		activeLineIsTopLine:function(){
			return this.lines[0] === this.activeLine;
		},

		moveUpOneLine:function(){//当前行后的所有行上移一行
			var lastActiveText,line,before,after;

			var lastActiveLine = this.activeLine;
			lastActiveText = '' + lastActiveLine.text;

			var activeIndex = this.lines.indexOf(this.activeLine);
			this.activeLine = this.lines[activeIndex - 1];
			this.activeLine.caret = this.activeLine.text.length;

			this.lines.splice(activeIndex,1);

			this.moveCursor(this.activeLine + this.activeLine.getWidth(this.context),this.activeLine.bottom);

			this.activeLine.text += lastActiveText;

			for(var i = activeIndex;i<this.lines.length;i++)
			{
				line = this.lines[i];
				line.bottom -= line.getHeight(this.context);
			}
		},

		insert:function(text){//在文本段中插入文本
			this.activeLine.earse(this.context,this.drawingSurface);//将当前活动的文本擦除
			this.activeLine.insert(text);//然后将文本插入该行
			var t = this.activeLine.text.substring(0,this.activeLine.caret),
				w = this.context.measureText(t).width;
			
			this.moveCursor(this.activeLine.left + w,this.activeLine.bottom);//光标移动到行内插入文本的地方
			this.activeLine.draw(this.context);//重新绘制该行内容
		},

		newline:function(){
			var textBeforeCursor = this.activeLine.text.substring(0,this.activeLine.caret),
				textAfterCursor = this.activeLine.text.substring(this.activeLine.caret),
				height = this.context.measureText('W').width +
						 this.context.measureText('W').width /6,
				bottom = this.activeLine.bottom + height,
				activeIndex,
				line;

				this.earse(this.context,this.drawingSurface);//擦除当前段落
				this.activeLine.text = textBeforeCursor;//当前活动文本值变为光标前半段

				line = new TextLine(this.activeLine.left,bottom);//创建新的文本对象  即新行  与之前的文本左对齐 高度相差文字高度
				line.insert(textAfterCursor);//在新行上插入换行下来的后半段

				activeIndex = this.lines.indexOf(this.activeLine);//获取原段落在原文本数组中的下标

				this.lines.splice(activeIndex + 1,0,line);//将新文本行插入到换行前文本的后一位
				this.activeLine = line;//将新行变成当前活动文本
				this.activeLine.caret = 0;//光标移动到最前面

				activeIndex = this.lines.indexOf(this.activeLine);//获取新行下标
				for(var i = activeIndex + 1; i < this.lines.length ; i++)
				{
					line = this.lines[i];
					line.bottom += height;//将新行后的所有文本移动到下一行
				}
				this.draw();
				this.cursor.draw(this.context,this.activeLine.left,this.activeLine.bottom);

		},

		backspace : function(){
			var lastActiveLine,
				activeIndex,
				t,w;

			this.context.save();
			if(this.activeLine.caret === 0){//光标是否位于当前文本行的最左端
				if(!this.activeLineIsTopLine()){//当前行是否为第一行
					this.earse(this.context,this.drawingSurface);//如果不为第一行且光标位于最左端  将整个文本擦除  
					this.moveUpOneLine();//将当前文本行之下的各行依次上移一行
					this.draw();//重新绘制文本段
				}
			}
			else{//否则删除前一个字符 重新绘制当前文本

				//this.context.fillStyle = fillStyleSelect.value;
				//this.context.strokeStyle = strokeStyleSelect.value;
				
				this.activeLine.earse(this.context,this.drawingSurface);
				this.activeLine.removeCharacterBeforeCaret();

				t = this.activeLine.text.slice(0, this.activeLine.caret);
				w = this.context.measureText(t).width;

				this.moveCursor(this.activeLine.left + w,this.activeLine.bottom);
				this.activeLine.draw(this.context);
			}
			context.restore();
		}
	}
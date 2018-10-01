lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.ForEach", lc.dynamicui.elements.DynamicElement,
		function(element) {
			if (element.nodeName == "LC-DYN-FOREACH") {
				this.arrayExpression = element.getAttribute("array");
				this.varName = element.getAttribute("var");
				this.content = element.innerHTML;
			} else if (element.getAttribute("lc-dyn-foreach")) {
				var s = element.getAttribute("lc-dyn-foreach");
				var i = s.indexOf(' in ');
				if (i < 0) throw "Invalid foreach expression: " + s;
				this.varName = s.substring(0, i).trim();
				this.arrayExpression = s.substring(i + 4).trim();
				this.content = element;
				element.removeAttribute("lc-dyn-foreach");
			} else
				throw new Error("Unable to determine how to process foreach element");
			
			this.startComment = document.createComment("for each " + this.varName + " in " + this.arrayExpression);
			this.endComment = document.createComment("end for each " + this.varName + " in " + this.arrayExpression);
			element.parentNode.insertBefore(this.startComment, element);
			element.parentNode.insertBefore(this.endComment, element);
			lc.html.remove(element);
			
			lc.dynamicui.elements.DynamicElement.call(this, this.startComment);
			this.arrayValue = undefined;
			this.arrayElements = [];
			this.arrayExpression = new lc.dynamicui.Expression(this.arrayExpression, this.element);
			lc.dynamicui.registerElement(this, [this.arrayExpression]);
		}, {
			
			evaluate: function() {
				var arr = this.arrayExpression.evaluate();
				if (lc.dynamicui.equals(arr, this.arrayValue)) {
					//if (lc.log.trace("lc.dynamicui.ForEach")) lc.log.trace("lc.dynamicui.ForEach", "array still the same: " + this.arrayExpression.expression);
					return;
				}
				if (lc.log.trace("lc.dynamicui.ForEach")) lc.log.trace("lc.dynamicui.ForEach", "array changed: " + this.arrayExpression.expression);
				var newElements = [];
				if (arr && arr.length > 0) {
					for (var i = 0; i < arr.length; ++i) {
						var elem = arr[i];
						var found = false;
						for (var j = 0; j < this.arrayElements.length; ++j) {
							if (lc.dynamicui.equals(elem, this.arrayElements[j].value)) {
								newElements.push(this.arrayElements[j])
								this.arrayElements.splice(j, 1);
								found = true;
								break;
							}
						}
						if (!found)
							newElements.push(this.createElement(elem, i));
					}
				}
				for (var i = 0; i < this.arrayElements.length; ++i)
					for (var j = 0; j < this.arrayElements[i].elements.length; ++j)
						lc.html.remove(this.arrayElements[i].elements[j]);
				this.arrayElements = newElements;
				this.arrayValue = arr;
				for (var i = 0; i < this.arrayElements.length; ++i) {
					for (var j = 0; j < this.arrayElements[i].elements.length; ++j) {
						var element = this.arrayElements[i].elements[j];
						var alreadyThere = element.parentNode;
						this.startComment.parentNode.insertBefore(element, this.endComment);
						if (!alreadyThere)
							lc.html.processor.process(element);
					}
				}
			},
			
			createElement: function(value, index) {
				if (typeof this.content === 'string') {
					var e = document.createElement("DIV");
					e.innerHTML = this.content;
					var result = {
						elements: [],
						value: value
					};
					while (e.childNodes.length > 0) {
						var elem = e.removeChild(e.childNodes[0]);
						this._setContext(elem, value, index);
						result.elements.push(elem);
					}
					return result;
				}
				var e = this.content.cloneNode(true);
				this._setContext(e, value, index);
				return { elements: [e], value: value };
			},
			
			_setContext: function(element, value, index) {
				var ctx = lc.Context.get(element);
				ctx.addProperty(this.varName, value);
				ctx.addProperty(this.varName + "Index", index);
			}
			
		}
	);
	
});
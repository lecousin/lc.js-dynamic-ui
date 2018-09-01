lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.ForEach", lc.dynamicui.elements.DynamicElement,
		function(element) {
			this.arrayExpression = element.getAttribute("array");
			this.varName = element.getAttribute("var");
			this.content = element.innerHTML;
			this.startComment = document.createComment("for each " + this.varName + " in " + this.arrayExpression);
			this.endComment = document.createComment("end for each " + this.varName + " in " + this.arrayExpression);
			element.parentNode.insertBefore(this.startComment, element);
			element.parentNode.insertBefore(this.endComment, element);
			lc.html.remove(element);
			lc.dynamicui.elements.DynamicElement.call(this, this.startComment);
			this.arrayValue = undefined;
			this.arrayElements = [];
			lc.dynamicui.registerElement(this, [this.arrayExpression]);
		}, {
			
			evaluate: function() {
				var arr = lc.dynamicui.evaluate(this.arrayExpression, this.element);
				if (lc.dynamicui.equals(arr, this.arrayValue)) return;
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
					lc.html.remove(this.arrayElements[i].element);
				this.arrayElements = newElements;
				this.arrayValue = arr;
				for (var i = 0; i < this.arrayElements.length; ++i) {
					var alreadyThere = this.arrayElements[i].element.parentNode;
					this.startComment.parentNode.insertBefore(this.arrayElements[i].element, this.endComment);
					if (!alreadyThere)
						lc.html.processor.process(this.arrayElements[i].element);
				}
			},
			
			createElement: function(value, index) {
				var e = document.createElement("DIV");
				var ctx = lc.Context.get(e);
				ctx.addProperty(this.varName, value);
				ctx.addProperty(this.varName + "Index", index);
				e.innerHTML = this.content;
				return {
					element: e,
					value: value
				};
			}
			
		}
	);
	
});
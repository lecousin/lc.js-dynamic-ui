lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.Conditional", lc.dynamicui.elements.DynamicElement,
		function(element) {
			if (element.nodeName == "LC-DYN-IF") {
				this.condition = element.getAttribute("condition");
				this.content = element.innerHTML;
			} else if (element.getAttribute("lc-dyn-if")) {
				this.condition = element.getAttribute("lc-dyn-if");
				this.content = element;
				element.removeAttribute("lc-dyn-if");
			} else
				throw new Error("Unable to determine how to process if element");
			
			this.startComment = document.createComment("if " + this.condition);
			this.endComment = document.createComment("end if " + this.condition);
			element.parentNode.insertBefore(this.startComment, element);
			element.parentNode.insertBefore(this.endComment, element);
			lc.html.remove(element);
			
			lc.dynamicui.elements.DynamicElement.call(this, this.startComment);
			this.conditionValue = undefined;
			this.condition = new lc.dynamicui.Expression(this.condition, this.element);
			this.currentElements = [];
			lc.dynamicui.registerElement(this, [this.condition]);
		}, {
			
			evaluate: function() {
				var condition = this.condition.evaluate();
				if (condition !== undefined) condition = condition ? true : false;
				if (condition === this.conditionValue) return;
				this.conditionValue = condition;
				if (!condition) {
					for (var i = 0; i < this.currentElements.length; ++i)
						lc.html.remove(this.currentElements[i]);
					this.currentElements = [];
				} else {
					if (typeof this.content === 'string') {
						var e = document.createElement("DIV");
						e.innerHTML = this.content;
						while (e.childNodes.length > 0)
							this.currentElements.push(e.removeChild(e.childNodes[0]));
					} else
						this.currentElements.push(this.content.cloneNode(true));
					for (var i = 0; i < this.currentElements.length; ++i) {
						this.endComment.parentNode.insertBefore(this.currentElements[i], this.endComment);
						lc.html.processor.process(this.currentElements[i]);
					}
				}
			}
			
		}
	);
	
});
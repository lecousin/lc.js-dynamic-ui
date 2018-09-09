lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.DynamicValue", lc.dynamicui.elements.DynamicElement,
		function(element) {
			var span = document.createElement("SPAN");
			this.expression = new lc.dynamicui.Expression(element.textContent, span);
			element.parentNode.insertBefore(span, element);
			lc.html.remove(element);
			element = span;
			this.comment = document.createComment(this.expression.expression);
			element.appendChild(this.comment);
			this.value = undefined;
			this.asHTML = element.hasAttribute("as-html");
			lc.dynamicui.elements.DynamicElement.call(this, element);
			lc.dynamicui.registerElement(this, [this.expression]);
		}, {
			
			evaluate: function() {
				var value = this.expression.evaluate();
				if (lc.dynamicui.equals(value, this.value)) return;
				this.value = value;
				lc.html.removeChildrenAfter(this.comment);
				var txt = this.value;
				if (txt === undefined) txt = "";
				if (txt === null) txt = "";
				if (this.asHTML) {
					var tmp = document.createElement("DIV");
					tmp.innerHTML = txt;
					while (tmp.childNodes.length > 0)
						this.element.appendChild(tmp.childNodes[0]);
					lc.html.processor.process(this.element);
				} else {
					this.element.appendChild(document.createTextNode(txt));
				}
			}
			
		}
	);
	
});
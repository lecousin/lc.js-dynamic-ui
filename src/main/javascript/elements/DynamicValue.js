lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.DynamicValue", lc.dynamicui.elements.DynamicElement,
		function(element) {
			element.style.display = "inline-block";
			this.expression = element.textContent;
			lc.html.empty(element);
			this.comment = document.createComment(this.expression);
			element.appendChild(this.comment);
			this.value = undefined;
			this.asHTML = element.hasAttribute("as-html");
			lc.dynamicui.elements.DynamicElement.call(this, element);
			lc.dynamicui.registerElement(this, [this.expression]);
		}, {
			
			evaluate: function() {
				var value = lc.dynamicui.evaluate(this.expression, this.element);
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
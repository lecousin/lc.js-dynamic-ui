lc.app.onDefined("lc.dynamicui.elements.DynamicElement", function() {
	
	lc.core.extendClass("lc.dynamicui.elements.ApplyTemplate", lc.dynamicui.elements.DynamicElement,
		function(element) {
			this.templateName = element.getAttribute("name");
			this.variables = [];
			for (var i = 0; i < element.childNodes.length; ++i) {
				var node = element.childNodes[i];
				if (node.nodeType == 1) {
					if (node.nodeName == "VARIABLE") {
						this.variables.push({
							name: node.getAttribute("name"),
							expression: node.textContent
						});
					}
				}
			}
			this.comment = document.createComment("lc-dyn-apply-template: " + this.templateName);
			element.parentNode.insertBefore(this.comment, element);
			var ctx = lc.Context.aggregate(element);
			lc.html.remove(element);
			
			if (typeof ctx["lc-dyn-template-" + this.templateName] === 'undefined') {
				lc.log.error("lc-dynamicui-apply-template", "Unknown template " + this.templateName);
				return;
			}

			var template = ctx["lc-dyn-template-" + this.templateName];
			if (template.length == 1)
				element = template[0].cloneNode(true);
			else {
				element = document.createElement("DIV");
				for (var i = 0; i < template.length; ++i)
					element.appendChild(template[i].cloneNode(true));
			}
			lc.html.insertAfter(element, this.comment);

			ctx = lc.Context.get(element);
			
			lc.dynamicui.elements.DynamicElement.call(this, element);
			var expressions = [];
			for (var i = 0; i < this.variables.length; ++i) {
				this.variables[i].expression = new lc.dynamicui.Expression(this.variables[i].expression, element);
				expressions.push(this.variables[i].expression);
				ctx.addProperty(this.variables[i].name, undefined);
			}
			lc.dynamicui.registerElement(this, expressions);
			
			lc.html.processor.process(element);
		}, {
			
			evaluate: function() {
				var ctx = lc.Context.get(this.element);
				for (var i = 0; i < this.variables.length; ++i) {
					var v = this.variables[i];
					var val = v.expression.evaluate();
					if (lc.dynamicui.equals(val, ctx[v.name])) continue;
					ctx[v.name] = val;
				}
			}
			
		}
	);
	
});
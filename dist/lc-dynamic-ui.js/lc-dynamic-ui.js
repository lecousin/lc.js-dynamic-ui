lc.core.createClass("lc.dynamicui.DynamicEvent",
	function(object, eventName, eventCode, element) {
		var eventFunction = function(event) {
			lc.dynamicui.evaluate("{" + eventCode + "}", element, object, { event: event });
			lc.dynamicui.needCycle();
		};
	
		if (typeof object["addEventListener"] === 'function')
			lc.events.listen(object, eventName, eventFunction);
		else if (lc.core.instanceOf(object, "lc.events.Producer"))
			object.on(eventName, eventFunction);
		else
			throw "Unable to listen to an event on object " + lc.core.typeOf(object);

		lc.events.listen(element, 'destroy', function() {
			if (typeof object["addEventListener"] === 'function')
				lc.events.unlisten(object, eventName, eventFunction);
			else if (lc.core.instanceOf(object, "lc.events.Producer"))
				object.unlisten(eventName, eventFunction);
		});
	}, {
	}
);
lc.core.createClass("lc.dynamicui.DynamicProperty",
	function(object, propertyName, propertyValue, element) {
		this.object = object;
		this.propertyName = propertyName;
		var callback = new lc.async.Callback(this, this.update);
		lc.dynamicui.watch(propertyValue, element, callback);
		lc.events.listen(element, 'destroy', new lc.async.Callback(this, function() {
			lc.dynamicui.unwatch(propertyValue, element, callback);
		}));
	}, {
		update: function(value, previous) {
			this.object[this.propertyName] = value;
		}
	}
);
lc.core.createClass("lc.dynamicui.elements.DynamicElement",
	function(element) {
		this.element = element;
		element._lc_dynamicui = this;
		lc.events.listen(element, 'destroy', new lc.async.Callback(this, this.destroyed));
	}, {
		
		evaluate: function() {
			// to be overridden
		},
		
		destroyed: function() {
			lc.dynamicui.unregisterElement(this);
			this.element._lc_dynamicui = null;
			this.element = null;
		}
		
	}
);
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
lc.app.onDefined(["lc.html.processor","lc.Context"], function() {
	
	lc.core.namespace("lc.dynamicui", {
		
		registerElement: function(dynElement, expressions) {
			dynElement._watch_callback = function() {
				lc.dynamicui.updateElement(dynElement);
			};
			dynElement._watch_expressions = expressions;
			for (var i = 0; i < expressions.length; ++i)
				lc.dynamicui.watch(expressions[i], dynElement.element, dynElement._watch_callback);
		},
		
		unregisterElement: function(dynElement) {
			for (var i = 0; i < dynElement._watch_expressions.length; ++i)
				lc.dynamicui.unwatch(dynElement._watch_expressions[i], dynElement.element, dynElement._watch_callback);
		},
		
		updateElement: function(dynElement) {
			dynElement.evaluate();
		},
		
		_watchers: [],
		
		watch: function(expression, element, callback) {
			var watcher = {
				expression: expression,
				element: element,
				callback: callback,
				value: undefined,
				check: function() {
					var val = lc.dynamicui.evaluate(this.expression, this.element);
					if (lc.dynamicui.equals(val, this.value)) return false;
					var prev = this.value;
					this.value = val;
					lc.async.Callback.callListeners(this.callback, [val, prev]);
					return true;
				}
			};
			lc.dynamicui._watchers.push(watcher);
			watcher.check();
		},
		
		unwatch: function(expression, element, callback) {
			for (var i = 0; i < lc.dynamicui._watchers.length; ++i) {
				var w = lc.dynamicui._watchers[i];
				if (w.expression === expression && w.element === element && w.callback === w.callback) {
					lc.dynamicui._watchers.splice(i, 1);
					break;
				}
			}
		},
		
		_needCycle: false,
		_nextCycle: null,
		
		needCycle: function() {
			if (lc.dynamicui._needCycle) return;
			lc.dynamicui._needCycle = true;
			if (!lc.dynamicui._nextCycle)
				lc.dynamicui._nextCycle = setTimeout(function() { lc.dynamicui._cycle(); }, 0);
		},
		
		evaluate: function(expression, element, thisObj, additions) {
			var ctx = lc.Context.aggregate(element);
			if (additions)
				for (var n in additions)
					ctx[n] = additions[n];
			var i;
			while ((i = expression.indexOf("$(")) >= 0) {
				var j = expression.indexOf(')', i + 2);
				if (j < 0) break;
				expression = expression.substring(0, i) + "lc.Context.get(document.getElementById(\"" + expression.substring(i + 2, j) + "\"), true)" + expression.substring(j + 1);
			}
			var properties = "";
			var first = true;
			for (var name in ctx) {
				if (first) first = false; else properties += ", ";
				properties += name;
			}
			var code = "(function(" + properties + ")";
			if (expression.startsWith("{"))
				code += expression;
			else
				code += "{return (" + expression + ");}";
			code += ").call(this,";
			first = true;
			for (var name in ctx) {
				if (first) first = false; else code += ", ";
				code += "context." + name;
			}
			code += ")";
			try {
				var value = new Function("context", "return (" + code + ")").call(thisObj, ctx);
				if (lc.log.trace("lc.dynamicui"))
					lc.log.trace("lc.dynamicui", "Expression " + expression + " = " + value + "\r\nthis = " + thisObj + ", properties: " + properties);
				return value;
			} catch (error) {
				if (lc.log.trace("lc.dynamicui"))
					lc.log.trace("lc.dynamicui", "Expression " + expression + ": " + error + "\r\nthis = " + thisObj + ", properties: " + properties);
				return undefined;
			}
		},
		
		equals: function(v1, v2) {
			if (v1 === v2) return true;
			// arrays
			if (Array.isArray(v1)) {
				if (!Array.isArray(v2)) return false;
				if (v1.length != v2.length) return false;
				for (var i = 0; i < v1.length; ++i)
					if (!lc.dynamicui.equals(v1[i], v2[i]))
						return false;
				return true;
			}
			if (Array.isArray(v2))
				return false;
			// objects
			if (typeof v1 === 'object') {
				if (!(typeof v2 === 'object')) return false;
				for (var n in v1) {
					if (!v2.hasOwnProperty(n)) return false;
					if (!lc.dynamicui.equals(v1[n], v2[n]))
						return false;
				}
				for (var n in v2) {
					if (!v1.hasOwnProperty(n)) return false;
				}
				return true;
			}
			if (typeof v2 === 'object') return false;
			// else
			return false;
		},
		
		_cycle: function() {
			var count = 0;
			if (lc.log.debug("lc.dynamicui"))
				lc.log.debug("lc.dynamicui", "Start cycle");
			do {
				for (var i = 0; i < lc.dynamicui._watchers.length; ++i) {
					var w = lc.dynamicui._watchers[i];
					w.check();
				}
				lc.dynamicui._needCycle = false;
			} while ((++count) < 100 && lc.dynamicui._needCycle);
			lc.dynamicui._nextCycle = null;
			if (lc.log.debug("lc.dynamicui"))
				lc.log.debug("lc.dynamicui", "End cycle: " + count);
		}
		
	});
	
	lc.Context.globalEvents.on('changed', function() {
		lc.dynamicui.needCycle();
	});
	
	lc.html.processor.addPreProcessor(function(element, elementStatus, globalStatus) {
		if (element.nodeType == 1) {
			for (var i = 0; i < element.attributes.length; ++i) {
				var a = element.attributes.item(i);
				if (a.name.startsWith("lc-dyn-property-"))
					new lc.dynamicui.DynamicProperty(element, a.name.substring(16), a.value, element);
				else if (a.name.startsWith("lc-dyn-event-"))
					new lc.dynamicui.DynamicEvent(element, a.name.substring(13), a.value, element);
			}
			
			if (element.nodeName == "LC-DYN") {
				new lc.dynamicui.elements.DynamicValue(element);
				elementStatus.stop();
				return;
			}
			if (element.nodeName == "LC-DYN-FOREACH") {
				new lc.dynamicui.elements.ForEach(element);
				elementStatus.stop();
				return;
			}
		}
	}, 5000);
	
});
//# sourceMappingURL=lc-dynamic-ui.js.map
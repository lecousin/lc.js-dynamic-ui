lc.core.createClass("lc.dynamicui.DynamicEvent",
	function(object, eventName, eventCode, element) {
		var eventFunction = function(event) {
			var expression = new lc.dynamicui.Expression("{" + eventCode + "}", element, object, { event: event });
			try {
				expression.evaluate(true);
			} catch (error) {
				lc.log.error("lc.dynamicui.DynamicEvent", "Listener error on " + eventName + ": " + error, error);
			}
			lc.dynamicui.needCycle();
		};

		if (lc.core.instanceOf(object, "lc.events.Producer")) {
			object.on(eventName, eventFunction);
			lc.events.listen(element, 'destroy', function() {
				object.unlisten(eventName, eventFunction);
			});
			return;
		}
		
		if (typeof object["nodeType"] !== 'undefined' && object.nodeType == 1) {
			var ctx = lc.Context.get(object, true);
			if (ctx) {
				for (var name in ctx) {
					var val = ctx[name];
					if (lc.core.instanceOf(val, "lc.events.Producer") && val.hasEvent(eventName)) {
						val.on(eventName, eventFunction);
						lc.events.listen(element, 'destroy', function() {
							val.unlisten(eventName, eventFunction);
						});
						return;
					}
				}
			}
		}
		
		if (typeof object["addEventListener"] === 'function') {
			lc.events.listen(object, eventName, eventFunction);
			lc.events.listen(element, 'destroy', function() {
				lc.events.unlisten(object, eventName, eventFunction);
			});
			return;
		}

		throw new Error("Unable to listen to an event on object " + lc.core.typeOf(object));
	}, {
	}
);
lc.core.createClass("lc.dynamicui.DynamicProperty",
	function(object, propertyName, propertyValue, element) {
		this.object = object;
		this.propertyName = propertyName;
		var callback = new lc.async.Callback(this, this.update);
		var expr = new lc.dynamicui.Expression(propertyValue, element);
		lc.dynamicui.watch(expr, callback);
		lc.events.listen(element, 'destroy', new lc.async.Callback(this, function() {
			lc.dynamicui.unwatch(expr, callback);
		}));
	}, {
		update: function(value, previous) {
			this.object[this.propertyName] = value;
		}
	}
);
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
lc.core.createClass("lc.dynamicui.DynamicData",
	function(element, expression) {
		this.expression = expression;
		this.element = element;
		lc.events.listen(element, "processed", new lc.async.Callback(this, this._linkData));
	}, {
		_linkData: function() {
			if (this.element.nodeName == "INPUT") {
				if (this.element.type == "checkbox" || this.element.type == "radio") {
					this._linkProperty(this.element, "checked");
					lc.events.listen(this.element, "change", lc.dynamicui.needCycle);
				} else {
					this._linkProperty(this.element, "value");
					lc.events.listen(this.element, "keyup", lc.dynamicui.needCycle);
					lc.events.listen(this.element, "change", lc.dynamicui.needCycle);
				}
				return;
			}
			var ctx = lc.Context.get(this.element, true);
			if (ctx) {
				for (var n in ctx) {
					if (lc.core.instanceOf(ctx[n], lc.events.Producer) && typeof ctx[n]["hasOwnProperty"] === 'function') {
						if (ctx[n].hasEvent("change") && ctx[n].hasOwnProperty("value")) {
							this._linkProperty(ctx[n], "value");
							ctx[n].on("change", lc.dynamicui.needCycle);
							return;
						}
					}
				}
			}
			lc.log.warn("lc.dynamicui.DynamicData", "Unable to find how to link data " + this.expression);
		},
		
		_linkProperty: function(object, propertyName) {
			var propExpr = new lc.dynamicui.Expression("this." + propertyName, this.element, object);
			var dataExpr = new lc.dynamicui.Expression(this.expression, this.element, object);
			var dataFromProp = new lc.dynamicui.Expression(this.expression + " = this." + propertyName, this.element, object);
			// initial value
			object[propertyName] = dataExpr.evaluate(false);
			// watch
			var propWatcher, dataWatcher;
			lc.dynamicui.watch(dataExpr, dataWatcher = new lc.async.Callback(this, function(value, previous) {
				object[propertyName] = value;
			}));
			lc.dynamicui.watch(propExpr, propWatcher = new lc.async.Callback(this, function(value, previous) {
				dataFromProp.evaluate(false);
			}));
			// unwatch
			lc.events.listen(this.element, "destroy", function() {
				lc.dynamicui.unwatch(propExpr, propWatcher);
				lc.dynamicui.unwatch(dataExpr, dataWatcher);
			});
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
				this.arrayValue = lc.core.copyDeep(arr);
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
lc.core.createClass("lc.dynamicui.Expression",
	function(expression, element, thisObj, additions) {
		this.expression = expression;
		this.element = element;
		this.thisObj = thisObj;
		this.additions = additions;
		this.currentValue = undefined;
		this.currentCycle = -1;
	},{
		evaluate: function(throws) {
			if (this.currentCycle === lc.dynamicui.getCycleId())
				return this.currentValue;
			
			this.currentCycle = lc.dynamicui.getCycleId();

			try {
				this.currentValue = lc.Context.expression.evaluate(this.expression, this.element, this.thisObj, this.additions);
				if (this.currentValue && lc.core.instanceOf(this.currentValue, lc.async.Future)) {
					var future = this.currentValue;
					if (future.isDone())
						this.currentValue = future.getResult();
					else {
						this.currentValue = undefined;
						future.onsuccess(new lc.async.Callback(this, function(result) {
							this.currentValue = result;
							lc.dynamicui.needCycle();
						}));
					}
					if (lc.log.trace("lc.dynamicui.Expression"))
						lc.log.trace("lc.dynamicui.Expression", this.expression + " = " + this.currentValue + "\r\ntype = " + lc.core.typeOf(this.currentValue) + ", this = " + this.thisObj + ", properties: " + properties);
				}
			} catch (error) {
				if (throws) throw error;
				this.currentValue = undefined;
			}
			return this.currentValue;
		}
	}
);
lc.app.onDefined(["lc.html.processor","lc.Context"], function() {
	
	lc.core.namespace("lc.dynamicui", {
		
		registerElement: function(dynElement, expressions) {
			if (!dynElement.element) throw new Error("Dynamic element must have an element attached");
			dynElement._watch_callback = function() {
				lc.dynamicui.updateElement(dynElement);
			};
			dynElement._watch_expressions = expressions;
			for (var i = 0; i < expressions.length; ++i)
				lc.dynamicui.watch(expressions[i], dynElement._watch_callback);
			lc.dynamicui.needCycle();
		},
		
		unregisterElement: function(dynElement) {
			for (var i = 0; i < dynElement._watch_expressions.length; ++i)
				lc.dynamicui.unwatch(dynElement._watch_expressions[i], dynElement._watch_callback);
			lc.dynamicui._elementsToUpdate.remove(dynElement);
		},
		
		_elementsToUpdate: [],
		
		updateElement: function(dynElement) {
			lc.dynamicui._elementsToUpdate.push(dynElement);
		},
		
		_updateElements: function() {
			var roots = [];
			for (var i = 0; i < lc.dynamicui._elementsToUpdate.length; ++i) {
				var e = lc.dynamicui._elementsToUpdate[i];
				if (!e.element) continue; // already removed
				var found = false;
				for (var j = 0; j < roots.length; ++j) {
					if (roots[j] === e) {
						found = true;
						break;
					}
					if (lc.xml.isAncestorOf(roots[j].element, e.element)) {
						found = true;
						break;
					}
				}
				if (found) continue;
				for (var j = 0; j < roots.length; ++j) {
					if (lc.xml.isAncestorOf(e.element, roots[j].element)) {
						roots.splice(j, 1);
						j--;
					}
				}
				roots.push(e);
			}
			for (var i = 0; i < roots.length; ++i)
				if (roots[i].element)
					lc.dynamicui._updateElementsHierarchy(roots[i].element);
		},
		
		_updateElementsHierarchy: function(element) {
			if (element._lc_dynamicui) {
				element._lc_dynamicui.evaluate();
			}
			for (var i = 0; i < element.childNodes.length; ++i)
				lc.dynamicui._updateElementsHierarchy(element.childNodes[i]);
		},
		
		_watchers: [],
		
		watch: function(expression, callback) {
			if (!lc.core.instanceOf(expression, lc.dynamicui.Expression))
				throw new Error("lc.dynamicui.watch must be called with a lc.dynamicui.Expression instance, given is: " + lc.core.typeOf(expression));
			var watcher = {
				expression: expression,
				callback: callback,
				value: undefined,
				check: function() {
					var val = this.expression.evaluate();
					if (lc.dynamicui.equals(val, this.value)) return false;
					// TODO trace or debug
					var prev = this.value;
					this.value = val;
					lc.async.Callback.callListeners(this.callback, [val, prev]);
					return true;
				}
			};
			lc.dynamicui._watchers.push(watcher);
			watcher.check();
		},
		
		unwatch: function(expression, callback) {
			for (var i = 0; i < lc.dynamicui._watchers.length; ++i) {
				var w = lc.dynamicui._watchers[i];
				if (w.expression === expression && w.callback === w.callback) {
					lc.dynamicui._watchers.splice(i, 1);
					break;
				}
			}
		},
		
		_needCycle: false,
		_nextCycle: null,
		_cycleId: 0,
		
		needCycle: function() {
			if (lc.dynamicui._needCycle) return;
			if (lc.log.trace("lc.dynamicui")) {
				try { throw new Error(); } catch (e) {
					lc.log.trace("lc.dynamicui", "needCycle here:\r\n" + e.stack);
				}
			}
			lc.dynamicui._needCycle = true;
			if (!lc.dynamicui._nextCycle)
				lc.dynamicui._nextCycle = setTimeout(function() { lc.dynamicui._cycle(); }, 0);
		},
		
		getCycleId: function() {
			return lc.dynamicui._cycleId;
		},
		
		equals: function(v1, v2, done) {
			if (v1 === null || v2 === null) return v1 === v2;
			if (v1 === undefined || v2 === undefined) return v1 === v2;
			if (!done) done = [];
			if (done.contains(v1) && done.contains(v2)) return true;
			done = done.slice();
			done.push(v1);
			done.push(v2);
			// arrays
			if (Array.isArray(v1)) {
				if (!Array.isArray(v2)) return false;
				if (v1.length != v2.length) return false;
				for (var i = 0; i < v1.length; ++i)
					if (!lc.dynamicui.equals(v1[i], v2[i], done))
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
					if (!lc.dynamicui.equals(v1[n], v2[n], done))
						return false;
				}
				for (var n in v2) {
					if (!v1.hasOwnProperty(n)) return false;
				}
				return true;
			}
			if (typeof v2 === 'object') return false;
			// else
			return v1 === v2;
		},
		
		_cycle: function() {
			var count = 0;
			if (lc.log.debug("lc.dynamicui"))
				lc.log.debug("lc.dynamicui", "Start cycle");
			var start = new Date().getTime();
			do {
				lc.dynamicui._cycleId++;
				lc.dynamicui._needCycle = false;
				if (count > 0 && lc.log.debug("lc.dynamicui"))
					lc.log.debug("lc.dynamicui", "New cycle needed (" + count + ")");
				for (var i = 0; i < lc.dynamicui._watchers.length; ++i) {
					var w = lc.dynamicui._watchers[i];
					w.check();
				}
				lc.dynamicui._updateElements();
			} while ((++count) < 100 && lc.dynamicui._needCycle);
			lc.dynamicui._nextCycle = null;
			if (lc.log.debug("lc.dynamicui"))
				lc.log.debug("lc.dynamicui", "End cycle: " + count + " done in " + (new Date().getTime() - start) + "ms.");
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
				else if (a.name == "lc-dyn-controller") {
					var clazz = a.value;
					var name = "controller";
					var j = clazz.indexOf(" as ");
					if (j > 0) {
						name = clazz.substring(j + 4).trim();
						clazz = clazz.substring(0, j).trim();
					}
					var ctor = lc.core.fromName(clazz);
					if (!ctor) {
						lc.log.error("lc.dynamicui", "Controller class does not exist: " + clazz);
					} else {
						var controller = new ctor(element, elementStatus);
						lc.Context.get(element).setProperty(name, controller);
					}
				} else if (a.name == "lc-dyn-data")
					new lc.dynamicui.DynamicData(element, a.value);
			}
			
			if (element.nodeName == "LC-DYN") {
				new lc.dynamicui.elements.DynamicValue(element);
				elementStatus.stop();
				return;
			}
			if (element.nodeName == "LC-DYN-IF" || element.getAttribute("lc-dyn-if")) {
				new lc.dynamicui.elements.Conditional(element);
				elementStatus.stop();
				return;
			}
			if (element.nodeName == "LC-DYN-FOREACH" || element.getAttribute("lc-dyn-foreach")) {
				new lc.dynamicui.elements.ForEach(element);
				elementStatus.stop();
				return;
			}
			if (element.nodeName == "LC-DYN-TEMPLATE" || element.getAttribute("lc-dyn-template")) {
				new lc.dynamicui.Template(element);
				elementStatus.stop();
				return;
			}
			if (element.nodeName == "LC-DYN-APPLY-TEMPLATE") {
				new lc.dynamicui.elements.ApplyTemplate(element);
				elementStatus.stop();
				return;
			}
		}
	}, 20000);
	
	lc.html.processor.addPostProcessor(function(element, elementStatus, globalStatus) {
		if (element.nodeType == 1) {
			for (var i = 0; i < element.attributes.length; ++i) {
				var a = element.attributes.item(i);
				if (a.name.startsWith("lc-dyn-event-"))
					new lc.dynamicui.DynamicEvent(element, a.name.substring(13), a.value, element);
				else if (a.name == "lc-dyn-event") {
					var s = a.nodeValue;
					var j = s.indexOf('=');
					var expr = s.substring(j + 1);
					s = s.substring(0, j);
					j = s.indexOf(" on ");
					var eventName = s.substring(0, j).trim();
					var objectName = s.substring(j + 4).trim();
					var obj = lc.Context.searchValue(element, objectName);
					if (!obj) {
						lc.log.error("lc.dynamicui", "lc-dyn-event: Property " + objectName + " not found in the context of the element");
						continue;
					}
					var obj = ctx[objectName];
					if (!lc.core.instanceOf(obj, "lc.events.Producer")) {
						lc.log.error("lc.dynamicui", "lc-dyn-event: Property " + objectName + " is not a lc.events.Producer: " + lc.core.typeOf(obj));
						continue;
					}
					if (!obj.hasEvent(eventName)) {
						lc.log.error("lc.dynamicui", "lc-dyn-event: Property " + objectName + " of type " + lc.Core.typeOf(obj) + " has no event " + eventName);
						continue;
					}
					new lc.dynamicui.DynamicEvent(obj, eventName, expr, element);
				}
			}
		}
		
	}, 5000);
	
	// when an asynchronous operation is done, trigger a new cycle
	lc.app.addAsynchronousOperationListener(function(future) {
		future.ondone(lc.dynamicui.needCycle);
	});
	
});

lc.core.createClass("lc.dynamicui.Template",
	function(element) {
		var ctx = lc.Context.get(element.parentNode);
		element.parentNode.removeChild(element);
		var elements = [];
		var name;
		if (element.nodeName == "LC-DYN-TEMPLATE") {
			while (element.childNodes.length > 0)
				elements.push(element.childNodes[0]);
			name = element.getAttribute("name");
		} else if (element.getAttribute("lc-dyn-template")) {
			elements.push(element);
			name = element.getAttribute("lc-dyn-template");
			element.removeAttribute("lc-dyn-template");
		} else
			throw new Error("Unable to determine how to process template element")
		ctx.addProperty("lc-dyn-template-" + name, elements);
	}, {
	}
);

//# sourceMappingURL=lc-dynamic-ui.js.map
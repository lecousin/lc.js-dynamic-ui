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

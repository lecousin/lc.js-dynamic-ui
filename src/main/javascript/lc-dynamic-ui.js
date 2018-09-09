lc.app.onDefined(["lc.html.processor","lc.Context"], function() {
	
	lc.core.namespace("lc.dynamicui", {
		
		registerElement: function(dynElement, expressions) {
			dynElement._watch_callback = function() {
				lc.dynamicui.updateElement(dynElement);
			};
			dynElement._watch_expressions = expressions;
			for (var i = 0; i < expressions.length; ++i)
				lc.dynamicui.watch(expressions[i], dynElement._watch_callback);
		},
		
		unregisterElement: function(dynElement) {
			for (var i = 0; i < dynElement._watch_expressions.length; ++i)
				lc.dynamicui.unwatch(dynElement._watch_expressions[i], dynElement._watch_callback);
		},
		
		_elementsToUpdate: [],
		
		updateElement: function(dynElement) {
			lc.dynamicui._elementsToUpdate.push(dynElement);
		},
		
		_updateElements: function() {
			var roots = [];
			for (var i = 0; i < lc.dynamicui._elementsToUpdate.length; ++i) {
				var e = lc.dynamicui._elementsToUpdate[i];
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
	}, 5000);
	
	lc.html.processor.addPostProcessor(function(element, elementStatus, globalStatus) {
		if (element.nodeType == 1) {
			for (var i = 0; i < element.attributes.length; ++i) {
				var a = element.attributes.item(i);
				if (a.name.startsWith("lc-dyn-event-"))
					new lc.dynamicui.DynamicEvent(element, a.name.substring(13), a.value, element);
			}
		}
		
	}, 5000);
	
});
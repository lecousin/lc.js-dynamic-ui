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
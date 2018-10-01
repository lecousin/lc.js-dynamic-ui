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
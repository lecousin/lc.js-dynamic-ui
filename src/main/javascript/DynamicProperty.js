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
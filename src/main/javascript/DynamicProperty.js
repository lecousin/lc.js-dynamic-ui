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
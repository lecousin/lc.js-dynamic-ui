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
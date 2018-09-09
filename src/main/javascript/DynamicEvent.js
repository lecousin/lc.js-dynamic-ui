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
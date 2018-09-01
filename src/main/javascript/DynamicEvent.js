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
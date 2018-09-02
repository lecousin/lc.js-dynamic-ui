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

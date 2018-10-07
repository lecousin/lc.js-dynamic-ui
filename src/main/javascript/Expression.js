lc.core.createClass("lc.dynamicui.Expression",
	function(expression, element, thisObj, additions) {
		this.expression = expression;
		this.element = element;
		this.thisObj = thisObj;
		this.additions = additions;
		this.currentValue = undefined;
		this.currentCycle = -1;
	},{
		evaluate: function(throws) {
			if (this.currentCycle === lc.dynamicui.getCycleId())
				return this.currentValue;
			
			this.currentCycle = lc.dynamicui.getCycleId();

			try {
				this.currentValue = lc.Context.expression.evaluate(this.expression, this.element, this.thisObj, this.additions);
				if (this.currentValue && lc.core.instanceOf(this.currentValue, lc.async.Future)) {
					var future = this.currentValue;
					if (future.isDone())
						this.currentValue = future.getResult();
					else {
						this.currentValue = undefined;
						future.onsuccess(new lc.async.Callback(this, function(result) {
							this.currentValue = result;
							lc.dynamicui.needCycle();
						}));
					}
					if (lc.log.trace("lc.dynamicui.Expression"))
						lc.log.trace("lc.dynamicui.Expression", this.expression + " = " + this.currentValue + "\r\ntype = " + lc.core.typeOf(this.currentValue) + ", this = " + this.thisObj + ", properties: " + properties);
				}
			} catch (error) {
				if (throws) throw error;
				this.currentValue = undefined;
			}
			return this.currentValue;
		}
	}
);
var app = require('../../server/server');
var ds = app.dataSources.db;
var ord = ds.getModel ('order');
        
// Hiding the existing remote methods.
ord.sharedClass.find('create',true).shared = false;
ord.sharedClass.find('upsert',true).shared = false;
ord.sharedClass.find('exists',true).shared = false;
ord.sharedClass.find('findById',true).shared = false;
ord.sharedClass.find('find',true).shared = false;
ord.sharedClass.find('findOne',true).shared = false;
ord.sharedClass.find('updateAll',true).shared = false;
ord.sharedClass.find('deleteById',true).shared = false;
ord.sharedClass.find('count',true).shared = false;
ord.sharedClass.find('updateAttributes',false).shared = false;

module.exports = function(order){
	//add item to cart:
	order.addItemToCart = function(productId, qty, cb) {
		var wcToken ; 
		var wcTrustedToken;
		var uId;
		var pId;

		var liHandlers = app.models.LoginIdentityHandler;
			liHandlers.guestIdentity( function(err, liHandlersRes){
				console.log('Guest Id response::'+liHandlersRes);
				if(liHandlersRes){
					var wcToken = liHandlersRes.WCToken; 
					var wcTrustedToken  = liHandlersRes.WCTrustedToken;
					var pId = liHandlersRes.personalizationID;
					var uId = liHandlersRes.userId;
					var ordHandlers = app.models.OrderHandler;
					
					ordHandlers.addItem2Cart(productId, qty, wcToken, wcTrustedToken, pId, uId, function(err, ordHandlersRes){
						//console.log(ordHandlersRes);

						cb(null, ordHandlersRes);
					});
				}		
			});
	}
    order.remoteMethod(
        'addItemToCart', 
        {
          accepts: [{arg: 'productId', type: 'string'},{arg: 'qty', type: 'number'}],
		  http: {path: '/addItemToCart', verb: 'post'},
          returns: {arg: 'addToCart', type: 'JSON'},
        }
    );
	
	
	
	//Get cart details:
	order.getCartDetails = function(wcToken, trustedToken, pId, uId, cb) {

		var ordHandlers = app.models.OrderHandler;
		var orderClass = app.models.order;
		var adjustmentClass = app.models.adjustment;
		var orderItemClass = app.models.orderItem;
		
		ordHandlers.displayCart(wcToken, trustedToken, pId, uId, function(err, cart){
			var orderObj = new orderClass();
			orderObj.orderId = cart.orderId;
			var orderItems = [];
			var ordItems = cart.orderItem;
			var respJSON = [];
			var prodIds = [];
			
			ordItems.forEach(function(ordItem){
				var orderItem = new orderItemClass();
				orderItem.UOM = ordItem.UOM;
				orderItem.currency = ordItem.currency;
				orderItem.createDate = ordItem.createDate;
				orderItem.orderItemId = ordItem.orderItemId;
				orderItem.inventoryStatus = ordItem.orderItemInventoryStatus;
				orderItem.price = ordItem.orderItemPrice;
				orderItem.status = ordItem.orderItemStatus;
				orderItem.partNumber = ordItem.partNumber;
				orderItem.productId = ordItem.productId;
				prodIds.push(ordItem.productId);
				orderItem.productUrl = ordItem.productUrl;
				orderItem.quantity = ordItem.quantity;
				orderItem.salesTax = ordItem.salesTax;
				orderItem.salesTaxCurrency = ordItem.salesTaxCurrency;
				orderItem.shippingCharge = ordItem.shippingCharge;
				orderItem.shippingChargeCurrency = ordItem.shippingChargeCurrency;
				orderItem.shippingTax = ordItem.shippingTax;
				orderItem.shippingTaxCurrency = ordItem.shippingTaxCurrency;
				orderItem.unitPrice = ordItem.unitPrice;
				orderItem.unitQuantity = ordItem.unitQuantity;
				orderItem.unitUOM = ordItem.unitUom;
				orderItems.push(orderItem);
			});
			
			orderObj.orderItem = orderItems;
			var cartAdj = cart.adjustment;
			var cartAdjs = [];
			cartAdj.forEach(function(adjustment){
				var cartAdjustment = new adjustmentClass();
				cartAdjustment.addItemToCart = adjustment.amount;
				cartAdjustment.code = adjustment.code;
				cartAdjustment.currency = adjustment.currency;
				cartAdjustment.description = adjustment.description;
				cartAdjustment.displayLevel = adjustment.displayLevel;
				cartAdjustment.usage = adjustment.usag;
				cartAdjs.push(cartAdjustment);
			});
			orderObj.adjustments = cartAdjs;
			orderObj.grandTotal = cart.grandTotal;
			orderObj.totalProductPrice = cart.totalProductPrice;
			orderObj.grandTotalCurrency = cart.grandTotalCurrency;
			orderObj.lastUpdateTime = cart.lastUpdateDate;

			respJSON.push(orderObj);
			var productHandler = app.models.productHandler;
			var productClass = app.models.product;
    		var productObj = new productClass();
			productHandler.findByIds(prodIds ,function(err, productRes){
	    		if(productRes){
	                var productView = productRes.catalogEntryView;
	                if(productView){
	                    productView.forEach(function(product){
	                        productObj.name = product.name;
	                        productObj.thumbnail = product.thumbnail;
	            		});
	            	}
	        	}
	        	respJSON.push(productObj);
				cb(null, respJSON);
			});	
            
		});
	}

    order.remoteMethod(
        'getCartDetails', 
        {
          accepts: [{arg: 'wcToken', type: 'string'},{arg: 'trustedToken', type: 'string'},{arg: 'pId', type: 'string'},{arg: 'uid', type: 'string'}],
		  http: {path: '/getCartDetails', verb: 'post'},
          returns: {arg: 'cart', type: 'JSON'},
        }
    );	
};
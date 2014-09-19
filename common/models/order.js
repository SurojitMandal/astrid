var app = require('../../server/server');
var ds = app.dataSources.db;
var ord = ds.getModel ('order');
var async = require("async");
        
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

    //Get cart details:
	order.orderCheckout = function(wcToken, trustedToken, pId, uId, shipMode, orderId, cb) {

		var ordHandlers = app.models.OrderHandler;
		var orderClass = app.models.order;
		var adjustmentClass = app.models.adjustment;
		var address = app.models.address;
		var shipAddressObj = new address();
		var billAddressObj = new address();
		
		ordHandlers.orderCheckout(wcToken, trustedToken, pId, uId, shipMode, orderId, function(err, cart){
			var cart2 = JSON.parse(cart[1]);
			// console.log(cart2);
			cart = JSON.parse(cart[0]);
			// console.log(cart);

			var orderObj = new orderClass();
			orderObj.orderId = cart.orderId;
			var orderItems = [];
			var ordItems = cart.orderItem;
			var respJSON = [];
			var shipMethod;
			var asyncTasks = [];

			ordItems.forEach(function(ordItem){
				asyncTasks.push(function(cb){
					buildOrderItem(ordItem, cb);
				});
			});

			async.parallel(asyncTasks,
				// callback function
				function(err, data){
					if (err) {
						console.log("Error occurred: " + err);
						return;
					}
					for (var i = 0; i < data.length; i++) {
						orderItems.push(data[i]);
					};
					// console.log(orderItems);

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
					
					shipAddressObj.firstName = cart2.CheckoutProfile[0].shipping_firstName;
					shipAddressObj.lastName = cart2.CheckoutProfile[0].shipping_lastName;
					var shipAdd = cart2.CheckoutProfile[0].shipping_addressLine;
					shipAddressObj.addressLine1 = shipAdd[0];
					shipAddressObj.addressLine2 = shipAdd[1];
					shipAddressObj.addressLine3 = shipAdd[2];
					orderObj.shippingAddress = shipAddressObj;

					orderObj.shippingMethod = shipMethod;

					billAddressObj.firstName = cart2.CheckoutProfile[0].billing_firstName;
					billAddressObj.lastName = cart2.CheckoutProfile[0].billing_lastName;
					var billAdd = cart2.CheckoutProfile[0].billing_addressLine;
					billAddressObj.addressLine1 = billAdd[0];
					billAddressObj.addressLine2 = billAdd[1];
					billAddressObj.addressLine3 = billAdd[2];
					orderObj.billingAddress = billAddressObj;
					var protoData = cart2.CheckoutProfile[0].protocolData;
					var paymentMethod;
					protoData.forEach(function(data){
						if(data.name === 'payment_method')
							paymentMethod = data.value;
					});
					orderObj.paymentMethod = paymentMethod;
					orderObj.paymentAmount = cart.grandTotal;																						

					cb(null,orderObj);
				}
			)

		});
	}

	function buildOrderItem(ordItem,cb){
		console.log("buildOrderItem");
		var productClass = app.models.product;
		productClass.productTrans(ordItem.productId, function(err, productRes){
			
			console.log("productTrans callback");
			var orderItemClass = app.models.orderItem;
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
			shipMethod = ordItem.shipModeDescription;
			orderItem.name = productRes.name;
			orderItem.thumbnail = productRes.thumbnail;
			cb(null,orderItem);
		});
	}

    order.remoteMethod(
        'orderCheckout', 
        {
          accepts: [{arg: 'wcToken', type: 'string'},{arg: 'trustedToken', type: 'string'},{arg: 'pId', type: 'string'},{arg: 'uid', type: 'string'},{arg: 'shipMode', type: 'string'},{arg: 'orderId', type: 'string'}],
		  http: {path: '/orderCheckout', verb: 'post'},
          returns: {arg: 'cart', type: 'JSON'},
        }
    );	
};
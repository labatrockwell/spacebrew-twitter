/**
 * 
 * Spacebrew Library for Javascript
 * --------------------------------
 *  
 * This library was designed to work on front-end (browser) envrionments, and back-end (server) 
 * environments. Please refer to the readme file, the documentation and examples to learn how to 
 * use this library.
 * 
 * Spacebrew is an open, dynamically re-routable software toolkit for choreographing interactive 
 * spaces. Or, in other words, a simple way to connect interactive things to one another. Learn 
 * more about Spacebrew here: http://docs.spacebrew.cc/
 *
 * To import into your web apps, we recommend using the minimized version of this library, 
 * filename sb-1.0.0.min.js.
 *
 * Latest Updates:
 * - updated boolean handling to fix bug where false values were resolving to true.
 * - packaged library as a module when it is imported into a node server environment. This makes
 * 	 it possible to use this library to connect to Spacebrew from a node server.
 * 
 * @author 		Brett Renfer and Julio Terra from LAB @ Rockwell Group
 * @filename	sb.js
 * @version 	1.0.2
 * @date 		Feb 5, 2013
 * 
 */

/**
 * Check if Bind method exists in current enviroment. If not, it creates an implementation of
 * this useful method.
 */
if (!Function.prototype.bind) {  
  Function.prototype.bind = function (oThis) {  
	if (typeof this !== "function") {  
	  // closest thing possible to the ECMAScript 5 internal IsCallable function  
	  throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");  
	} 
  
	var aArgs = Array.prototype.slice.call(arguments, 1),   
		fToBind = this,   
		fNOP = function () {},  
		fBound = function () {  
		  return fToBind.apply(this instanceof fNOP  
								 ? this  
								 : oThis || window,  
							    aArgs.concat(Array.prototype.slice.call(arguments)));  
		};  
  
	fNOP.prototype = this.prototype;  
	fBound.prototype = new fNOP();  
  
	return fBound;  
  };  
} 

var window = window || undefined;

// if app is running in a browser, then define the getQueryString method
if (window) {
	if (!window['getQueryString']){
		/**
		 * Get parameters from a query string
		 * @param  {String} name Name of query string to parse (w/o '?' or '&')
		 * @return {String}	value of parameter (or empty string if not found)
		 */
		window.getQueryString = function( name ) {
			if (!window.location) return;
			name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
			var regexS = "[\\?&]"+name+"=([^&#]*)";
			var regex = new RegExp( regexS );
			var results = regex.exec( window.location.href );
			if( results == null ) return "";
			else return results[1];
		}
	}	
}

var WebSocket = WebSocket || {};

/**
 * @namespace for Spacebrew library
 */
var Spacebrew = Spacebrew || {};

/**
 * Spacebrew client!
 * @constructor
 * @param  {String} server      (Optional) Base address of Spacebrew server. This server address is overwritten if server defined in query string; defaults to localhost.
 * @param  {String} name        (Optional) Base name of app. Base name is overwritten if "name" is defined in query string; defaults to window.location.href.
 * @param  {String} description (Optional) Base description of app. Description name is overwritten if "description" is defined in query string;
 */
Spacebrew.Client = function( server, name, description ){

	console.log("building Spacebrew object")
	/**
	 * Name of app
	 * @type {String}
	 */
	this._name = name || "javascript client";
	if (window) {
		this._name = (window.getQueryString('name') !== "" ? unescape(window.getQueryString('name')) : this._name);
	}
	
	/**
	 * Description of your app
	 * @type {String}
	 */
	this._description = description || "spacebrew javascript client";
	if (window) {
		this._description = (window.getQueryString('description') !== "" ? unescape(window.getQueryString('description')) : this._description);
	}


	/**
	 * Spacebrew server to which the app will connect
	 * @type {String}
	 */
	this.server = server || "sandbox.spacebrew.cc";
	if (window) {
		this.server = (window.getQueryString('server') !== "" ? unescape(window.getQueryString('server')) : this.server);
	}

	/**
	 * Reference to WebSocket
	 * @type {WebSocket}
	 */
	this.socket 	 = null;

	/**
	 * Configuration file for Spacebrew
	 * @type {Object}
	 */
	this.config		 = {
		name: this._name,
		description: this._description,
		publish:{
			messages:[]
		},
		subscribe:{
			messages:[]
		}
	};

	/**
	 * Are we connected to a Spacebrew server?
	 * @type {Boolean}
	 */
	this._isConnected = false;
}

/**
 * Connect to Spacebrew 
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype.connect = function(){
	try {
		this.socket 	 		= new WebSocket("ws://"+this.server+":9000");
		this.socket.onopen 		= this._onOpen.bind(this);
		this.socket.onmessage 	= this._onMessage.bind(this);
		this.socket.onclose 	= this._onClose.bind(this);
	} catch(e){
		this._isConnected = false;
		console.log("[Spacebrew.connect] connection attempt failed")
	}
}

/**
 * Override in your app to receive on open event for connection
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onOpen = function( name, value ){}


/**
 * Override in your app to receive on close event for connection
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onClose = function( name, value ){}

/**
 * Override in your app to receive "range" messages, e.g. sb.onRangeMessage = yourRangeFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onRangeMessage = function( name, value ){}

/**
 * Override in your app to receive "boolean" messages, e.g. sb.onBooleanMessage = yourBoolFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onBooleanMessage = function( name, value ){}

/**
 * Override in your app to receive "string" messages, e.g. sb.onStringMessage = yourStringFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onStringMessage = function( name, value ){}

/**
 * Override in your app to receive "custom" messages, e.g. sb.onCustomMessage = yourStringFunction
 * @param  {String} name  Name of incoming route
 * @param  {String} value [description]
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.onCustomMessage = function( name, value ){}

/**
 * Add a route you are publishing on 
 * @param {String} name Name of incoming route
 * @param {String} type "boolean", "range", or "string"
 * @param {String} def  default value
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.addPublish = function( name, type, def ){
	this.config.publish.messages.push({"name":name, "type":type, "default":def});
	this.updatePubSub();
}

/**
 * [addSubscriber description]
 * @param {String} name Name of outgoing route
 * @param {String} type "boolean", "range", or "string"
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.addSubscribe = function( name, type ){
	this.config.subscribe.messages.push({"name":name, "type":type });
	this.updatePubSub();
}

/**
 * Update publishers and subscribers
 * @memberOf Spacebrew.Client
 * @private
 */
Spacebrew.Client.prototype.updatePubSub = function(){
	if (this._isConnected) this.socket.send(JSON.stringify({"config":this.config}));
}

/**
 * Send a route to Spacebrew
 * @param  {String} name  Name of outgoing route (must match something in addPublish)
 * @param  {String} type  "boolean", "range", or "string"
 * @param  {String} value Value to send
 * @memberOf Spacebrew.Client
 * @public
 */
Spacebrew.Client.prototype.send = function( name, type, value ){
	var message = {
		message:{
           clientName:this._name,
           name:name,
           type:type,
           value:value
       }
   	};

   	//console.log(message);
   	this.socket.send(JSON.stringify(message));
}

/**
 * Called on WebSocket open
 * @private
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onOpen = function() {
    console.log("WebSockets connection opened");
    console.log("my name is: "+this._name);
	this._isConnected = true;

  	// send my config
  	this.updatePubSub();
  	this.onOpen();
}

/**
 * Called on WebSocket message
 * @private
 * @param  {Object} e
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onMessage = function( e ){
	// parse message and call callbacks
	var name = JSON.parse(e.data).message.name;
    var type = JSON.parse(e.data).message.type;
	var value = JSON.parse(e.data).message.value;

	switch( type ){
		case "boolean":
			this.onBooleanMessage( name, value == "true" );
			break;
		case "string":
			this.onStringMessage( name, value );
			break;
		case "range":
			this.onRangeMessage( name, Number(value) );
			break;
		default:
			this.onCustomMessage( name, value);
	}
}

/**
 * Called on WebSocket close
 * @private
 * @memberOf Spacebrew.Client
 */
Spacebrew.Client.prototype._onClose = function() {
    console.log("WebSockets connection closed");
	this._isConnected = false;
	this.onClose();
};

/**
 * name Method that sets or gets the spacebrew app name. If parameter is provided then it sets the name, otherwise
 * 		it just returns the current app name.
 * @param  {String} newName New name of the spacebrew app
 * @return {String} Returns the name of the spacebrew app if called as a getter function. If called as a 
 *                  setter function it will return false if the method is called after connecting to spacebrew, 
 *                  because the name must be configured before connection is made.
 */
Spacebrew.Client.prototype.name = function (newName){
	if (newName) {
		this._name = newName;
	} 	
	return this._name;	
};

/**
 * name Method that sets or gets the spacebrew app description. If parameter is provided then it sets the description, 
 * 		otherwise it just returns the current app description.
 * @param  {String} newDesc New description of the spacebrew app
 * @return {String} Returns the description of the spacebrew app if called as a getter function. If called as a 
 *                  setter function it will return false if the method is called after connecting to spacebrew, 
 *                  because the description must be configured before connection is made.
 */
Spacebrew.Client.prototype.description = function (newDesc){
	if (newDesc) {
		if (this._isConnected) return false;
		this._description = newDesc;
		this.config.description = this._description;
	} 
	return this._description;	
};

/**
 * isConnected Method that returns current connection state of the spacebrew client.
 * @return {Boolean} Returns true if currently connected to Spacebrew
 */
Spacebrew.Client.prototype.isConnected = function (){
	return this._isConnected;	
};

// check if module has been defined, to determine if this is a node application
var module = module || undefined;

// if app is running in a node server environment then package Spacebrew library as a module
if (!window && module) {
	WebSocket = require("ws");
	module.exports = {
		Spacebrew: Spacebrew
	} 
}


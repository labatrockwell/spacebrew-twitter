var uiPort = uiPort || 3001
	, clientId = clientId || -1
	, debug = true;

var model = {
		"sb": {
			"name": getQueryString("name") || "space_tweets_front",
			"description": getQueryString("description") || "web app that forwards tweets to spacebrew",
			"pubs": [
			    { "name":'users_and_tweets', 	"type": 'string' }, 
			    { "name":'tweets', 				"type": 'string' }, 
			    { "name":'new_tweets', 			"type": 'boolean' }
			],
			"subs": [
			    { "name":'query',				 "type": 'string' } 
			],
			"connected": "false"
		},
		"data": {
			"tweets": [],
			"query": ""
		},
		"controls": {
			"refresh": getQueryString("refresh") || 15000
		}
	};

var Control = {};


/**
 * Control constructor for the app controller. It initializes the view and model, registers the controller
 * 		with the view, so that it can handle appropriate callbacks .
 * @param  {View.main} view  View object that controls the display of tweets and query submissions
 * @param  {Model} model Model object that holds the configuration settings, and live data
 * @return {Control.main}	Returns an instance of the app controller.
 */
Control.main = function (view, model) {
	var self = this;

	// link the model and view objects
	this.model = model || {};
	this.view = view  || {};

	// register the controller with the view and
	this.view.registerController(this, "submit");

	// connect to spacebrew
	this.connect();

	// set interval for making requests to twitter
	this.interval = setInterval(function() {
		self._query();
	}, this.model.controls.refresh);
}

/**
 * Control Prototype The controller prototype holds all functionality for the control objects. These objects
 * 		are responsible for handling data from the view and spacebrew, then it communicates with the node server 
 * 		to submit queries and process requests. Finally it forwards the appropriate data to the browser view 
 * 		and spacebrew.
 * @type {Control.main}
 */
Control.main.prototype = {
	constructor: Control.main,	// link to constructor
	initialized: false,			// flag that identifies if view has been initialized
	view: {},					// link to view, where tweets are displayed and queries are submitted
	model: {},					// link to model, which holds configuration and live data
	sb: {},						// client connection to spacebrew server
	interval: {},				// interval object that calls the query method repeatedly

	/**
	 * connect Method used to connect to spacebrew. It uses the configuration settings from the 
	 * 		model object to configure the publication and subscription feeds.
	 */
	connect: function () {
		var pubs = model.sb.pubs.length, 
			subs = model.sb.subs.length;

		this.sb = new Spacebrew.Client(undefined, this.model.sb.name, this.model.sb.description);

		for (var i = 0; i < pubs; i += 1) {
			this.sb.addPublish( this.model.sb.pubs[i].name, this.model.sb.pubs[i].type );		
		}
		for (var i = 0; i < subs; i += 1) {
			this.sb.addSubscribe( this.model.sb.subs[i].name, this.model.sb.subs[i].type );		
		}
		this.sb.onStringMessage = this.onString.bind(this);
		this.sb.onOpen = this.onOpen.bind(this);
		this.sb.onClose = this.onClose.bind(this);
		this.sb.connect();
	},

	/**
	 * onString function that processes string messages received from spacebrew. It converts the string into a query that 
	 * 		is used as a filter to select tweets to be forwarded to spacebrew. 	
	 * @param  {String} inlet Name of the subcription feed channel where the message was received
	 * @param  {String} msg   The message itself
	 */
	onString: function (inlet, msg) {
		if (debug) console.log("[onString] got string msg: " + msg);
	},

	/**
	 * onOpen callback method that handles the on open event for the Spacebrew connection.
	 */
	onOpen: function () {
		model.sb.connected = true;
		if (debug) console.log("[onOpen] spacebrew connection established");
	},

	/**
	 * onClose callback method that handles the on close event for the Spacebrew Connection.  
	 */
	onClose: function () {
		model.sb.connected = false;
		if (debug) console.log("[onClose] spacebrew connection closed");
	},

	/**
	 * _query method that is called 
	 * @return {[type]} [description]
	 */
	_query: function () {
		if (this.model.data.query === "") return;
		var query = { "query": escape(this.model.data.query), "id" : clientId }; 
		var self = this;
		if (true) console.log("[Control:submit] new query: ", query );

		$.ajax({
		    type: "GET",
		    url: "/twitter/search", 
			data: JSON.stringify(query),
		    contentType: "application/json; charset=utf-8",
		    dataType: "json",
		    context: self,

		    success: function(jData) {
	    		var maxLen = 25;
			    for (var i = 0; i < jData.length; i++) {
	    	    	if (jData[i].user && jData[i].text && jData[i].created_at ) {
	    	    		self.model.data.tweets.unshift(jData[i]);
	    	    		if (self.model.data.tweets.length > maxLen) {
	    		    		self.model.data.tweets = self.model.data.tweets.slice(0,maxLen);    			
	    	    		}
	    	    	}
	    		}
			    self.view.load();
			    console.log("self.sb ", self.sb);
				if (self.sb._isConnected) {
					for (var i = 0; i < jData.length; i++) {
						var newTweet = jData[i];
						vals = [JSON.stringify(newTweet), newTweet.text, "true"];
						for (var j in self.model.sb.pubs) {
							self.sb.send( self.model.sb.pubs[j].name, self.model.sb.pubs[j].type, vals[j] );                            
						}				    	
					}
				}
		    },
		    error: function(err) {
		        console(err.toString());
		    }
		});
	},

	submit: function (query) {
		if (true) console.log("[Control:submit] new query: " + query );
		this.model.data.query = query;
		this.model.data.tweets = [];
	    this.view.load();
	    this._query();
	}

}



/**
 * View namespace for the view elements of the webservices app
 * @type {Object}
 */
 var View = {};
 
/**
 * View.main Class constructor method. Sets up the event listeners for the input text box and button.
 */
View.main = function () {
	if (this.debug) console.log("[View] calling constructor ");
	this.setup();
}

/**
 * View.main.prototype Class definition where all attributes and methods of the View.main class are
 *        defined.
 * @type {Object}
 */
View.main.prototype = {
	constructor: View.main,	// link to constructor
	initialized: false,		// flag that identifies if view has been initialized
	controller: undefined,
	submitFuncName: "",

	setup: function() {
		var self = this;
		$("#qSubmit").on("click", function() {
			if ($("#qText").val() != "" ) {
				self.submit();
			}
		});
		$("#qText").on("keypress", function(event) {
			if ($("#qText").val() != "" && (event.charCode == 13 || event.charCode == 10)) {
				self.submit();
			}
		});
	},

	registerController: function(control, name) {
		this.controller = control;
		this.submitFuncName = name;
	},

	load: function() {
		$("#query_results h1").text("Forwarding Tweets With:  " + model.data.query);

		$("#tweet_container .tweet").remove();        

		for (var i in model.data.tweets) {
			var $newEle = $("#templates .tweet").clone();
			$newEle.attr( {id: i} );
			$newEle.find(".user").text(model.data.tweets[i].user);
			$newEle.find(".text").text(model.data.tweets[i].text);
			$newEle.find(".created_at").text(model.data.tweets[i].created_at);
			$newEle.appendTo('#tweet_container');
			if (this.debug) console.log("[updateTransformList] created a new list item", $newEle);
		}	
	},

	submit: function() {
		var msg;
		if (this.controller[this.submitFuncName]) {
			msg = $("#qText").val();
			this.controller[this.submitFuncName]((msg));			
		}
	}
}


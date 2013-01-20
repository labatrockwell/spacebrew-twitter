var uiPort = uiPort || 3001
	, clientId = clientId || -1
	, debug = true;

var model = {
		"sb": {
			"name": unescape(getQueryString("name")) || "space_tweets_front",
			"description": unescape(getQueryString("description")) || "web app that forwards tweets to spacebrew",
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
			"user": {
				"available" : false,
				"query": "",
				"geo": {
					"available": false,
					"lat": undefined,
					"long": undefined,
					"radius": undefined
				}				
			},
			"server": {
				"tweets": [],
				"latest": 0
			},

			"tweets": [],
			"latest": 0,
			"query": "",
			"geo": {
				"lat": undefined,
				"long": undefined,
				"radius": undefined,
				"available": false
			}

		},
		"controls": {
			"refresh": ((getQueryString("refresh") || 15000) < 5000) ? (getQueryString("refresh") || 15000) : 5000
		}
	};

var app = {};
	app.view = {};

$(window).bind("load", function() {
	// setupQuery();
	// sbConnect();
	app.view = new View.main();
	app.control = new Control.main(app.view, model);

});

/**
 * Control namespace for the controller elements of the webservices app
 * @type {Object}
 */
var Control = {};

	/**
	 * Control.main constructor for the app controller. It initializes the view and model, registers the controller
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
	 * Control.main Prototype The controller prototype holds all functionality for the control objects. These objects
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
			if (clientId == -1) return;

			var query = { "query": escape(this.model.data.query)
						, "id" : clientId 
						, "geo" : this.model.data.geo } 
				, self = this;

			if (true) console.log("[Control:_query] new query: ", query );

			$.ajax({
			    type: "GET",
			    url: "/twitter/search", 
				data: JSON.stringify(query),
			    contentType: "application/json; charset=utf-8",
			    dataType: "json",
			    context: self,

			    success: function(jData) {
		    		var maxLen = 25
						, curTweet = {}
						, vals = [];

					// if the response is not for the most recent query then don't process it
					if (jData.query !== self.model.data.query) return;

					console.log("[Controller:_query:success] tweets received ", jData.tweets);

		    		// loop through the new tweet array to add each one to our model 
				    for (var i = 0; i < jData.tweets.length; i++) {
		    	    	if (jData.tweets[i].user && jData.tweets[i].text && jData.tweets[i].created_at ) {
		    	    		self.model.data.tweets.unshift(jData.tweets[i]);
		    	    	}
		    		}

		    		// if our model array has grown to large will shrink it back down
    	    		if (self.model.data.tweets.length > maxLen) {
    		    		self.model.data.tweets = self.model.data.tweets.slice(0,maxLen);    			
    	    		}

    	    		// load the tweets to the page
				    self.view.load();

				    // is spacebrew is connected then send each tweet separately to spacebrew
					if (self.sb._isConnected) {
						for (var i = 0; i < self.model.data.tweets.length; i++) {
							// if this is a tweet that has not been sent yet, then send it
							if (model.data.tweets[i].id > model.data.latest) {
								model.data.latest = model.data.tweets[i].id;					

								// prep and then loop through each publication feed to send message
								curTweet = self.model.data.tweets[i];						// load current tweet
								vals = [JSON.stringify(curTweet), curTweet.text, "true"];	// set the values for each publication feed
								for (var j in self.model.sb.pubs) {							
									self.sb.send( self.model.sb.pubs[j].name, self.model.sb.pubs[j].type, vals[j] );                            
								}				    	
							}
						}
					}
			    },

			    error: function(err) {
			        console.log(err);
			    }
			});
		},

		/**
		 * submit Method that is called to register new twitter queries.
		 * @param  {String } query Twitter query string
		 */
		submit: function (query) {
			var regex_lat = /([0-9]{1,2}.[0-9]{1,10})/
				, regex_long = /([0-9]{1,3}.[0-9]{1,10})/
				, regex_rad = /([0-9]{1,6})/
				, match_results = undefined				
				, geo_attrs = ["lat", "long", "radius"]
				, regexes = [regex_lat, regex_long, regex_rad]
				, geo_available = true
				;

			if (true) console.log("[Control:submit] new query: ", query );
			this.model.data.query = query["query"];

			// add the lat and long attributes to model
			for (var i = 0; i < geo_attrs.length; i += 1) {
				match_results = query[geo_attrs[i]].match(regexes[i]);
				if (match_results) {
					console.log(("matched " + geo_attrs[i] + " "), match_results);
					this.model.data.geo[geo_attrs[i]] = query[geo_attrs[i]];
				} else {
					console.log("no match for " + geo_attrs[i]);
					geo_available = false;
				}							
			}
			if (geo_available) this.model.data.geo.available = true;
			else this.model.data.geo.available = false;

			this.model.data.tweets = [];
			this.model.data.latest = 0;
			this.view.clear();
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
	 * View.main constructor method. Sets up the event listeners for the input text box and button.
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

		/**
		 * setup Sets up the submit button and text box listeners for submitting twitter queries. Listeners are
		 * 		set-up for submit button click, and carriage returns and new line keypress events.
		 */
		setup: function() {
			var self = this;
			$(".qSubmit").on("click", function() {
				if ($("#qText").val() != "" ) {
					self.submit();
				}
			});

			var textInputs = ["#qText", "#latText", "#longText", "#radText"];
			for (var i = 0; i < textInputs.length; i += 1) {
				$(textInputs[i]).on("keypress", function(event) {
					if ($(textInputs[i]).val() != "" && (event.charCode == 13 || event.charCode == 10)) {
						self.submit();
					}
				});				
			}
			// $("#qText").on("keypress", function(event) {
			// 	if ($("#qText").val() != "" && (event.charCode == 13 || event.charCode == 10)) {
			// 		self.submit();
			// 	}
			// });
		},

		/**
		 * registerControler Method that is called by the app controller to register the method used to submit
		 * 		new Twitter queries. If no method name is provided then it defaults to "submit".
		 * @param  {Control Object} control Link to control object, that will handle new query submissions
		 * @param  {String} name    Name of the method from the controller that should be called on query submissions
		 */
		registerController: function(control, name) {
			this.controller = control;
			this.submitFuncName = name || "submit";
		},

		/**
		 * load Method that loads tweets to the browser window. It uses the tweet template to create
		 * 		the appropriate html objects.
		 */
		load: function() {
			var tweets_len = model.data.tweets.length
				, subtitle = ""
				, $newEle
				;

			if (model.data.geo.available) {
				subtitle = "Geocode Filter:" 
							 + " lat " + model.data.geo.lat + ","
							 + " long " + model.data.geo.long + ","
							 + " radius " + model.data.geo.radius + " miles";
			}

			$("#query_results h1").text("Forwarding Tweets With:  " + model.data.query);

			$("#query_results h2").text(subtitle);

			$("#content .tweet").remove();        

			for (var i in model.data.tweets) {
				$newEle = $("#templates .tweet").clone();
				$newEle.attr( {id: i} );
				$newEle.find(".user").text(model.data.tweets[i].user);
				$newEle.find(".text").text(model.data.tweets[i].text);
				$newEle.find(".created_at").text(model.data.tweets[i].created_at);
				$newEle.appendTo('#content');
				if (this.debug) console.log("[updateTransformList] created a new list item", $newEle);
			}	
		},

		/**
		 * clear Method that clears the list of tweets in the browser.
		 */
		clear: function() {
			$("#content .tweet").remove();        
		},

		/**
		 * submit Method that handle query submissions. It calls the controller's callback method that was
		 * 		registered in the registerController method.
		 */
		submit: function() {
			var msg = {};
			if (this.controller[this.submitFuncName]) {
				msg.query = $("#qText").val();
				msg.lat = $("#latText").val();
				msg.long = $("#longText").val();
				msg.radius = $("#radText").val();
				this.controller[this.submitFuncName]((msg));
				model.data.latest = 0;			
			}
		}
	}


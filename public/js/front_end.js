var clientId = clientId || -1
	, debug = true;

var Model = {};

	Model.Main = function (config) {
		if (getQueryString("refresh")) {
			this.controls.refresh = !isNaN(getQueryString("refresh")) ? (getQueryString("refresh") * 1000) : this.controls.refresh;
		}
		this.config = config;

		for (var type in this.config.input) {
			this.data.input[type] = {};	
			for (var group in this.config.input[type]) {
				this.data.input[type][group] = {};	
				for (var entry in this.config.input[type][group]) {
						this.data.input[type][group][entry] = "";			
				}
				this.data.input[type][group].available = false;
			}
		}

		for (var type in this.config.output) {
			this.data.output[type] = {};	
			this.data.output[type].list = [];
			this.data.output[type].latest = 0;
		}

		console.log("Model.Main - model has been created: ", this.data);
	}

	Model.Main.prototype = {
		constructor: Model.Main,
		config: {},
		data: {
			input: {},
			output: {}
		},
		controls: {
			refresh: 30000
		}
	}

/**
 * Control namespace for the controller elements of the webservices app
 * @type {Object}
 */
var Control = {};

	/**
	 * Control.Main constructor for the app controller. It initializes the view and model, registers the controller
	 * 		with the view, so that it can handle appropriate callbacks .
	 * @param  {View.Web} view  View object that controls the display of tweets and query submissions
	 * @param  {Model} model Model object that holds the configuration settings, and live data
	 * @return {Control.Main}	Returns an instance of the app controller.
	 */
	Control.Main = function (view, model) {
		var self = this;

		// link the model and view objects
		this.model = model || {};

		if ($.isArray(view)){
			this.views = view;
		} else if (view) { 
			this.views = [view];
		} else {
			this.views = [];
		}

		for (var i = 0; i < this.views.length; i += 1) {
		    if (this.views[i]["registerController"]) this.views[i].registerController(this, "submit");	    			
		}

		// set interval for making requests to twitter
		this.interval = setInterval(function() {
			self._query();
		}, this.model.controls.refresh);

		console.log("Control.Main set refresh to: ", this.model.controls.refresh);
	}

	/**
	 * Control.Main Prototype The controller prototype holds all functionality for the control objects. These objects
	 * 		are responsible for handling data from the view and spacebrew, then it communicates with the node server 
	 * 		to submit queries and process requests. Finally it forwards the appropriate data to the browser view 
	 * 		and spacebrew.
	 * @type {Control.Main}
	 */
	Control.Main.prototype = {
		constructor: Control.Main,	// link to constructor
		initialized: false,			// flag that identifies if view has been initialized
		views: [],					// link to view, where tweets are displayed and queries are submitted
		model: {},					// link to model, which holds configuration and live data
		interval: {},				// interval object that calls the query method repeatedly

		/**
		 * _query method that is called 
		 * @return {[type]} [description]
		 */
		_query: function () {
			var data_avail = false;
			for (var group in this.model.data.input.required) {
				var attr_avail = false;
				for (var input in this.model.data.input.required[group]) {
					if (this.model.data.input.required[group][input] !== "") data_avail = true;
					attr_avail = true;
				}
			}

			console.log("[Control:_query] attr_avail: " + attr_avail + " data_avail " + !data_avail );

			if (attr_avail && !data_avail) return;

			// if (this.model.data.input.required.query.text === "") return;
			if (clientId == -1) return;

			var query = { "id": 	clientId 
						, "data": 	this.model.data.input } 
				, self = this;

			console.log("[Control:_query] new query: ", query );
			console.log("[Control:_query] making query to ", this.model.config.query_path);

			$.ajax({
			    type: 			"GET",
			    url: 			this.model.config.query_path, 
			    contentType: 	"application/json; charset=utf-8",
			    dataType: 		"json",
			    context: 		self,
				data: 			JSON.stringify(query),

			    success: function(jData) {
		    		var maxLen = 25
						, curTweet = {}
						, vals = [];

					// if the response is not for the most recent query then don't process it
					// if (jData.query !== self.model.data.input.required.query.text) return;

					console.log("[Controller:_query:success] data test ", self.model.data);
					// if (jData.query !== self.model.data.query.text) return;

					console.log("[Controller:_query:success] tweets received ", jData.list);

		    		// loop through the new tweet array to add each one to our model 
				    for (var i = 0; i < jData.list.length; i++) {
		    	    	if (jData.list[i].user && jData.list[i].text && jData.list[i].created_at ) {
							for (var content in this.model.data.output) {
			    	    		self.model.data.output[content].list.unshift(jData.list[i]);
			    	    	}
		    	    	}
		    		}

		    		// if our model array has grown to large will shrink it back down
    	    		if (self.model.data.output.tweets.list > maxLen) {
						for (var content in this.model.data.output) {
	    		    		self.model.data.output[content].list = self.model.data.output[content].list.slice(0,maxLen);    			
	    		    	}
    	    		}

    	    		// load the tweets to the page
    	    		for (var j = 0; j < self.views.length; j += 1) {
					    if (self.views[j]["load"]) {
						    console.log("loading tweets to views ", j)	    			
					    	self.views[j]["load"]();
					    }
    	    		}

					for (var content in this.model.data.output) {
	    	    		// update the latest variable if there are tweets in the queu				
	    	    		if (self.model.data.output[content].list > 0) {
							self.model.data.output[content].latest = self.model.data.output[content].list[0].id;					
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
				, regex_integer = /[0-9\.-]+/
				, regex_string = /[\w-]+/
				, match_results = undefined				
				, geo_attrs = ["lat", "long", "radius"]
				, regexes = [regex_lat, regex_long, regex_rad]
				, new_regexes = {"integer": regex_integer, "string": regex_string}
				, geo_available = true
				;

			if (true) console.log("[Control:submit] new query: ", query );
			if (true) console.log("[Control:submit] this.model.data.input: ", this.model.data.input );

			// loop through each input to read each one				
			for (var type in this.model.config.input) {
				for (var group in this.model.config.input[type]) {
					var data_available = true;

					for (var attr in this.model.config.input[type][group]) {
						var data_type = this.model.config.input[type][group][attr];

						match_results = query[type][group][attr].match(new_regexes[data_type]);
						if (match_results) {
							console.log("matched " , match_results);
							this.model.data.input[type][group][attr] = query[type][group][attr];
						} else {
							data_available = false;
						}
					}
					if (data_available) {
						this.model.data.input[type][group].available = true;
					} else {
						this.model.data.input[type][group].available = false;						
					}
				}
				// console.log("[Control:submit] updated data object: " + this.model.data.input[type]);
			}
			if (true) console.log("[Control:submit] data test: ", this.model.data );

			for (var ele in this.model.data.output) {
				this.model.data.output[ele].list = [];
				this.model.data.output[ele].latest = 0;				
			}

    		for (var i = 0; i < this.views.length; i += 1) {
			    if (this.views[i]["clear"]) this.views[i].clear();	    			
			    if (this.views[i]["load"]) this.views[i].load();	    			
    		}
		    this._query();
		}
	}



/**
 * View namespace for the view elements of the webservices app. Here is an overview of the view
 * 		API methods:
 * 		* registerController (all views)
 * 		* submit (input view)
 * 		* load (display view)
 * 		* clear (display view)
 * @type {Object}
 */
var View = {};
 
/**
 * View.Web constructor method. Sets up the event listeners for the input text box and button.
 */
View.Web = function (config) {
		if (this.debug) console.log("[View.Web] calling constructor ");
		if (config["model"]) this.model = config["model"];
		if (config["debug"]) this.debug = config["debug"] || false;
		this.setup();
		this.load = this.load;
	}

	/**
	 * View.Web.prototype Class definition where all attributes and methods of the View.Web class are
	 *        defined.
	 * @type {Object}
	 */
	View.Web.prototype = {
		constructor: View.Web,	// link to constructor
		model: {},
		debug: false,
		initialized: false,		// flag that identifies if view has been initialized
		controller: undefined,
		submitFuncName: "",
		baseTextBox: "_textBox",

		/**
		 * setup Sets up the submit button and text box listeners for submitting twitter queries. Listeners are
		 * 		set-up for submit button click, and carriage returns and new line keypress events.
		 */
		setup: function() {
			var self = this;

			this.setupForm();
			this.setupDataTemplate();

			$(".qSubmit").on("click", function() {
				if ($("#qText").val() != "" ) {
					self.submit();
				}
			});

			//add listeners to all the text box to submit query on return/enter
			$(".textBox").on("keypress", function(event) {
				if ($(this).val() != "" && (event.charCode == 13 || event.charCode == 10)) {
					self.submit();
				}
			});				

		},

		setupForm: function() {
			var $typeDiv
				, $groupDiv
				, $newEle
				, htmlSettings;

			// create the submission form as defined in the configuration object
			for (var type in this.model.config.input) {

				// create the wrapper for different input types (required and optional)
				htmlSettings = { id: type, title: (type + ' query fields.') };
				$typeDiv = $('<div/>', htmlSettings).appendTo('#query_form');

				// loop through each input group of current input type
				for (var attr in this.model.config.input[type]) {

					// create new div object for the current input group 
					htmlSettings = { class: type, id: attr, title: (type + ' query fields.') };
					$groupDiv = $('<div/>', htmlSettings).appendTo($typeDiv);

					// create title element for the input group
					htmlSettings = { class: 'title', text: (attr + ":") };
					$('<h2/>', htmlSettings).appendTo($groupDiv);

					// loop through input group elements to creat text boxes
					for (var sub_attr in this.model.config.input[type][attr]) {
						htmlSettings = { class: 'textBox', type: "text", value: sub_attr, id: sub_attr + "_textBox" };
						$('<input/>', htmlSettings).appendTo($groupDiv);
					}							
					
					// add submit button to the button of each group
					htmlSettings = { 	class: 'qSubmit', type: "button", value: "submit query" };
					$('<input>', htmlSettings).appendTo($groupDiv);
				}
			}			
		},

		setupDataTemplate: function() {
			var $typeDiv
				, $groupDiv
				, divSettings;

			// create a template for the data as configured in object
			for (var type in this.model.config.output) {

				// create the wrapper for each template type
				divSettings = { class: type };
				$typeDiv = $('<div/>', divSettings).appendTo('#templates');

				// loop through each element of the current template
				for (var attr in this.model.config.output[type]) {

					// create new span for each element 
					divSettings = { class: attr };
					$groupDiv = $('<div/>', divSettings).appendTo($typeDiv);
				}
			}			
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

			var query_str = ""
				, $newEle
				;

			console.log("[Web:load] this.model.data ", this.model.data);

			for (var type in this.model.config.input) {
				console.log("[Web:load] this model data ", type);

				for (var cur in this.model.config.input[type]) {
					query_str += "::" + cur + " - ";
					for (var ele in this.model.config.input[type][cur]) {
						console.log("[Web:load] HERE ", this.model.data.input[type][cur]);
						if (this.model.data.input[type][cur].available && ele !== "available") {
							query_str += " " + ele + ": " + this.model.data.input[type][cur][ele];
							console.log("[Web:load] cur " + cur + " ele " + ele);
						} else {
							query_str = "";
						}
					}
				}			
				console.log("[Web:load] query_str ",  query_str);
				var $ele = $("#query_results ." + type ).text(query_str);
				query_str = "";

			}

			$("#content .tweets").remove();        

			for (var content in this.model.data.output) {
				for (var element in this.model.data.output[content].list) {
					$newEle = $("#templates .tweets").clone();
					$newEle.attr( {id: element} );
					for (var attr in this.model.data.output[content].list[element]) {
						var cur_val = this.model.data.output[content].list[element][attr];
						$newEle.find("." + attr).text(cur_val +  "  ::  ");
					}
					$newEle.appendTo('#content');
					console.log("[Web:load] created a new list item", $newEle);
				}	
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

				// loop through each input to read each one				
				for (var type in this.model.config.input) {
					msg[type] = {};
					for (var group in this.model.config.input[type]) {
						msg[type][group] = {};
						for (var attr in this.model.config.input[type][group]) {
							msg[attr] = $("#" + attr + "_textBox").val();
							msg[type][group][attr] = $("#" + attr + "_textBox").val();
						}
					}
				}
				console.log("[View.Web:submit] msg ", msg);
				this.controller[this.submitFuncName]((msg));
			}
		}
	}

/**
 * View.Web constructor method. Sets up the event listeners for the input text box and button.
 */
View.Spacebrew = function (config) {
		if (this.debug) console.log("[View.Spacebrew] calling constructor ");
		if (config["model"]) this.model = config["model"];
		if (config["debug"]) this.debug = config["debug"] || false;

		this.sb = new Spacebrew.Client(undefined, this.model.config.sb.name, this.model.config.sb.description);

		var pubs = this.model.config.sb.pubs, 
			subs = this.model.config.sb.subs;

		for (var i = 0; i < pubs.length; i += 1) {
			this.sb.addPublish( pubs[i].name, pubs[i].type );		
		}
		for (var i = 0; i < subs.length; i += 1) {
			this.sb.addSubscribe( subs[i].name, subs[i].type );		
		}
		this.sb.onStringMessage = this.onString.bind(this);
		this.sb.onOpen = this.onOpen.bind(this);
		this.sb.onClose = this.onClose.bind(this);
		this.sb.connect();
	}

	/**
	 * View.Web.prototype Class definition where all attributes and methods of the View.Web class are
	 *        defined.
	 * @type {Object}
	 */
	View.Spacebrew.prototype = {
		constructor: View.Web,	// link to constructor
		sb: {},
		model: undefined,
		connected: false,		// flag that identifies if view has been initialized
		controller: undefined,
		submitFuncName: "",

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
			this.connected = true;
			if (debug) console.log("[onOpen] spacebrew connection established");
		},

		/**
		 * onClose callback method that handles the on close event for the Spacebrew Connection.  
		 */
		onClose: function () {
			this.connected = false;
			if (debug) console.log("[onClose] spacebrew connection closed");
		},

		load: function() {
			for (var content in this.model.data.output) {
				var content_list = this.model.data.output[content].list;
				for (var i = content_list.length - 1; i >= 0; i--) {
					// if this is a tweet that has not been sent yet, then send it
					if (content_list[i].id > this.model.data.output[content].latest) {
						console.log("[Spacebrew:load] sending to spacbrew data ", content_list[i]);

						// prep and then loop through each publication feed to send message
						curTweet = content_list[i];					// load current tweet
						vals = [JSON.stringify(curTweet), curTweet.text, "true"];	// set the values for each publication feed
						for (var j in this.model.config.sb.pubs) {							
							this.sb.send( this.model.config.sb.pubs[j].name, this.model.config.sb.pubs[j].type, vals[j] );                            
						}				    	
					}
				}
			}
		}
	}



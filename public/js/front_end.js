var clientId = clientId || -1
	, debug = false;

/**
 * Model Namespace for the model object that is configured for each webapp
 * @namespace
 */
var Model = {};

	/**
	 * Model.Main Constructor for the app model. It initializes the model based on the config object that
	 * 			  is passed in as an argument.
	 * @param  {Object} config  Configuration object that is used to maintain the app's state.
	 * @return {Model.Main}		Returns an instance of the app model.
	 */
	Model.Main = function (config) {
		if (getQueryString("refresh")) {
			this.controls.refresh = !isNaN(getQueryString("refresh")) ? (getQueryString("refresh") * 1000) : this.controls.refresh;
		}
		this.config = config;

		// set-up the input state variables
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

		// set-up the output state variables
		for (var type in this.config.output) {
			this.data.output[type] = {};	
			this.data.output[type].list = [];
			this.data.output[type].latest = 0;
		}

		if (debug) console.log("Model.Main - model has been created: ", this.data);
	}

	/**
	 * Model.Main Prototype The model prototype shows the top-level structure of how the model
	 * 			  structures its data.
	 * @type {Control.Main}
	 */
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
 * Control Namespace for the controller elements of the webservices app
 * @namespace
 */
var Control = {};

	/**
	 * Control.Main constructor for the app controller. It initializes the view and model, registers the controller
	 * 		with the view, so that it can handle appropriate callbacks .
	 * @param  {View.Web} view  View object that controls the display of content and query submissions
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
		this.interval = undefined;

		if (debug) console.log("Control.Main set refresh to: ", this.model.controls.refresh);
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
		views: [],					// link to view, where content is displayed and queries are submitted
		model: {},					// link to model, which holds configuration and live data
		interval: undefined,				// interval object that calls the query method repeatedly
		forwarding: false,

		/**
		 * _query method that is called 
		 * @return {[type]} [description]
		 */
		_query: function () {
			// loop through the required data fields to make sure data has been provided
			var data_avail = false;
			for (var group in this.model.data.input.required) {
				var attr_avail = false;
				for (var input in this.model.data.input.required[group]) {
					if (this.model.data.input.required[group][input] !== "") data_avail = true;
					attr_avail = true;
				}
			}
			if (debug) console.log("[Control:_query] attr_avail: " + attr_avail + " data_avail " + !data_avail );

			// if client is not valid and data not provided for a required attribute then exit the function
			if ((attr_avail && !data_avail) || (clientId == -1)) return;

			// prepare query object and create self variable with link to current context
			var query = { "id": clientId , "data": this.model.data.input } 
				, self = this;
			if (debug) console.log("[Control:_query] new query: ", query );

			// make ajax request to the server for data from a webservice
			$.ajax({
			    type: 			"GET",
			    url: 			this.model.config.query_path, 
			    contentType: 	"application/json; charset=utf-8",
			    dataType: 		"json",
			    context: 		self,
				data: 			escape(JSON.stringify(query)),

			    success: function(jData) {
		    		var maxLen = 25
						, curTweet = {}
						, vals = [];

					if (debug) console.log("[Controller:_query:success] new data received ", jData.list);

		    		// loop through the new content array to add each element to our model 
				    for (var i = 0; i < jData.list.length; i++) {
						for (var content in this.model.data.output) {
		    	    		self.model.data.output[content].list.unshift(jData.list[i]);
		    	    	}
		    		}

		    		// if our model array has grown too large then shrink it back down
					for (var content in this.model.data.output) {
			    		if (self.model.data.output[content].list.length > maxLen) {
	    		    		self.model.data.output[content].list = self.model.data.output[content].list.slice(0,maxLen);    			
	    		    	}
    	    		}

    	    		// load the content to the different views
    	    		for (var j = 0; j < self.views.length; j += 1) {
					    if (self.views[j]["load"]) {
						    if (debug) console.log("[Controller:_query:success] loading content to views ", j)	    			
					    	self.views[j]["load"]();
					    }
    	    		}

    	    		// update the id or time_created of the most recent data element				
					for (var content in this.model.data.output) {
	    	    		if (self.model.data.output[content].list.length > 0) {
						    if (debug) console.log("[Controller:_query:success] update the latest id to ", self.model.data.output[content].list[0].id)	    			
							self.model.data.output[content].latest = self.model.data.output[content].list[0].id;					
	    	    		}
	    	    	}
			    },

			    error: function(err) {
			        if (debug) console.log(err);
			    }
			});
		},

		/**
		 * submit Method that is called to register new twitter queries.
		 * @param  {String } query Twitter query string
		 */
		submit: function (query) {
			// handle button press if forwarding is active by turning off forwarding
			if (this.forwarding) {
				var regex_integer = /[0-9\.-]+/
					, regex_string = /[\w-]+/
					, match_results = undefined				
					, geo_attrs = ["lat", "long", "radius"]
					, new_regexes = {"integer": regex_integer, "string": regex_string}
					, geo_available = true
					, self = this
					;

				if (debug) console.log("[Control:submit] new query: ", query );
				if (debug) console.log("[Control:submit] this.model.data.input: ", this.model.data.input );

				// loop through each input type (required and optional) and group 				
				for (var type in this.model.config.input) {
					if (query[type]) {
						for (var group in this.model.config.input[type]) {
							var data_available = true;

							if (query[type][group]) {
								// loop through each input field within the current group
								for (var attr in this.model.config.input[type][group]) {
									// make sure that the input string has an appropriate value, using regex
									var data_type = this.model.config.input[type][group][attr];
									if (query[type][group][attr]) {
										match_results = query[type][group][attr].match(new_regexes[data_type]);

										// if input string has an appropriate value then store it
										if (match_results) {
											if (debug) console.log("[Control:submit] matched " , match_results);
											this.model.data.input[type][group][attr] = query[type][group][attr];
										// if input string does not have an appropriate value then set data_available to false
										} else {
											data_available = false;
											break;
										}								
									} 
								}
							}

							// if data valid data was provided for all input field in this group then
							// set the available flag for this data group to true
							if (data_available) {
								this.model.data.input[type][group].available = true;
							} else {
								this.model.data.input[type][group].available = false;						
							}
						}
					}
				}
				if (debug) console.log("[Control:submit] data test: ", this.model.data );				

				// re-initialize the list and latest variables for each output
				for (var ele in this.model.data.output) {
					this.model.data.output[ele].list = [];
					this.model.data.output[ele].latest = 0;				
				}

				// update the views as appropriate
	    		for (var i = 0; i < this.views.length; i += 1) {
				    if (this.views[i]["updateState"]) this.views[i].updateState(true);	    			
				    if (this.views[i]["clear"]) this.views[i].clear();	    			
				    if (this.views[i]["load"]) this.views[i].load();	    			
	    		}
				// finally, let's make a query to the appropriate webservice
			    this._query();
			}
		},

		toggleState: function() {
			var self = this; 

			// handle button press if forwarding is active by turning off forwarding
			if (this.forwarding) {
				if (debug) console.log("[Control:toggleState] stop forwarding ");

				// update the state in the appropriate views (such as the web view)
	    		for (var i = 0; i < this.views.length; i += 1) {
				    if (this.views[i]["updateState"]) this.views[i].updateState(false);	    			
	    		}
	    		// turn off the interval, and set the interval variable to undefined
	    		if (this.interval) {
	    			clearInterval(this.interval);
	    			this.interval = undefined;
	    		}

			// handle button press if forwarding is NOT active by turning on forwarding
			} else {
				if (debug) console.log("[Control:toggleState] start forwarding - setting refresh interval to: ", this.model.controls.refresh );

	    		// re-setting the forwarding interval
	    		if (this.interval) { clearInterval(this.interval); }
				this.interval = setInterval(function() {
					if (debug) console.log("[Control:submit] requesting new data ");
					self._query();
				}, this.model.controls.refresh);
			}					

			// change the data forwarding state of the app
    		this.forwarding = !this.forwarding;
		}
	}



/**
 * View namespace for the view elements of the webservices app. Here is an overview of the view
 * 		API methods:
 * 		* registerController (all views)
 * 		* submit (all views)
 * 		* load (all view)
 * 		* clear (web view only)
 * 		* updateState (web view only)
 * @type {Object}
 */
var View = {};
 
/**
 * View.Web constructor method. Sets up the event listeners for the input text box and button.
 */
View.Web = function (config) {
		if (debug) console.log("[View.Web] calling constructor ");
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
			this.setupForm();
			this.setupDataTemplate();
			this.setupListeners();
		},

		/**
		 * setupListeners Sets up the submit button and text box listeners for submitting twitter queries. 
		 * 		Listeners are set-up for submit button click, and carriage returns and new line keypress 
		 * 		events.
		 */
		setupListeners: function() {
			var self = this;

			// add listener to the submit button
			$(".qSubmit").on("click", function() {
				if ($("#qText").val() != "" ) {
					self.submit();
				}
			});

			//add listeners to all the text boxes to trigger "submit" when return or enter are pressed
			$(".textBox").on("keypress", function(event) {
				if ($(this).val() != "" && (event.charCode == 13 || event.charCode == 10)) {
					self.submit();
				}
			});				
		},
		/**
		 * setupForm Sets up the input form for whichever webservice is being rendered.
		 */
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
					htmlSettings = { class: 'qSubmit', type: "button", value: "start forwarding" };
					$('<input>', htmlSettings).appendTo($groupDiv);
				}
			}			
		},

		/**
		 * setupDataTemplate Mehod that creates the html template to handle the data from this
		 * 					 webservice. This template is cloned to display data.
		 */
		setupDataTemplate: function() {
			var $typeDiv
				, $groupDiv
				, divSettings;

			// create a template for the data as configured in object
			for (var type in this.model.config.output) {

				// create the wrapper for each template type
				divSettings = { class: type + " content_elements" };
				$typeDiv = $('<div/>', divSettings).appendTo('#templates');

				// loop through each element of the current template
				for (var attr in this.model.config.output[type]) {

					// create new span for each element 
					divSettings = { class: attr + " content_element_attr"};
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
			// this.submitFuncName = name || "submit";
		},

		/**
		 * load Method that loads content to the browser window. It uses the tweet template to create
		 * 		the appropriate html objects.
		 */
		load: function() {

			var query_str = ""
				, $newEle
				;

			if (debug) console.log("[Web:load] this.model.data ", this.model.data);

			for (var type in this.model.config.input) {
				if (debug) console.log("[Web:load] this model data ", type);

				for (var cur in this.model.config.input[type]) {
					query_str += "::" + cur + " - ";
					for (var ele in this.model.config.input[type][cur]) {
						if (debug) console.log("[Web:load] HERE ", this.model.data.input[type][cur]);
						if (this.model.data.input[type][cur].available && ele !== "available") {
							query_str += " " + ele + ": " + this.model.data.input[type][cur][ele];
							if (debug) console.log("[Web:load] cur " + cur + " ele " + ele);
						} else {
							query_str = "";
						}
					}
				}			
				if (debug) console.log("[Web:load] query_str ",  query_str);
				var $ele = $("#query_results ." + type ).text(query_str);
				query_str = "";

			}

			for (var content in this.model.data.output) {
				$("#content .content_elements").remove();        

				for (var element in this.model.data.output[content].list) {
					$newEle = $("#templates .content_elements").clone();
					$newEle.attr( {id: element} );
					for (var attr in this.model.data.output[content].list[element]) {
						var cur_val = this.model.data.output[content].list[element][attr];
						if (cur_val !== "not available") {
							$newEle.find("." + attr).text(attr +  "  ::  " + cur_val);							
						}
					}
					$newEle.appendTo('#content');
					if (debug) console.log("[Web:load] created a new list item", $newEle);
				}	
			}
		},

		/**
		 * clear Method that clears the list of content elements from the browser.
		 */
		clear: function() {
			$("#content .tweet").remove();        
		},

		/**
		 * clear Method that clears the list of content elements from the browser.
		 */
		updateState: function(_on) {
			if (_on) $("#query_form .qSubmit").val("stop forwarding");        
			else $("#query_form .qSubmit").val("start forwarding");        
		},

		/**
		 * submit Method that handle query submissions. It calls the controller's callback method that was
		 * 		registered in the registerController method.
		 */
		submit: function() {
			var msg = {};
			if (this.controller["submit"] && this.controller["toggleState"]) {

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

				if (debug) console.log("[View.Web:submit] msg ", msg);
				this.controller.toggleState();
				this.controller.submit(msg);
			}
		}
	}

/**
 * View.Web constructor method. Sets up the event listeners for the input text box and button.
 */
View.Spacebrew = function (config) {
		if (debug) console.log("[View.Spacebrew] calling constructor ");
		if (config["model"]) this.model = config["model"];
		if (config["debug"]) this.debug = config["debug"] || false;

		this.sb = new Spacebrew.Client(undefined, this.model.config.sb.name, this.model.config.sb.description);
		// console.log("[View.Spacebrew] spacebrew client at " +  + " name " + this.model.config.sb.name);

		var pubs = this.model.config.sb.pubs, 
			subs = this.model.config.sb.subs;

		for (var i = 0; i < pubs.length; i += 1) {
			this.sb.addPublish( pubs[i].name, pubs[i].type );		
			if (debug) console.log("[View.Spacebrew] adding pub " + pubs[i].name + " type " + pubs[i].type);
		}
		for (var i = 0; i < subs.length; i += 1) {
			this.sb.addSubscribe( subs[i].name, subs[i].type );		
			if (debug) console.log("[View.Spacebrew] adding sub " + pubs[i].name + " type " + pubs[i].type);
		}
		this.sb.onStringMessage = this.onString.bind(this);
		this.sb.onRangeMessage = this.onRange.bind(this);
		this.sb.onBooleanMessage = this.onBoolean.bind(this);
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
		callbacks: {},

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

		addCallback: function(eventName, cbName, cbContext ) {
			if (debug) console.log ("[ViewSpacebrew:addCallback] trying to add " + cbName + " to event " + eventName)
			if (debug) console.log ("[ViewSpacebrew:addCallback] type of cbName ", typeof cbContext[cbName])
			if ((typeof cbContext[cbName]) === "function") {
				this.callbacks[eventName] = cbContext[cbName].bind(cbContext);
				if (debug) console.log ("[ViewSpacebrew:addCallback] callback " + cbName + " added successufully to event " + eventName)
			}
			else {
				return false; 
			}
		},

		/**
		 * onString function that processes string messages received from spacebrew. It converts the string into a query that 
		 * 		is used as a query filter for the webservice. 	
		 * @param  {String} inlet Name of the subcription feed channel where the message was received
		 * @param  {String} msg   The message itself
		 */
		onString: function (inlet, msg) {
			if (debug) console.log("[onString] got string msg: " + msg);
			if (this.callbacks["onString"]) {
				this.callbacks["onString"](inlet, msg);
			}
		},


		onRange: function (inlet, msg) {
			if (debug) console.log("[onRange] got string msg: " + msg);
			if (this.callbacks["onRange"]) {
				this.callbacks["onRange"](inlet, msg);
			}
		},

		onBoolean: function (inlet, msg) {
			if (debug) console.log("[onBoolean] got string msg: " + msg);
			if (this.callbacks["onBoolean"]) {
				this.callbacks["onBoolean"](inlet, msg);
			}
		},

		/**
		 * onOpen callback method that handles the on open event for the Spacebrew connection.
		 */
		onOpen: function () {
			this.connected = true;
			if (debug) console.log("[onOpen] spacebrew connection established");
			if (this.callbacks["onOpen"]) {
				this.callbacks["onOpen"]();
			}
		},

		/**
		 * onClose callback method that handles the on close event for the Spacebrew Connection.  
		 */
		onClose: function () {
			this.connected = false;
			if (debug) console.log("[onClose] spacebrew connection closed");
			if (this.callbacks["onClose"]) {
				this.callbacks["onClose"]();
			}
		},

		load: function() {
			if (debug) console.log("[Spacebrew:load] load method called ");
			for (var content in this.model.data.output) {
				if (debug) console.log("[Spacebrew:load] this.model.data.output ", content);
				var content_list = this.model.data.output[content].list;
				for (var i = content_list.length - 1; i >= 0; i--) {
					if (debug) console.log("[Spacebrew:load] this.model.data.output[content]", i);
					if (debug) console.log("[Spacebrew:load] this.model.data.output[content].id", content_list[i].id);
					if (debug) console.log("[Spacebrew:load] this.model.data.output[content].latest", this.model.data.output[content].latest);

					// if this is a content element that has not been sent yet, then send it
					if (content_list[i].id > this.model.data.output[content].latest) {
						if (debug) console.log("[Spacebrew:load] id is higher than latest");

						// callback method handles how content is sent to spacebrew
						if (this.callbacks["load"]) {
							if (debug) console.log("[Spacebrew:load] this.callbacks['load']", this.callbacks["load"]);
							this.callbacks["load"](content_list[i], this.model.config.sb.pubs, this.sb);
						}
					}
				}
			}
		}
	}



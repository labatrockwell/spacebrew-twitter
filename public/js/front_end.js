var uiPort = uiPort || 3001;
var clientId = clientId || -1;

var model = {};
	model.server = '127.0.0.1';
	model.tweets = [];
	model.query = "";

function ajaxReq(query) {
	$.ajax({
	    type: "GET",
	    url: "/twitter/search", 
		data: JSON.stringify(query),
	    contentType: "application/json; charset=utf-8",
	    dataType: "json",
	    success: function(jData) {
		    console.log("jData: ", jData);
		    for (var i = 0; i < jData.length; i++) {
    	    	if (jData[i].user && jData[i].text && jData[i].created_at ) {
    	    		model.tweets.unshift(jData[i]);
    	    		var maxLen = 25;
    	    		if (model.tweets.length > maxLen) {
    		    		model.tweets = model.tweets.slice(0,maxLen);    			
    	    		}
    	    	}
    		    for (var j in model.tweets) {
    			    console.log("user: " + model.tweets[j].user + "\ntext: " + model.tweets[j].text + "\ncreated: " + model.tweets[j].created_at);
    			}
    		}
		    app.view.load();

	    },
	    error: function(err) {
	        alert(err.toString());
	    }
	});
}



var Control = {};

Control.main = function (view, model) {
	var self = this;
	this.view = view;
	this.model = model;
	this.interval = setInterval(function() {
		self.query();
	}, 15000);
}

Control.main.prototype = {
	constructor: Control.main,	// link to constructor
	initialized: false,		// flag that identifies if view has been initialized
	interval: {},

	query: function () {
		if (this.model.query === "") return;
		var query = { "query": this.model.query, "id" : clientId }; 
		var self = this;

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
	    	    		self.model.tweets.unshift(jData[i]);
	    	    		if (self.model.tweets.length > maxLen) {
	    		    		self.model.tweets = self.model.tweets.slice(0,maxLen);    			
	    	    		}
	    	    	}
	    		}
			    self.view.load();
		    },
		    error: function(err) {
		        alert(err.toString());
		    }
		});
	},

	newQuery: function (query) {
		this.model.query = query;
		this.model.tweets = [];
	    this.view.load();
	    this.query();
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

	load: function() {
		$("#tweet_container .tweet").remove();        

		for (var i in model.tweets) {
			var $newEle = $("#templates .tweet").clone();
			$newEle.attr( {id: i} );
			$newEle.find(".user").text(model.tweets[i].user);
			$newEle.find(".text").text(model.tweets[i].text);
			$newEle.find(".created_at").text(model.tweets[i].created_at);
			$newEle.appendTo('#tweet_container');
			if (this.debug) console.log("[updateTransformList] created a new list item", $newEle);
		}	
	},

	submit: function() {
		model.query = $("#qText").val();
		var msg = { "query": model.query, "id" : clientId }; 

		ajaxReq(msg);
		$("#query_results h1").text("Forwarding Tweets With:  " + model.query);
		model.tweets = [];
		this.load();
	}
}


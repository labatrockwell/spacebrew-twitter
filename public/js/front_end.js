var uiPort = uiPort || 3001;
var clientId = clientId || -1;

var model = {};
	model.server = '127.0.0.1';
	model.tweets = [];
	model.query = "";

/**
 * TweetApp
 */

var tweetServer = new WebSocket("ws://" + model.server + ":" + uiPort);  

tweetServer.onopen = function() {
	console.log("WebSockets connection opened");
	var config = {"clientId": clientId};
	tweetServer.send(JSON.stringify(config));
}

tweetServer.onmessage = function(data) {
    console.log("Got WebSockets message: ", data.data);
    try {
	    var jData = JSON.parse(data.data);	
	    console.log("jData: ", jData);
    	if (jData.user && jData.text && jData.created_at ) {
    		model.tweets.unshift(jData);
    		var maxLen = 25;
    		if (model.tweets.length > maxLen) {
	    		model.tweets = model.tweets.slice(0,maxLen);    			
    		}
    	}
	    for (var i in model.tweets) {
		    console.log("user: " + model.tweets[i].user + "\ntext: " + model.tweets[i].text + "\ncreated: " + model.tweets[i].created_at);
		}
    } catch (e) {
	    console.log("error parsing data as json: " + e);	
    }
    app.view.load();
}

tweetServer.onclose = function() {
    console.log("WebSockets connection closed");
}

tweetServer.onerror = function(e) {
  console.log("onerror ", e);
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
		var msg = { "query": model.query }; 
		tweetServer.send(JSON.stringify(msg));
		$("#query_results h1").text("Forwarding Tweets With:  " + model.query);
		model.tweets = [];
		this.load();
	}
}


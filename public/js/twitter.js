var app = {}
	, clientId = clientId || -1
	, sbConfigs = sbConfigs || {}
	, debug = false
	, config = {
		"sb": {
			"server": this.sbConfigs.server || "sandbox.spacebrew.cc"
			, "port": this.sbConfigs.port || 9000
			, "name": this.sbConfigs.name || "space_tweets_front"
			, "description": unescape(this.sbConfigs.description) || "web app that forwards tweets to spacebrew"
			, "pubs": [
			    { 
			    	"name": 'tweets', 	
			    	"type": 'string' 
			    }
			    , { 
			    	"name": 'users_tweets', 				
			    	"type": 'string' 
			    }
			    , { 
			    	"name": 'users_tweets_photos', 				
			    	"type": 'string' 
			    }
			    , { 
			    	"name": 'users_tweets_geo', 				
			    	"type": 'string' 
			    }
			    , { 
			    	"name": 'kitchen_sink', 				
			    	"type": 'string' 
			    }
			    , { 
			    	"name": 'new_tweets', 
			    	"type": 'boolean' 
			    }
			],
			"subs": [
			    { 
			    	"name": 'query', 
			    	"type": 'string' 
			    } 
			]
		},
		"input": {
			"required": {
				"query": {
					"text": "string"
				}
			},
			"optional": {
				"geo": {
					"lat": "integer",
					"long": "integer",
					"radius": "integer"
				}									
			}
		},
		"output": {
			"tweets": {
				"user": ""
				, "text": ""
                , "lat": ""
                , "long": ""
				, "created_at": ""
                , "photo": ""

			}
		},
		"query_path" : "/twitter/search"
	};


/**
 * sbLoadTweet Callback method that is called to send information about an individual tweet via spacebrew.
 * 			   This is where this mapping can be customized.
 * @param  {Object} curTweet Current tweet object
 * @param  {Object} pubs     Information about all publication channels
 * @param  {Object} sb       Link to spacbrew object
 */
function sbLoadTweet(curTweet, pubs, sb) {
	var users_tweets = JSON.stringify({"user": curTweet.name, "tweet": curTweet.text})
		, users_tweets_photos = JSON.stringify({"user": curTweet.name, "tweet": curTweet.text, "photo": curTweet.photo})
		, kitchen_sink = JSON.stringify(curTweet)
		, users_tweets_geo = undefined
		, vals = {};

		if (curTweet.lat && curTweet.long) {
			if (curTweet.lat != "not available" && curTweet.long != "not available") {
				users_tweets_geo = JSON.stringify({"user": curTweet.name, "tweet": curTweet.text, "lat": curTweet.lat, "long": curTweet.long});		
			}			
		}
		vals = {
					"tweets": curTweet.text
					, "users_tweets": users_tweets
					, "users_tweets_photos": users_tweets_photos
					, "users_tweets_geo": users_tweets_geo
					, "kitchen_sink": kitchen_sink
					, "new_tweets": "true"
				};	// set the values for each publication feed

	for (var j in pubs) {							
		if (debug) console.log("[sbLoadTweet] current pub: " + j + " name: " + pubs[j].name);
		if (vals[pubs[j].name]) {
			if (debug) console.log("[sbLoadTweet] sending value: " + vals[pubs[j].name]);
			sb.send( pubs[j].name, pubs[j].type, vals[pubs[j].name] );		
		}
	}				    	
}	

/**
 * onString Callback method used to handle string messages from Spacebrew.
 * @param  {String} name  	Name of the subscription channel
 * @param  {String} value 	Text of the message that was sent
 */
function onString(name, value) {
	if (debug) console.log("[onString] from " + name + ", value: " + value);
	var msg = {
		"required": {
			"query": {
				"text" : value
				, "available": true
			}
		}
	}
	if (debug) console.log("[onString] submitting msg ", msg);
	app.control.submit(msg);
}

$(window).bind("load", function() {

	// check if the fsLogIn button exists, if so then register a click listener
	var $logInButton = $("#logIn");

	if ($logInButton.length > 0) {
		if (debug) console.log("[onload:window] registering the logInButton")
		$logInButton.on("click", function(event) {
			var url = "/twitter/auth?client_id=" + clientId
			if (getQueryString("server")) url += "&server=" + getQueryString("server");    
			if (getQueryString("name")) url += "&name=" + getQueryString("name");    
			if (getQueryString("description")) url += "&description=" + getQueryString("description");    
			if (getQueryString("refresh")) url += "&refresh=" + getQueryString("refresh");    
			$(location).attr('href', url);
		})
	} 

	else {
		app.model = new Model.Main(config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoadTweet", this);
		app.sb_view.addCallback("onString", "onString", this);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);
	}

});
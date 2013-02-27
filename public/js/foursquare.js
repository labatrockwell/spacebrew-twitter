var app = {}
	, clientId = clientId || -1
	, debug = false
	, config = {
		"sb": {
			"name": unescape(getQueryString("name")) || "space_fs_check_ins",
			"description": unescape(getQueryString("description")) || "web app that forwards foursquare check-ins to spacebrew",
			"pubs": [
			    { 
			    	"name": 'people' 	
			    	, "type": 'string' 
			    }
			    , { 
			    	"name": 'people_and_venues' 	
			    	, "type": 'string' 
			    }
			    , { 
			    	"name": 'people_and_coords' 	
			    	, "type": 'string' 
			    }
			    , { 
			    	"name": 'people_and_photos' 	
			    	, "type": 'string' 
			    }
			    , { 
			    	"name": 'photos' 	
			    	, "type": 'string' 
			    }
			    , { 
			    	"name": 'check_in_bang' 	
			    	, "type": 'boolean' 
			    }
			],
			"subs": [
			]
		},
		"input": {
			"required": {
				"my friends": {}
			},
			"optional": {
				"geo": {
					"lat": "integer",
					"long": "integer",
				}									
			}
		},
		"output": {
			"check-ins": {
				"address": "",
				"checkinsCount": "",
				"city": "",
				"country": "",
				"createdAt": "",
				"id": "",
				"lat": "",
				"long": "",
				"photo": "",
				"state": "",
				"user": "",
				"venue": ""
			}
		},

		"query_path" : "/foursquare/search"
	};


/**
 * sbFunctions Constructor for the object that holds the spacebrew callback methods that will be registered
 * 			   with the controller via the addCallback method.
 */
function sbFunctions () {

	/**
	 * sbLoadCheckins	Method that processes each check-in for spacebrew. It parses out the appropriate
	 * 					check-in data attributes and recombines as required into strings that are sent
	 * 					via spacebrew.
	 * @param  {content} content holds the current check-in that is being processed
	 * @param  {Object} pubs     holds the names and types of the spacebrew pubs channels
	 * @param  {Object} sb       holds a link to the spacebrew connection
	 */
	this.sbLoadCheckins = function(content, pubs, sb) {
		if (debug) console.log("[sbLoadCheckins:sbFunctions] called ");
		var user_venue = { "user": content.user, "venue": content.venue}
		var user_coords = { "user": content.user, "lat": content.lat, "long": content.long}
		var user_photo = { "user": content.user, "photo": content.photo}

		// set the values for each publication feed
		vals = [
			content.user 
			, JSON.stringify(user_venue)
			, JSON.stringify(user_coords)
			, JSON.stringify(user_photo)
			, content.photo
			, "true"
		];	

		// loop through pubs array to send the appropriate spacebrew message via each outlet 
		for (var j in pubs) {							
			if (debug) console.log("sbLoadCheckins name " + pubs[j].name + " type " + pubs[j].type + " vals " + vals[j]);
			sb.send( pubs[j].name, pubs[j].type, vals[j] );                            
		}				    	
	}
}

var testSb = new sbFunctions();

$(window).bind("load", function() {
	if (debug) console.log("[onload:window] page loaded for client id " + clientId)

	// check if the fsLogIn button exists, if so then register a click listener
	var $logInButton = $("#fsLogIn");

	if ($logInButton.length > 0) {
		if (debug) console.log("[onload:window] registering the logInButton")
		$logInButton.on("click", function(event) {
			var url = "/foursquare/auth?client_id=" + clientId
			if (getQueryString("server")) url += "&server=" + getQueryString("server");    
			if (getQueryString("name")) url += "&name=" + getQueryString("name");    
			if (getQueryString("description")) url += "&description=" + getQueryString("description");    
			if (getQueryString("refresh")) url += "&refresh=" + getQueryString("refresh");    
			$(location).attr('href',url);
		})
	} 

	// if the user has been logged in, no fsLogIn button exists, then start-up the app
	else {
		if (debug) console.log("[onload:window] user is logged in, start-up the application")
		app.model = new Model.Main(config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoadCheckins", testSb);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);		
	}
});
var app = {}
	, clientId = clientId || -1
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
			    { 
			    	"name": 'lat, long'
			    	, "type": 'string'
			    } 
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

function sbFunctions () {

	this.sbLoadCheckins = function(content, pubs, sb) {
		console.log("sbLoadCheckins called ");
		var user_venue = { "user": content.user, "venue": content.venue}
		var user_coords = { "user": content.user, "lat": content.lat, "long": content.long}
		var user_photo = { "user": content.user, "photo": content.photo}

		vals = [
			content.user 
			, JSON.stringify(user_venue)
			, JSON.stringify(user_coords)
			, JSON.stringify(user_photo)
			, content.photo
			, "true"
		];	// set the values for each publication feed
		for (var j in pubs) {							
			console.log("sbLoadCheckins name " + pubs[j].name + " type " + pubs[j].type + " vals " + vals[j]);
			sb.send( pubs[j].name, pubs[j].type, vals[j] );                            
		}				    	
	}
}

var testSb = new sbFunctions();

$(window).bind("load", function() {
	console.log("[onload:window] page loaded for client id " + clientId)

	// check if the fsLogIn button exists, if so then register a click listener
	var $logInButton = $("#fsLogIn");
	if ($logInButton.length > 0) {
		console.log("[onload:window] registering the logInButton")
		$logInButton.on("click", function(event) {
			var url = "/foursquare/auth?client_id=" + clientId
			if (getQueryString("server")) url += "&server=" + getQueryString("server");    
			if (getQueryString("name")) url += "&name=" + getQueryString("name");    
			if (getQueryString("description")) url += "&description=" + getQueryString("description");    
			$(location).attr('href',url);
		})
	} 

	// if the user has been logged in, no fsLogIn button exists, then start-up the app
	else {
		console.log("[onload:window] user is logged in, start-up the application")
		app.model = new Model.Main(config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoadCheckins", testSb);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);		
	}

});
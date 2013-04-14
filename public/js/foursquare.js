var app = {}
	, clientId = clientId || -1
	, queryStr = queryStr || {}
	, authConfirm = authConfirm || false
	, debug = this.queryStr.debug || true
	, config = {
		"type": "forward"
		, "sb": {
			"server": this.queryStr.server || "sandbox.spacebrew.cc"
			, "port": this.queryStr.port || 9000
			, "name": this.queryStr.name || "space_fs_check_ins"
			, "description": unescape(this.queryStr.description) || "web app that forwards foursquare check-ins to spacebrew"
			, "pubs": [
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
			]
			, "subs": [
			]
		}
		, "input": {
			"required": {
				"my friends": {}
			}
			, "optional": {
				"geo": {
					"lat": "integer",
					"long": "integer",
				}									
			}
		}
		, "output": {
			"check-ins": {
				"address": "",
				"checkinsCount": "",
				"city": "",
				"country": "",
				"createdAt": "",
				"id": "",
				"lat": "",
				"long": "",
				"photo": "img",
				"state": "",
				"user": "",
				"venue": ""
			}
		}
		, "query_path" : "/foursquare/search"
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
		var people_and_venues = JSON.stringify({"user": content.user, "venue": content.venue})
			, people_and_coords = JSON.stringify({"user": content.user, "lat": content.lat, "long": content.long})
			, people_and_photos = JSON.stringify({"user": content.user, "photo": content.photo})
			, vals
			;

		// set the values for each publication feed
		vals = [
			content.user 			// people
			, people_and_venues		// people_and_venues
			, people_and_coords		// people_and_coords
			, people_and_photos		// people_and_photos
			, content.photo 		// photos
			, "true"				// check-in_bang
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

	if (!authConfirm) {
		$("#logIn").on("click", function(event) {
			$(location).attr('href', ("/foursquare/auth?client_id=" + clientId));
		});
		if (debug) console.log("[onload:window] registered logIn button")
	} 

	else {
		app.model = new Model.Main(clientId, config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoadCheckins", testSb);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);		
		if (debug) console.log("[onload:window] user is logged in, start-up the application")
	}
});
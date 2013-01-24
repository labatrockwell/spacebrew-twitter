var app = {}
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
	function sbLoadCheckins(content, pubs, sb) {
		var user_venue = { "user": content.name, "venue": content.venue}
		var user_coords = { "user": content.name, "lat": content.lat, "long": content.long}
		var user_photo = { "user": content.name, "photo": content.photo}
		var photo = { "photo": content.photo}

		vals = [
			content.name 
			, user_venue
			, user_coords
			, user_photo
			, photo
			, "true"
		];	// set the values for each publication feed
		for (var j in pubs) {							
			sb.send( pubs[j].name, pubs[j].type, vals[j] );                            
		}				    	
	}		
}

$(window).bind("load", function() {
	app.model = new Model.Main(config);
	app.web_view = new View.Web({"model": app.model});
	app.sb_view = new View.Spacebrew({"model": app.model});
	// app.sb_view.addCallback("load", "sbLoadCheckins", sbFunctions);
	app.control = new Control.Main([app.web_view, app.sb_view], app.model);
});
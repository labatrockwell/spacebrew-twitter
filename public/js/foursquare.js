var app = {}
	, config = {
		"sb": {
			"name": unescape(getQueryString("name")) || "space_fs_check_ins",
			"description": unescape(getQueryString("description")) || "web app that forwards foursquare check-ins to spacebrew",
			"pubs": [
			    { 
			    	"name": 'people', 	
			    	"type": 'string' 
			    }
			],
			"subs": [
			    { 
			    	"name": 'lat, long', 
			    	"type": 'string' 
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
				"user": "",
			}
		},

		"query_path" : "/foursquare/search"
	};

$(window).bind("load", function() {
	app.model = new Model.Main(config);
	app.web_view = new View.Web({"model": app.model});
	app.sb_view = new View.Spacebrew({"model": app.model});
	app.control = new Control.Main([app.web_view, app.sb_view], app.model);
});
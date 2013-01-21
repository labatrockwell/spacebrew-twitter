var app = {}
	, config = {
		"sb": {
			"name": unescape(getQueryString("name")) || "space_tweets_front",
			"description": unescape(getQueryString("description")) || "web app that forwards tweets to spacebrew",
			"pubs": [
			    { 
			    	"name": 'users_and_tweets', 	
			    	"type": 'string' 
			    }, 
			    { 
			    	"name": 'tweets', 				
			    	"type": 'string' 
			    }, 
			    { 
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
				"user": "",
				"text": "",
				"created_at": ""
			}
		}
	};

$(window).bind("load", function() {
	app.model = new Model.Main(config);
	app.web_view = new View.Web({"model": app.model});
	app.sb_view = new View.Spacebrew({"model": app.model});
	app.control = new Control.Main([app.web_view, app.sb_view], app.model);
});
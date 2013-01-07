///////////////////////////////////
// Module dependencies
var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')


///////////////////////////////////
// create application
var app = express()
function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}


///////////////////////////////////
// set the view location and template type
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.set('view options', { pretty: true })


///////////////////////////////////
// set middleware in order
app.use(express.logger('dev'))
app.use(stylus.middleware(
  { src: __dirname + '/public'
  , compile: compile
  }
))
app.use(express.static(__dirname + '/public'))


//////////////////////////////
// Spacebrew Connection
var WebSocket = require('ws');

var sb = {};
    sb.server = 'ec2-184-72-140-184.compute-1.amazonaws.com';
    sb.name = "twitter_app";
    sb.desc = "";
    sb.pubName = 'tweets',
    sb.config = {
        "config": {
            "name": sb.name,
            "description": sb.desc,
            "publish": {
                "messages": [
                    {
                        "name": sb.pubName,
                        "type": "string"
                    }
                ]
            },
            "subscribe": {
                "messages": []
            }
        }
    };

    sb.conn = new WebSocket("ws://"+sb.server+":9000");  
    
    sb.conn.onopen = function() {
        console.log("[sb.onopen] connection opened, configuring spacebrew");
        sb.conn.send(JSON.stringify(sb.config));
    }

    sb.conn.onmessage = function(e) {
    }

    sb.conn.onclose = function() {
        console.log("[sb.onopen] connection closed");
    }

    sb.conn.onerror = function(e) {
        console.log("onerror ", e);    
    }
    
    // When the "error" event is emitted for the spacebrew connection, this is called
    sb.conn.on("error", function(error) {
        console.log("+++++++ ERROR +++++++");
        console.error(error);
    });
    
    sb.send = function( name, type, value ){
        var message = {
            message:{
               clientName:this.name,
               name:name,
               type:type,
               value:value
            }
        };
        //console.log(message);
        sb.conn.send(JSON.stringify(message));
    };


//////////////////////////////
// Connect to Temboo - create single TembooSession object
var tauth = require("./temboo_auth").tAuth;
var tsession = require("temboo/core/temboosession");
var session = new tsession.TembooSession(tauth.user, tauth.app, tauth.key);

var tResults = {};
var lastId = 0;

//////////////////////////////
// Make Twitter Query
// function queryTwitter(searchT) {
function queryTwitter(searchT, uiClient) {
	if (!isString(searchT)) return;

    var Twitter = require("temboo/Library/Twitter/Search");
    var queryChoreo = new Twitter.Query(session);
    
    // Instantiate and populate the input set for the choreo
    var queryInputs = queryChoreo.newInputSet();

    // Set inputs
    queryInputs.set_ResponseFormat("json");
    queryInputs.set_Query(searchT);

    console.log("****************************");
    console.log("[queryTwitter] query: " + searchT);

    var successCallback = function(results) {
        tResults = JSON.parse(results.get_Response());
        // console.log( "[queryTwitter] full results: ", tResults );
        // if (false) {
        if (tResults.query) {
            console.log( "[queryTwitter] results for: " + tResults.query + " (escaped: " + escape(tResults.query)  + ")" );
            if (tResults.results) {
                var newTweets = [];
                for(var i = tResults.results.length - 1; i >= 0; i--) {
                    if (tResults.results[i].id > lastId) {
                        var newTweet = {
                            user: tResults.results[i].from_user,
                            text: tResults.results[i].text,
                            created_at: tResults.results[i].created_at
                        };
                        newTweets.push(newTweet);
                        lastId = tResults.results[i].id;
                        sb.send(sb.pubName, "string", JSON.stringify(newTweet));
                        if (uiClient) {
		                    if (uiClient.send) {
	                        	uiClient.send(JSON.stringify(newTweet));
	                        }
                        }
                    }
                }
                console.log("[queryTwitter] number of new tweets: ", newTweets.length);
                if (newTweets.length > 0) console.log("[queryTwitter] list of new tweets:\n", newTweets);
            }
        }
    };

    // Run the choreo, specifying success and error callback handlers
    queryChoreo.execute(
        queryInputs,
        successCallback,
        function(error){console.log(error.type); console.log(error.message);}
    );
}


///////////////////////////////////
// create front-end UI server 
var WebSocketServer = require('ws').Server;

var wssUI = {};
	wssUI.newId = 0;
	wssUI.clients = {
		client: {},
		query: "",
		interval: {}
	};
	wssUI.port = 3001;
	wssUI.conn = new WebSocketServer({port: wssUI.port});
	wssUI.conn.on('connection', function(conn) {
		console.log("connected to front end");

		var clientId = wssUI.newId;
		wssUI.clients[clientId] = { client: conn, query: ""};
		wssUI.newId++;

	    conn.on('message', function(message) {
	        console.log('received: %s', message);
	    	try {
		    	message = JSON.parse(message);
		    } catch (e) {
		    	console.log("error can't convert message to json");
		    }

	        if (isString(message.query)) {
	        	wssUI.clients[clientId].query = message.query;
		        console.log('client id: ' + clientId + " new query: " + wssUI.clients[clientId].query);
		        queryTwitter(wssUI.clients[clientId].query, conn);
	        }
	    });

	    conn.on('close', function() {
	    	delete wssUI.clients[clientId];
	    });

	    conn.send('something');

	});

var isString = function (obj) {
	return toString.call(obj) == '[object String]';
}

///////////////////////////////////
// make twitter query when necessary 
setInterval(function(){
	for ( var i in wssUI.clients ) {
		if (!(wssUI.clients[i].query === "")) {
			console.log ("client id: " + i + " query: " + wssUI.clients[i].query);
			queryTwitter(wssUI.clients[i].query, wssUI.clients[i].client);			
		}
	}
}, 20000);


///////////////////////////////////
// link paths to templates and data
app.get('/', function (req, res) {
    var urlReq = require('url').parse(req.url, true);

    if (urlReq.query.search) {
        query = urlReq.query.search;
        lastId = 0;
	    console.log("New Twitter Query: " + query);
    }

	var testSend = [{tweet:"first tweet", user:"test user"}]
	res.render('index',
		{ 
			title : 'spacebrew twitter',
			subTitle : 'sending tweets to spacebrew',
			port: wssUI.port, 
			data : JSON.stringify(testSend)
		}
	)

})

app.get('/test', function (req, res) {
  res.end('Test!')
})

///////////////////////////////////
// app will listen to port 
app.listen(3000)
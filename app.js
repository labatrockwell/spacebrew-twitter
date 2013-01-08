///////////////////////////////////
// Module dependencies
var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , WebSocketServer = require('ws').Server;


var model = {}
    model.httpPort = 3002;
    model.wsPort = 3001;
    model.newClientId = 0;
    model.clients = {};

var sbBase = {};
    sbBase.server = 'ec2-184-72-140-184.compute-1.amazonaws.com';

/**
 * Loop through each argument that is passed in via the shell when app is launched. Look for
 *     port and server configuration settings. The forEach method loops through each item in 
 *     the process.argv object.  
 * @param  {string} val   Value stored in the current argument 
 * @param  {[type]} index Index of the current argument
 * @param  {[type]} array Array containing all additional command line arguments
 */
process.argv.forEach(function (val, index, array) {
    // check if port number was passed as argument
    // console.log(index + ': ' + val);

    // check if port number was passed as argument
    var regMatch = val.match(/(\w+)=(\d+)/)
    if (regMatch) {
        if (regMatch[1] == "port") {
            model.httpPort = regMatch[2]   
            console.log("APP http port number set: " + model.httpPort)
        }         
        if (regMatch[1] == "portUI") {
            model.wsPort = regMatch[2]   
            console.log("APP UI-websockets port number set: " + model.wsPort)
        }         
    }

    // check if spacebrew server address was passed as argument
    regMatch = val.match(/(\w+)=([\w\-\.]+)/)
    if (regMatch) {
        if (regMatch[1] == "server") {
            sbBase.server = regMatch[2]   
            console.log("APP base spacebrew server set to: " + sbBase.server)
        }         
    }
})

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

sbBase.name = "space_tweets";
sbBase.pubName = ['users_and_tweets', 'tweets', 'new_tweets']
sbBase.config = {
    "config": {
        "name": "space_tweets",
        "description": "spacebrew twitter forwarder",
        "publish": {
            "messages": [
                {
                    "name": sbBase.pubName[0],
                    "type": "string"
                },
                {
                    "name": sbBase.pubName[1],
                    "type": "string"
                },
                {
                    "name": sbBase.pubName[2],
                    "type": "boolean"
                }
            ]
        },
        "subscribe": {
            "messages": []
        }
    }
};

sbBase.send = function( cName, name, type, value, _sb ){
    var message = {
        message:{
           clientName: cName,
           name:name,
           type:type,
           value:value
        }
    };
    console.log("[sbBase.send] sending " + JSON.stringify(message));

    //console.log(message);
    if (_sb) _sb.send(JSON.stringify(message));
    else sb.conn.send(JSON.stringify(message));
};

//////////////////////////////
// Connect to Temboo - create single TembooSession object
var tauth = require("./temboo_auth").tAuth;
var tsession = require("temboo/core/temboosession");
var session = new tsession.TembooSession(tauth.user, tauth.app, tauth.key);

//////////////////////////////
// Make Twitter Query
function queryTwitter(searchT, clientId) {
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
        var tResults = JSON.parse(results.get_Response());
        model.clients[clientId].results = tResults.results;

        if (tResults.query) {
            console.log( "[queryTwitter] results for: " + tResults.query );
            if (model.clients[clientId].results) {
                var newTweets = [];
                for(var i = model.clients[clientId].results.length - 1; i >= 0; i--) {
                    if (model.clients[clientId].results[i].id > model.clients[clientId].lastId) {
                        var newTweet = {
                            user: model.clients[clientId].results[i].from_user,
                            text: model.clients[clientId].results[i].text,
                            created_at: model.clients[clientId].results[i].created_at
                        };
                        newTweets.push(newTweet);
                        model.clients[clientId].lastId = model.clients[clientId].results[i].id;
                        if (model.clients[clientId].sb.connected) {
                            sbBase.send(model.clients[clientId].sb.name, sbBase.pubName[0], "string", JSON.stringify(newTweet), model.clients[clientId].sb.conn);
                            sbBase.send(model.clients[clientId].sb.name, sbBase.pubName[1], "string", newTweet.text, model.clients[clientId].sb.conn);
                            sbBase.send(model.clients[clientId].sb.name, sbBase.pubName[2], "boolean", "true", model.clients[clientId].sb.conn);                            
                        }
                        if (model.clients[clientId]) {
                            if (model.clients[clientId].conn) {
                                model.clients[clientId].conn.send(JSON.stringify(newTweet));
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
var wssUI = {};

wssUI.conn = new WebSocketServer({port: model.wsPort});

wssUI.conn.on('connection', function(conn) {
	console.log("connected to front end");

	var clientId = model.newClientId;
	model.clients[clientId] = {
            id: model.newClientId,
            conn: conn,
            query: "",
            interval: getInterval(clientId, 15000),
            sb: {},
            lastId: 0,
            results: {},
        };
    model.newClientId++;

    model.clients[clientId].sb = {
        server : sbBase.server,
        name : sbBase.name,
        desc : "",
        conn : {},
        config: {},
        connected : false
    }

    model.clients[clientId].sb.conn = new WebSocket("ws://"+ model.clients[clientId].sb.server +":9000");

    model.clients[clientId].sb.conn.onopen = function() {
            console.log("[sb.onopen] connection opened, sending client settings to spacebrew \n" + JSON.stringify(model.clients[clientId].sb.config));
            var newConfig = sbBase.config;
            newConfig.config.name = model.clients[clientId].sb.name;
            newConfig.config.server = model.clients[clientId].sb.server;
            model.clients[clientId].sb.conn.send(JSON.stringify(newConfig));
            model.clients[clientId].sb.connected = true;
            model.clients[clientId].sb.config = newConfig;
    }

    model.clients[clientId].sb.conn.onclose = function() {
        console.log("[sb.onopen] connection closed");
    }

    model.clients[clientId].sb.conn.onerror = function(e) {
            console.log("onerror ", e);    
    }

    // When the "error" event is emitted for the spacebrew connection, this is called
    model.clients[clientId].sb.conn.on("error", function(error) {
            console.log("+++++++ ERROR +++++++");
            console.error(error);
    });            

    conn.on('message', function(message) {
        console.log('received: %s', message);
    	try {
	    	message = JSON.parse(message);
	    } catch (e) {
	    	console.log("error can't convert message to json");
	    }

        if (isString(message.query)) {
            console.log('client id: ' + clientId + " new query: " + model.clients[clientId].query);
        	model.clients[clientId].query = message.query;
            model.clients[clientId].lastId = 0;
	        queryTwitter(model.clients[clientId].query, model.clients[clientId].id);
        }
    });

    conn.on('close', function() {
        clearInterval(model.clients[clientId].interval);
    	delete model.clients[clientId];
    });

    conn.send('something');

});

var isString = function (obj) {
	return toString.call(obj) == '[object String]';
}


function getInterval(clientId, timeInterval) {
    if (timeInterval) timeInterval = isNaN(timeInterval) ? 20000 : timeInterval;
    else timeInterval =  20000;
    var newInterval = setInterval(function(){
        if (model.clients[clientId]) {
            if (!(model.clients[clientId].query === "")) {
                console.log ("client id: " + clientId + " query: " + model.clients[clientId].query);
                queryTwitter(model.clients[clientId].query, model.clients[clientId].id);          
            }
        } else {
            clearInterval(newInterval);
        }
    }, timeInterval);
    return newInterval
}

///////////////////////////////////
// make twitter query when necessary 
// setInterval(function(){
// 	for ( var i in model.clients ) {
// 		if (!(model.clients[i].query === "")) {
// 			console.log ("client id: " + i + " query: " + model.clients[i].query);
// 			queryTwitter(model.clients[i].query, model.clients[i].id);			
// 		}
// 	}
// }, 20000);


///////////////////////////////////
// link paths to templates and data
app.get('/', function (req, res) {
  res.write('live services:\n')
  res.write('\t/twitter')
  res.end()
})


app.get('/twitter', function (req, res) {
    var urlReq = require('url').parse(req.url, true);

    if (urlReq.query.server) {
        sbBase.server = urlReq.query.server
        console.log("Setting spacebrew server: " + sbBase.server);        
    }

    if (urlReq.query.name) {
        sbBase.name = urlReq.query.name
        console.log("Setting spacebrew name: " + sbBase.name);        
    }

	var testSend = [{tweet:"first tweet", user:"test user"}]
	res.render('index',
		{ 
			title : 'spacebrew twitter',
			subTitle : 'sending tweets to spacebrew',
			port: model.wsPort, 
			data : JSON.stringify(testSend)
		}
	)

})

app.get('/test', function (req, res) {
  res.end('Test!')
})

///////////////////////////////////
// app will listen to port 
try {
    app.listen(model.httpPort)    
} catch (e) {
    console.log("ERROR: Unable to start-up express web server")
    console.log("       Error message:\n", e)
}
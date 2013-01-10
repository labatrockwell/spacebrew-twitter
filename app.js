///////////////////////////////////
// Module dependencies
var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , WebSocketServer = require('ws').Server;


var model = {}
    model.httpPort = 3002;
    model.wsPort = 3001;
    model.curClientId = 0;
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
sbBase.pubs = [
    {name:'users_and_tweets', type: 'string'}, 
    {name:'tweets', type: 'string'}, 
    {name:'new_tweets', type: 'boolean'}
]

sbBase.config = {
    "config": {
        "name": "space_tweets",
        "description": "spacebrew twitter forwarder",
        "publish": {
            "messages": [
                {
                    "name": sbBase.pubs[0].name,
                    "type": sbBase.pubs[0].type
                },
                {
                    "name": sbBase.pubs[1].name,
                    "type": sbBase.pubs[1].type
                },
                {
                    "name": sbBase.pubs[2].name,
                    "type": sbBase.pubs[2].type
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

        if (tResults.query) {
            model.clients[clientId].results = tResults.results;
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

                        // update the id of the most recent message
                        model.clients[clientId].lastId = model.clients[clientId].results[i].id;

                        // if connected to spacebrew, send the new tweets
                        if (model.clients[clientId].sb_connected) {
                            var vals = [JSON.stringify(newTweet), newTweet.text, "true"];
                            for (var i in sbBase.pubs) {
                                sbBase.send( 
                                                model.clients[clientId].sb_name, 
                                                sbBase.pubs[i].name, 
                                                sbBase.pubs[i].type, 
                                                vals[i], 
                                                model.clients[clientId].sb
                                            );                            
                            }
                        }

                        // if connected to 
                        if (model.clients[clientId].ui) {
                            model.clients[clientId].ui.send(JSON.stringify(newTweet));
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
    var clientId = -1;

    conn.on('message', function(message) {
        console.log('received: %s', message);
    	try { message = JSON.parse(message); } 
        catch (e) { console.log("error can't convert message to json"); }

        if (message.clientId) {
            if (!isNaN(message.clientId)) {
                clientId = message.clientId;
                model.clients[clientId].ui = conn;
                model.clients[clientId].interval = getInterval(clientId);

                var newConfig = sbBase.config;
                    newConfig.config.name = model.clients[clientId].sb_name;
                    newConfig.config.server = model.clients[clientId].sb_server;
                    newConfig.config.description = model.clients[clientId].sb_desc;

                model.clients[clientId].sb = new WebSocket("ws://"+ model.clients[clientId].sb_server +":9000");

                model.clients[clientId].sb.onopen = function() {
                    console.log("[sb.onopen] connection opened, sending client settings to spacebrew \n" + JSON.stringify(model.clients[clientId].sb_config));
                    model.clients[clientId].sb.send(JSON.stringify(newConfig));
                    model.clients[clientId].sb_connected = true;
                    model.clients[clientId].sb_config = newConfig;            
                }

                model.clients[clientId].sb.onclose = function() {
                    console.log("[sb.onopen] connection closed");
                }

                model.clients[clientId].sb.onerror = function(e) {
                    console.log("onerror ", e);    
                }

                // When the "error" event is emitted for the spacebrew connection, this is called
                model.clients[clientId].sb.on("error", function(error) {
                    console.log("+++++++ ERROR +++++++");
                    console.error(error);
                });            
            }
        }

        if (isString(message.query)) {
            if (clientId >= 0) {
                model.clients[clientId].query = message.query;
                model.clients[clientId].lastId = 0;
                queryTwitter(model.clients[clientId].query, model.clients[clientId].id);
                console.log('client id: ' + clientId + " new query: " + model.clients[clientId].query);                
            } 
        }
    });

    conn.on('close', function() {
        if (model.clients[clientId].sb) model.clients[clientId].sb.close();
        clearInterval(model.clients[clientId].interval);
    	delete model.clients[clientId];
    });

    conn.send('something');

});

var isString = function (obj) {
	return toString.call(obj) == '[object String]';
}


function getInterval(clientId) {
    var newInterval = setInterval(function(){
        if (model.clients[clientId]) {
            if (!(model.clients[clientId].query === "")) {
                console.log ("client id: " + clientId + " query: " + model.clients[clientId].query);
                queryTwitter(model.clients[clientId].query, model.clients[clientId].id);          
            }
        } else {
            clearInterval(newInterval);
        }
    }, model.clients[clientId].interval_time);
    return newInterval
}

function newClient(config) {
    model.curClientId++;
    var clientId = model.curClientId;
    model.clients[clientId] = {
        id: clientId,
        query: "",
        interval: {},
        interval_time: config.refresh || 20000,
        results: {},
        lastId: 0,
        ui: {},
        ui_connected: false,
        sb: {},
        sb_name: config.name || sbBase.name,
        sb_server: config.server || sbBase.server,
        sb_desc: "app the forwards tweets to spacebrew",
        sb_config: {},
        sb_connected: false,
    } 
    return model.clients[clientId];
}

///////////////////////////////////
// link paths to templates and data
app.get('/', function (req, res) {
  res.write('live services:\n')
  res.write('\t/twitter')
  res.end()
})

app.get('/twitter', function (req, res) {
    var urlReq = require('url').parse(req.url, true);
    var qs = {};
    var client;

    if (urlReq.query.server) {
        qs.server = urlReq.query.server;
        console.log("Setting spacebrew server: " + qs.server);        
    }

    if (urlReq.query.name) {
        qs.name = urlReq.query.name;
        console.log("Setting spacebrew name: " + qs.name);        
    }

    if (urlReq.query.refresh) {
        if (!isNaN(urlReq.query.refresh)) {
            qs.refresh = urlReq.query.refresh;
            if (qs.refresh < 4000) qs.refresh = 4000;
            console.log("Setting refresh time: " + qs.refresh);        
        }
    }

    client = newClient(qs);

	res.render('index',
		{ 
			title : 'spacebrew twitter'
			, subTitle : 'sending tweets to spacebrew'
			, port: model.wsPort
            , clientId: client.id
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
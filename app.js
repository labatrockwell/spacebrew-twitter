///////////////////////////////////
// Module dependencies
var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , WebSocketServer = require('ws').Server;


var model = {}
    model.httpPort = 3002;
    model.curClientId = 0;
    model.clients = {};

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
            model.httpPort = regMatch[2];   
            console.log("APP http port number set: " + model.httpPort);
        }         
    }
})

///////////////////////////////////
// create application
var app = express()

///////////////////////////////////
// set the view location and template type
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.set('view options', { pretty: true })

///////////////////////////////////
// set middleware in order
app.use(express.logger('dev'))
app.use(stylus.middleware( { src: __dirname + '/public', compile: compileStylus } ))
app.use(express.static(__dirname + '/public'))

app.get('/', handleRoot);
app.get('/twitter', handleTwitterApp);
app.get('/twitter/search', handleTwitterQuery);
app.get('/twitter/query', handleTwitterQuery);


//////////////////////////////
// Connect to Temboo - create single TembooSession object
var tauth = require("./temboo_auth").tAuth;
var tsession = require("temboo/core/temboosession");
var session = new tsession.TembooSession(tauth.user, tauth.app, tauth.key);

/**
 * queryTwitter Function that submits twitter queries to via the Temboo API engine. 
 * @param  {Integer} clientId     Id of the client that submitted this query
 * @param  {String} callbackName Name of callback method that should be called when results data
 *                               is received. If none is proved then it will default to reply.
 */
function queryTwitter(clientId, callbackName) {
    var searchT = model.clients[clientId].query,
        callbackName = callbackName || "reply"

	if (!isString(searchT)) return;    // return if search term not valid

    // set-up the temboo service connection
    var Twitter = require("temboo/Library/Twitter/Search");
    var queryChoreo = new Twitter.Query(session);
    
    // Instantiate and populate the input set for the choreo
    var queryInputs = queryChoreo.newInputSet();
    queryInputs.set_ResponseFormat("json");     // requesting response in json
    queryInputs.set_Query(searchT);             // setting the search query


    /**
     * successCallback Method that is called by the temboo API when the results from twitter are
     *     returned. It process the data and calls the client's handler method to forward the
     *     data back to the front end
     * @param  {Temboo Results Obect} results Results from Temboo Twitter service query
     */
    var successCallback = function(results) {
        var tResults = JSON.parse(results.get_Response()),
            newTweets = [],
            newTweet = {},
            vals = "";

        if (tResults.query && tResults.results) {
            console.log( "[queryTwitter] results received for query: " + tResults.query );

            model.clients[clientId].results = tResults.results;
            for(var i = model.clients[clientId].results.length - 1; i >= 0; i--) {
                if (model.clients[clientId].results[i].id > model.clients[clientId].lastId) {
                    newTweet = {
                        user: model.clients[clientId].results[i].from_user,
                        text: model.clients[clientId].results[i].text,
                        created_at: model.clients[clientId].results[i].created_at
                    };
                    newTweets.push(newTweet);

                    // update the id of the most recent message
                    model.clients[clientId].lastId = model.clients[clientId].results[i].id;
                }
            }

            if (model.clients[clientId][callbackName]) {
                model.clients[clientId][callbackName](JSON.stringify(newTweets));
            }

            console.log("[queryTwitter] number of new tweets: ", newTweets.length);
            if (newTweets.length > 0) console.log("[queryTwitter] list of new tweets:\n", newTweets);
            if (model.clients[clientId][callbackName]) {
                model.clients[clientId][callbackName]();
            }
        }
    };

    // Run the choreo, passing the success and error callback handlers
    queryChoreo.execute(
        queryInputs,
        successCallback,
        function(error) {console.log(error.type); console.log(error.message);}
    );
}

/**
 * compileStylus Compiles the stylus library to use nib. These are the libraries that handle the stylesheet
 *     stylus files (ending in .styl)
 * @param  {unknown} str  TBD
 * @param  {unknown} path TBD
 */
function compileStylus(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}

/**
 * handleRoot Callback function that handles requests to the base URL
 * @param  {Request Object} req Express server request object, which includes information about the HTTP request
 * @param  {Response Object} res Express server response object, used to respond to the HTTP request
 */
function handleRoot(req, res) {
  res.write('live services:\n')
  res.write('\t/twitter')
  res.end()
}

/**
 * handleTwitterApp Callback function that handles requests for the twitter app. These requests are parsed to
 *     extract the app name from the URL. Once that is done, a new client object is created and then the appropriate 
 *     page template is rendered. The client id, page title and subtitle are passed to the front-end page that is 
 *     being rendered.   
 * @param  {Request Object} req Express server request object, which includes information about the HTTP request
 * @param  {Response Object} res Express server response object, used to respond to the HTTP request
 */
function handleTwitterApp (req, res) {
    var client = newClient();

	res.render('index',
		{ 
            title : "Tweets in Space"			
            , subTitle : "forwarding tweets to spacebrew"
            , clientId: client.id
		}
	)
}

/**
 * handleTwitterQuery Callback function that handles ajax requests for tweets. The query string in the URL for 
 *     each request includes a client id and a twitter query term. These are used to make the appropriate request
 *     to the twitter server, via Temboo. A reply callback method is added to the client object. This method is used
 *     by the queryTwitter function to respond to the ajax request once it receives a response from the twitter server.
 *        
 * @param  {Request Object} req Express server request object, which includes information about the HTTP request
 * @param  {Response Object} res Express server response object, used to respond to the HTTP request
 */
function handleTwitterQuery (req, res) {
    var urlReq = require('url').parse(req.url, true)    // get the full URL request
        , query = urlReq.search.replace(/\?/, "")       // get query string from URL request, remove the leading '?'
        , queryJson = JSON.parse(unescape(query))      // convert string to json (unescape to convert string format first)
        , client                                       // will hold client object
        ;

    console.log("[handleTwitterQuery] json query ", queryJson)

    if (!(queryJson.id && model.clients[queryJson.id])) {
        client = newClient();
        queryJson.id = client.id;
    } 

    // if the query object featured a valid query then process it
    if (queryJson.query) {
        console.log("Valid query from id: " + queryJson.id + ", new query : " + queryJson.query);        

        // set the ajax_req flag to true and create the callback function
        model.clients[queryJson.id].query = queryJson.query;
        model.clients[queryJson.id].reply = function(data) {
            res.end(data);                
        }

        // submit the query and client id to the query twitter app
        queryTwitter(queryJson.id);
    }
}
// })

/**
 * isString Function that checks whether an object is a string
 * @param  {Object}  obj Object that will be checked to confirm whether it is a string
 * @return {Boolean}     Returns true if the object was a string. False otherwise.
 */
var isString = function (obj) {
    return toString.call(obj) === '[object String]';
}

/**
 * newClient Increments the curClientId and then add a new client to the model.clients object, assigning
 *     to it the new client id.
 * @param  {Object} config  Configuration object with an application name
 * @return {model.Client}   Returns the client object that was just created
 */
function newClient(config) {
    model.curClientId++;
    var clientId = model.curClientId;
    model.clients[clientId] = {
        id: clientId,
        query: "",
        results: {},
        lastId: 0,
        reply: undefined,
    } 
    return model.clients[clientId];
}

///////////////////////////////////
// app will listen to port 
try {
    app.listen(model.httpPort)    
} catch (e) {
    console.log("ERROR: Unable to start-up express web server")
    console.log("       Error message:\n", e)
}
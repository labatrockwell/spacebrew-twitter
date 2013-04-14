module.exports = {
    session: {},                    // link to active temboo session
    model: {                        // holds app configuration and current state information
		"curClientId": 0
		, "clients": {}
    },

    /**
     * init 	Method that initializes the controller object by getting a reference to the
     * 			Temboo session object.
     * @param  {Object} config  Configuration object that includes the auth settings 
     *                          and the session object.
     * @return {Object}         Twitter control object if config object was valid,
     *                          otherwise it returns an empty object
     */
    init: function( config ) {
        if (config["session"]) {
	        this.session = config["session"];
	        console.log("[init:Twitter] successfully configured twitter status update controller")
	        return this;
        } else {
            console.log("[init:Twitter] unable to configure twitter status update controller")
            return {};        
        }
    },

    /**
     * newClient 	Increments the curClientId and then add a new client to the this.model.clients object, 
     * 				assigning to it the new client id.
     * @param  {Object} config  	Configuration object with an application name
     * @return {this.model.Client}  Returns the client object that was just created
     */
    newClient: function () {
        this.model.curClientId++;               // update curClientId number
        var clientId = this.model.curClientId;  // assign id number for current client
        this.model.clients[clientId] = {        // initialize the current client object
			"id": clientId
			, "updates": []
			, "reply": undefined
			, "auth": {
				"auth_token_secret": ""
				, "callback_id" : ""
				, "access_token": ""
				, "access_token_secret": ""
				, "oath_started": false
			}
			, "query_str": {
				"server": "sandbox.spacebrew.cc"
				, "port": 9000
				, "name": "space tweets"
				, "description": "forwards tweets to spacebrew"
				, "refresh": undefined
			}
		}
        return this.model.clients[clientId];
    },

    /**
     * handleAppRequest 	Callback function that handles requests for the twitter app. These requests 
     * 						are parsed to extract the app name from the URL. Once that is done, a new 
     * 						client object is created and then the appropriate page template is rendered. 
     * 						The client id, page title and subtitle are passed to the front-end page that is 
     *       				being rendered.   
     * @param  {Request Object} req 	Express server request object, which includes information about the 
     *                          		HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    handleAppRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
        	, client = this.newClient()
        	;

        // create the query string that will be appended to the redirect urls
        if (urlReq.query['server']) client.query_str["server"] = urlReq.query['server'];       
        if (urlReq.query['port']) client.query_str["port"] = urlReq.query['port'];        
        if (urlReq.query['name']) client.query_str["name"] = urlReq.query['name'];
        if (urlReq.query['description']) client.query_str["description"] = urlReq.query['description'];
        if (urlReq.query['refresh']) client.query_str["refresh"] = urlReq.query['refresh'];
        if (urlReq.query['debug']) client.query_str["debug"] = urlReq.query['debug'];

        console.log("[handleAppRequest] new client id ", client.id)
        console.log("[handleAppRequest] loaded query string settings ", this.model.clients[client.id].query_str)

        res.render('twitter_update_no_auth',
            { 
                "title" : "Tweets in Space"           
                , "subTitle" : "Send tweets through spacebrew"
                , "clientId" : client.id
                , "authConfirm" : false
                , "queryStr" : client.query_str
            }
        )                                
    },

    /**
     * handleOAuthRequest 	Method that handles http requests associated to OAuth athentication for the
     * 						Foursquare app. It leverages Temboo's OAuth API, in a consistent manner.
     * @param  {Request Object} req 	Express server request object, which includes information about 
     *                          		the HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    handleOAuthRequest: function(req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , client = this.model.clients[client_id]
            , Twitter = require("temboo/Library/Twitter/OAuth")
            , oauthChoreo = undefined
            , oauthInputs = undefined
            , self = this
            ; 

        console.log("[handleOAuthRequest]  client id ", client_id)
        console.log("[handleOAuthRequest] current client's model: ", this.model.clients[client_id])

        // handle first step of the OAuth authentication flow
		if (!this.model.clients[client.id].auth.oath_started) {
            console.log("[authTemboo] step 1 - client id ", client.id)

			oauthChoreo = new Twitter.InitializeOAuth(self.session);

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('TwitterSpacebrewForwarder');
			oauthInputs.set_ForwardingURL("http://localhost:8002/tweet/auth?client_id=" + client.id)

			var intitializeOAuthCallback = function(results){
			    	console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizationURL());
			    	self.model.clients[client_id].auth.auth_token_secret = results.get_OAuthTokenSecret();
			    	self.model.clients[client_id].auth.callback_id = results.get_CallbackID();
			    	self.model.clients[client.id].auth.oath_started = true;
			    	res.redirect(results.get_AuthorizationURL());		    		
			    }

			oauthChoreo.execute(
			    oauthInputs,
			    intitializeOAuthCallback,
			    function(error){console.log("start OAuth", error.type); console.log(error.message);}
			);
		}

        // handle second step of the OAuth authentication flow
		else {
            console.log("[authTemboo] step 2 - client id ", client.id)

		    oauthChoreo = new Twitter.FinalizeOAuth(self.session)

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('TwitterSpacebrewForwarder');
			oauthInputs.set_CallbackID(self.model.clients[client_id].auth.callback_id);
			oauthInputs.set_OAuthTokenSecret(self.model.clients[client_id].auth.auth_token_secret);

			var finalizeOAuthCallback = function(results){
		    	console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
		    	self.model.clients[client_id].auth.access_token = results.get_AccessToken();
		    	self.model.clients[client_id].auth.access_token_secret = results.get_AccessTokenSecret();

	            client = self.model.clients[client_id];
	            res.render('twitter_update',
	                { 
						"title" : "Tweets in Space"           
						, "subTitle" : "forwarding tweets to spacebrew"
						, "clientId" : client.id
						, "authConfirm" : true
						, "queryStr" : client.query_str
	                }
	            )                                            
		    }

			// Run the choreo, specifying success and error callback handlers
			oauthChoreo.execute(
			    oauthInputs,
			    finalizeOAuthCallback,
			    function(error){console.log("final OAuth", error.type); console.log(error.message);}
			);
		} 
    },

    /**
     * Callback function that handles ajax requests for making tweets. The query string 
     *  in the URL for each request includes a client id and the tweet. 
     * 	A reply callback method is added to the client object. This method 
     * 	is used by the tweetTemboo function to respond to the ajax request once 
     * 	it receives a response from the twitter server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about 
     *                          		the HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    handleStatusUpdate: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))      // convert string to json (unescape to convert string format first)
            // , client                                       // will hold client object
            , update = ""
            ;


        console.log("[handleStatusUpdate] json update ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/tweet"); 
        } 

        // make sure that the required query attributes are included in request
        if (queryJson.data.required) {
			for (var attr in queryJson.data.required) {
				if (!queryJson.data.required[attr].available) {
					console.log("[handleQueryRequest] required attribute " + queryJson.data.required[attr] + " not available");
					return;
				}
			}
		}

		update = queryJson.data.required.tweet.update;
		if (update > 140) {
			update = update.substring(0, 140);
		}
		console.log("[handleQueryRequest] update text ", queryJson.data.required.tweet);
		console.log("[handleQueryRequest] update text ", update);

        this.model.clients[queryJson.id].updates.push(update);

        // create the callback function to respond to request once data has been received from twitter
        this.model.clients[queryJson.id].reply = function(data) {
            console.log("[handleStatusUpdate] callback method: ", data);
            res.end(data);                
        }

        // submit the query and client id to the query twitter app
        this.updateTemboo(queryJson.id, "reply");
    },

    /**
     * Submits tweets to twitter via the Temboo API engine. 
     * @param  {Integer} clientId     	Id of the client that submitted this query
     * @param  {String} callbackName 	Name of callback method that should be called when results data
     *                                	is received. If none is proved then it will default to reply.
     */
    updateTemboo: function (clientId, callbackName) {
        var tweet = this.model.clients[clientId].updates[this.model.clients[clientId].updates.length-1]
            , callbackName = callbackName || "reply"
            , self = this
        	, Twitter = require("temboo/Library/Twitter/Tweets")
			, queryChoreo = new Twitter.StatusesUpdate(self.session)
			, queryInputs = queryChoreo.newInputSet()
            ;

        // abort search if query (held in searchT) is not a valid string
        if (!this.isString(tweet)) {
	        console.log("[updateTemboo] tweet not valid: ", tweet);
	        return;    // return if search term not valid
	    }

        console.log("[updateTemboo] new to be made made: ", tweet);

        // prepare the query by adding authentication elements
		queryInputs.setCredential("TwitterSpacebrewForwarderConsumerKeySecret");
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_AccessTokenSecret(this.model.clients[clientId].auth.access_token_secret);

		// configure query with search term and other info
        queryInputs.set_StatusUpdate(tweet);             // setting the search query    
 
        /**
         * Method that is called by the temboo API when the results from 
         *  twitter are returned. It process the data and calls the client's 
         *  handler method to forward the data back to the front end
         *  
         * @param {Temboo Results Obect} results 	Results from Temboo Twitter service query
         */
        var successCallback = function( results ) {
            var tResults = JSON.parse(results.get_Response())
            	, vals = ""
            	;

            // if the response includes one or more tweets then process it
            if (tResults.text) {
				console.log( "[successCallback:updateTemboo] tweeted successfully: ", tResults.text );
				if (self.model.clients[clientId][callbackName]) {
					new_tweet = { "tweet" : tResults.text };
					var reply_obj = { "list" : [new_tweet] , "state": "success"};
					self.model.clients[clientId][callbackName](JSON.stringify(reply_obj));
				}
			}
		};

        // Run the choreo, passing the success and error callback handlers
        queryChoreo.execute(
            queryInputs,
            successCallback,
            function(error) {console.log(error.type); console.log(error.message);}
        );
    },

    /**
     * isString 	Check whether an object is a string
     * @param  {Object}  obj 	Object that will be checked to confirm whether it is a string
     * @return {Boolean}     	Returns true if the object was a string. False otherwise.
     */
    isString: function (obj) {
        return toString.call(obj) === '[object String]';
    }
}
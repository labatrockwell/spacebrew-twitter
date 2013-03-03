module.exports = {
    model: {
		"curClientId": 0,
	    "auth" : {
	    	"consumer_key" : "",
	        "consumer_secret" : "",	    	
	    },
    	"clients" : {}
    },

    session: {},

    init: function( config ) {
        this.session = config["session"];
        if (config["auth"]) {
            this.model.auth = config["auth"];
        }
        return this;
    },

    /**
     * newClient 	Increments the curClientId and then add a new client to the this.model.clients object, assigning
     *     			to it the new client id.
     * @param  {Object} config  	Configuration object with an application name
     * @return {this.model.Client}  Returns the client object that was just created
     */
    newClient: function () {
        this.model.curClientId++;
        var clientId = this.model.curClientId;
        this.model.clients[clientId] = {
            "id": clientId,
            "query": "",
            "request": {},
            "results": {},
            "lastId": 0,
            "reply": undefined,
            "geo": {
                "lat": 0,
                "long": 0,
                "radius": 0,
                "available": "false"
            },
            "auth": {
                "auth_token_secret": "",
                "callback_id" : "" ,
                "access_token": "",
                "access_token_secret": "",
                "oath_started": false
            }, 
            "query_str": {
            	"server": "sandbox.spacebrew.cc",
            	"port": 9000,
            	"name": "space tweets",
            	"description": "forwards tweets to spacebrew",
            	"refresh": undefined
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

        console.log("[authTemboo] loaded query string settings ", this.model.clients[client.id].query_str)

        res.render('twitter_no_auth',
            { 
                "title" : "Tweets in Space"           
                , "subTitle" : "forwarding tweets to spacebrew"
                , "clientId" : client.id
                , "authConfirm" : false
                , "queryStr" : client.query_str
            }
        )                                
    },

    handleOAuthRequest: function(req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , client = this.model.clients[client_id]
            , Twitter = require("temboo/Library/Twitter/OAuth")
            , oauthChoreo = undefined
            , oauthInputs = undefined
            , self = this
            ; 

        console.log("[authTemboo] received auth request ", urlReq)
        console.log("[authTemboo] models client ", this.model.clients[client_id])

        // handle first step of the OAuth authentication flow
		if (!this.model.clients[client.id].auth.oath_started) {
            console.log("[authTemboo] step 1 - client id ", client.id)

			oauthChoreo = new Twitter.InitializeOAuth(self.session);

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('TwitterSpacebrewForwarder');
			oauthInputs.set_ForwardingURL("http://localhost:8002/twitter/auth?client_id=" + client.id)

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
	            res.render('twitter',
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
     * handleQueryRequest 	Callback function that handles ajax requests for tweets. The query string 
     * 						in the URL for each request includes a client id and a twitter query term. 
     * 						These are used to make the appropriate request to the twitter server, via 
     * 						Temboo. A reply callback method is added to the client object. This method 
     * 						is used by the queryTemboo function to respond to the ajax request once it 
     * 						receives a response from the twitter server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about 
     *                          		the HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    handleQueryRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            // , query = urlReq.search.replace(/\?/, "")       // get query string from URL request, remove the leading '?'
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))      // convert string to json (unescape to convert string format first)
            , client                                       // will hold client object
            ;

        console.log("[handleQueryRequest] json query ", queryJson)

        // if the client id is not defined or the client does not exist, then create a new client
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            client = this.newClient();
            queryJson.id = client.id;
        } 

        this.model.clients[queryJson.id].request = this.model.clients[queryJson.id];

        // make sure that the incoming request includes a text query
        if (queryJson.data.required.query.text) {
            console.log("[handleQueryRequest] Valid query from id: " + queryJson.id + ", query : " + queryJson.data.required.query.text);        

            // check if this query differs from the current one, if so then re-initialize the lastId, and query vars
            if ((this.model.clients[queryJson.id].query !== queryJson.data.required.query.text)) {
                console.log("[handleQueryRequest] Query is new");        
                this.model.clients[queryJson.id].lastId = 0;
                this.model.clients[queryJson.id].query = queryJson.data.required.query.text;
            }

            // if query includes geo filter, then process it
            if (queryJson.data.optional.geo) {
                // check if any of the geo filter attributes have changed then update the client object 
                if ((queryJson.data.optional.geo.lat != this.model.clients[queryJson.id].geo.lat) || 
                    (queryJson.data.optional.geo.long != this.model.clients[queryJson.id].geo.long) ||
                    (queryJson.data.optional.geo.radius != this.model.clients[queryJson.id].geo.radius) ||
                    (queryJson.data.optional.geo.available != this.model.clients[queryJson.id].geo.available)) 
                {
                    console.log("[handleQueryRequest] Geocode included : ", queryJson.data.optional.geo);        
                    this.model.clients[queryJson.id].geo.lat = queryJson.data.optional.geo.lat;
                    this.model.clients[queryJson.id].geo.long = queryJson.data.optional.geo.long;
                    this.model.clients[queryJson.id].geo.radius = queryJson.data.optional.geo.radius;
                    this.model.clients[queryJson.id].geo.available = queryJson.data.optional.geo.available;                
                    this.model.clients[queryJson.id].lastId = 0;     // reset last ID to 0
                }
            }

            // create the callback function to respond to request once data has been received from twitter
            this.model.clients[queryJson.id].reply = function(data) {
                console.log("[handleQueryRequest] callback method: ", data);
                res.end(data);                
            }

            // submit the query and client id to the query twitter app
            this.queryTemboo(queryJson.id, "reply");
        }
    },

    /**
     * queryTemboo 	Submits twitter queries to via the Temboo API engine. 
     * @param  {Integer} clientId     	Id of the client that submitted this query
     * @param  {String} callbackName 	Name of callback method that should be called when results data
     *                                	is received. If none is proved then it will default to reply.
     */
    queryTemboo: function (clientId, callbackName) {
        var searchT = this.model.clients[clientId].query
            , geocodeT = this.model.clients[clientId].geo
            , geocodeString = undefined
            , callbackName = callbackName || "reply"
            , self = this
        	, Twitter = require("temboo/Library/Twitter/Search")
			, queryChoreo = new Twitter.Tweets(self.session)
			, queryInputs = queryChoreo.newInputSet()
            ;

        console.log("[queryTemboo] new request made: ", searchT);
        // console.log("[queryTemboo] geocode: ", geocodeT);

        // abort search if query (held in searchT) is not a valid string
        if (!this.isString(searchT)) return;    // return if search term not valid

        // request a temboo choreo object to execute query
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_AccessTokenSecret(this.model.clients[clientId].auth.access_token_secret);
		queryInputs.set_ConsumerSecret(this.model.auth.consumer_secret);
		queryInputs.set_ConsumerKey(this.model.auth.consumer_key);
        queryInputs.set_Query(searchT);             // setting the search query    
        queryInputs.set_SinceId(this.model.clients[clientId].lastId);
        queryInputs.set_IncludeEntities(true);      // request add'l metadata
 
        // if geocode available, then process it and add it to query
        if (geocodeT.available) {
            geocodeString = "" + this.model.clients[clientId].geo.lat 
                            + "," + this.model.clients[clientId].geo.long 
                            + "," + this.model.clients[clientId].geo.radius + "mi";
            queryInputs.set_Geocode(geocodeString);             // setting the search query
            console.log("[queryTemboo] geocode string: ", geocodeString);
        }

        /**
         * successCallback 	Method that is called by the temboo API when the results from 
         * 					twitter are returned. It process the data and calls the client's 
         * 					handler method to forward the data back to the front end
         * @param {Temboo Results Obect} results 	Results from Temboo Twitter service query
         */
        var successCallback = function(results) {
            var tResults = JSON.parse(results.get_Response()),
                newTweets = [],
                newTweet = {},
                vals = "";

            // console.log( "[successCallback:queryTemboo] query results reply: ", tResults );

            // if the response includes one or more tweets then process it
            if (tResults.statuses.length > 0) {
                console.log( "[successCallback:queryTemboo] response data array: ", tResults.statuses );

                // save results in the model
                self.model.clients[clientId].results = tResults.statuses;

                // loop through results to prepare data to send to front end
                for(var i = self.model.clients[clientId].results.length - 1; i >= 0; i--) {
                    if (self.model.clients[clientId].results[i].id > self.model.clients[clientId].lastId) {

                        newTweet = {
                            "user": unescape(self.model.clients[clientId].results[i].user.name)
                            , "text": unescape(self.model.clients[clientId].results[i].text)
                            , "created_at": unescape(self.model.clients[clientId].results[i].created_at)
                            , "id": self.model.clients[clientId].results[i].id
                            , "photo": self.model.clients[clientId].results[i].user.profile_image_url
                            , "lat": "not available"
                            , "long": "not available"
                        };

                        if (self.model.clients[clientId].results[i]["geo"]) {
                            if (self.model.clients[clientId].results[i].geo["coordinates"]) {
                                newTweet.lat = self.model.clients[clientId].results[i].geo.coordinates[0];
                                newTweet.long = self.model.clients[clientId].results[i].geo.coordinates[1];
                            }
                        }

                        newTweets.push(newTweet);

                        // update the id of the most recent message
                        self.model.clients[clientId].lastId = self.model.clients[clientId].results[i].id;
                    }
                }

                // call appropriate response methods for client that made request
                console.log("[successCallback:queryTemboo] new tweets: ", newTweets);
                if (self.model.clients[clientId][callbackName]) {
                    var reply_obj = {"list" : newTweets, "query": self.model.clients[clientId].query };
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
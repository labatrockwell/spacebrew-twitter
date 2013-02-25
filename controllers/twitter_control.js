module.exports = {
    model: {},
    session: {},

    init: function( config ) {
        this.session = config["session"];
        this.model = {
            "curClientId": 0,
            "clients": {}
        };
        return this;
    },

    /**
     * newClient Increments the curClientId and then add a new client to the this.model.clients object, assigning
     *     to it the new client id.
     * @param  {Object} config  Configuration object with an application name
     * @return {this.model.Client}   Returns the client object that was just created
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
            }
            "auth": {
                "access_token": "",
                "access_token_secret": ""
            }
        } 
        return this.model.clients[clientId];
    },

    /**
     * handleAppRequest Callback function that handles requests for the twitter app. These requests are parsed to
     *     extract the app name from the URL. Once that is done, a new client object is created and then the appropriate 
     *     page template is rendered. The client id, page title and subtitle are passed to the front-end page that is 
     *     being rendered.   
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleAppRequest: function (req, res) {
        var client = this.newClient();

    	res.render('twitter',
    		{ 
                title : "Tweets in Space"			
                , subTitle : "forwarding tweets to spacebrew"
                , clientId: client.id
    		}
    	)
    },

    /**
     * handleQueryRequest Callback function that handles ajax requests for tweets. The query string in the URL for 
     *     each request includes a client id and a twitter query term. These are used to make the appropriate request
     *     to the twitter server, via Temboo. A reply callback method is added to the client object. This method is used
     *     by the queryTemboo function to respond to the ajax request once it receives a response from the twitter server.
     *        
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
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

            // this.authTemboo(queryJson.id, "reply");
        }
    },

    authTemboo: function(clientId) {
        // request a temboo choreo object to execute query
        var self = this
        	, Twitter = require("temboo/Library/Twitter/Search")
			, initializeOAuthChoreo = new Twitter.InitializeOAuth(session)
			, initializeOAuthInputs = initializeOAuthChoreo.newInputSet()
			;

		initializeOAuthInputs.setCredential('TwitterSpacebrewForwarder');

		var intitializeOAuthCallback = function(results_start){
		    	console.log("initial OAuth successful");
			    var finalizeOAuthChoreo = new Twitter.FinalizeOAuth(session);
				var finalizeOAuthInputs = finalizeOAuthChoreo.newInputSet();
				finalizeOAuthInputs.setCredential('TwitterSpacebrewForwarder');
				finalizeOAuthInputs.set_CallbackID(results_start.get_CallbackID);
				finalizeOAuthInputs.set_OAuthTokenSecret(results_start.get_OAuthTokenSecret());

				var finalizeOAuthCallback = function(results_finish){
			    	console.log("finish OAuth successful");
			    	this.model.clients[clientId].auth.access_token = results_finish.get_AccessToken();
			    	this.model.clients[clientId].auth.access_token_secret = results_start.get_OAuthTokenSecret();
			    }

				// Run the choreo, specifying success and error callback handlers
				finalizeOAuthChoreo.execute(
				    finalizeOAuthInputs,
				    finalizeOAuthCallback,
				    function(error){console.log(error.type); console.log(error.message);}
				);
		    		
		    }

		initializeOAuthChoreo.execute(
		    initializeOAuthInputs,
		    intitializeOAuthCallback,
		    function(error){console.log(error.type); console.log(error.message);}
		);
 
    },

    /**
     * queryTemboo Function that submits twitter queries to via the Temboo API engine. 
     * @param  {Integer} clientId     Id of the client that submitted this query
     * @param  {String} callbackName Name of callback method that should be called when results data
     *                               is received. If none is proved then it will default to reply.
     */
    queryTemboo: function (clientId, callbackName) {
        var searchT = this.model.clients[clientId].query
            , geocodeT = this.model.clients[clientId].geo
            , geocodeString = undefined
            , callbackName = callbackName || "reply"
            , self = this
            ;

        console.log("[queryTemboo] new request made: ", searchT);
        console.log("[queryTemboo] geocode: ", geocodeT);

        // abort search if query (held in searchT) is not a valid string
        if (!this.isString(searchT)) return;    // return if search term not valid

        // request a temboo choreo object to execute query
        var Twitter = require("temboo/Library/Twitter/Search");

/*
		//////////////////////////////////////////////////////////
		// NEW CODE FOR HANDLING TWITTER SEARCHES - USING OAUTH2.0
        var queryChoreo = new Twitter.Tweets(self.session);
        var queryInputs = queryChoreo.newInputSet();

        queryInputs.setCredential('TwitterSpacebrewForwarderConsumerKeySecret');
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_AccessTokenSecret(this.model.clients[clientId].auth.access_token_secret);
        queryInputs.set_ResponseFormat("json");     // requesting response in json
        queryInputs.set_Query(searchT);             // setting the search query    
        queryInputs.set_SinceId(this.model.clients[clientId].lastId);
        queryInputs.set_IncludeEntities(true);      // request add'l metadata
 */

        var queryChoreo = new Twitter.Query(self.session);

        // Instantiate and populate the input set for the choreo
        var queryInputs = queryChoreo.newInputSet();
        queryInputs.set_ResponseFormat("json");     // requesting response in json
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

            // if the response includes a query and results then process it
            if (tResults.query && tResults.results) {
                console.log( "[successCallback:queryTemboo] query: " + tResults.query );
                console.log( "[successCallback:queryTemboo] results : ", tResults.results );

                // save results in the model
                self.model.clients[clientId].results = tResults.results;

                // loop through results to prepare data to send to front end
                for(var i = self.model.clients[clientId].results.length - 1; i >= 0; i--) {
                    if (self.model.clients[clientId].results[i].id > self.model.clients[clientId].lastId) {

                        newTweet = {
                            "user": self.model.clients[clientId].results[i].from_user
                            , "text": self.model.clients[clientId].results[i].text
                            , "created_at": self.model.clients[clientId].results[i].created_at
                            , "id": self.model.clients[clientId].results[i].id
                            , "photo": self.model.clients[clientId].results[i].profile_image_url
                            , "lat": "not available"
                            , "long": "not available"
                            // , "hashtags": self.model.clients[clientId].results[i].entities.hashtags
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
     * isString Function that checks whether an object is a string
     * @param  {Object}  obj Object that will be checked to confirm whether it is a string
     * @return {Boolean}     Returns true if the object was a string. False otherwise.
     */
    isString: function (obj) {
        return toString.call(obj) === '[object String]';
    }
}
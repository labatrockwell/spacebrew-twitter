module.exports = {
    request: require("request"),    // link to http request library
    session: {},                    // link to active temboo session
    model: {                        // holds app configuration and current state information
        "curClientId": 0,
        "clients": {},
        "auth": {
            "client_id" : "",
            "client_secret" : "",
            "redirect_url" : "",
            "request_code_url" : "",
            "response_type" : "",
            "request_token_url" : "",
            "grant_type" : "",
            "code" : "",
            "access_token" : "",
            "query_str" : ""
        }
    },

    /**
     * init Method that initializes the 
     * @param  {Object} config  Configuration object that includes the auth settings and the 
     *                          session object.
     * @return {Object}         Foursquare control object, if the config object was a valid
     *                          configuration object, otherwise it returns an empty object
     */
    init: function( config ) {
        if (config["session"] && config["auth"]) {
            this.session = config["session"];
            this.model = {
                "curClientId": 0,
                "clients": {},
            };
            if (config["auth"]) {
                this.model.auth = config["auth"];
            }
            console.log("[init:foursquareControl] successfully configured fourquare controller")
            return this;            
        } else {
            console.log("[init:foursquareControl] unable to configure fourquare controller")
            return {};        
        }
    },

    /**
     * newClient Increments the curClientId and then add a new client to the this.model.clients object, assigning
     *     to it the new client id.
     * @param  {Object} config      Configuration object with an application name
     * @return {Object}             Returns the client object that was just created
     */
    newClient: function (config) {
        this.model.curClientId++;               // update curClientId number
        var clientId = this.model.curClientId;  // assign id number for current client
        this.model.clients[clientId] = {        // initialize the current client object
            "id": clientId,
            "query": "",
            "results": {},
            "afterTimeStamp": 0,
            "reply": undefined,
            "geo": {
                "lat": 0,
                "long": 0,
                "available": false
            },
            "auth": {
                "code": "",
                "access_token": ""
            }
        } 
        return this.model.clients[clientId];    // return reference to current client object
    },

    /**
     * handleAppRequest Callback function that handles requests for the foursquare app. These requests 
     *     are parsed to extract the client_id, app name, server and description from the query string. 
     *     If this is an unathenticated request then new client is created and the authentication page 
     *     template is rendered, featuring a button that takes the user to log-in to foursquare. 
     *     Otherwise, the logged-in page is rendered, which features the query input boxes.  
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleAppRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , client
            ;

        console.log("[handleAppRequest] received app request query ", urlReq.query)

        // handle non-authorized clients by rendering the non-authorized page template
        if ((client_id == -1) || !this.model.clients[client_id] || this.model.clients[client_id].auth.access_token === "") {
            client = this.newClient();
            console.log("[handleAppRequest] unathorized user - page loading - created new client with id: ", client.id)

            res.render('foursquare_no_auth',
                { 
                    title : "Foursquare in Space"           
                    , subTitle : "forwarding check-ins to spacebrew"
                    , clientId : client.id
                }
            )                                
        }

        // handle authorized clients by rendering the logged-in page template
        else {
            client = this.model.clients[client_id];
            console.log("[handleAppRequest] athorized user - page loading - for client with id: ", client.id)
            res.render('foursquare',
                { 
                    title : "Foursquare in Space"           
                    , subTitle : "forwarding check-ins to spacebrew"
                    , clientId : client.id
                }
            )                                            
        }
    },

    /**
     * handleAuthenticationReq Callback method that handles all Oauth 2.0 authorization-related requests 
     *                         for the foursquare app. There are three different types of requests that it
     *                         handles:
     *                             1. Initial authorization requests are made when users click on the 
     *                                log-in to foursquare button on the non-authorized user page. These
     *                                requests are redirected to the appropriate foursquare API log-in page. 
     *                             2. Initial authorization response are made by the foursquare Oauth API
     *                                when a user logs-in to foursquare after being redirect in step 1. 
     *                                These responses contain a "code" in the query string. 
     *                             3. When the "code" is received, we need to make a second request to another
     *                                foursquare API endpoint to acquire an "access_token". Since the user
     *                                does not need to be redirected, http request is handled by server. This 
     *                                access token is used to make queries to the foursquare API via Temboo.  
     *                      
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleAuthenticationReq: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , server = urlReq.query['server'] || undefined
            , name = urlReq.query['name'] || undefined
            , description = urlReq.query['description'] || undefined
            , refresh = urlReq.query['refresh'] || undefined
            , query_str = "" 
            , auth_req = ""
            , self = this
            , client = undefined
            ; 
            console.log("[handleAuthenticationReq] received auth request ", urlReq)

        // create the query string that will be appended to the redirect urls
        if (client_id > 0) client = this.model.clients[client_id];
        else client = this.newClient();
        query_str = "client_id=" + client_id 
        if (server) query_str += "&server=" + server        
        if (name) query_str += "&name=" + name;
        if (description) query_str += "&description=" + description;
        if (refresh) query_str += "&refresh=" + refresh;
        this.model.clients[client.id].auth.query_str = query_str;
        console.log("[handleAuthenticationReq] created query string ", query_str)

        // if we received an authentication code then let's request a token
        if (urlReq.query["code"]) {
            // save the authentication code
            this.model.clients[client.id].auth.code = urlReq.query["code"];
            console.log("[handleAuthenticationReq] saved client auth code ", this.model.clients[client.id].auth.code)

            // prepare the access token request url
            auth_req = this.model.auth.request_token_url
                    + "?client_id=" + escape(this.model.auth.client_id)
                    + "&client_secret=" + escape(this.model.auth.client_secret)
                    + "&grant_type=" + escape(this.model.auth.grant_type)
                    + "&redirect_uri=" + escape(this.model.auth.redirect_url + "?" + query_str)
                    + "&code=" + escape(this.model.clients[client.id].auth.code);

            // make a http request for the access token
            this.request(auth_req, function(error, response, body) {
                // handle errors
                if (error) { 
                    console.log("error msg ", error)
                // send response body to be processed
                } else {
                    self.handleTokenResponse(body, res, client.id);
                }
            });
        }

        // if no authentication code was received then this is an initial authorization request.
        else {
            // Redirect user to foursquare log-in.
            res.redirect( this.model.auth.request_code_url
                         + "?client_id=" + escape(this.model.auth.client_id)
                         + "&response_type="  + escape(this.model.auth.response_type)
                         + "&redirect_uri=" + escape(this.model.auth.redirect_url + "?" + query_str));            
        }
    },

    /**
     * handleTokenResponse Callback method that handles response from the foursquare API to access token 
     *                     requests. These requests are the second step in the Oauth 2.0 authorization 
     *                     process. These responses feature an "access_token" that is stored in the appropriate
     *                     client for use in query requests to foursquare.
     * @param  {Object} req     HTTP response body
     * @param  {Object} res     Full HTTP response
     * @param  {Integer} id     Client id of the client that is associated to this authorization request
     */
    handleTokenResponse: function(body, res, id ) {
        // convert body of message to json variable
        var body_json = JSON.parse(unescape(body))
            , main_page
            ;

        console.log("[handleTokenResponse] converted to json: ", body_json);

        // check json object for access token attribute
        if(body_json["access_token"]) {
            this.model.auth.access_token = body_json["access_token"];
            this.model.clients[id].auth.access_token = body_json["access_token"];
            console.log("[handleTokenRequest] received auth token ", this.model.clients[id].auth.access_token)
            res.redirect('/foursquare?' + this.model.clients[id].auth.query_str);
        }
    },

    /**
     * handleQueryRequest Callback function that handles ajax requests for new content. The query string in the URL for 
     *     each request includes a client id and optional params, such as long and latitude. These are used to make the 
     *     appropriate request to foursquare via Temboo. A reply callback method is added to the client object. This 
     *     method is used by the queryTemboo function to respond to the ajax request once it receives a response from 
     *     the foursquare server.
     *        
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleQueryRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , query = urlReq.search.replace(/\?/, "")       // get query string from URL request, remove the leading '?'
            , queryJson = JSON.parse(unescape(query))       // convert string to json (unescape to convert string format first)
            , client                                        // will hold client object
            ;

        console.log("[handleQueryRequest] query string in json: ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/foursquare"); 
        } 

        // if geo filter data is available, then store it in the appropriate client
        if (queryJson.data.optional.geo) {
            // if any of the geo filter attributes have changed then update the client object 
            if ((queryJson.data.optional.geo.lat != this.model.clients[queryJson.id].geo.lat) || 
                (queryJson.data.optional.geo.long != this.model.clients[queryJson.id].geo.long) ||
                (queryJson.data.optional.geo.available != this.model.clients[queryJson.id].geo.available)) 
            {
                console.log("[handleQueryRequest] geocode included : ", queryJson.geo);        
                this.model.clients[queryJson.id].geo.lat = queryJson.data.optional.geo.lat;
                this.model.clients[queryJson.id].geo.long = queryJson.data.optional.geo.long;
                this.model.clients[queryJson.id].geo.available = queryJson.data.optional.geo.available;                
                this.model.clients[queryJson.id].afterTimeStamp = 0;     // reset last ID to 0
            }
        }

        // // set the ajax_req flag to true and create the callback function
        this.model.clients[queryJson.id].reply = function(data) {
            console.log("[reply:handleQueryRequest] callback method, rendering data: ", data);
            res.end(data);                
        }

        this.queryTemboo(queryJson.id, "reply");
    },

    /**
     * queryTemboo Function that submits foursquare API requests via the Temboo API engine. 
     * @param  {Integer}    clientId        Id of the client that submitted this query
     * @param  {String}     callbackName    Name of callback method that should be called when results data
     *                                      is received. If none is proved then it will default to reply.
     */
    queryTemboo: function (clientId, callbackName) {
        var searchT = this.model.clients[clientId].query
            , geocodeT = this.model.clients[clientId].geo
            , callbackName = callbackName || "reply"
            , self = this
            ;

        console.log("[queryTemboo] new request made: ", searchT);
        console.log("[queryTemboo] geocode: ", geocodeT);
        console.log("[queryTemboo] auth token: ",this.model.clients[clientId].auth.access_token)

        if (!this.isString(searchT)) return;    // return if search term not valid

        // set-up the temboo service connection
        var Foursquare = require("temboo/Library/Foursquare/Checkins");
        var queryChoreo = new Foursquare.RecentCheckins(this.session);
        
        // Instantiate and populate the input set for the choreo
        var queryInputs = queryChoreo.newInputSet();
        queryInputs.set_ResponseFormat("json");     // requesting response in json
        queryInputs.set_OauthToken(this.model.clients[clientId].auth.access_token);
        if (this.model.clients[clientId].geo.available) {
            console.log("[queryTemboo] geo code data available: ");
            queryInputs.set_Latitude(this.model.clients[clientId].geo.lat);     // requesting response in json
            queryInputs.set_Longitude(this.model.clients[clientId].geo.long);     // requesting response in json            
        }
        queryInputs.set_AfterTimeStamp(this.model.clients[clientId].createdAt);

        /**
         * successCallback Method that is called by the temboo API when the results from twitter are
         *     returned. It process the data and calls the client's handler method to forward the
         *     data back to the front end
         * @param  {Temboo Results Obect} results Results from Temboo Twitter service query
         */
        var successCallback = function(results) {
            var tResults = JSON.parse(results.get_Response())
                , checkIns = []
                , newCheckIn = {} 
                ;

            // console.log( "[successCallback] results received - string: ", results.get_Response() );
            console.log( "[successCallback:queryTemboo] results received - json: ", tResults );

            // check if results received by verifying that tResults object contains a response.recent attribute
            if (tResults["response"]) {
                if (tResults.response["recent"]) {

                    // store the results in the appropriate client
                    self.model.clients[clientId].results = tResults.response["recent"];

                    // loop through each check-in to parse and store the data
                    for(var i = tResults.response["recent"].length - 1; i >= 0; i--) {
                        // if this is a new check in then process it
                        if (self.model.clients[clientId].results[i].createdAt > self.model.clients[clientId].afterTimeStamp) {
                            newCheckIn = {
                                "user": tResults.response["recent"][i].user.firstName + " " + tResults.response["recent"][i].user.lastName,
                                "photo": tResults.response["recent"][i].user.photo,
                                "venue": tResults.response["recent"][i].venue.name,
                                "address": tResults.response["recent"][i].venue.location.address,
                                "lat": tResults.response["recent"][i].venue.location.lat,
                                "long": tResults.response["recent"][i].venue.location.lng,
                                "city": tResults.response["recent"][i].venue.location.city,
                                "state": tResults.response["recent"][i].venue.location.state,
                                "country": tResults.response["recent"][i].venue.location.country,
                                "checkinsCount": tResults.response["recent"][i].venue.stats.checkinsCount,
                                "createdAt": tResults.response["recent"][i].createdAt,
                                "id": tResults.response["recent"][i].createdAt,
                                // "source": tResults.response["recent"][i].source.name,
                                // "id": tResults.response["recent"][i].id
                            };
                            console.log( "[successCallback:queryTemboo] new check-in created, index number: " + i, newCheckIn);

                            // add new checkin to checkIns array
                            checkIns.push(newCheckIn);

                            // update the id of the most recent message
                            self.model.clients[clientId].afterTimeStamp = self.model.clients[clientId].results[i].createdAt;
                        }
                    }

                }

                // call appropriate response methods for client that made request
                if (self.model.clients[clientId][callbackName]) {
                    var reply_obj = { "list" : checkIns };
                    console.log("\n[successCallback:queryTemboo] sending json response: ", JSON.stringify(reply_obj));
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
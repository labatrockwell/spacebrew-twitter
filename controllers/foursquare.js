module.exports = {
    request: require("request"),

    model: {
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
            "access_token" : ""
        }
    },
    session: {},

    init: function( config ) {
        this.session = config["session"];
        this.model = {
            "curClientId": 0,
            "clients": {},
        };
        if (config["auth"]) {
            this.model.auth = config["auth"];
        }
        return this;
    },

    /**
     * newClient Increments the curClientId and then add a new client to the this.model.clients object, assigning
     *     to it the new client id.
     * @param  {Object} config  Configuration object with an application name
     * @return {this.model.Client}   Returns the client object that was just created
     */
    newClient: function (config) {
        this.model.curClientId++;
        var clientId = this.model.curClientId;
        this.model.clients[clientId] = {
            "id": clientId,
            "query": "",
            "results": {},
            "afterTimeStamp": 0,
            "reply": undefined,
            "geo": {
                "lat": 0,
                "long": 0,
                "radius": 0,
                "available": "false"
            },
            "auth": {
                "code": "",
                "access_token": ""
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
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1;

        console.log("[handleAppRequest] received app request ", urlReq)


        if (client_id == -1) {
            res.render('foursquare_no_auth',
                { 
                    title : "Foursquare in Space"           
                    , subTitle : "forwarding check-ins to spacebrew"
                    , clientId : client_id
                }
            )                                
        }

        else {
            res.render('foursquare',
                { 
                    title : "Foursquare in Space"           
                    , subTitle : "forwarding check-ins to spacebrew"
                    , clientId : client_id
                }
            )                                            
        }
    },

    /**
     * handleAuthenticationReq 
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleAuthenticationReq: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , auth_req = ""
            , self = this
            , client = self.newClient()
            ; 

        console.log("[handleAuthenticationReq] received auth request ", urlReq)

        // if we received an authentication code back then let's request a token
        if (urlReq.query["code"]) {
            // save the authentication code
            this.model.auth.code = urlReq.query["code"];
            this.model.clients[client.id].auth.code = urlReq.query["code"];
            console.log("[handleAuthenticationReq] saved general auth code ", this.model.auth.code)
            console.log("[handleAuthenticationReq] saved client auth code ", this.model.clients[client.id].auth.code)

            // prepare the access token request url
            auth_req = this.model.auth.request_token_url
                    + "?client_id=" + this.model.auth.client_id
                    + "&client_secret=" + this.model.auth.client_secret
                    + "&grant_type=" + this.model.auth.grant_type
                    + "&redirect_uri=" + this.model.auth.redirect_url
                    + "&code=" + this.model.clients[client.id].auth.code;

            // make a http request for the access token
            this.request(auth_req, function(error, response, body) {
                // handle errors
                if (error) console.log("error msg ", error)

                // send response body to be processed
                else self.handleTokenResponse(body, res, client.id);
            });
        }

        else {
            res.redirect( this.model.auth.request_code_url
                         + "?client_id=" + this.model.auth.client_id
                         + "&response_type="  + this.model.auth.response_type
                         + "&redirect_uri=" + this.model.auth.redirect_url);            
        }
    },

    handleTokenResponse: function(body, res, id) {
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
            res.redirect('/foursquare?client_id=' + id);
        }
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
            , query = urlReq.search.replace(/\?/, "")       // get query string from URL request, remove the leading '?'
            , queryJson = JSON.parse(unescape(query))      // convert string to json (unescape to convert string format first)
            , client                                       // will hold client object
            ;

        console.log("[handleQueryRequest] json query ", queryJson)

        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            client = this.newClient();
            queryJson.id = client.id;
        } 

        // if the query object featured a valid query then process it
        if (queryJson.query) {
            console.log("Valid query from id: " + queryJson.id + ", query : " + queryJson.query);        

            // if this is a different query
            // if (!(this.model.clients[queryJson.id].query === queryJson.query)) {
            //     console.log("Query is new");        
            //     this.model.clients[queryJson.id].afterTimeStamp = 0;
            //     this.model.clients[queryJson.id].query = queryJson.query;
            // }

            // // if queryJson object includes a geo object
            // if (queryJson.geo) {
            //     // if any of the geo filter attributes have changed then update the client object 
            //     if ((queryJson.geo.lat != this.model.clients[queryJson.id].geo.lat) || 
            //         (queryJson.geo.long != this.model.clients[queryJson.id].geo.long) ||
            //         (queryJson.geo.radius != this.model.clients[queryJson.id].geo.radius) ||
            //         (queryJson.geo.available != this.model.clients[queryJson.id].geo.available)) 
            //     {
            //         console.log("Geocode included : ", queryJson.geo);        
            //         this.model.clients[queryJson.id].geo.lat = queryJson.geo.lat;
            //         this.model.clients[queryJson.id].geo.long = queryJson.geo.long;
            //         this.model.clients[queryJson.id].geo.radius = queryJson.geo.radius;
            //         this.model.clients[queryJson.id].geo.available = queryJson.geo.available;                
            //         this.model.clients[queryJson.id].afterTimeStamp = 0;     // reset last ID to 0
            //     }
            // }

            // submit the query and client id to the query twitter app
        }

        // // set the ajax_req flag to true and create the callback function
        this.model.clients[queryJson.id].reply = function(data) {
            console.log("[this.model.clients[queryJson.id].reply] callback method: ", data);
            res.end(data);                
        }

        this.queryTemboo(queryJson.id, "reply");
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
        console.log("[queryTemboo] auth token: ",this.model.clients[clientId].auth.access_token)

        if (!this.isString(searchT)) return;    // return if search term not valid

        // set-up the temboo service connection
        var Foursquare = require("temboo/Library/Foursquare/Checkins");
        var queryChoreo = new Foursquare.RecentCheckins(this.session);
        
        // Instantiate and populate the input set for the choreo
        var queryInputs = queryChoreo.newInputSet();
        queryInputs.set_ResponseFormat("json");     // requesting response in json
        queryInputs.set_OauthToken(this.model.clients[clientId].auth.access_token);
        queryInputs.set_Latitude(40.7142);     // requesting response in json
        queryInputs.set_Longitude(-74.0064);     // requesting response in json
        // queryInputs.set_AfterTimeStamp(this.model.clients[clientId].afterTimeStamp);

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

            if (tResults["response"]) {
                if (tResults.response["recent"]) {
                    console.log( "[successCallback:queryTemboo] results received");
                    self.model.clients[clientId].results = tResults.response["recent"];
                        for(var i = tResults.response["recent"].length - 1; i >= 0; i--) {
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
                                // "source": tResults.response["recent"][i].source.name,
                                "id": tResults.response["recent"][i].id
                            };
                            console.log( "[successCallback:queryTemboo] element " + i, newCheckIn);

                            checkIns.push(newCheckIn);

                            // update the id of the most recent message
                            self.model.clients[clientId].afterTimeStamp = self.model.clients[clientId].results[i].createdAt;
                        }
                    }

                }

                // call appropriate response methods for client that made request
                console.log("[successCallback:queryTemboo] new checkIns: ", JSON.stringify(checkIns));
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
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
            "access_token" : "",
            "query_str" : ""
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
            , client_id = urlReq.query['client_id'] || -1
            , server = urlReq.query['server'] || "localhost"
            , name = urlReq.query['name'] || "empty"
            , description = urlReq.query['description'] || "empty"
            , client
            ;

        console.log("[handleAppRequest] received app request query ", urlReq.query)

        // handle non-authorized clients
        if ((client_id == -1) || !this.model.clients[client_id]) {
            client = this.newClient();
            console.log("[handleAppRequest] creating new client with id ", client.id)

            res.render('foursquare_no_auth',
                { 
                    title : "Foursquare in Space"           
                    , subTitle : "forwarding check-ins to spacebrew"
                    , clientId : client.id
                }
            )                                
        }

        // handle authorized clients
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
            , client_id = urlReq.query['client_id'] || -1
            , server = urlReq.query['server'] || undefined
            , name = urlReq.query['name'] || undefined
            , description = urlReq.query['description'] || undefined
            , query_str = "" 
            , auth_req = ""
            , self = this
            , client = undefined
            ; 

        console.log("[handleAuthenticationReq] received app request query ", urlReq.query)

        if (client_id > 0) client = this.model.clients[client_id];
        else client = this.newClient();
        query_str = "client_id=" + client_id 

        if (server) query_str += "server=" + server        
        if (name) query_str += "&name=" + name;
        if (description) query_str += "&description=" + description;

        this.model.clients[client.id].auth.query_str = query_str;

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
                    + "?client_id=" + escape(this.model.auth.client_id)
                    + "&client_secret=" + escape(this.model.auth.client_secret)
                    + "&grant_type=" + escape(this.model.auth.grant_type)
                    + "&redirect_uri=" + escape(this.model.auth.redirect_url + "?" + query_str)
                    + "&code=" + escape(this.model.clients[client.id].auth.code);

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
                         + "?client_id=" + escape(this.model.auth.client_id)
                         + "&response_type="  + escape(this.model.auth.response_type)
                         + "&redirect_uri=" + escape(this.model.auth.redirect_url + "?" + query_str));            
        }
    },

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
                                "id": tResults.response["recent"][i].createdAt,
                                // "source": tResults.response["recent"][i].source.name,
                                // "id": tResults.response["recent"][i].id
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
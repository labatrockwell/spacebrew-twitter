module.exports = {
    tAuth : {
    	"request_code_url" : "https://foursquare.com/oauth2/authenticate",
        "client_id" : "ADD_CLIENT_ID_FOR_YOUR_FOURSQUARE_APP",
        "response_type" : "code",

    	"request_token_url" : "https://foursquare.com/oauth2/access_token",
        "grant_type" : "authorization_code",
        "client_secret" : "ADD_CLIENT_SECRET_FOR_YOUR_FOURSQUARE_APP",
        
        "redirect_url" : "http://localhost:8002/foursquare/auth",
    }
};